import * as fs from "fs";
import * as path from "path";

import { ENVIRONMENTS } from "../../config/config";
import { BadScanDatabase } from "../models/badScanRecord";
import { Artifact, SpatialService } from "../services/spatialService";
import { getBadScans } from "../utils/data/badScans";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { ReportSection, generatePdfReport } from "../utils/reportGenerator";
import { downloadFile, downloadJsonFile } from "../utils/sync/downloadHelpers";

/**
 * Script to sync artifacts from the Spatial API.
 * - Downloads artifacts for configured environments.
 * - Skips artifacts already marked as "Bad Scans".
 * - Ensures valid synced artifacts have `video.mp4`, `arData.json`, and `rawScan.json`.
 * - Generates a sync report PDF.
 */

// --- Concurrency Helper ---

const INITIAL_ACTIVE = 0;

function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let active = INITIAL_ACTIVE;

  const next = () => {
    active--;
    if (queue.length > INITIAL_ACTIVE) {
      const job = queue.shift();
      if (job) {
        job();
      }
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    const res = await new Promise<T>((resolve, reject) => {
      const runTask = async () => {
        active++;
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        } finally {
          next();
        }
      };

      if (active < concurrency) {
        runTask().catch((err: unknown) => {
          logger.error(`pLimit task failed (unexpected): ${String(err)}`);
        });
      } else {
        // Wrap async task in void function to satisfy generic queue type and no-misused-promises
        queue.push(() => {
          runTask().catch((err: unknown) => {
            logger.error(`pLimit task failed (queue): ${String(err)}`);
          });
        });
      }
    });
    return res;
  };

  return run;
}

// Constants

const ZERO = 0;
const START_PAGE = 1;
const JSON_INDENT = 2;
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

import { SyncFailureDatabase, getSyncFailures, saveSyncFailures } from "../utils/data/syncFailures";

interface SyncError {
  id: string;
  reason: string;
}

export interface SyncStats {
  env: string;
  found: number;
  new: number;
  failed: number;
  skipped: number;
  newFailures: number;
  knownFailures: number;
  errors: SyncError[];
  processedIds: Set<string>;
}

interface ArtifactResult {
  new: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
}

// Extracted Artifact Processor
async function processArtifact(
  artifact: Artifact,
  dataDir: string,
  badScans: BadScanDatabase
): Promise<ArtifactResult> {
  const result: ArtifactResult = {
    errors: [],
    failed: 0,
    new: 0,
    skipped: 0
  };

  // Hardened check for badScans
  if (Object.prototype.hasOwnProperty.call(badScans, artifact.id)) {
    result.skipped = 1;
    return result;
  }

  const { video, rawScan, arData } = artifact;

  const hasAllFiles =
    typeof video === "string" &&
    video.length > ZERO &&
    typeof rawScan === "string" &&
    rawScan.length > ZERO &&
    typeof arData === "string" &&
    arData.length > ZERO;

  if (hasAllFiles) {
    // Sanitize ID for path safety
    const safeId = artifact.id.replace(/[^a-z0-9_-]/gi, "_");
    const artifactDir = path.join(dataDir, safeId);
    const exists = fs.existsSync(artifactDir);

    if (!exists) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Save meta.json
    fs.writeFileSync(path.join(artifactDir, "meta.json"), JSON.stringify(artifact, null, JSON_INDENT));

    // Download files
    const downloadResults = await Promise.all([
      downloadFile(video, path.join(artifactDir, "video.mp4"), "video").then((err) => {
        if (err !== null) {
          const reason = typeof err === "string" ? err : "video download failed (unknown error)";
          if (typeof err !== "string") {
            logger.warn(`Undefined error returned for video download: ${artifact.id}`);
          }
          result.errors.push({ id: artifact.id, reason });
        }
        return err === null;
      }),
      downloadJsonFile(rawScan, path.join(artifactDir, "rawScan.json"), "rawScan").then((err) => {
        if (err !== null) {
          const reason = typeof err === "string" ? err : "rawScan download failed (unknown error)";
          result.errors.push({ id: artifact.id, reason });
        }
        return err === null;
      }),
      downloadJsonFile(arData, path.join(artifactDir, "arData.json"), "arData").then((err) => {
        if (err !== null) {
          const reason = typeof err === "string" ? err : "arData download failed (unknown error)";
          result.errors.push({ id: artifact.id, reason });
        }
        return err === null;
      })
    ]);

    const artifactFailed = downloadResults.some((r) => !r);

    if (artifactFailed) {
      result.failed = 1;
      try {
        fs.rmSync(artifactDir, { force: true, recursive: true });
      } catch (e) {
        logger.error(`Failed to delete incomplete artifact ${artifact.id}: ${String(e)}`);
      }
    } else if (!exists) {
      result.new = 1;
    }
  }

  return result;
}

