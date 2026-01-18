import * as dotenv from "dotenv";
import * as path from "path";

import { BadScanDatabase } from "../models/badScanRecord";
import { CheckedScanDatabase } from "../models/checkedScanRecord";
import {
  BadScanHistoryEntry,
  BlackFrameFinding,
  CleanDataStats,
  DateMismatch,
  DiscardReportInput,
  DiscardStats,
  DiscardedArtifact,
  DuplicateStats,
  DuplicateVideo,
  EnvCounts,
  FilterStats,
  VideoHeaderAnomaly
} from "../models/discardStats";
import { buildDiscardReport } from "../templates/discardReport";
import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";
import { saveVideoHashes } from "../utils/data/videoHashes";
import { logger } from "../utils/logger";
import { generatePdfReport } from "../utils/reportGenerator";
import { collectNewBadScans, toBadScanIdSet } from "./discard/shared";
import { runCleanPhase } from "./discard/cleanPhase";
import { runDuplicatesPhase } from "./discard/duplicatesPhase";
import { runFilterPhase } from "./discard/filterPhase";
import { runMismatchPhase } from "./discard/mismatchPhase";
import { buildDiscardConfig } from "./discard/config";
import {
  CleanDataOptions,
  DiscardOptions,
  DuplicatesPhaseOptions,
  FilterPhaseOptions,
  MismatchPhaseOptions,
  MismatchPhaseResult
} from "./discard/types";

export type {
  CleanDataStats,
  DiscardedArtifact,
  DiscardStats,
  DuplicateStats,
  FilterStats
} from "../models/discardStats";

dotenv.config({ quiet: true } as dotenv.DotenvConfigOptions);

export { probeVideo, runCleanPhase } from "./discard/cleanPhase";
export { runDuplicatesPhase } from "./discard/duplicatesPhase";
export { classifyGeminiAnswer, processArtifact, runBatchProcessing, runFilterPhase } from "./discard/filterPhase";
export { runMismatchPhase } from "./discard/mismatchPhase";
export { collectNewBadScans } from "./discard/shared";
export type {
  CleanPhaseOptions,
  CleanPhaseResult,
  DiscardOptions,
  DuplicatesPhaseOptions,
  DuplicatesPhaseResult,
  FilterOptions,
  FilterPhaseOptions,
  FilterPhaseResult,
  MismatchPhaseOptions,
  MismatchPhaseResult
} from "./discard/types";

export async function runDuplicatesOnly(options?: DuplicatesPhaseOptions): Promise<DuplicateStats> {
  const config = buildDiscardConfig(options);
  const result = await runDuplicatesPhase(options, config);
  return result.stats;
}

export async function runCleanOnly(options?: CleanDataOptions): Promise<CleanDataStats> {
  const config = buildDiscardConfig(options);
  const result = await runCleanPhase(options, config);
  return result.stats;
}

export async function runFilterOnly(options?: FilterPhaseOptions): Promise<FilterStats> {
  const config = buildDiscardConfig(options);
  const result = await runFilterPhase(options, config);
  return result.stats;
}

export async function runMismatchOnly(options?: MismatchPhaseOptions): Promise<MismatchPhaseResult["stats"]> {
  const config = buildDiscardConfig(options);
  const result = await runMismatchPhase(options, config);
  return result.stats;
}

export async function generateDiscardReport(input: DiscardReportInput): Promise<void> {
  const reportData = buildDiscardReport(input);
  await generatePdfReport(reportData, "2 - Discard Report.pdf");
}

export async function main(options?: DiscardOptions): Promise<DiscardStats> {
  const config = buildDiscardConfig(options);
  const dataDir = config.dataDir;
  const isDryRun = config.dryRun;
  const minDuration = config.minDuration;

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
    const cleanResult = await runCleanPhase(
      {
        ...options,
        artifactDirs: remainingArtifacts,
        databases: { badScans, checkedScans },
        saveResults: false
      },
      config
    );
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
    const filterResult = await runFilterPhase(
      {
        ...options,
        artifactDirs: remainingArtifacts,
        databases: { badScans, checkedScans },
        saveResults: false
      },
      config
    );
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
    const duplicatesResult = await runDuplicatesPhase(
      {
        ...options,
        artifactDirs: remainingArtifacts,
        databases: { badScans, checkedScans },
        saveResults: false
      },
      config
    );
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
    if (!isDryRun) {
      saveVideoHashes(duplicatesResult.videoHashes, options?.videoHashesFile);
    }
  }

  let dateMismatches: DateMismatch[] = [];
  let videoHeaderAnomalies: VideoHeaderAnomaly[] = [];
  let blackFrameFindings: BlackFrameFinding[] = [];
  if (options?.skipMismatch !== true) {
    const mismatchResult = await runMismatchPhase(
      {
        ...options,
        artifactDirs: remainingArtifacts,
        databases: { badScans, checkedScans },
        saveResults: false
      },
      config
    );
    dateMismatches = mismatchResult.dateMismatches;
    videoHeaderAnomalies = mismatchResult.videoHeaderAnomalies;
    blackFrameFindings = mismatchResult.blackFrameFindings;
  }

  if (!isDryRun) {
    saveBadScans(badScans, options?.badScansFile);
    saveCheckedScans(checkedScans, options?.checkedScansFile);
  }

  logger.info(
    `Discard complete. Cleaned removed=${cleanStats.removedCount.toString()}, quarantined=${cleanStats.quarantinedCount.toString()}, cached=${cleanStats.skippedCleanCount.toString()}; Filter processed=${filterStats.processed.toString()}, removed=${filterStats.removed.toString()}, skipped=${filterStats.skipped.toString()}, cached=${filterStats.skippedCached.toString()}, ambiguous=${filterStats.skippedAmbiguous.toString()}, errors=${filterStats.errors.toString()}; Duplicates found=${duplicateStats.duplicateCount.toString()}, new=${duplicateStats.newDuplicateCount.toString()}.`
  );

  const finalBadScanCount = Object.keys(badScans).length;
  const badScansByEnv: Record<string, number> = {};
  const zeroCount = 0;
  const incrementCount = 1;

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

  const processedByEnv: Record<string, number> = {};
  const validCachedByEnv: Record<string, number> = {};
  const checkedScanIds = new Set(Object.keys(checkedScans));

  initialArtifacts.forEach((dir) => {
    const env = path.basename(path.dirname(dir));
    const artifactId = path.basename(dir);
    processedByEnv[env] = (processedByEnv[env] ?? zeroCount) + incrementCount;

    if (checkedScanIds.has(artifactId) && !Object.prototype.hasOwnProperty.call(badScans, artifactId)) {
      validCachedByEnv[env] = (validCachedByEnv[env] ?? zeroCount) + incrementCount;
    }
  });

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
    blackFrameFindings,
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
