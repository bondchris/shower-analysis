import * as fs from "fs";
import * as path from "path";

import { ENVIRONMENTS } from "../../config/config";
import { BadScanDatabase } from "../models/badScanRecord";
import { SyncError, SyncStats } from "../models/syncStats";
import { extractVideoMetadata } from "../utils/video/metadata";
import { hashVideoInDirectory } from "../utils/video/hash";
import { ArtifactResponse, SpatialService } from "../services/spatialService";
import { buildSyncReport } from "../templates/syncReport";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { discardArtifact } from "../utils/data/discardArtifact";
import { SyncFailureDatabase, getSyncFailures, saveSyncFailures } from "../utils/data/syncFailures";
import {
  type VideoHashDatabase,
  addVideoHash,
  findDuplicateArtifacts,
  getVideoHashes,
  saveVideoHashes
} from "../utils/data/videoHashes";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";
import { downloadFile, downloadJsonFile } from "../utils/sync/downloadHelpers";

/**
 * Script to sync artifacts from the Spatial API.
 * - Downloads artifacts for configured environments.
 * - Skips artifacts already marked as "Bad Scans".
 * - Ensures valid synced artifacts have `video.mp4`, `arData.json`, and `rawScan.json`.
 * - Optionally downloads `pointCloud.json` and `initialLayout.json` if present in the artifact.
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
  videoHash?: string;
  duplicateIds?: string[];
  dateMismatch?: {
    scanDate: string;
    videoDate: string;
    diffHours: number;
    isNew?: boolean;
  };
}

interface ProcessArtifactOptions {
  canonicalByHash: Record<string, string>;
  canonicalOrderByHash: Record<string, number>;
  artifactOrder: number;
  environment: string;
  onBadScanAdded: () => void;
}

// Extracted Artifact Processor
export async function processArtifact(
  artifact: ArtifactResponse,
  dataDir: string,
  badScans: BadScanDatabase,
  videoHashes: VideoHashDatabase,
  options: ProcessArtifactOptions
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
  const { artifactOrder, canonicalByHash, canonicalOrderByHash, environment, onBadScanAdded } = options;
  const sanitizeId = (id: string) => id.replace(/[^a-z0-9_-]/gi, "_");
  const buildArtifactDir = (id: string) => path.join(dataDir, sanitizeId(id));

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
        downloadJsonFile(pointCloud, path.join(artifactDir, "pointCloud.json"), "pointCloud").then((err) => {
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
        downloadJsonFile(initialLayout, path.join(artifactDir, "initialLayout.json"), "initialLayout").then((err) => {
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
        const discardedPath = discardArtifact(artifactDir, { artifactsRoot, dataRoot });
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
        const pointCloudPath = path.join(artifactDir, "pointCloud.json");
        if (fs.existsSync(pointCloudPath)) {
          const pointCloudStats = fs.statSync(pointCloudPath);
          result.pointCloudSize = pointCloudStats.size;
        }

        const initialLayoutPath = path.join(artifactDir, "initialLayout.json");
        if (fs.existsSync(initialLayoutPath)) {
          const initialLayoutStats = fs.statSync(initialLayoutPath);
          result.initialLayoutSize = initialLayoutStats.size;
        }

        // Hash video for duplicate detection
        try {
          const hash = await hashVideoInDirectory(artifactDir);
          if (hash !== null) {
            result.videoHash = hash;
            const FIRST_DUPLICATE_INDEX = 0;
            const MIN_DUPLICATE_ENTRIES = 0;
            const duplicateIds = findDuplicateArtifacts(videoHashes, hash, artifact.id);
            const recordDuplicateBadScan = (id: string, duplicates: string[]) => {
              if (badScans[id] !== undefined) {
                return;
              }
              const reasonDetail =
                duplicates.length > MIN_DUPLICATE_ENTRIES
                  ? `Duplicate video (hash ${hash}) matches ${duplicates.join(", ")}`
                  : `Duplicate video (hash ${hash})`;
              badScans[id] = {
                date: new Date().toISOString(),
                environment,
                reason: reasonDetail
              };
              onBadScanAdded();
            };

            const discardDuplicate = (id: string, targetDir: string, duplicates: string[]) => {
              const artifactsRoot = path.resolve(dataDir, "..");
              const dataRoot = path.resolve(artifactsRoot, "..");
              const discardedPath = discardArtifact(targetDir, { artifactsRoot, dataRoot });
              recordDuplicateBadScan(id, duplicates);
              if (discardedPath === null) {
                logger.error(`Failed to discard duplicate artifact ${id}`);
              } else {
                logger.info(`Discarded duplicate artifact ${id} -> ${discardedPath}`);
              }
            };

            if (canonicalByHash[hash] === undefined) {
              const defaultCanonical = duplicateIds[FIRST_DUPLICATE_INDEX] ?? artifact.id;
              canonicalByHash[hash] = defaultCanonical;
              const defaultOrder =
                duplicateIds.length > MIN_DUPLICATE_ENTRIES ? Number.MIN_SAFE_INTEGER : artifactOrder;
              canonicalOrderByHash[hash] = defaultOrder;
            }

            const currentCanonicalId = canonicalByHash[hash] ?? artifact.id;
            const currentCanonicalOrder = canonicalOrderByHash[hash] ?? artifactOrder;

            if (artifactOrder < currentCanonicalOrder && currentCanonicalId !== artifact.id) {
              const previousCanonicalId = currentCanonicalId;
              canonicalByHash[hash] = artifact.id;
              canonicalOrderByHash[hash] = artifactOrder;

              const previousArtifactDir = buildArtifactDir(previousCanonicalId);
              const duplicateReasonIds = [...duplicateIds, artifact.id];
              if (fs.existsSync(previousArtifactDir)) {
                discardDuplicate(previousCanonicalId, previousArtifactDir, duplicateReasonIds);
              } else {
                recordDuplicateBadScan(previousCanonicalId, duplicateReasonIds);
              }
            }

            const canonicalId = canonicalByHash[hash] ?? artifact.id;
            const hasDuplicates = duplicateIds.length > MIN_DUPLICATE_ENTRIES;
            if (hasDuplicates) {
              result.duplicateIds = duplicateIds;
              const isCanonicalArtifact = artifact.id === canonicalId;
              if (!isCanonicalArtifact) {
                discardDuplicate(artifact.id, artifactDir, duplicateIds);
                addVideoHash(videoHashes, hash, artifact.id);
                return result;
              }
            }

            addVideoHash(videoHashes, hash, artifact.id);
          }
        } catch (e) {
          logger.warn(`Failed to hash video for artifact ${artifact.id}: ${String(e)}`);
        }

        // Date Mismatch Check
        if (artifact.scanDate !== undefined) {
          const vidMeta = await extractVideoMetadata(artifactDir);
          if (vidMeta?.creationTime !== undefined) {
            const scanTime = new Date(artifact.scanDate).getTime();
            const videoTime = new Date(vidMeta.creationTime).getTime();
            const diffMs = Math.abs(scanTime - videoTime);
            const SECONDS_PER_MIN = 60;
            const MINUTES_PER_HOUR = 60;
            const MS_PER_SECOND = 1000;
            const HOUR_MS = SECONDS_PER_MIN * MINUTES_PER_HOUR * MS_PER_SECOND;
            const diffHours = diffMs / HOUR_MS;

            const MISMATCH_THRESHOLD_HOURS = 24;
            if (diffHours > MISMATCH_THRESHOLD_HOURS) {
              result.dateMismatch = {
                diffHours,
                isNew: !exists,
                scanDate: artifact.scanDate,
                videoDate: vidMeta.creationTime
              };
            }
          }
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
  const dataDir = path.join(process.cwd(), "data", "artifacts", env.name.replace(/[^a-z0-9]/gi, "_").toLowerCase());

  const stats: SyncStats = {
    arDataSize: 0,
    dateMismatches: [],
    duplicateCount: 0,
    duplicates: [],
    env: env.name,
    errors: [],
    failed: 0,
    found: 0,
    initialLayoutSize: 0,
    knownFailures: 0,
    new: 0,
    newArDataSize: 0,
    newDuplicateCount: 0,
    newFailures: 0,
    newInitialLayoutSize: 0,
    newPointCloudSize: 0,
    newRawScanSize: 0,
    newVideoSize: 0,
    pointCloudSize: 0,
    processedIds: new Set<string>(),
    rawScanSize: 0,
    skipped: 0,
    videoHistory: {},
    videoSize: 0
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

  const videoHashes = getVideoHashes();
  logger.info(`Loaded ${Object.keys(videoHashes).length.toString()} video hashes for duplicate detection.`);
  const canonicalByHash: Record<string, string> = {};
  const MIN_HASH_IDS = 0;
  const FIRST_HASH_INDEX = 0;
  const canonicalOrderByHash: Record<string, number> = {};
  const PERSISTED_CANONICAL_ORDER = Number.MIN_SAFE_INTEGER;
  Object.entries(videoHashes).forEach(([hash, ids]) => {
    if (
      !Array.isArray(ids) ||
      ids.length <= MIN_HASH_IDS ||
      canonicalByHash[hash] !== undefined ||
      typeof ids[FIRST_HASH_INDEX] !== "string"
    ) {
      return;
    }
    const firstId = ids[FIRST_HASH_INDEX];
    canonicalByHash[hash] = firstId;
    canonicalOrderByHash[hash] = PERSISTED_CANONICAL_ORDER;
  });
  const badScanUpdateState = { updated: false };
  let artifactOrderCounter = 0;

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
            const artifactOrder = artifactOrderCounter++;
            const r = await limitArtifact(async () => {
              const pa = await processArtifact(a, dataDir, badScans, videoHashes, {
                artifactOrder,
                canonicalByHash,
                canonicalOrderByHash,
                environment: env.name,
                onBadScanAdded: () => {
                  badScanUpdateState.updated = true;
                }
              });
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

          if (r.dateMismatch) {
            stats.dateMismatches.push({
              diffHours: r.dateMismatch.diffHours,
              environment: env.name,
              id: a.id,
              isNew: r.dateMismatch.isNew ?? false,
              scanDate: r.dateMismatch.scanDate,
              videoDate: r.dateMismatch.videoDate
            });
          }

          // Track duplicates
          const NO_DUPLICATES = 0;
          const ONE_NEW = 1;
          if (r.videoHash !== undefined && r.duplicateIds !== undefined && r.duplicateIds.length > NO_DUPLICATES) {
            const isNewDuplicate = r.new >= ONE_NEW;
            const duplicateEntry: {
              artifactId: string;
              duplicateIds: string[];
              environment: string;
              hash: string;
              isNew: boolean;
              scanDate?: string;
            } = {
              artifactId: a.id,
              duplicateIds: r.duplicateIds,
              environment: env.name,
              hash: r.videoHash,
              isNew: isNewDuplicate
            };
            if (r.scanDate !== undefined) {
              duplicateEntry.scanDate = r.scanDate;
            }
            stats.duplicates.push(duplicateEntry);
            stats.duplicateCount += r.duplicateIds.length;
            if (isNewDuplicate) {
              stats.newDuplicateCount += r.duplicateIds.length;
            }
          }

          stats.videoSize += r.videoSize;
          stats.arDataSize += r.arDataSize;
          stats.rawScanSize += r.rawScanSize;
          stats.pointCloudSize += r.pointCloudSize;
          stats.initialLayoutSize += r.initialLayoutSize;

          if (r.new >= ONE_NEW) {
            stats.newArDataSize += r.arDataSize;
            stats.newRawScanSize += r.rawScanSize;
            stats.newVideoSize += r.videoSize;
            stats.newPointCloudSize += r.pointCloudSize;
            stats.newInitialLayoutSize += r.initialLayoutSize;
          }

          if (r.scanDate !== undefined) {
            const ZERO_SIZE = 0;
            if (r.videoSize > ZERO_SIZE) {
              try {
                const date = new Date(r.scanDate);
                const SUBSTRING_START = 0;
                const SUBSTRING_LENGTH = 7;
                const monthKey = date.toISOString().slice(SUBSTRING_START, SUBSTRING_LENGTH); // YYYY-MM

                const history = stats.videoHistory[monthKey] ?? {
                  count: 0,
                  totalSize: 0
                };

                history.count++;
                history.totalSize += r.videoSize;
                stats.videoHistory[monthKey] = history;
              } catch {
                // Ignore invalid dates
              }
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
    const knownFailuresDb = getSyncFailures();
    stats.errors.forEach((err) => {
      if (Object.prototype.hasOwnProperty.call(knownFailuresDb, err.id)) {
        stats.knownFailures++;
      } else {
        stats.newFailures++;
      }
    });

    if (badScanUpdateState.updated) {
      saveBadScans(badScans);
      logger.info(`Saved ${Object.keys(badScans).length.toString()} bad scans.`);
    }

    // Save video hash database
    saveVideoHashes(videoHashes);
    logger.info(`Saved ${Object.keys(videoHashes).length.toString()} video hashes.`);
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
