import * as fs from "fs";
import * as path from "path";

import { ENVIRONMENTS } from "../../config/config";
import { BadScanDatabase } from "../models/badScanRecord";
import { SyncError, SyncStats } from "../models/syncStats";
import { ArtifactResponse, SpatialService } from "../services/spatialService";
import { buildSyncReport } from "../templates/syncReport";
import { getBadScans } from "../utils/data/badScans";
import { discardArtifact } from "../utils/data/discardArtifact";
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
 * - Optionally downloads `pointCloud.ply` and `initialLayout.png` if present in the artifact.
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
          logger.error(`pLimit task failed: ${String(e)}`);
          reject(e instanceof Error ? e : new Error(String(e)));
        } finally {
          next();
        }
      };

      if (active < concurrency) {
        runTask().catch(() => undefined);
      } else {
        // Wrap async task in void function to satisfy generic queue type and no-misused-promises
        queue.push(() => {
          runTask().catch(() => undefined);
        });
      }
    });
    return res;
  };

  return run;
}

export const testExports = { pLimit };

interface ArtifactResult {
  new: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
  videoSize: number;
  arDataSize: number;
  rawScanSize: number;
  pointCloudSize: number;
  initialLayoutSize: number;
  scanDate?: string;
}

// Extracted Artifact Processor
export async function processArtifact(
  artifact: ArtifactResponse,
  dataDir: string,
  badScans: BadScanDatabase
): Promise<ArtifactResult> {
  const result: ArtifactResult = {
    arDataSize: 0,
    errors: [],
    failed: 0,
    initialLayoutSize: 0,
    new: 0,
    pointCloudSize: 0,
    rawScanSize: 0,
    skipped: 0,
    videoSize: 0
  };

  const JSON_INDENT = 2;

  const ZERO = 0;
  const sanitizeId = (id: string) => id.replace(/[^a-z0-9_-]/gi, "_");

  // Hardened check for badScans
  if (Object.prototype.hasOwnProperty.call(badScans, artifact.id)) {
    result.skipped = 1;
    return result;
  }

  if (artifact.scanDate !== undefined) {
    result.scanDate = artifact.scanDate;
  }

  const { video, rawScan, arData, pointCloud, initialLayout } = artifact;

  const hasAllFiles =
    typeof video === "string" &&
    video.length > ZERO &&
    typeof rawScan === "string" &&
    rawScan.length > ZERO &&
    typeof arData === "string" &&
    arData.length > ZERO;

  if (hasAllFiles) {
    // Sanitize ID for path safety
    const safeId = sanitizeId(artifact.id);
    const artifactDir = path.join(dataDir, safeId);
    const exists = fs.existsSync(artifactDir);

    if (!exists) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Save meta.json
    fs.writeFileSync(path.join(artifactDir, "meta.json"), JSON.stringify(artifact, null, JSON_INDENT));

    // Download required files
    const downloadPromises: Promise<boolean>[] = [
      downloadFile(video, path.join(artifactDir, "video.mp4"), "video").then((err) => {
        if (err !== null) {
          const reason = typeof err === "string" ? err : "video download failed (unknown error)";
          if (typeof err !== "string") {
            logger.warn(`Undefined error returned for video download: ${artifact.id}`);
          }
          result.errors.push({ date: artifact.scanDate, id: artifact.id, reason });
        }
        return err === null;
      }),
      downloadJsonFile(rawScan, path.join(artifactDir, "rawScan.json"), "rawScan").then((err) => {
        if (err !== null) {
          const reason = typeof err === "string" ? err : "rawScan download failed (unknown error)";
          result.errors.push({ date: artifact.scanDate, id: artifact.id, reason });
        }
        return err === null;
      }),
      downloadJsonFile(arData, path.join(artifactDir, "arData.json"), "arData").then((err) => {
        if (err !== null) {
          const reason = typeof err === "string" ? err : "arData download failed (unknown error)";
          result.errors.push({ date: artifact.scanDate, id: artifact.id, reason });
        }
        return err === null;
      })
    ];

    // Download optional files if present
    if (typeof pointCloud === "string" && pointCloud.length > ZERO) {
      downloadPromises.push(
        downloadFile(pointCloud, path.join(artifactDir, "pointCloud.ply"), "pointCloud").then((err) => {
          if (err !== null) {
            const reason = typeof err === "string" ? err : "pointCloud download failed (unknown error)";
            result.errors.push({ date: artifact.scanDate, id: artifact.id, reason });
          }
          return err === null;
        })
      );
    }

    if (typeof initialLayout === "string" && initialLayout.length > ZERO) {
      downloadPromises.push(
        downloadFile(initialLayout, path.join(artifactDir, "initialLayout.png"), "initialLayout").then((err) => {
          if (err !== null) {
            const reason = typeof err === "string" ? err : "initialLayout download failed (unknown error)";
            result.errors.push({ date: artifact.scanDate, id: artifact.id, reason });
          }
          return err === null;
        })
      );
    }

    const downloadResults = await Promise.all(downloadPromises);

    // Only check required files (first 3: video, rawScan, arData) for failure
    // Optional files (pointCloud, initialLayout) failures should not mark artifact as failed
    const REQUIRED_FILE_COUNT = 3;
    const ARRAY_START_INDEX = 0;
    const requiredFileResults = downloadResults.slice(ARRAY_START_INDEX, REQUIRED_FILE_COUNT);
    const artifactFailed = requiredFileResults.some((r) => !r);

    if (artifactFailed) {
      result.failed = 1;
      try {
        const dataRoot = path.resolve(dataDir, "..", "..");
        const artifactsRoot = path.join(dataRoot, "artifacts");
        const errorReasons = result.errors.map((e) => e.reason).join("; ");
        const syncReason = `Sync failed: ${errorReasons || "required file download failed"}`;
        const discardedPath = discardArtifact(artifactDir, { artifactsRoot, dataRoot, reason: syncReason });
        if (discardedPath === null) {
          throw new Error("Failed to move artifact to discarded-artifacts");
        }
      } catch (e) {
        logger.error(`Failed to discard incomplete artifact ${artifact.id}: ${String(e)}`);
      }
    } else if (!exists) {
      result.new = 1;
    }

    if (!artifactFailed) {
      try {
        const videoStats = fs.statSync(path.join(artifactDir, "video.mp4"));
        const rawScanStats = fs.statSync(path.join(artifactDir, "rawScan.json"));
        const arDataStats = fs.statSync(path.join(artifactDir, "arData.json"));

        result.videoSize = videoStats.size;
        result.rawScanSize = rawScanStats.size;
        result.arDataSize = arDataStats.size;

        // Track optional file sizes if they exist
        const pointCloudPath = path.join(artifactDir, "pointCloud.ply");
        if (fs.existsSync(pointCloudPath)) {
          const pointCloudStats = fs.statSync(pointCloudPath);
          result.pointCloudSize = pointCloudStats.size;
        }

        const initialLayoutPath = path.join(artifactDir, "initialLayout.png");
        if (fs.existsSync(initialLayoutPath)) {
          const initialLayoutStats = fs.statSync(initialLayoutPath);
          result.initialLayoutSize = initialLayoutStats.size;
        }
      } catch (e) {
        logger.warn(`Failed to get stats/metadata for artifact ${artifact.id}: ${String(e)}`);
      }
    }
  }

  return result;
}

