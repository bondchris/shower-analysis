import * as fs from "fs";
import * as path from "path";

import { ENVIRONMENTS } from "../../config/config";
import { BadScanDatabase } from "../models/badScanRecord";
import { SyncError, SyncStats } from "../models/syncStats";
import { ArtifactResponse, SpatialService } from "../services/spatialService";
import { buildSyncReport } from "../templates/syncReport";
import { getBadScans } from "../utils/data/badScans";
import { SyncFailureDatabase, getSyncFailures, saveSyncFailures } from "../utils/data/syncFailures";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";
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

/**
 * A concurrency limit helper (similar to `p-limit`).
 * Restricts the number of concurrent executions of the provided promise-returning function.
 * This ensures we don't overwhelm external APIs or file descriptors during batch processing.
 */
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

interface ArtifactResult {
  new: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
}

// Extracted Artifact Processor
async function processArtifact(
  artifact: ArtifactResponse,
  dataDir: string,
  badScans: BadScanDatabase
): Promise<ArtifactResult> {
  const result: ArtifactResult = {
    errors: [],
    failed: 0,
    new: 0,
    skipped: 0
  };

  const JSON_INDENT = 2;

  const ZERO = 0;

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
  const START_PAGE = 1;
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
        const artifacts: ArtifactResponse[] = res.data;

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

        // Aggregate results safely
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

    // Calculate failure stats
    const knownFailuresDb = getSyncFailures();
    stats.errors.forEach((err) => {
      if (Object.prototype.hasOwnProperty.call(knownFailuresDb, err.id)) {
        stats.knownFailures++;
      } else {
        stats.newFailures++;
      }
    });
  } catch (e) {
    logger.error(`Failed to sync ${env.name}: ${String(e)}`);
  }

  return stats;
}

export async function generateSyncReport(allStats: SyncStats[], knownFailures: SyncFailureDatabase) {
  const reportData = buildSyncReport(allStats, knownFailures);
  await generatePdfReport(reportData, "sync-report.pdf");
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
  const EXIT_SUCCESS = 0;
  const EXIT_FAILURE = 1;

  main()
    .then(() => process.exit(EXIT_SUCCESS))
    .catch((err: unknown) => {
      logger.error(err);
      process.exit(EXIT_FAILURE);
    });
}
