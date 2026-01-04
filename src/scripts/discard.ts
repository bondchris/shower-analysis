import * as dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";

import { BadScanDatabase } from "../models/badScanRecord";
import { CheckedScanDatabase } from "../models/checkedScanRecord";
import {
  BadScanHistoryEntry,
  CleanDataStats,
  DateMismatch,
  DiscardReportInput,
  DiscardStage,
  DiscardStats,
  DiscardedArtifact,
  DuplicateStats,
  DuplicateVideo,
  EnvCounts,
  FilterStats,
  VideoHeaderAnomaly
} from "../models/discardStats";
import { GeminiService } from "../services/geminiService";
import { buildDiscardReport } from "../templates/discardReport";
import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";
import { discardArtifact } from "../utils/data/discardArtifact";
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
import { hashVideoInDirectory } from "../utils/video/hash";
import { extractVideoMetadata } from "../utils/video/metadata";

export type {
  CleanDataStats,
  DiscardedArtifact,
  DiscardStats,
  DuplicateStats,
  FilterStats
} from "../models/discardStats";

dotenv.config({ quiet: true } as dotenv.DotenvConfigOptions);

export interface CleanDataOptions {
  dataDir?: string;
  badScansFile?: string;
  checkedScansFile?: string;
  dryRun?: boolean;
  quarantineDir?: string;
  minDuration?: number;
  now?: () => Date;
  logger?: (msg: string) => void;
  fs?: Pick<
    typeof fs,
    "existsSync" | "readdirSync" | "statSync" | "renameSync" | "mkdirSync" | "rmSync" | "writeFileSync"
  >;
  ffprobe?: typeof ffmpeg.ffprobe;
}

export interface FilterOptions {
  concurrency?: number;
  dryRun?: boolean;
}

interface DiscardDatabases {
  badScans: ReturnType<typeof getBadScans>;
  checkedScans: ReturnType<typeof getCheckedScans>;
}

export interface CleanPhaseOptions extends CleanDataOptions {
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  saveResults?: boolean;
}

export interface CleanPhaseResult {
  stats: CleanDataStats;
  databases: DiscardDatabases;
  remainingArtifacts: string[];
}

export interface FilterPhaseOptions extends FilterOptions {
  dataDir?: string;
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  badScansFile?: string;
  checkedScansFile?: string;
  service?: GeminiService;
  saveInterval?: number;
  saveResults?: boolean;
}

export interface FilterPhaseResult {
  stats: FilterStats;
  databases: DiscardDatabases;
  processedArtifacts: string[];
}

export interface DuplicatesPhaseOptions {
  dataDir?: string;
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  videoHashes?: VideoHashDatabase;
  badScansFile?: string;
  videoHashesFile?: string;
  dryRun?: boolean;
  saveResults?: boolean;
}

export interface DuplicatesPhaseResult {
  stats: DuplicateStats;
  databases: DiscardDatabases;
  videoHashes: VideoHashDatabase;
  duplicates: DuplicateVideo[];
  remainingArtifacts: string[];
}

export interface MismatchStats {
  processed: number;
  mismatchCount: number;
  newMismatchCount: number;
  skippedCached: number;
  headerAnomalyCount: number;
  newHeaderAnomalyCount: number;
  errors: number;
}

export interface MismatchPhaseOptions {
  dataDir?: string;
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  checkedScansFile?: string;
  dryRun?: boolean;
  saveResults?: boolean;
}

export interface MismatchPhaseResult {
  stats: MismatchStats;
  databases: DiscardDatabases;
  dateMismatches: DateMismatch[];
  videoHeaderAnomalies: VideoHeaderAnomaly[];
}

export interface DiscardOptions
  extends CleanPhaseOptions, FilterPhaseOptions, DuplicatesPhaseOptions, MismatchPhaseOptions {
  skipClean?: boolean;
  skipFilter?: boolean;
  skipDuplicates?: boolean;
  skipMismatch?: boolean;
}

interface FfprobeData {
  format?: {
    duration?: number;
  };
}

/* c8 ignore start */
function getEnvironmentName(dataDir: string, artifactDir: string): string {
  const relativePath = path.relative(dataDir, artifactDir);
  const parts = relativePath.split(path.sep);
  const minimumPartsForEnvironment = 2;
  const environmentOffsetFromEnd = 2;
  const unknownEnvironment = "unknown";
  const hasEnvironment = parts.length >= minimumPartsForEnvironment;
  return hasEnvironment ? (parts[parts.length - environmentOffsetFromEnd] ?? unknownEnvironment) : unknownEnvironment;
}
/* c8 ignore stop */

