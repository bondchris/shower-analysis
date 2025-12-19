import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";

import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";
import { logger } from "../utils/logger";

/**
 * Script to clean up the data directory.
 * - Iterates through all artifacts in `data/artifacts`.
 * - Checks for missing `video.mp4` or invalid video files.
 * - Checks if video is too short.
 * - Deletes invalid artifacts to save space and ensure dataset quality.
 * - Updates `badScans.json` with reasons for deletion.
 */

export interface CleanDataOptions {
  dataDir?: string;
  badScansFile?: string;
  checkedScansFile?: string; // Add option for checked scans
  dryRun?: boolean;
  quarantineDir?: string;
  minDuration?: number;
  now?: () => Date;
  logger?: (msg: string) => void;
  fs?: Pick<typeof fs, "existsSync" | "readdirSync" | "statSync" | "rmSync" | "renameSync">;
  ffprobe?: typeof ffmpeg.ffprobe;
}

export interface CleanDataStats {
  removedCount: number;
  quarantinedCount: number;
  skippedCleanCount: number;
  failedDeletes: string[];
}

// Minimal interface for ffprobe metadata
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
  const ZERO = 0;
  const defDuration = defaultDuration ?? ZERO;

  const result = await new Promise<{ ok: boolean; duration: number }>((resolve) => {
    ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        resolve({ duration: defDuration, ok: false });
        return;
      }

      const data = metadata as FfprobeData | undefined;
      const raw = data?.format?.duration;
      // Explicitly check for number, finite, and non-negative
      const duration = typeof raw === "number" && Number.isFinite(raw) && raw >= ZERO ? raw : defDuration;

      // We consider it OK if ffprobe succeeded, but caller might enforce min duration
      resolve({ duration, ok: true });
    });
  });

  return result;
}

export async function main(opts?: CleanDataOptions): Promise<CleanDataStats> {
  const fsImpl = opts?.fs ?? fs;
  const ffprobeImpl = opts?.ffprobe ?? ffmpeg.ffprobe;
  const log = opts?.logger ?? ((msg: string) => logger.info(msg));
  const now = opts?.now ?? (() => new Date());

  const DATA_DIR = opts?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  // Allow paths to pass to utils
  const BAD_SCANS_FILE = opts?.badScansFile;
  const CHECKED_SCANS_FILE = opts?.checkedScansFile;

  const DEFAULT_MIN_DURATION = 12;
  const MIN_DURATION = opts?.minDuration ?? DEFAULT_MIN_DURATION;
  const DECIMAL_PLACES = 2;
  const INITIAL_COUNT = 0;

  const DRY_RUN = opts?.dryRun ?? false;
  const QUARANTINE_DIR = opts?.quarantineDir;

  log("Starting data cleaning...");
  if (DRY_RUN) {
    log("  [DRY RUN] No changes will be made.");
  }
  if (QUARANTINE_DIR !== undefined && QUARANTINE_DIR !== "") {
    log(`  [QUARANTINE] Moving bad artifacts to: ${QUARANTINE_DIR}`);
  }

  const artifactDirs = findArtifactDirectories(DATA_DIR);
  log(`Found ${artifactDirs.length.toString()} directories to check.`);

  // Load dbs
  const badScans = getBadScans(BAD_SCANS_FILE);
  const checkedScans = getCheckedScans(CHECKED_SCANS_FILE);

  const cleanScanIds = new Set<string>();
  for (const [id, entry] of Object.entries(checkedScans)) {
    if (entry.cleanedDate !== undefined && entry.cleanedDate !== "") {
      cleanScanIds.add(id);
    }
  }

  const stats: CleanDataStats = {
    failedDeletes: [],
    quarantinedCount: INITIAL_COUNT,
    removedCount: INITIAL_COUNT,
    skippedCleanCount: INITIAL_COUNT
  };

  const MIN_NESTING_DEPTH = 1;
  const ENV_PARENT_OFFSET = 2;

  for (const dir of artifactDirs) {
    const artifactId = path.basename(dir);

    // Robust environment detection: relative path from data root
    // e.g. data/artifacts/prod/uuid -> prod
    // e.g. data/artifacts/uuid -> (empty string) -> "unknown"
    const relPath = path.relative(DATA_DIR, dir);
    const parts = relPath.split(path.sep);
    // If nested (parts > 1), parent dir name is environment. Else "unknown".
    const environment =
      parts.length > MIN_NESTING_DEPTH ? (parts[parts.length - ENV_PARENT_OFFSET] ?? "unknown") : "unknown";

    // Skip if already known clean
    if (cleanScanIds.has(artifactId)) {
      stats.skippedCleanCount++;
      continue;
    }

    // Skip .DS_Store
    if (artifactId === ".DS_Store" || artifactId.startsWith(".")) {
      continue;
    }

    const artifactDir = dir;
    const videoPath = path.join(artifactDir, "video.mp4");

    const reason = await (async (): Promise<string | null> => {
      // 1. Missing Video
      if (!fsImpl.existsSync(videoPath)) {
        log(`[${artifactId}] Missing video.mp4`);
        return "Missing video.mp4";
      }

      // 2. Previously marked bad (cleanup)
      const { ok, duration } = await probeVideo(videoPath, ffprobeImpl);

      if (!ok) {
        log(`[${artifactId}] Invalid video (ffmpeg probe failed).`);
        return "Invalid video (ffmpeg probe failed)";
      }

      if (duration < MIN_DURATION) {
        log(`[${artifactId}] Video too short (${duration.toFixed(DECIMAL_PLACES)}s).`);
        return `Video too short (${duration.toFixed(DECIMAL_PLACES)}s)`;
      }

      return null;
    })();

    if (reason !== null) {
      // It is bad.
      badScans[artifactId] = {
        date: now().toISOString(),
        environment,
        reason
      };

      if (!DRY_RUN) {
        try {
          if (QUARANTINE_DIR !== undefined && QUARANTINE_DIR !== "") {
            const destName = `${environment}-${artifactId}`;
            const destPath = path.join(QUARANTINE_DIR, destName);
            fsImpl.renameSync(artifactDir, destPath);
            stats.quarantinedCount++;
            log("  -> Quarantined folder.");
          } else {
            fsImpl.rmSync(artifactDir, { force: true, recursive: true });
            stats.removedCount++;
            log("  -> Deleted folder.");
          }

          // If it was in checked scans, remove it?
          if (checkedScans[artifactId]) {
            Reflect.deleteProperty(checkedScans, artifactId);
          }
        } catch (e) {
          const msg = String(e);
          log(`  -> Failed to remove/move folder: ${msg}`);
          stats.failedDeletes.push(artifactId);
        }
      }
    } else if (!DRY_RUN) {
      // Clean
      let entry = checkedScans[artifactId];
      if (entry === undefined) {
        entry = {};
        checkedScans[artifactId] = entry;
      }
      entry.cleanedDate = now().toISOString();
    }
  }

  if (!DRY_RUN) {
    saveBadScans(badScans, BAD_SCANS_FILE);
    saveCheckedScans(checkedScans, CHECKED_SCANS_FILE);
  }

  log(
    `Clean complete. Removed: ${stats.removedCount.toString()}. Quarantined: ${stats.quarantinedCount.toString()}. Skipped (Cached): ${stats.skippedCleanCount.toString()}. Failed Deletes: ${stats.failedDeletes.length.toString()}.`
  );

  return stats;
}

if (require.main === module) {
  main().catch((err: unknown) => logger.error(err));
}
