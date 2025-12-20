import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

import { GeminiService } from "../services/geminiService";
import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";

/**
 * Script to filter out non-bathroom scans using Gemini Vision.
 * - Iterates through artifacts not yet checked or flagged bad.
 * - Sends the first frame (or video) to Gemini to ask "Is this a bathroom?".
 * - If NO, deletes the artifact and adds to `badScans.json`.
 * - If YES, marks as checked in `checkedScans.json`.
 */

dotenv.config({ quiet: true } as dotenv.DotenvConfigOptions);

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

export function classifyGeminiAnswer(textRaw: string): "YES" | "NO" | "AMBIGUOUS" {
  const text = textRaw.trim().toUpperCase();
  const normalized = text.replace(/[^\w\s]/g, " ");
  const hasYes = /\bYES\b/.test(normalized);
  const hasNo = /\bNO\b/.test(normalized);

  if (hasNo && !hasYes) {
    return "NO";
  }
  if (hasYes && !hasNo) {
    return "YES";
  }
  return "AMBIGUOUS";
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
    logger.error(`SAFETY: Skipping deletion of unsafe path: ${dir}`);
    stats.errors++;
    return stats;
  }
  if (!fs.existsSync(path.join(dir, "meta.json"))) {
    logger.error(`SAFETY: Skipping deletion of artifact without meta.json: ${dir}`);
    stats.errors++;
    return stats;
  }

  const parentDir = path.dirname(dir);
  const environment = path.basename(parentDir);

  // logger.info(`Checking ${artifactId} [${environment}]...`);

  try {
    const videoBuffer = fs.readFileSync(videoPath);
    const prompt = "Is this video showing a bathroom? Reply YES or NO.";

    const text = await service.generateContent(prompt, [
      {
        inlineData: {
          data: videoBuffer.toString("base64"),
          mimeType: "video/mp4"
        }
      }
    ]);

    // logger.info(`  -> ${artifactId}: Gemini says: ${text}`);

    const classification = classifyGeminiAnswer(text);

    if (classification === "NO") {
      logger.info(`  -> ${artifactId}: NOT A BATHROOM. Removing...`);

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
          logger.error(`  -> ${artifactId}: Failed to delete: ${String(e)}`);
          stats.errors++;
        }
      } else {
        logger.info(`  -> ${artifactId}: [DRY RUN] Would remove.`);
        stats.removed++;
      }
    } else if (classification === "YES") {
      logger.info(`  -> ${artifactId}: Kept.`);
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
      logger.info(`  -> ${artifactId}: AMBIGUOUS response ("${text}"). Skipping.`);
      stats.skippedAmbiguous++;
    }

    stats.processed++;
  } catch (err) {
    logger.error(`  -> ${artifactId}: Error processing video: ${String(err)}`);
    stats.errors++;
  }

  return stats;
}

interface BatchOptions extends FilterOptions {
  saveInterval?: number;
}

export async function runBatchProcessing(
  artifactDirs: string[],
  service: GeminiService,
  badScans: ReturnType<typeof getBadScans>,
  checkedScanIds: Set<string>,
  checkedScans: ReturnType<typeof getCheckedScans>,
  saveCallback: () => void,
  options: BatchOptions
): Promise<FilterStats> {
  const globalStats: FilterStats = {
    errors: 0,
    processed: 0,
    removed: 0,
    skipped: 0,
    skippedAmbiguous: 0,
    skippedCached: 0
  };

  const queue = [...artifactDirs];
  const ZERO = 0;
  const QUEUE_EMPTY = ZERO;
  const DEFAULT_SAVE_INTERVAL = 50;
  const SAVE_INTERVAL = options.saveInterval ?? DEFAULT_SAVE_INTERVAL;
  let processedSinceLastSave = ZERO;

  const bar = createProgressBar("Filtering |{bar}| {percentage}% | {value}/{total} Artifacts | ETA: {eta}s");
  const INITIAL_PROGRESS = 0;
  bar.start(queue.length, INITIAL_PROGRESS);

  const DEFAULT_CONCURRENCY = 5;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const dryRun = options.dryRun ?? false;

  const workers = Array(concurrency)
    .fill(null)
    .map(async () => {
      while (queue.length > QUEUE_EMPTY) {
        const dir = queue.shift();
        if (dir !== undefined) {
          const stats = await processArtifact(dir, service, badScans, checkedScanIds, checkedScans, {
            dryRun
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
            saveCallback();
          }
          bar.increment();
        }
      }
    });

  await Promise.all(workers);
  bar.stop();

  return globalStats;
}

export async function main() {
  const service = new GeminiService();

  // Configuration
  const CONCURRENCY = Number(process.env["BATHROOM_FILTER_CONCURRENCY"] ?? "5");
  const DRY_RUN = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";

  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");

  logger.info(`Starting Filter. Concurrency: ${CONCURRENCY.toString()}, Dry Run: ${String(DRY_RUN)}`);

  const artifactDirs = findArtifactDirectories(DATA_DIR);
  logger.info(`Found ${artifactDirs.length.toString()} artifacts.`);

  const badScans = getBadScans();
  const checkedScans = getCheckedScans();

  const checkedScanIds = new Set<string>();
  for (const [id, entry] of Object.entries(checkedScans)) {
    if (entry.filteredDate !== undefined && entry.filteredDate !== "") {
      checkedScanIds.add(id);
    }
  }

  logger.info(`Loaded ${Object.keys(checkedScans).length.toString()} checked scans.`);

  // Periodic Save Helper
  const saveDB = () => {
    if (!DRY_RUN) {
      saveBadScans(badScans);
      saveCheckedScans(checkedScans);
    }
  };

  const globalStats = await runBatchProcessing(artifactDirs, service, badScans, checkedScanIds, checkedScans, saveDB, {
    concurrency: CONCURRENCY,
    dryRun: DRY_RUN
  });

  saveDB(); // Final save

  logger.info("Scan complete.");
  logger.info(`Processed: ${globalStats.processed.toString()}`);
  logger.info(`Removed: ${globalStats.removed.toString()}`);
  logger.info(`Skipped (Cached): ${globalStats.skippedCached.toString()}`);
  logger.info(`Skipped (Ambiguous): ${globalStats.skippedAmbiguous.toString()}`);
  logger.info(`Errors: ${globalStats.errors.toString()}`);
}

if (require.main === module) {
  main().catch((err: unknown) => logger.error(err));
}