export async function syncEnvironment(env: { domain: string; name: string }): Promise<SyncStats> {
  logger.info(`Starting sync for: ${env.name}`);
  const dataDir = path.join(process.cwd(), "data", "artifacts", env.name);

  const stats: SyncStats = {
    arDataHistory: {},
    arDataSize: 0,
    env: env.name,
    errors: [],
    failed: 0,
    found: 0,
    initialLayoutHistory: {},
    initialLayoutSize: 0,
    knownFailures: 0,
    new: 0,
    newArDataSize: 0,
    newFailures: 0,
    newInitialLayoutSize: 0,
    newPointCloudSize: 0,
    newRawScanSize: 0,
    newVideoSize: 0,
    pointCloudHistory: {},
    pointCloudSize: 0,
    processedIds: new Set<string>(),
    rawScanHistory: {},
    rawScanSize: 0,
    skipped: 0,
    videoHistory: {},
    videoSize: 0
  };

  // Track which artifact IDs actually failed (required file failures)
  const failedArtifactIds = new Set<string>();

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

        for (let i = 0; i < pageResults.length; i++) {
          const r = pageResults[i];
          const a = artifacts[i];

          if (!r || !a) {
            continue;
          }

          stats.new += r.new;
          stats.skipped += r.skipped;
          stats.failed += r.failed;
          stats.errors.push(...r.errors);

          // Track artifact IDs that actually failed (required file failures)
          const NO_FAILURES = 0;
          if (r.failed > NO_FAILURES) {
            failedArtifactIds.add(a.id);
          }

          stats.videoSize += r.videoSize;
          stats.arDataSize += r.arDataSize;
          stats.rawScanSize += r.rawScanSize;
          stats.pointCloudSize += r.pointCloudSize;
          stats.initialLayoutSize += r.initialLayoutSize;

          const ONE_NEW = 1;
          if (r.new >= ONE_NEW) {
            stats.newArDataSize += r.arDataSize;
            stats.newRawScanSize += r.rawScanSize;
            stats.newVideoSize += r.videoSize;
            stats.newPointCloudSize += r.pointCloudSize;
            stats.newInitialLayoutSize += r.initialLayoutSize;
          }

          if (r.scanDate !== undefined) {
            const ZERO_SIZE = 0;
            try {
              const DATE_PART_INDEX = 0;
              const dateKey = r.scanDate.split("T")[DATE_PART_INDEX]; // YYYY-MM-DD
              if (dateKey !== undefined && dateKey !== "" && !dateKey.startsWith("0001")) {
                if (r.videoSize > ZERO_SIZE) {
                  const videoHistory = stats.videoHistory[dateKey] ?? {
                    count: 0,
                    totalSize: 0
                  };

                  videoHistory.count++;
                  videoHistory.totalSize += r.videoSize;
                  stats.videoHistory[dateKey] = videoHistory;
                }

                if (r.arDataSize > ZERO_SIZE) {
                  const arDataHistory = stats.arDataHistory[dateKey] ?? {
                    count: 0,
                    totalSize: 0
                  };

                  arDataHistory.count++;
                  arDataHistory.totalSize += r.arDataSize;
                  stats.arDataHistory[dateKey] = arDataHistory;
                }

                if (r.rawScanSize > ZERO_SIZE) {
                  const rawScanHistory = stats.rawScanHistory[dateKey] ?? {
                    count: 0,
                    totalSize: 0
                  };

                  rawScanHistory.count++;
                  rawScanHistory.totalSize += r.rawScanSize;
                  stats.rawScanHistory[dateKey] = rawScanHistory;
                }

                if (r.pointCloudSize > ZERO_SIZE) {
                  const pointCloudHistory = stats.pointCloudHistory[dateKey] ?? {
                    count: 0,
                    totalSize: 0
                  };

                  pointCloudHistory.count++;
                  pointCloudHistory.totalSize += r.pointCloudSize;
                  stats.pointCloudHistory[dateKey] = pointCloudHistory;
                }

                if (r.initialLayoutSize > ZERO_SIZE) {
                  const initialLayoutHistory = stats.initialLayoutHistory[dateKey] ?? {
                    count: 0,
                    totalSize: 0
                  };

                  initialLayoutHistory.count++;
                  initialLayoutHistory.totalSize += r.initialLayoutSize;
                  stats.initialLayoutHistory[dateKey] = initialLayoutHistory;
                }
              }
            } catch {
              // Ignore invalid dates
            }
          }
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
    // Count unique artifact IDs, not individual property errors
    // Only count errors from artifacts that actually failed (not optional file failures)
    const knownFailuresDb = getSyncFailures();
    const countedKnownFailures = new Set<string>();
    const countedNewFailures = new Set<string>();
    stats.errors.forEach((err) => {
      // Only count errors from artifacts that actually failed
      // Optional file failures (pointCloud/initialLayout) should not be counted
      if (!failedArtifactIds.has(err.id)) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(knownFailuresDb, err.id)) {
        if (!countedKnownFailures.has(err.id)) {
          countedKnownFailures.add(err.id);
          stats.knownFailures++;
        }
      } else if (!countedNewFailures.has(err.id)) {
        countedNewFailures.add(err.id);
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
  await generatePdfReport(reportData, "1 - Sync Report.pdf");
}

export async function main() {
  const knownFailures = getSyncFailures();
  const currentFailures: SyncFailureDatabase = {};
  const failureTimestamp = new Date().toISOString();

  const allStats: SyncStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await syncEnvironment(env);
    allStats.push(stats);

    // Record current failures
    for (const error of stats.errors) {
      const existing = currentFailures[error.id];
      const existingReasons = existing?.reasons ?? [];
      const updatedReasons = Array.from(new Set([...existingReasons, error.reason]));

      currentFailures[error.id] = {
        date: existing?.date ?? failureTimestamp,
        environment: existing?.environment ?? env.name,
        reasons: updatedReasons
      };
    }
  }

  await generateSyncReport(allStats, knownFailures);
  saveSyncFailures(currentFailures);
}

export async function runCli(runMain: () => Promise<void> = main) {
  const EXIT_SUCCESS = 0;
  const EXIT_FAILURE = 1;

  try {
    await runMain();
    process.exit(EXIT_SUCCESS);
  } catch (err: unknown) {
    logger.error(err);
    process.exit(EXIT_FAILURE);
  }
}

export function runIfMain(entryModule: NodeJS.Module, runner: () => Promise<void> = runCli, forceRun = false) {
  if (forceRun || require.main === entryModule) {
    runner().catch((err: unknown) => {
      logger.error(err);
    });
  }
}

runIfMain(module);
