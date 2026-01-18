import * as fs from "fs";
import * as path from "path";

import { FilterStats } from "../../models/discardStats";
import { GeminiService } from "../../services/geminiService";
import { getBadScans, saveBadScans } from "../../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../../utils/data/checkedScans";
import { discardArtifact } from "../../utils/data/discardArtifact";
import { findArtifactDirectories } from "../../utils/data/artifactIterator";
import { logger } from "../../utils/logger";
import { createProgressBar } from "../../utils/progress";
import { DiscardConfig, FilterOptions, FilterPhaseOptions, FilterPhaseResult } from "./types";
import { buildDiscardConfig } from "./config";

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
  const modelName = "gemini-3-pro-preview";

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
    stats.skipped++;
    return stats;
  }

  if (!dir.includes("data/artifacts") && !dryRun) {
    logger.error(`SAFETY: Skipping discard of unsafe path: ${dir}`);
    stats.errors++;
    return stats;
  }
  if (!fs.existsSync(path.join(dir, "meta.json"))) {
    logger.error(`SAFETY: Skipping discard of artifact without meta.json: ${dir}`);
    stats.errors++;
    return stats;
  }

  const parentDir = path.dirname(dir);
  const environment = path.basename(parentDir);

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

    const classification = classifyGeminiAnswer(text);

    if (classification === "NO") {
      logger.info(`  -> ${artifactId}: NOT A BATHROOM. Discarding...`);

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

      const createBadScanEntry = (): (typeof badScans)[string] => {
        const entry: (typeof badScans)[string] = {
          date: new Date().toISOString(),
          environment,
          reason: `Not a bathroom (Gemini ${modelName})`
        };
        if (scanDate !== undefined) {
          entry.scanDate = scanDate;
        }
        return entry;
      };

      if (!dryRun) {
        try {
          const artifactsRoot = path.resolve(dir, "..", "..");
          const dataRoot = path.dirname(artifactsRoot);
          const filterReason = `Not a bathroom (Gemini ${modelName})`;
          const discardedPath = discardArtifact(dir, { artifactsRoot, dataRoot, reason: filterReason });
          if (discardedPath !== null) {
            badScans[artifactId] = createBadScanEntry();
            stats.removed++;
          } else {
            throw new Error("Failed to move artifact to discarded-artifacts");
          }
        } catch (err) {
          logger.error(`  -> ${artifactId}: Failed to discard: ${String(err)}`);
          stats.errors++;
        }
      } else {
        logger.info(`  -> ${artifactId}: [DRY RUN] Would discard.`);
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
        entry.filteredModel = modelName;
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
  const defaultSaveInterval = 50;
  const saveInterval = options.saveInterval ?? defaultSaveInterval;
  const initialSaveCount = 0;
  let processedSinceLastSave = initialSaveCount;

  const progressTemplate = "Filtering |{bar}| {percentage}% | {value}/{total} Artifacts | ETA: {eta}s";
  const bar = createProgressBar(progressTemplate);
  const initialProgress = 0;
  bar.start(queue.length, initialProgress);

  const defaultConcurrency = 5;
  const concurrency = options.concurrency ?? defaultConcurrency;
  const dryRun = options.dryRun ?? false;

  const workers = Array(concurrency)
    .fill(null)
    .map(async () => {
      const emptyQueueThreshold = 0;
      while (queue.length > emptyQueueThreshold) {
        const dir = queue.shift();
        if (dir !== undefined) {
          const stats = await processArtifact(dir, service, badScans, checkedScanIds, checkedScans, {
            dryRun
          });

          globalStats.processed += stats.processed;
          globalStats.removed += stats.removed;
          globalStats.skipped += stats.skipped;
          globalStats.skippedCached += stats.skippedCached;
          globalStats.skippedAmbiguous += stats.skippedAmbiguous;
          globalStats.errors += stats.errors;

          processedSinceLastSave++;
          if (processedSinceLastSave >= saveInterval) {
            processedSinceLastSave = initialSaveCount;
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

export async function runFilterPhase(
  options?: FilterPhaseOptions,
  configInput?: DiscardConfig
): Promise<FilterPhaseResult> {
  const config = configInput ?? buildDiscardConfig(options);
  const dataDir = config.dataDir;
  const badScansFile = options?.badScansFile ?? config.badScansFile;
  const checkedScansFile = options?.checkedScansFile ?? config.checkedScansFile;
  const isDryRun = options?.dryRun ?? config.dryRun;
  const saveResults = options?.saveResults ?? config.saveResults;

  const badScans = options?.databases?.badScans ?? getBadScans(badScansFile);
  const checkedScans = options?.databases?.checkedScans ?? getCheckedScans(checkedScansFile);

  const artifactDirs = options?.artifactDirs ?? findArtifactDirectories(dataDir);
  logger.info(`Starting discard filter stage. Found ${artifactDirs.length.toString()} artifacts.`);

  const checkedScanIds = new Set<string>();
  for (const [id, entry] of Object.entries(checkedScans)) {
    if (entry.filteredDate !== undefined && entry.filteredDate !== "") {
      checkedScanIds.add(id);
    }
  }

  const concurrency = options?.concurrency ?? config.concurrency;
  const defaultSaveInterval = 50;
  const saveInterval = options?.saveInterval ?? defaultSaveInterval;
  const service = options?.service ?? config.service ?? new GeminiService();

  const save = () => {
    if (!isDryRun && saveResults) {
      saveBadScans(badScans, badScansFile);
      saveCheckedScans(checkedScans, checkedScansFile);
    }
  };

  const stats = await runBatchProcessing(artifactDirs, service, badScans, checkedScanIds, checkedScans, save, {
    concurrency,
    dryRun: isDryRun,
    saveInterval
  });

  if (!isDryRun && saveResults) {
    saveBadScans(badScans, badScansFile);
    saveCheckedScans(checkedScans, checkedScansFile);
  }

  logger.info(
    `Filter stage complete. Processed: ${stats.processed.toString()}, Removed: ${stats.removed.toString()}, Skipped Cached: ${stats.skippedCached.toString()}, Skipped Ambiguous: ${stats.skippedAmbiguous.toString()}, Errors: ${stats.errors.toString()}.`
  );

  return {
    databases: { badScans, checkedScans },
    processedArtifacts: artifactDirs,
    stats
  };
}
