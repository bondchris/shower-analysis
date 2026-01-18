import * as fs from "fs";
import * as path from "path";

import { BlackFrameFinding, DateMismatch, VideoHeaderAnomaly } from "../../models/discardStats";
import { getBadScans } from "../../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../../utils/data/checkedScans";
import { findArtifactDirectories } from "../../utils/data/artifactIterator";
import { detectBlackFrames } from "../../utils/video/blackFrames";
import { extractVideoMetadata } from "../../utils/video/metadata";
import { logger } from "../../utils/logger";
import { createProgressBar } from "../../utils/progress";
import { getEnvironmentName, shouldSkipEntry } from "./shared";
import { DiscardConfig, MismatchPhaseOptions, MismatchPhaseResult, MismatchStats } from "./types";
import { buildDiscardConfig } from "./config";

export async function runMismatchPhase(
  options?: MismatchPhaseOptions,
  configInput?: DiscardConfig
): Promise<MismatchPhaseResult> {
  const config = configInput ?? buildDiscardConfig(options);
  const dataDir = config.dataDir;
  const checkedScansFile = options?.checkedScansFile ?? config.checkedScansFile;
  const isDryRun = options?.dryRun ?? config.dryRun;
  const saveResults = options?.saveResults ?? config.saveResults;

  const badScans = options?.databases?.badScans ?? getBadScans();
  const checkedScans = options?.databases?.checkedScans ?? getCheckedScans(checkedScansFile);

  const discardedDir = path.join(path.dirname(dataDir), "discarded-artifacts");
  const activeArtifacts = options?.artifactDirs ?? findArtifactDirectories(dataDir);
  const discardedArtifacts = fs.existsSync(discardedDir) ? findArtifactDirectories(discardedDir) : [];
  const artifactDirs = [...activeArtifacts, ...discardedArtifacts];
  logger.info(
    `Starting mismatch detection stage. Found ${artifactDirs.length.toString()} artifacts (${activeArtifacts.length.toString()} active, ${discardedArtifacts.length.toString()} discarded).`
  );

  const stats: MismatchStats = {
    blackFrameCount: 0,
    errors: 0,
    headerAnomalyCount: 0,
    mismatchCount: 0,
    newBlackFrameCount: 0,
    newHeaderAnomalyCount: 0,
    newMismatchCount: 0,
    processed: 0,
    skippedCached: 0
  };

  const dateMismatches: DateMismatch[] = [];
  const videoHeaderAnomalies: VideoHeaderAnomaly[] = [];
  const blackFrameFindings: BlackFrameFinding[] = [];

  const bar = createProgressBar("Mismatches |{bar}| {percentage}% | {value}/{total} Artifacts | ETA: {eta}s");
  const initialProgress = 0;
  bar.start(artifactDirs.length, initialProgress);

  for (const dir of artifactDirs) {
    const artifactId = path.basename(dir);
    if (shouldSkipEntry(artifactId)) {
      bar.increment();
      continue;
    }

    const isDiscarded = dir.includes("discarded-artifacts");
    const baseDir = isDiscarded ? discardedDir : dataDir;
    const environment = getEnvironmentName(baseDir, dir);

    const entry = checkedScans[artifactId];
    const mismatchCached = entry?.mismatchCheckedDate !== undefined && entry.mismatchCheckedDate !== "";
    const headerCached = entry?.avcAnomalyCheckedDate !== undefined;
    const shouldCheckMismatch = !mismatchCached;
    const blackFrameCached = entry?.blackFrameCheckedDate !== undefined;

    if (mismatchCached) {
      if (entry.mismatchDiffHours !== undefined) {
        dateMismatches.push({
          diffHours: entry.mismatchDiffHours,
          environment,
          id: artifactId,
          isNew: false,
          scanDate: entry.mismatchScanDate ?? "",
          videoDate: entry.mismatchVideoDate ?? ""
        });
        stats.mismatchCount++;
      }
    }

    if (headerCached && entry.avcAnomalyDetected === true) {
      videoHeaderAnomalies.push({
        environment,
        id: artifactId,
        isNew: false
      });
      stats.headerAnomalyCount++;
    }

    if (blackFrameCached && entry.blackFrameDetected === true) {
      const cachedSegments = entry.blackFrameSegments ?? [];
      blackFrameFindings.push({
        environment,
        id: artifactId,
        isNew: false,
        segments: cachedSegments
      });
      stats.blackFrameCount++;
    }

    const shouldSkipProcessing = mismatchCached && headerCached && blackFrameCached;
    if (shouldSkipProcessing) {
      stats.skippedCached++;
      bar.increment();
      continue;
    }

    const videoPath = path.join(dir, "video.mp4");
    const metaPath = path.join(dir, "meta.json");

    if (!fs.existsSync(videoPath) || !fs.existsSync(metaPath)) {
      bar.increment();
      continue;
    }

    try {
      const metaContent = fs.readFileSync(metaPath, "utf-8");
      const meta = JSON.parse(metaContent) as { scanDate?: string };
      const scanDate = meta.scanDate;

      if (scanDate === undefined || scanDate === "") {
        bar.increment();
        continue;
      }

      stats.processed++;

      const vidMeta = await extractVideoMetadata(dir);
      if (shouldCheckMismatch) {
        if (vidMeta?.creationTime !== undefined) {
          const scanTime = new Date(scanDate).getTime();
          const videoTime = new Date(vidMeta.creationTime).getTime();
          const diffMs = Math.abs(scanTime - videoTime);
          const secondsPerMinute = 60;
          const minutesPerHour = 60;
          const msPerSecond = 1000;
          const hourMs = secondsPerMinute * minutesPerHour * msPerSecond;
          const diffHours = diffMs / hourMs;

          const mismatchThresholdHours = 24;
          const isMismatch = diffHours > mismatchThresholdHours;
          if (isMismatch) {
            const isNew = entry?.mismatchCheckedDate === undefined;

            dateMismatches.push({
              diffHours,
              environment,
              id: artifactId,
              isNew,
              scanDate,
              videoDate: vidMeta.creationTime
            });

            stats.mismatchCount++;
            if (isNew) {
              stats.newMismatchCount++;
            }
          }

          if (!isDryRun) {
            let checkEntry = checkedScans[artifactId];
            if (checkEntry === undefined) {
              checkEntry = {};
              checkedScans[artifactId] = checkEntry;
            }
            checkEntry.mismatchCheckedDate = new Date().toISOString();
            if (isMismatch) {
              checkEntry.mismatchDiffHours = diffHours;
              checkEntry.mismatchScanDate = scanDate;
              checkEntry.mismatchVideoDate = vidMeta.creationTime;
            }
          }
        } else if (!isDryRun) {
          let checkEntry = checkedScans[artifactId];
          if (checkEntry === undefined) {
            checkEntry = {};
            checkedScans[artifactId] = checkEntry;
          }
          checkEntry.mismatchCheckedDate = new Date().toISOString();
        }
      }

      if (!blackFrameCached) {
        try {
          const segments = await detectBlackFrames(videoPath);
          const noSegmentsDetected = 0;
          const hasBlackFrames = segments.length > noSegmentsDetected;
          if (hasBlackFrames) {
            const isNew = entry?.blackFrameCheckedDate === undefined;
            blackFrameFindings.push({
              environment,
              id: artifactId,
              isNew,
              segments
            });
            stats.blackFrameCount++;
            if (isNew) {
              stats.newBlackFrameCount++;
            }
          }

          if (!isDryRun) {
            let checkEntry = checkedScans[artifactId];
            if (checkEntry === undefined) {
              checkEntry = {};
              checkedScans[artifactId] = checkEntry;
            }
            checkEntry.blackFrameCheckedDate = new Date().toISOString();
            checkEntry.blackFrameDetected = hasBlackFrames;
            checkEntry.blackFrameSegments = hasBlackFrames ? segments : [];
          }
        } catch (error) {
          logger.warn(`Failed to check black frames for ${artifactId}: ${String(error)}`);
          stats.errors++;
        }
      }

      try {
        const HEADER_SIZE = 8;
        const MIN_PAYLOAD_SIZE = 1;
        const SIZE_FIELD_LENGTH = 4;
        const markerBuffer = Buffer.from("avcC", "ascii");
        const fileBuffer = fs.readFileSync(videoPath);
        let searchStart = 0;
        let foundValid = false;
        let foundInvalidBeforeValid = false;
        const NOT_FOUND = -1;
        while (searchStart < fileBuffer.length) {
          const idx = fileBuffer.indexOf(markerBuffer, searchStart);
          if (idx === NOT_FOUND) {
            break;
          }
          searchStart = idx + markerBuffer.length;
          const hasSizeField = idx >= SIZE_FIELD_LENGTH;
          if (!hasSizeField) {
            foundInvalidBeforeValid = true;
            continue;
          }
          const size = fileBuffer.readUInt32BE(idx - SIZE_FIELD_LENGTH);
          const payloadSize = size - HEADER_SIZE;
          const payloadEnd = idx + markerBuffer.length + payloadSize;
          const isValid = payloadSize >= MIN_PAYLOAD_SIZE && payloadEnd <= fileBuffer.length;
          if (isValid && !foundValid) {
            foundValid = true;
          } else if (!isValid && !foundValid) {
            foundInvalidBeforeValid = true;
          }
        }

        const hasAnomaly = foundInvalidBeforeValid;
        if (hasAnomaly) {
          videoHeaderAnomalies.push({
            environment,
            id: artifactId,
            isNew: entry?.avcAnomalyCheckedDate === undefined
          });
          stats.headerAnomalyCount++;
          if (entry?.avcAnomalyCheckedDate === undefined) {
            stats.newHeaderAnomalyCount++;
          }
          if (!isDryRun) {
            let checkEntry = checkedScans[artifactId];
            if (checkEntry === undefined) {
              checkEntry = {};
              checkedScans[artifactId] = checkEntry;
            }
            checkEntry.avcAnomalyCheckedDate = new Date().toISOString();
            checkEntry.avcAnomalyDetected = true;
          }
        } else if (!isDryRun) {
          let checkEntry = checkedScans[artifactId];
          if (checkEntry === undefined) {
            checkEntry = {};
            checkedScans[artifactId] = checkEntry;
          }
          checkEntry.avcAnomalyCheckedDate = new Date().toISOString();
          checkEntry.avcAnomalyDetected = false;
        }
      } catch (error) {
        logger.warn(`Failed to check video header for ${artifactId}: ${String(error)}`);
        stats.errors++;
      }
    } catch (e) {
      logger.warn(`Failed to check mismatch for artifact ${artifactId}: ${String(e)}`);
      stats.errors++;
    }

    bar.increment();
  }

  bar.stop();

  if (!isDryRun && saveResults) {
    saveCheckedScans(checkedScans, checkedScansFile);
  }

  logger.info(
    `Mismatch stage complete. Processed: ${stats.processed.toString()}, Mismatches: ${stats.mismatchCount.toString()} (new: ${stats.newMismatchCount.toString()}), Header anomalies: ${stats.headerAnomalyCount.toString()} (new: ${stats.newHeaderAnomalyCount.toString()}), Black frames: ${stats.blackFrameCount.toString()} (new: ${stats.newBlackFrameCount.toString()}), Cached: ${stats.skippedCached.toString()}, Errors: ${stats.errors.toString()}.`
  );

  return {
    blackFrameFindings,
    databases: { badScans, checkedScans },
    dateMismatches,
    stats,
    videoHeaderAnomalies
  };
}
