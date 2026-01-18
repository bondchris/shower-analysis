import * as fs from "fs";
import * as path from "path";

import { DuplicateStats, DuplicateVideo } from "../../models/discardStats";
import { getBadScans, saveBadScans } from "../../utils/data/badScans";
import { getCheckedScans } from "../../utils/data/checkedScans";
import { discardArtifact } from "../../utils/data/discardArtifact";
import { findArtifactDirectories } from "../../utils/data/artifactIterator";
import { hashVideoInDirectory } from "../../utils/video/hash";
import { logger } from "../../utils/logger";
import {
  VideoHashDatabase,
  addVideoHash,
  findDuplicateArtifacts,
  getVideoHashes,
  saveVideoHashes
} from "../../utils/data/videoHashes";
import { createProgressBar } from "../../utils/progress";
import { DiscardConfig, DuplicatesPhaseOptions, DuplicatesPhaseResult } from "./types";
import { buildDiscardConfig } from "./config";
import { getEnvironmentName, shouldSkipEntry } from "./shared";

export async function runDuplicatesPhase(
  options?: DuplicatesPhaseOptions,
  configInput?: DiscardConfig
): Promise<DuplicatesPhaseResult> {
  const config = configInput ?? buildDiscardConfig(options);
  const dataDir = config.dataDir;
  const badScansFile = options?.badScansFile ?? config.badScansFile;
  const videoHashesFile = options?.videoHashesFile ?? config.videoHashesFile;
  const isDryRun = options?.dryRun ?? config.dryRun;
  const saveResults = options?.saveResults ?? config.saveResults;

  const badScans = options?.databases?.badScans ?? getBadScans(badScansFile);
  const checkedScans = options?.databases?.checkedScans ?? getCheckedScans();
  const videoHashes: VideoHashDatabase = options?.videoHashes ?? getVideoHashes(videoHashesFile);

  const artifactDirs = options?.artifactDirs ?? findArtifactDirectories(dataDir);
  logger.info(`Starting duplicates detection stage. Found ${artifactDirs.length.toString()} artifacts.`);

  const stats: DuplicateStats = {
    duplicateCount: 0,
    errors: 0,
    newDuplicateCount: 0,
    processed: 0,
    skippedCached: 0
  };

  const duplicates: DuplicateVideo[] = [];
  const remainingArtifacts: string[] = [];

  const bar = createProgressBar("Duplicates |{bar}| {percentage}% | {value}/{total} Artifacts | ETA: {eta}s");
  const initialProgress = 0;
  bar.start(artifactDirs.length, initialProgress);

  for (const dir of artifactDirs) {
    const artifactId = path.basename(dir);
    if (shouldSkipEntry(artifactId)) {
      bar.increment();
      continue;
    }

    const environment = getEnvironmentName(dataDir, dir);

    if (Object.prototype.hasOwnProperty.call(badScans, artifactId)) {
      stats.skippedCached++;
      bar.increment();
      continue;
    }

    const videoPath = path.join(dir, "video.mp4");
    if (!fs.existsSync(videoPath)) {
      bar.increment();
      continue;
    }

    try {
      const hash = await hashVideoInDirectory(dir);
      if (hash === null) {
        stats.errors++;
        remainingArtifacts.push(dir);
        bar.increment();
        continue;
      }

      stats.processed++;
      const existingDuplicateIds = findDuplicateArtifacts(videoHashes, hash, artifactId);
      const noDuplicates = 0;
      const hasDuplicates = existingDuplicateIds.length > noDuplicates;

      if (hasDuplicates) {
        const metaPath = path.join(dir, "meta.json");
        let scanDate: string | undefined = undefined;
        if (fs.existsSync(metaPath)) {
          try {
            const metaContent = fs.readFileSync(metaPath, "utf-8");
            const meta = JSON.parse(metaContent) as { scanDate?: string };
            scanDate = meta.scanDate;
          } catch {
            // Ignore parse errors
          }
        }

        const isNew = !Object.prototype.hasOwnProperty.call(videoHashes, hash);

        const duplicateEntry: DuplicateVideo = {
          artifactId,
          duplicateIds: existingDuplicateIds,
          environment,
          hash,
          isNew
        };
        if (scanDate !== undefined) {
          duplicateEntry.scanDate = scanDate;
        }
        duplicates.push(duplicateEntry);

        stats.duplicateCount++;
        if (isNew) {
          stats.newDuplicateCount++;
        }

        const duplicateReason = `Duplicate video (hash ${hash}) matches ${existingDuplicateIds.join(", ")}`;
        const badScanEntry: (typeof badScans)[string] = {
          date: new Date().toISOString(),
          environment,
          reason: duplicateReason
        };
        if (scanDate !== undefined) {
          badScanEntry.scanDate = scanDate;
        }

        if (!isDryRun) {
          badScans[artifactId] = badScanEntry;

          try {
            const artifactsRoot = path.resolve(dir, "..", "..");
            const dataRoot = path.dirname(artifactsRoot);
            const discardedPath = discardArtifact(dir, { artifactsRoot, dataRoot, reason: duplicateReason });
            if (discardedPath === null) {
              throw new Error("Failed to move artifact to discarded-artifacts");
            }
            logger.info(`Discarded duplicate artifact ${artifactId} -> ${discardedPath}`);
          } catch (err) {
            logger.error(`Failed to discard duplicate artifact ${artifactId}: ${String(err)}`);
            stats.errors++;
            remainingArtifacts.push(dir);
          }
        } else {
          remainingArtifacts.push(dir);
        }
      } else {
        remainingArtifacts.push(dir);
      }

      addVideoHash(videoHashes, hash, artifactId);
    } catch (e) {
      logger.warn(`Failed to hash video for artifact ${artifactId}: ${String(e)}`);
      stats.errors++;
      remainingArtifacts.push(dir);
    }

    bar.increment();
  }

  bar.stop();

  if (!isDryRun && saveResults) {
    saveBadScans(badScans, badScansFile);
    saveVideoHashes(videoHashes, videoHashesFile);
  }

  logger.info(
    `Duplicates stage complete. Processed: ${stats.processed.toString()}, Duplicates: ${stats.duplicateCount.toString()}, New: ${stats.newDuplicateCount.toString()}, Cached: ${stats.skippedCached.toString()}, Errors: ${stats.errors.toString()}.`
  );

  return {
    databases: { badScans, checkedScans },
    duplicates,
    remainingArtifacts,
    stats,
    videoHashes
  };
}
