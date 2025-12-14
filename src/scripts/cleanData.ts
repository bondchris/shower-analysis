import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";

import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";

/**
 * Script to clean up the data directory.
 * - Iterates through all artifacts in `data/artifacts`.
 * - Checks for missing `video.mp4` or invalid video files.
 * - Checks if video is too short.
 * - Deletes invalid artifacts to save space and ensure dataset quality.
 * - Updates `badScans.json` with reasons for deletion.
 */

async function checkVideo(filePath: string): Promise<boolean> {
  const success = await new Promise<boolean>((resolve) => {
    ffmpeg.ffprobe(filePath, (err) => {
      if (err !== null && err !== undefined) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
  return success;
}

function findArtifactDirectories(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Check if it looks like an artifact dir (has UUID-like name)
      // Simple heuristic: if it contains meta.json directly, it's a candidate
      // identifying by meta.json allows us to catch incomplete artifacts that have meta but no video
      if (fs.existsSync(path.join(fullPath, "meta.json"))) {
        results.push(fullPath);
      } else {
        // Recurse (e.g., data/env/uuid)
        results.push(...findArtifactDirectories(fullPath));
      }
    }
  }
  return results;
}

async function getVideoDuration(filePath: string): Promise<number> {
  const DEFAULT_DURATION = 0;
  const duration = await new Promise<number>((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        resolve(DEFAULT_DURATION);
        return;
      }
      resolve(metadata.format.duration ?? DEFAULT_DURATION);
    });
  });
  return duration;
}

async function main() {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const BAD_SCANS_FILE = path.join(process.cwd(), "config", "badScans.json");
  const JSON_INDENT = 2;
  const INITIAL_COUNT = 0;
  const MIN_DURATION = 12;
  const DECIMAL_PLACES = 2;

  // Ensure bad-scans.json exists
  if (!fs.existsSync(BAD_SCANS_FILE)) {
    fs.writeFileSync(BAD_SCANS_FILE, JSON.stringify([], null, JSON_INDENT));
  }

  console.log("Starting data cleaning...");
  const artifactDirs = findArtifactDirectories(DATA_DIR);
  console.log(`Found ${artifactDirs.length.toString()} directories to check.`);

  const badScans = getBadScans();

  // Load clean scan cache
  const checkedScans = getCheckedScans();
  const cleanScanIds = new Set<string>();
  for (const [id, entry] of Object.entries(checkedScans)) {
    if (entry.cleanedDate !== undefined && entry.cleanedDate !== "") {
      cleanScanIds.add(id);
    }
  }

  let removedCount = INITIAL_COUNT;
  let skippedCleanCount = INITIAL_COUNT;

  for (const dir of artifactDirs) {
    const artifactId = path.basename(dir);
    const parentDir = path.dirname(dir);
    const environment = path.basename(parentDir);

    // Skip if already known clean
    if (cleanScanIds.has(artifactId)) {
      skippedCleanCount++;
      continue;
    }

    // Skip .DS_Store
    if (artifactId === ".DS_Store" || artifactId.startsWith(".")) {
      continue;
    }

    const artifactDir = dir;
    // Checking video file
    const videoPath = path.join(artifactDir, "video.mp4");

    if (!fs.existsSync(videoPath)) {
      console.log(`[${artifactId}] Missing video.mp4`);

      badScans[artifactId] ??= {
        date: new Date().toISOString(),
        environment: "unknown",
        reason: "Missing video.mp4"
      };

      try {
        fs.rmSync(artifactDir, { force: true, recursive: true });
        removedCount++;
        console.log("  -> Deleted folder.");
      } catch (e) {
        console.error(`  -> Failed to delete folder: ${String(e)}`);
      }
      continue;
    }

    // Check if it is marked bad (but somehow exists)
    if (artifactId in badScans) {
      console.log(`[${artifactId}] Is marked bad but exists. Deleting...`);
      try {
        fs.rmSync(artifactDir, { force: true, recursive: true });
        removedCount++;
      } catch {
        // ignore
      }
      continue;
    }

    // Check video integrity and duration - skipping actual ffmpeg check for now as it wasn't in the original replacement intended scope?
    // Wait, the original code had checkVideoIntegrity calls?
    // Looking at file content, I don't see `checkVideoIntegrity` function defined?
    // Ah, `checkVideo` was defined at top. `getVideoDuration` too.
    // The previous code called `checkVideoIntegrity` which seems undefined in the file dump I saw?
    // Wait, in Step 4116 `cleanData.ts` dump:
    // Line 8: `async function checkVideo(filePath: string): Promise<boolean>`
    // Line 46: `async function getVideoDuration(filePath: string): Promise<number>`
    // But lines 159 called `checkVideoIntegrity`?
    // "Line 159: const integrity = await checkVideoIntegrity(videoPath);"
    // This implies `checkVideoIntegrity` IS defined somewhere or imported?
    // But it's not in the imports or top level functions I saw.
    // Maybe checking `cleanData.ts` again... I see `checkVideo` and `getVideoDuration`.
    // I suspect `checkVideoIntegrity` was a hallucination in the *previous* edit or implied content?
    // Actually, I should use `checkVideo` and `getVideoDuration`.

    const isValid = await checkVideo(videoPath);
    if (!isValid) {
      console.log(`[${artifactId}] Invalid video (ffmpeg probe failed).`);
      badScans[artifactId] ??= {
        date: new Date().toISOString(),
        environment,
        reason: "Invalid video (ffmpeg probe failed)"
      };
      try {
        fs.rmSync(artifactDir, { force: true, recursive: true });
        removedCount++;
      } catch (e) {
        console.error(String(e));
      }
      continue;
    }

    const duration = await getVideoDuration(videoPath);
    if (duration < MIN_DURATION) {
      console.log(`[${artifactId}] Video too short (${duration.toFixed(DECIMAL_PLACES)}s).`);
      badScans[artifactId] ??= {
        date: new Date().toISOString(),
        environment,
        reason: `Video too short (${duration.toFixed(DECIMAL_PLACES)}s)`
      };
      try {
        fs.rmSync(artifactDir, { force: true, recursive: true });
        removedCount++;
      } catch (e) {
        console.error(String(e));
      }
      continue;
    }

    // If passed all checks, mark as clean
    // console.log("OK"); // Optional
    let entry = checkedScans[artifactId];
    if (entry === undefined) {
      entry = {};
      checkedScans[artifactId] = entry;
    }
    entry.cleanedDate = new Date().toISOString();

    // Periodic save? Or save at end?
    // The previous loop saved `checkedScans` constantly which is safe but slow.
    // Let's save every 10 or so? Or just let it be.
  }

  saveBadScans(badScans);
  saveCheckedScans(checkedScans);
  console.log(
    `\nClean complete. Removed: ${removedCount.toString()}. Skipped (Cached): ${skippedCleanCount.toString()}.`
  );
}

function mainWrapper() {
  main().catch(console.error);
}
mainWrapper();
