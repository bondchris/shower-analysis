import * as path from "path";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";

import { BadScanDatabase } from "../../models/badScanRecord";
import { CleanDataStats } from "../../models/discardStats";
import { getBadScans, saveBadScans } from "../../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../../utils/data/checkedScans";
import { discardArtifact } from "../../utils/data/discardArtifact";
import { findArtifactDirectories } from "../../utils/data/artifactIterator";
import { logger } from "../../utils/logger";
import { getEnvironmentName, shouldSkipEntry } from "./shared";
import { CleanPhaseOptions, CleanPhaseResult, DiscardConfig } from "./types";
import { buildDiscardConfig } from "./config";

interface FfprobeData {
  format?: {
    duration?: number;
  };
}

export async function probeVideo(
  filePath: string,
  ffprobe: typeof ffmpeg.ffprobe,
  defaultDuration?: number
): Promise<{ ok: boolean; duration: number }> {
  const defaultDurationFallback = 0;
  const defaultDurationSeconds = defaultDuration ?? defaultDurationFallback;
  const nonNegativeFloor = 0;

  const result = await new Promise<{ ok: boolean; duration: number }>((resolve) => {
    ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        resolve({ duration: defaultDurationSeconds, ok: false });
        return;
      }

      const data = metadata as FfprobeData | undefined;
      const rawDuration = data?.format?.duration;
      const duration =
        typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration >= nonNegativeFloor
          ? rawDuration
          : defaultDurationSeconds;

      resolve({ duration, ok: true });
    });
  });

  return result;
}

export async function runCleanPhase(
  options?: CleanPhaseOptions,
  configInput?: DiscardConfig
): Promise<CleanPhaseResult> {
  const config = configInput ?? buildDiscardConfig(options);
  const fsImpl = options?.fs ?? config.fs ?? fs;
  const ffprobeImpl = options?.ffprobe ?? config.ffprobe ?? ffmpeg.ffprobe;
  const log = options?.logger ?? config.logger ?? ((msg: string) => logger.info(msg));
  const now = options?.now ?? config.now ?? (() => new Date());

  const dataDir = config.dataDir;
  const badScansFile = options?.badScansFile ?? config.badScansFile;
  const checkedScansFile = options?.checkedScansFile ?? config.checkedScansFile;

  const minDuration = options?.minDuration ?? config.minDuration;
  const decimalPlaces = 2;
  const isDryRun = options?.dryRun ?? config.dryRun;
  const quarantineDir = options?.quarantineDir ?? config.quarantineDir;
  const saveResults = options?.saveResults ?? config.saveResults;

  const badScans: BadScanDatabase = options?.databases?.badScans ?? getBadScans(badScansFile);
  const checkedScans = options?.databases?.checkedScans ?? getCheckedScans(checkedScansFile);

  const artifactDirs = options?.artifactDirs ?? findArtifactDirectories(dataDir);
  log(`Starting discard clean stage. Found ${artifactDirs.length.toString()} artifacts.`);
  if (isDryRun) {
    log("  [DRY RUN] No changes will be made.");
  }
  if (quarantineDir !== undefined && quarantineDir !== "") {
    log(`  [QUARANTINE] Moving bad artifacts to: ${quarantineDir}`);
  }

  const cleanedIds = new Set<string>();
  for (const [id, entry] of Object.entries(checkedScans)) {
    if (entry.cleanedDate !== undefined && entry.cleanedDate !== "") {
      cleanedIds.add(id);
    }
  }

  const stats: CleanDataStats = {
    failedDeletes: [],
    quarantinedCount: 0,
    removedCount: 0,
    skippedCleanCount: 0
  };

  const artifactsRoot = path.basename(dataDir) === "artifacts" ? dataDir : path.dirname(dataDir);
  const dataRoot = path.dirname(artifactsRoot);
  const remainingArtifacts: string[] = [];

  for (const dir of artifactDirs) {
    const artifactId = path.basename(dir);
    if (shouldSkipEntry(artifactId)) {
      continue;
    }

    if (cleanedIds.has(artifactId)) {
      stats.skippedCleanCount++;
      remainingArtifacts.push(dir);
      continue;
    }

    const videoPath = path.join(dir, "video.mp4");
    const environment = getEnvironmentName(dataDir, dir);

    const reason = await (async (): Promise<string | null> => {
      if (!fsImpl.existsSync(videoPath)) {
        log(`[${artifactId}] Missing video.mp4`);
        return "Missing video.mp4";
      }

      const probe = await probeVideo(videoPath, ffprobeImpl);
      if (!probe.ok) {
        log(`[${artifactId}] Invalid video (ffmpeg probe failed).`);
        return "Invalid video (ffmpeg probe failed)";
      }

      if (probe.duration < minDuration) {
        log(`[${artifactId}] Video too short (${probe.duration.toFixed(decimalPlaces)}s).`);
        return `Video too short (${probe.duration.toFixed(decimalPlaces)}s)`;
      }

      return null;
    })();

    if (reason !== null) {
      const metaPath = path.join(dir, "meta.json");
      let scanDate: string | undefined = undefined;
      if (fsImpl.existsSync(metaPath)) {
        try {
          const metaContent = fs.readFileSync(metaPath, "utf-8");
          const meta = JSON.parse(metaContent) as { scanDate?: string };
          scanDate = meta.scanDate;
        } catch {
          // Ignore parse errors
        }
      }

      const badScanEntry: (typeof badScans)[string] = {
        date: now().toISOString(),
        environment,
        reason
      };
      if (scanDate !== undefined) {
        badScanEntry.scanDate = scanDate;
      }
      badScans[artifactId] = badScanEntry;

      if (!isDryRun) {
        try {
          if (quarantineDir !== undefined && quarantineDir !== "") {
            const destinationName = `${environment}-${artifactId}`;
            const destinationPath = path.join(quarantineDir, destinationName);
            fsImpl.renameSync(dir, destinationPath);
            stats.quarantinedCount++;
            log("  -> Quarantined folder.");
          } else {
            const discardedPath = discardArtifact(dir, { artifactsRoot, dataRoot, fsImpl, reason });
            if (discardedPath !== null) {
              stats.removedCount++;
              log("  -> Moved to discarded-artifacts folder.");
            } else {
              throw new Error("Failed to move artifact to discarded-artifacts");
            }
          }

          if (checkedScans[artifactId]) {
            Reflect.deleteProperty(checkedScans, artifactId);
          }
        } catch (err) {
          log(`  -> Failed to remove/move folder: ${String(err)}`);
          stats.failedDeletes.push(artifactId);
          remainingArtifacts.push(dir);
        }
      } else {
        remainingArtifacts.push(dir);
      }
    } else {
      if (!isDryRun) {
        let entry = checkedScans[artifactId];
        if (entry === undefined) {
          entry = {};
          checkedScans[artifactId] = entry;
        }
        entry.cleanedDate = now().toISOString();
      }
      remainingArtifacts.push(dir);
    }
  }

  if (!isDryRun && saveResults) {
    saveBadScans(badScans, badScansFile);
    saveCheckedScans(checkedScans, checkedScansFile);
  }

  log(
    `Clean stage complete. Discarded: ${stats.removedCount.toString()}. Quarantined: ${stats.quarantinedCount.toString()}. Skipped (Cached): ${stats.skippedCleanCount.toString()}. Failed Moves: ${stats.failedDeletes.length.toString()}.`
  );

  return { databases: { badScans, checkedScans }, remainingArtifacts, stats };
}
