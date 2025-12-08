import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";

import { getBadScans, saveBadScans } from "../utils/badScans";

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
  const badScanIds = new Set(badScans.map((r) => r.id));
  let removedCount = INITIAL_COUNT;

  for (const dir of artifactDirs) {
    const videoPath = path.join(dir, "video.mp4");
    const rawScanPath = path.join(dir, "rawScan.json");
    const arDataPath = path.join(dir, "arData.json");

    const artifactId = path.basename(dir);
    const parentDir = path.dirname(dir);
    const environment = path.basename(parentDir);

    process.stdout.write(`Checking ${artifactId}... `);

    // Check completeness first
    if (!fs.existsSync(videoPath) || !fs.existsSync(rawScanPath) || !fs.existsSync(arDataPath)) {
      console.log("INCOMPLETE. Removing...");
      try {
        fs.rmSync(dir, { force: true, recursive: true });
        removedCount++;
      } catch (e) {
        console.error(`Failed to delete ${dir}:`, e);
      }
      continue;
    }

    const isValid = await checkVideo(videoPath);
    if (!isValid) {
      console.log("INVALID VIDEO. Removing...");

      // Record if not already recorded
      if (!badScanIds.has(artifactId)) {
        badScans.push({
          date: new Date().toISOString(),
          environment,
          id: artifactId,
          reason: "ffprobe failed (corrupt video)"
        });
        badScanIds.add(artifactId);
      }
      try {
        fs.rmSync(dir, { force: true, recursive: true });
        removedCount++;
      } catch (e) {
        console.error(`Failed to delete ${dir}:`, e);
      }
      continue;
    }

    // Check Duration
    const duration = await getVideoDuration(videoPath);
    if (duration < MIN_DURATION) {
      console.log(`TOO SHORT (${duration.toFixed(DECIMAL_PLACES)}s). Removing...`);
      if (!badScanIds.has(artifactId)) {
        badScans.push({
          date: new Date().toISOString(),
          environment,
          id: artifactId,
          reason: `Video too short (${duration.toFixed(DECIMAL_PLACES)}s < 12s)`
        });
        badScanIds.add(artifactId);
      }
      try {
        fs.rmSync(dir, { force: true, recursive: true });
        removedCount++;
      } catch (e) {
        console.error(`Failed to delete ${dir}:`, e);
      }
    } else {
      console.log("OK");
    }
  }

  saveBadScans(badScans);
  console.log(`\nCleanup complete.`);
  console.log(`Removed ${removedCount.toString()} corrupt artifacts.`);
  console.log(`Total bad scans recorded: ${badScans.length.toString()}`);
}

function mainWrapper() {
  main().catch(console.error);
}
mainWrapper();
