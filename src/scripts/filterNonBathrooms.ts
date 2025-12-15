import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

import { GeminiService } from "../services/geminiService";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";

/**
 * Script to filter out non-bathroom scans using Gemini Vision.
 * - Iterates through artifacts not yet checked or flagged bad.
 * - Sends the first frame (or video) to Gemini to ask "Is this a bathroom?".
 * - If NO, deletes the artifact and adds to `badScans.json`.
 * - If YES, marks as checked in `checkedScans.json`.
 */

dotenv.config();

export const MODEL_NAME = "gemini-3-pro-preview";

export interface FilterOptions {
  concurrency?: number;
  dryRun?: boolean;
}

export interface FilterStats {
  errors: number;
  processed: number;
  removed: number;
  skipped: number;
  skippedAmbiguous: number;
  skippedCached: number;
}

export function findArtifactDirectories(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }

  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of list) {
      if (ent.isDirectory()) {
        const fullPath = path.join(dir, ent.name);
        // Optimization: Check for meta.json directly instead of recursing blindly
        if (fs.existsSync(path.join(fullPath, "meta.json"))) {
          results.push(fullPath);
        } else {
          results.push(...findArtifactDirectories(fullPath));
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}: ${String(err)}`);
  }

  return results;
}

export async function processArtifact(
  dir: string,
  service: GeminiService,
  badScans: ReturnType<typeof getBadScans>,
  checkedScanIds: Set<string>,
  checkedScans: ReturnType<typeof getCheckedScans>,
  options: FilterOptions = {}
): Promise<FilterStats> {
  const stats: FilterStats = {
    errors: 0,
    processed: 0,
    removed: 0,
    skipped: 0,
    skippedAmbiguous: 0,
    skippedCached: 0
  };

  const artifactId = path.basename(dir);
  const dryRun = options.dryRun ?? false;

  // 1. Skip checks
  if (artifactId in badScans) {
    stats.skippedCached++;
    return stats;
  }
  if (checkedScanIds.has(artifactId)) {
    stats.skippedCached++;
    return stats;
  }

  const videoPath = path.join(dir, "video.mp4");
  if (!fs.existsSync(videoPath)) {
    stats.skipped++; // Missing video
    return stats;
  }

  // 2. Safety Validation
  // Ensure we are inside data/artifacts (rudimentary check, can be improved)
  if (!dir.includes("data/artifacts") && !dryRun) {
    console.error(`SAFETY: Skipping deletion of unsafe path: ${dir}`);
    stats.errors++;
    return stats;
  }
  if (!fs.existsSync(path.join(dir, "meta.json"))) {
    console.error(`SAFETY: Skipping deletion of artifact without meta.json: ${dir}`);
    stats.errors++;
    return stats;
  }

  const parentDir = path.dirname(dir);
  const environment = path.basename(parentDir);

  console.log(`Checking ${artifactId} [${environment}]...`);

  try {
    const videoBuffer = fs.readFileSync(videoPath);
    const prompt = "Is this video showing a bathroom? Reply YES or NO.";

    let text = "";
    text = (
      await service.generateContent(prompt, [
        {
          inlineData: {
            data: videoBuffer.toString("base64"),
            mimeType: "video/mp4"
          }
        }
      ])
    )
      .trim()
      .toUpperCase();

    console.log(`  -> ${artifactId}: Gemini says: ${text}`);

    // Strict Parsing
    // Remove punctuation to handle "NO." or "YES!"
    const normalized = text.replace(/[^\w\s]/g, " ");
    const hasYes = /\bYES\b/.test(normalized);
    const hasNo = /\bNO\b/.test(normalized);

    if (hasNo && !hasYes) {
      console.log(`  -> ${artifactId}: NOT A BATHROOM. Removing...`);

      if (!dryRun) {
        // Only mark BAD if we actually delete it successfully
        try {
          fs.rmSync(dir, { force: true, recursive: true });

          // Successful delete -> record bad scan
          badScans[artifactId] = {
            date: new Date().toISOString(),
            environment,
            reason: `Not a bathroom (Gemini ${MODEL_NAME})`
          };
          stats.removed++;
        } catch (e) {
          console.error(`  -> ${artifactId}: Failed to delete: ${String(e)}`);
          stats.errors++;
        }
      } else {
        console.log(`  -> ${artifactId}: [DRY RUN] Would remove.`);
        stats.removed++;
      }
    } else if (hasYes && !hasNo) {
      console.log(`  -> ${artifactId}: Kept.`);
      if (!dryRun) {
        let entry = checkedScans[artifactId];
        if (entry === undefined) {
          entry = {};
          checkedScans[artifactId] = entry;
        }
        entry.filteredDate = new Date().toISOString();
        entry.filteredModel = MODEL_NAME;
        checkedScanIds.add(artifactId);
      }
    } else {
      console.log(`  -> ${artifactId}: AMBIGUOUS response ("${text}"). Skipping.`);
      stats.skippedAmbiguous++;
    }

    stats.processed++;
  } catch (err) {
    console.error(`  -> ${artifactId}: Error processing video: ${String(err)}`);
    stats.errors++;
  }

  return stats;
}

export async function main() {
  const service = new GeminiService();

  // Configuration
  const CONCURRENCY = Number(process.env["BATHROOM_FILTER_CONCURRENCY"] ?? "5");
  const DRY_RUN = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";

  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");

  console.log(`Starting Filter. Concurrency: ${CONCURRENCY.toString()}, Dry Run: ${String(DRY_RUN)}`);

  const artifactDirs = findArtifactDirectories(DATA_DIR);
  console.log(`Found ${artifactDirs.length.toString()} artifacts.`);

  const badScans = getBadScans();
  const checkedScans = getCheckedScans();

  const checkedScanIds = new Set<string>();
  for (const [id, entry] of Object.entries(checkedScans)) {
    if (entry.filteredDate !== undefined && entry.filteredDate !== "") {
      checkedScanIds.add(id);
    }
  }

  console.log(`Loaded ${Object.keys(checkedScans).length.toString()} checked scans.`);

  const globalStats: FilterStats = {
    errors: 0,
    processed: 0,
    removed: 0,
    skipped: 0,
    skippedAmbiguous: 0,
    skippedCached: 0
  };

  // Process in chunks/queue
  const queue = [...artifactDirs];
  const ZERO = 0;
  const QUEUE_EMPTY = ZERO;

  // Periodic Save Config
  const SAVE_INTERVAL = 50;
  let processedSinceLastSave = ZERO;

  // Save helper
  const saveDB = () => {
    if (!DRY_RUN) {
      saveBadScans(badScans);
      saveCheckedScans(checkedScans);
      console.log("  [Checkpoint] DB Saved.");
    }
  };

  const workers = Array(CONCURRENCY)
    .fill(null)
    .map(async () => {
      while (queue.length > QUEUE_EMPTY) {
        const dir = queue.shift();
        if (dir !== undefined) {
          const stats = await processArtifact(dir, service, badScans, checkedScanIds, checkedScans, {
            dryRun: DRY_RUN
          });

          // Accumulate stats (not thread-safe strictly but JS is single threaded event loop so OK)
          globalStats.processed += stats.processed;
          globalStats.removed += stats.removed;
          globalStats.skipped += stats.skipped;
          globalStats.skippedCached += stats.skippedCached;
          globalStats.skippedAmbiguous += stats.skippedAmbiguous;
          globalStats.errors += stats.errors;

          processedSinceLastSave++;
          if (processedSinceLastSave >= SAVE_INTERVAL) {
            processedSinceLastSave = ZERO;
            saveDB();
          }
        }
      }
    });

  await Promise.all(workers);

  saveDB(); // Final save

  console.log("\nScan complete.");
  console.log(`Processed: ${globalStats.processed.toString()}`);
  console.log(`Removed: ${globalStats.removed.toString()}`);
  console.log(`Skipped (Cached): ${globalStats.skippedCached.toString()}`);
  console.log(`Skipped (Ambiguous): ${globalStats.skippedAmbiguous.toString()}`);
  console.log(`Errors: ${globalStats.errors.toString()}`);
}

if (require.main === module) {
  main().catch(console.error);
}