function shouldSkipEntry(name: string): boolean {
  return name === ".DS_Store" || name.startsWith(".");
}

function toBadScanIdSet(database: BadScanDatabase): Set<string> {
  return new Set(Object.keys(database));
}

function collectNewBadScans(
  badScanDatabase: BadScanDatabase,
  beforeIds: Set<string>,
  afterIds: Set<string>,
  stage: DiscardStage
): DiscardedArtifact[] {
  const additions: DiscardedArtifact[] = [];
  afterIds.forEach((id) => {
    if (beforeIds.has(id)) {
      return;
    }
    const entry = badScanDatabase[id];
    if (entry === undefined) {
      return;
    }
    additions.push({
      date: entry.date,
      environment: entry.environment,
      id,
      reason: entry.reason,
      stage
    });
  });
  return additions;
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

export async function runCleanPhase(options?: CleanPhaseOptions): Promise<CleanPhaseResult> {
  const fsImpl = options?.fs ?? fs;
  const ffprobeImpl = options?.ffprobe ?? ffmpeg.ffprobe;
  const log = options?.logger ?? ((msg: string) => logger.info(msg));
  const now = options?.now ?? (() => new Date());

  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const badScansFile = options?.badScansFile;
  const checkedScansFile = options?.checkedScansFile;

  const defaultMinDuration = 12;
  const minDuration = options?.minDuration ?? defaultMinDuration;
  const decimalPlaces = 2;
  const isDryRun = options?.dryRun ?? false;
  const quarantineDir = options?.quarantineDir;
  const saveResults = options?.saveResults ?? true;

  const badScans = options?.databases?.badScans ?? getBadScans(badScansFile);
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

      // Read scanDate from meta.json
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

export async function runFilterPhase(options?: FilterPhaseOptions): Promise<FilterPhaseResult> {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const badScansFile = options?.badScansFile;
  const checkedScansFile = options?.checkedScansFile;
  const envDryRun = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";
  const isDryRun = options?.dryRun ?? envDryRun;
  const saveResults = options?.saveResults ?? true;

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

  const defaultConcurrency = Number(process.env["BATHROOM_FILTER_CONCURRENCY"] ?? "5");
  const concurrency = options?.concurrency ?? defaultConcurrency;
  const defaultSaveInterval = 50;
  const saveInterval = options?.saveInterval ?? defaultSaveInterval;
  const service = options?.service ?? new GeminiService();

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

export async function runDuplicatesPhase(options?: DuplicatesPhaseOptions): Promise<DuplicatesPhaseResult> {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const badScansFile = options?.badScansFile;
  const videoHashesFile = options?.videoHashesFile;
  const envDryRun = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";
  const isDryRun = options?.dryRun ?? envDryRun;
  const saveResults = options?.saveResults ?? true;

  const badScans = options?.databases?.badScans ?? getBadScans(badScansFile);
  const checkedScans = options?.databases?.checkedScans ?? getCheckedScans();
  const videoHashes = options?.videoHashes ?? getVideoHashes(videoHashesFile);

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

export async function runDuplicatesOnly(options?: DuplicatesPhaseOptions): Promise<DuplicateStats> {
  const result = await runDuplicatesPhase(options);
  return result.stats;
}

export async function runCleanOnly(options?: CleanDataOptions): Promise<CleanDataStats> {
  const result = await runCleanPhase(options);
  return result.stats;
}

export async function runFilterOnly(options?: FilterPhaseOptions): Promise<FilterStats> {
  const result = await runFilterPhase(options);
  return result.stats;
}

export async function runMismatchPhase(options?: MismatchPhaseOptions): Promise<MismatchPhaseResult> {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const checkedScansFile = options?.checkedScansFile;
  const envDryRun = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";
  const isDryRun = options?.dryRun ?? envDryRun;
  const saveResults = options?.saveResults ?? true;

  const badScans = options?.databases?.badScans ?? getBadScans();
  const checkedScans = options?.databases?.checkedScans ?? getCheckedScans(checkedScansFile);

  // Scan both active and discarded artifacts for date mismatches
  const discardedDir = path.join(path.dirname(dataDir), "discarded-artifacts");
  const activeArtifacts = options?.artifactDirs ?? findArtifactDirectories(dataDir);
  const discardedArtifacts = fs.existsSync(discardedDir) ? findArtifactDirectories(discardedDir) : [];
  const artifactDirs = [...activeArtifacts, ...discardedArtifacts];
  logger.info(
    `Starting mismatch detection stage. Found ${artifactDirs.length.toString()} artifacts (${activeArtifacts.length.toString()} active, ${discardedArtifacts.length.toString()} discarded).`
  );

  const stats: MismatchStats = {
    errors: 0,
    headerAnomalyCount: 0,
    mismatchCount: 0,
    newHeaderAnomalyCount: 0,
    newMismatchCount: 0,
    processed: 0,
    skippedCached: 0
  };

  const dateMismatches: DateMismatch[] = [];
  const videoHeaderAnomalies: VideoHeaderAnomaly[] = [];

  const bar = createProgressBar("Mismatches |{bar}| {percentage}% | {value}/{total} Artifacts | ETA: {eta}s");
  const initialProgress = 0;
  bar.start(artifactDirs.length, initialProgress);

  for (const dir of artifactDirs) {
    const artifactId = path.basename(dir);
    if (shouldSkipEntry(artifactId)) {
      bar.increment();
      continue;
    }

    // Get environment name - handle both active and discarded artifact paths
    const isDiscarded = dir.includes("discarded-artifacts");
    const baseDir = isDiscarded ? discardedDir : dataDir;
    const environment = getEnvironmentName(baseDir, dir);

    const entry = checkedScans[artifactId];
    const mismatchCached = entry?.mismatchCheckedDate !== undefined && entry.mismatchCheckedDate !== "";
    const headerCached = entry?.avcAnomalyCheckedDate !== undefined;
    const shouldCheckMismatch = !mismatchCached;

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

    const shouldSkipProcessing = mismatchCached && headerCached;
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

      // Detect stray avcC markers in video header
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
    `Mismatch stage complete. Processed: ${stats.processed.toString()}, Mismatches: ${stats.mismatchCount.toString()}, New: ${stats.newMismatchCount.toString()}, Header anomalies: ${stats.headerAnomalyCount.toString()} (new: ${stats.newHeaderAnomalyCount.toString()}), Cached: ${stats.skippedCached.toString()}, Errors: ${stats.errors.toString()}.`
  );

  return {
    databases: { badScans, checkedScans },
    dateMismatches,
    stats,
    videoHeaderAnomalies
  };
}

export async function runMismatchOnly(options?: MismatchPhaseOptions): Promise<MismatchStats> {
  const result = await runMismatchPhase(options);
  return result.stats;
}

export async function generateDiscardReport(input: DiscardReportInput): Promise<void> {
  const reportData = buildDiscardReport(input);
  await generatePdfReport(reportData, "2 - Discard Report.pdf");
}

export async function main(options?: DiscardOptions): Promise<DiscardStats> {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const envDryRun = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";
  const isDryRun = options?.dryRun ?? envDryRun;
  const defaultMinDuration = 12;
  const minDuration = options?.minDuration ?? defaultMinDuration;

  const badScans: BadScanDatabase = options?.databases?.badScans ?? getBadScans(options?.badScansFile);
  const checkedScans: CheckedScanDatabase =
    options?.databases?.checkedScans ?? getCheckedScans(options?.checkedScansFile);

  const initialArtifacts = options?.artifactDirs ?? findArtifactDirectories(dataDir);
  const artifactCount = initialArtifacts.length;
  const initialBadScanIds = toBadScanIdSet(badScans);
  const initialBadScanCount = initialBadScanIds.size;

  let remainingArtifacts = initialArtifacts;
  let artifactsAfterClean = remainingArtifacts.length;
  let cleanStats: CleanDataStats = {
    failedDeletes: [],
    quarantinedCount: 0,
    removedCount: 0,
    skippedCleanCount: 0
  };

  let badScanIdsAfterClean = initialBadScanIds;
  let newBadScansFromClean: DiscardedArtifact[] = [];
  let newBadScansFromFilter: DiscardedArtifact[] = [];
  let newBadScansFromDuplicates: DiscardedArtifact[] = [];

  if (options?.skipClean !== true) {
    const cleanResult = await runCleanPhase({
      ...options,
      artifactDirs: remainingArtifacts,
      dataDir,
      databases: { badScans, checkedScans },
      dryRun: isDryRun,
      saveResults: false
    });
    cleanStats = cleanResult.stats;
    remainingArtifacts = cleanResult.remainingArtifacts;
    artifactsAfterClean = remainingArtifacts.length;
    badScanIdsAfterClean = toBadScanIdSet(badScans);
    newBadScansFromClean = collectNewBadScans(badScans, initialBadScanIds, badScanIdsAfterClean, "clean");
  }

  let filterStats: FilterStats = {
    errors: 0,
    processed: 0,
    removed: 0,
    skipped: 0,
    skippedAmbiguous: 0,
    skippedCached: 0
  };

  let badScanIdsAfterFilter = badScanIdsAfterClean;
  if (options?.skipFilter !== true) {
    const filterResult = await runFilterPhase({
      ...options,
      artifactDirs: remainingArtifacts,
      dataDir,
      databases: { badScans, checkedScans },
      dryRun: isDryRun,
      saveResults: false
    });
    filterStats = filterResult.stats;
    remainingArtifacts = filterResult.processedArtifacts.filter(
      (dir) => !Object.prototype.hasOwnProperty.call(badScans, path.basename(dir))
    );
    badScanIdsAfterFilter = toBadScanIdSet(badScans);
    newBadScansFromFilter = collectNewBadScans(badScans, badScanIdsAfterClean, badScanIdsAfterFilter, "filter");
  }

  let duplicateStats: DuplicateStats = {
    duplicateCount: 0,
    errors: 0,
    newDuplicateCount: 0,
    processed: 0,
    skippedCached: 0
  };
  let duplicates: DuplicateVideo[] = [];

  if (options?.skipDuplicates !== true) {
    const duplicatesResult = await runDuplicatesPhase({
      ...options,
      artifactDirs: remainingArtifacts,
      dataDir,
      databases: { badScans, checkedScans },
      dryRun: isDryRun,
      saveResults: false
    });
    duplicateStats = duplicatesResult.stats;
    duplicates = duplicatesResult.duplicates;
    remainingArtifacts = duplicatesResult.remainingArtifacts;
    const badScanIdsAfterDuplicates = toBadScanIdSet(badScans);
    newBadScansFromDuplicates = collectNewBadScans(
      badScans,
      badScanIdsAfterFilter,
      badScanIdsAfterDuplicates,
      "duplicates"
    );
  }

  let dateMismatches: DateMismatch[] = [];
  let videoHeaderAnomalies: VideoHeaderAnomaly[] = [];
  if (options?.skipMismatch !== true) {
    const mismatchResult = await runMismatchPhase({
      ...options,
      artifactDirs: remainingArtifacts,
      dataDir,
      databases: { badScans, checkedScans },
      dryRun: isDryRun,
      saveResults: false
    });
    dateMismatches = mismatchResult.dateMismatches;
    videoHeaderAnomalies = mismatchResult.videoHeaderAnomalies;
  }

  if (!isDryRun) {
    saveBadScans(badScans, options?.badScansFile);
    saveCheckedScans(checkedScans, options?.checkedScansFile);
    saveVideoHashes(getVideoHashes(), options?.videoHashesFile);
  }

  logger.info(
    `Discard complete. Cleaned removed=${cleanStats.removedCount.toString()}, quarantined=${cleanStats.quarantinedCount.toString()}, cached=${cleanStats.skippedCleanCount.toString()}; Filter processed=${filterStats.processed.toString()}, removed=${filterStats.removed.toString()}, skipped=${filterStats.skipped.toString()}, cached=${filterStats.skippedCached.toString()}, ambiguous=${filterStats.skippedAmbiguous.toString()}, errors=${filterStats.errors.toString()}; Duplicates found=${duplicateStats.duplicateCount.toString()}, new=${duplicateStats.newDuplicateCount.toString()}.`
  );

  const finalBadScanCount = Object.keys(badScans).length;
  const badScansByEnv: Record<string, number> = {};
  const zeroCount = 0;
  const incrementCount = 1;

  // Count all bad scans by environment and reason category (totals from database)
  const tooShortTotalByEnv: Record<string, number> = {};
  const notBathroomTotalByEnv: Record<string, number> = {};
  const duplicateTotalByEnv: Record<string, number> = {};

  Object.values(badScans).forEach((entry) => {
    const env = entry.environment;
    badScansByEnv[env] = (badScansByEnv[env] ?? zeroCount) + incrementCount;

    const reason = entry.reason.toLowerCase();
    if (reason.includes("too short")) {
      tooShortTotalByEnv[env] = (tooShortTotalByEnv[env] ?? zeroCount) + incrementCount;
    } else if (reason.includes("not a bathroom")) {
      notBathroomTotalByEnv[env] = (notBathroomTotalByEnv[env] ?? zeroCount) + incrementCount;
    } else if (reason.includes("duplicate video")) {
      duplicateTotalByEnv[env] = (duplicateTotalByEnv[env] ?? zeroCount) + incrementCount;
    }
  });

  // Count NEW bad scans by environment and reason category (from this run)
  const allNewBadScans = [...newBadScansFromClean, ...newBadScansFromFilter, ...newBadScansFromDuplicates];
  const tooShortNewByEnv: Record<string, number> = {};
  const notBathroomNewByEnv: Record<string, number> = {};
  const duplicateNewByEnv: Record<string, number> = {};

  allNewBadScans.forEach((entry) => {
    const env = entry.environment;
    const reason = entry.reason.toLowerCase();
    if (reason.includes("too short")) {
      tooShortNewByEnv[env] = (tooShortNewByEnv[env] ?? zeroCount) + incrementCount;
    } else if (reason.includes("not a bathroom")) {
      notBathroomNewByEnv[env] = (notBathroomNewByEnv[env] ?? zeroCount) + incrementCount;
    } else if (reason.includes("duplicate video")) {
      duplicateNewByEnv[env] = (duplicateNewByEnv[env] ?? zeroCount) + incrementCount;
    }
  });

  // Count artifacts per environment from disk and track cached valid
  const processedByEnv: Record<string, number> = {};
  const validCachedByEnv: Record<string, number> = {};
  const checkedScanIds = new Set(Object.keys(checkedScans));

  initialArtifacts.forEach((dir) => {
    const env = path.basename(path.dirname(dir));
    const artifactId = path.basename(dir);
    processedByEnv[env] = (processedByEnv[env] ?? zeroCount) + incrementCount;

    // If artifact is in checkedScans cache and not a bad scan, it's cached valid
    if (checkedScanIds.has(artifactId) && !Object.prototype.hasOwnProperty.call(badScans, artifactId)) {
      validCachedByEnv[env] = (validCachedByEnv[env] ?? zeroCount) + incrementCount;
    }
  });

  // Build countsByEnv combining all metrics
  const allEnvs = new Set([...Object.keys(processedByEnv), ...Object.keys(badScansByEnv)]);
  const countsByEnv: Record<string, EnvCounts> = {};
  allEnvs.forEach((env) => {
    const processed = processedByEnv[env] ?? zeroCount;
    const tooShortTotal = tooShortTotalByEnv[env] ?? zeroCount;
    const tooShortNew = tooShortNewByEnv[env] ?? zeroCount;
    const notBathroomTotal = notBathroomTotalByEnv[env] ?? zeroCount;
    const notBathroomNew = notBathroomNewByEnv[env] ?? zeroCount;
    const duplicateTotal = duplicateTotalByEnv[env] ?? zeroCount;
    const duplicateNew = duplicateNewByEnv[env] ?? zeroCount;
    const totalBad = badScansByEnv[env] ?? zeroCount;
    const totalValid = Math.max(zeroCount, processed - totalBad);
    const validCached = validCachedByEnv[env] ?? zeroCount;
    const validNew = Math.max(zeroCount, totalValid - validCached);
    countsByEnv[env] = {
      duplicateCached: duplicateTotal - duplicateNew,
      duplicateNew,
      notBathroomCached: notBathroomTotal - notBathroomNew,
      notBathroomNew,
      processed,
      tooShortCached: tooShortTotal - tooShortNew,
      tooShortNew,
      validCached,
      validNew
    };
  });

  const discardedOnDiskCount = finalBadScanCount;

  // Build bad scan history for "Over Time" charts (uses scanDate for timeline)
  const badScanHistory: BadScanHistoryEntry[] = [];
  for (const [id, entry] of Object.entries(badScans)) {
    if (entry.scanDate !== undefined) {
      badScanHistory.push({
        environment: entry.environment,
        id,
        reason: entry.reason,
        scanDate: entry.scanDate
      });
    }
  }

  const reportInput: DiscardReportInput = {
    artifactCount,
    artifactsAfterClean,
    badScanHistory,
    badScansByEnv,
    cleanStats,
    countsByEnv,
    dateMismatches,
    discardedOnDiskCount,
    dryRun: isDryRun,
    duplicateStats,
    duplicates,
    filterStats,
    finalBadScanCount,
    initialBadScanCount,
    minDuration,
    newBadScans: [...newBadScansFromClean, ...newBadScansFromFilter, ...newBadScansFromDuplicates],
    videoHeaderAnomalies
  };
  await generateDiscardReport(reportInput);

  return { clean: cleanStats, duplicates: duplicateStats, filter: filterStats };
}

/* c8 ignore start */
if (require.main === module) {
  main().catch((err: unknown) => logger.error(err));
}
/* c8 ignore stop */