export async function syncEnvironment(env: { domain: string; name: string }): Promise<SyncStats> {
  logger.info(`Starting sync for: ${env.name}`);
  const dataDir = path.join(process.cwd(), "data", "artifacts", env.name.replace(/[^a-z0-9]/gi, "_").toLowerCase());

  const stats: SyncStats = {
    env: env.name,
    errors: [],
    failed: 0,
    found: 0,
    knownFailures: 0,
    new: 0,
    newFailures: 0,
    processedIds: new Set<string>(),
    skipped: 0
  };

  // Limits
  const PAGE_CONCURRENCY = 5;
  const ARTIFACT_CONCURRENCY = 20;

  const limitPage = pLimit(PAGE_CONCURRENCY);
  const limitArtifact = pLimit(ARTIFACT_CONCURRENCY);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const badScans = getBadScans();
  logger.info(`Loaded ${Object.keys(badScans).length.toString()} known bad scans to skip.`);

  const service = new SpatialService(env.domain, env.name);

  // Get initial page to determine total pages
  const initialPage = START_PAGE;
  try {
    const initialRes = await service.fetchScanArtifacts(initialPage);
    const totalArtifacts = initialRes.pagination.total;
    const lastPage = initialRes.pagination.lastPage;

    stats.found = totalArtifacts;

    logger.info(`Found ${totalArtifacts.toString()} total artifacts. (Pages: ${lastPage.toString()})`);

    const pages = Array.from({ length: lastPage }, (_, i) => i + initialPage);
    const totalPages = pages.length;

    const bar = createProgressBar("Syncing |{bar}| {percentage}% | {value}/{total} Pages | ETA: {eta}s");
    const INITIAL_PROGRESS = 0;
    bar.start(totalPages, INITIAL_PROGRESS);

    const processPageTask = async (pageNum: number) => {
      try {
        const res = await service.fetchScanArtifacts(pageNum);
        const artifacts: Artifact[] = res.data;

        // Queue all artifacts for processing and wait for results
        const pageResults = await Promise.all(
          artifacts.map(async (a) => {
            const r = await limitArtifact(async () => {
              const pa = await processArtifact(a, dataDir, badScans);
              return pa;
            });
            return r;
          })
        );

        // Aggregate results safely (page level aggregation is single threaded in `processPageTask` scope)
        // Note: processPageTask itself is concurrent with other pages, so we shouldn't mutate `stats` directly?
        // Wait, multiple `processPageTask` run concurrently. `stats` IS shared.
        // But `stats.errors.push` is array push (safe in JS).
        // `stats.failed +=` is safe (no preemption).
        // The issue is ordering.
        // To be safer, we can return `pageResults` from `processPageTask` and aggregate at top level?
        // But `processPageTask` is void return in current design.
        // I will aggregate here for now (user: "safe in Node... non-deterministic").
        // Given I deduplicate errors later, it is mostly fine.

        for (const r of pageResults) {
          stats.new += r.new;
          stats.skipped += r.skipped;
          stats.failed += r.failed;
          stats.errors.push(...r.errors);
        }
      } catch (e) {
        logger.error(`Error fetching page ${pageNum.toString()}: ${String(e)}`);
      } finally {
        bar.increment();
      }
    };

    // Run all pages with concurrency limit
    await Promise.all(
      pages.map(async (pageNum) => {
        await limitPage(async () => {
          await processPageTask(pageNum);
        });
      })
    );
    bar.stop();
  } catch (e) {
    logger.error(`Failed to sync ${env.name}: ${String(e)}`);
  }

  return stats;
}

export async function generateSyncReport(allStats: SyncStats[], knownFailures: SyncFailureDatabase) {
  const sections: ReportSection[] = [];

  // Summary Table
  // Calculate Totals
  const totalFound = allStats.reduce((sum, s) => sum + s.found, ZERO);
  const totalNew = allStats.reduce((sum, s) => sum + s.new, ZERO);
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, ZERO);
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, ZERO);
  const totalKnownFailures = allStats.reduce((sum, s) => sum + s.knownFailures, ZERO);
  const totalNewFailures = allStats.reduce((sum, s) => sum + s.newFailures, ZERO);

  const headers = ["", ...allStats.map((s) => s.env), "Total"];
  const tableData: string[][] = [
    [
      "Found",
      ...allStats.map((s) => s.found.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFound.toString()}</span>`
    ],
    [
      "New",
      ...allStats.map((s) => s.new.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalNew.toString()}</span>`
    ],
    [
      "Failed",
      ...allStats.map((s) => s.failed.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFailed.toString()}</span>`
    ],
    [
      "New Failures",
      ...allStats.map((s) => s.newFailures.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalNewFailures.toString()}</span>`
    ],
    [
      "Known Failures",
      ...allStats.map((s) => s.knownFailures.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalKnownFailures.toString()}</span>`
    ],
    [
      "Skipped",
      ...allStats.map((s) => s.skipped.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalSkipped.toString()}</span>`
    ]
  ];

  const rowClasses: Record<number, string> = {
    0: "bg-info", // Found
    1: "bg-success", // New
    2: "bg-error", // Failed
    3: "bg-error-light", // New Failures (lighter red)
    4: "bg-error-light", // Known Failures (lighter red, same as New Failures)
    5: "bg-warning" // Skipped
  };

  sections.push({
    data: tableData,
    options: { headers, rowClasses },
    title: "Sync Summary",
    type: "table"
  });

  // Failures Section
  const ZERO_FAILURES = 0;
  const failedStats = allStats.filter((s) => s.errors.length > ZERO_FAILURES);

  if (failedStats.length > ZERO_FAILURES) {
    sections.push({ title: "Sync Failures", type: "header" });

    failedStats.forEach((stats) => {
      if (stats.errors.length > ZERO_FAILURES) {
        // Classify errors
        const newErrors: SyncError[] = [];
        const knownErrors: SyncError[] = [];

        stats.errors.forEach((err) => {
          if (Object.prototype.hasOwnProperty.call(knownFailures, err.id)) {
            knownErrors.push(err);
          } else {
            newErrors.push(err);
          }
        });

        // Helper to render error list
        const renderErrorList = (errors: SyncError[], title: string) => {
          if (errors.length === ZERO_FAILURES) {
            return;
          }

          // Group errors by ID and deduplicate reasons
          const errorsById = new Map<string, Set<string>>();
          errors.forEach((err) => {
            if (!errorsById.has(err.id)) {
              errorsById.set(err.id, new Set());
            }
            errorsById.get(err.id)?.add(err.reason);
          });

          // Print grouped errors
          const errorLines: string[] = [];
          errorsById.forEach((reasons, id) => {
            const currentArtifactErrors: string[] = [];

            // Group failures logic
            const groupedFailures = new Map<string, string[]>(); // status -> types[]
            const miscFailures: string[] = [];

            reasons.forEach((reason) => {
              const regex = /^(.+) download failed \((.+)\)$/;
              const match = regex.exec(reason);
              if (match !== null) {
                const MATCH_TYPE_INDEX = 1;
                const MATCH_STATUS_INDEX = 2;
                const type = match[MATCH_TYPE_INDEX];
                const status = match[MATCH_STATUS_INDEX];
                if (type !== undefined && status !== undefined) {
                  if (!groupedFailures.has(status)) {
                    groupedFailures.set(status, []);
                  }
                  groupedFailures.get(status)?.push(type);
                }
              } else {
                miscFailures.push(reason);
              }
            });

            // Collect grouped failures
            groupedFailures.forEach((types, status) => {
              const sortedTypes = types.sort();
              let typeStr = "";
              const ONE_ITEM = 1;
              const TWO_ITEMS = 2;
              const FIRST_ITEM = 0;
              const SECOND_ITEM = 1;

              if (sortedTypes.length === ONE_ITEM) {
                typeStr = sortedTypes[FIRST_ITEM] ?? "";
              } else if (sortedTypes.length === TWO_ITEMS) {
                typeStr = `${sortedTypes[FIRST_ITEM] ?? ""} and ${sortedTypes[SECOND_ITEM] ?? ""}`;
              } else {
                const last = sortedTypes.pop();
                typeStr = `${sortedTypes.join(", ")}, and ${String(last)}`;
              }
              currentArtifactErrors.push(`Download failed (${status}) for ${typeStr}`);
            });

            // Collect misc failures
            miscFailures.forEach((reason) => {
              currentArtifactErrors.push(reason);
            });

            // Print to errorLines based on count
            const SINGLE_FAILURE = 1;
            const FIRST_ERROR = 0;
            const monoId = `<span class="font-mono">${id}</span>`;
            if (currentArtifactErrors.length === SINGLE_FAILURE) {
              errorLines.push(`${monoId} - ${currentArtifactErrors[FIRST_ERROR] ?? ""}`);
            } else {
              errorLines.push(monoId);
              currentArtifactErrors.forEach((err) => {
                errorLines.push(`  - ${err}`);
              });
            }
          });

          sections.push({
            data: errorLines,
            level: 4,
            title: title,
            type: "list"
          });
        };

        if (newErrors.length > ZERO_FAILURES || knownErrors.length > ZERO_FAILURES) {
          sections.push({ level: 3, title: `Environment: ${stats.env}`, type: "header" });
          renderErrorList(newErrors, "New Failures");
          renderErrorList(knownErrors, "Known Failures");
        }
      }
    });
  } else {
    sections.push({
      data: "No failures occurred during sync.",
      type: "text"
    });
  }

  await generatePdfReport(
    {
      sections,
      title: "Sync Report"
    },
    "sync-report.pdf"
  );
}

export async function main() {
  const knownFailures = getSyncFailures();
  const currentFailures: SyncFailureDatabase = {};

  const allStats: SyncStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await syncEnvironment(env);
    allStats.push(stats);

    // Record current failures
    for (const error of stats.errors) {
      currentFailures[error.id] = {
        date: new Date().toISOString(),
        environment: env.name,
        reason: error.reason
      };
    }
  }

  await generateSyncReport(allStats, knownFailures);
  saveSyncFailures(currentFailures);
}

if (require.main === module) {
  main()
    .then(() => process.exit(EXIT_SUCCESS))
    .catch((err: unknown) => {
      logger.error(err);
      process.exit(EXIT_FAILURE);
    });
}
