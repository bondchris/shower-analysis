import { ENVIRONMENTS } from "../../config/config";
import { EnvStats } from "../models/envStats";
import { ArtifactResponse, SpatialService } from "../services/spatialService";
import { buildValidationReport } from "../templates/validationReport";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";

interface EnvironmentConfig {
  domain: string;
  name: string;
}

const getValidDateKey = (scanDate: unknown): string | null => {
  const DATE_PART_INDEX = 0;

  if (typeof scanDate !== "string") {
    return null;
  }
  const date = scanDate.split("T")[DATE_PART_INDEX];
  if (date === undefined || date === "" || date.startsWith("0001")) {
    return null;
  }
  return date;
};

export function applyArtifactToStats(stats: EnvStats, item: ArtifactResponse): void {
  const REQUIRED_FIELDS: (keyof ArtifactResponse)[] = ["id", "scanDate", "rawScan", "arData", "video"];
  const WARNING_FIELDS: (keyof ArtifactResponse)[] = ["projectId"];
  const REQUIRED_ARTIFACT_FIELDS: (keyof ArtifactResponse)[] = ["video", "rawScan", "arData"];
  const INITIAL_ERROR_COUNT = 0;
  const ERROR_INCREMENT = 1;
  const NO_MISSING_FIELDS = 0;
  const artifactId = typeof item.id === "string" ? item.id : null;
  const scanDateValue = typeof item.scanDate === "string" ? item.scanDate : "";

  stats.processed++;
  const missingFields = REQUIRED_FIELDS.filter((field) => item[field] === undefined || item[field] === null);
  const issues: string[] = [...missingFields];

  // Check for invalid date
  if (typeof item.scanDate === "string" && item.scanDate.startsWith("0001")) {
    issues.push("scanDate (invalid)");
    if (artifactId !== null) {
      stats.invalidScanDateDetails.push({ id: artifactId, scanDate: scanDateValue });
    }
  }

  // Check for floors with parent ids set
  if (typeof item.rawScan === "string" && item.rawScan.length > NO_MISSING_FIELDS) {
    try {
      const rawScanData = JSON.parse(item.rawScan) as { floors?: { parentIdentifier?: string | null }[] };
      if (Array.isArray(rawScanData.floors)) {
        const hasFloorWithParentId = rawScanData.floors.some(
          (floor) => floor.parentIdentifier !== null && floor.parentIdentifier !== undefined
        );
        if (hasFloorWithParentId) {
          const errorKey = "floors with parent id";
          if (!issues.includes(errorKey)) {
            issues.push(errorKey);
          }
        }
      }
    } catch {
      // Ignore JSON parse errors - rawScan validation will catch this separately
    }
  }

  const missingWarnings = WARNING_FIELDS.filter((field) => item[field] === undefined || item[field] === null);
  if (missingWarnings.includes("projectId") && artifactId !== null) {
    stats.missingProjectIdIds.push(artifactId);
  }

  const missingRequiredArtifacts = REQUIRED_ARTIFACT_FIELDS.filter(
    (field) => item[field] === undefined || item[field] === null
  );
  if (missingRequiredArtifacts.length > NO_MISSING_FIELDS && artifactId !== null) {
    stats.missingRequiredArtifacts.push({ id: artifactId, missingFields: missingRequiredArtifacts });
  }

  // Track property presence dynamically (both total and by date)
  const propertyDate = getValidDateKey(item.scanDate);
  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      const val = (item as unknown as Record<string, unknown>)[key];
      if (val !== undefined && val !== null) {
        stats.propertyCounts[key] = (stats.propertyCounts[key] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;

        if (propertyDate !== null) {
          stats.propertyCountsByDate[propertyDate] ??= {};
          const dateCounts = stats.propertyCountsByDate[propertyDate];
          dateCounts[key] = (dateCounts[key] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;
        }
      }
    }
  }

  if (issues.length > NO_MISSING_FIELDS) {
    stats.artifactsWithIssues++;
    for (const issue of issues) {
      stats.missingCounts[issue] = (stats.missingCounts[issue] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;
    }

    // Track error by date
    const date = getValidDateKey(item.scanDate);
    if (date !== null) {
      const currentCount = stats.errorsByDate[date] ?? INITIAL_ERROR_COUNT;
      stats.errorsByDate[date] = currentCount + ERROR_INCREMENT;
    }
  }

  if (missingWarnings.length > NO_MISSING_FIELDS) {
    stats.artifactsWithWarnings++;
    for (const field of missingWarnings) {
      stats.warningCounts[field] = (stats.warningCounts[field] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;
    }

    // Track warning by date
    const date = getValidDateKey(item.scanDate);
    if (date !== null) {
      const currentCount = stats.warningsByDate[date] ?? INITIAL_ERROR_COUNT;
      stats.warningsByDate[date] = currentCount + ERROR_INCREMENT;
    }
  }

  // Track success percentages
  const date = getValidDateKey(item.scanDate);
  if (date !== null) {
    const currentTotal = stats.totalScansByDate[date] ?? INITIAL_ERROR_COUNT;
    stats.totalScansByDate[date] = currentTotal + ERROR_INCREMENT;

    if (issues.length === NO_MISSING_FIELDS) {
      const currentClean = stats.cleanScansByDate[date] ?? INITIAL_ERROR_COUNT;
      stats.cleanScansByDate[date] = currentClean + ERROR_INCREMENT;
    }
  }
}

const createInitialStats = (envName: string): EnvStats => ({
  artifactsWithIssues: 0,
  artifactsWithWarnings: 0,
  cleanScansByDate: {},
  errorsByDate: {},
  invalidScanDateDetails: [],
  missingCounts: {},
  missingProjectIdIds: [],
  missingRequiredArtifacts: [],
  name: envName,
  pageErrors: {},
  processed: 0,
  propertyCounts: {},
  propertyCountsByDate: {},
  totalArtifacts: 0,
  totalScansByDate: {},
  warningCounts: {},
  warningsByDate: {}
});

const applyPageArtifacts = (stats: EnvStats, data: ArtifactResponse[]): void => {
  for (const item of data) {
    applyArtifactToStats(stats, item);
  }
};

const buildRemainingPages = (lastPage: number): number[] => {
  const PAGE_START = 1;
  const NEXT_PAGE_OFFSET = 1;
  const NO_PAGES = 0;
  const pagesRemaining = lastPage - PAGE_START;
  const startPage = PAGE_START + NEXT_PAGE_OFFSET;
  return Array.from({ length: pagesRemaining > NO_PAGES ? pagesRemaining : NO_PAGES }, (_, i) => i + startPage);
};

const processPage = async (service: SpatialService, stats: EnvStats, pageNum: number): Promise<void> => {
  try {
    const res = await service.fetchScanArtifacts(pageNum);
    applyPageArtifacts(stats, res.data);
  } catch (e: unknown) {
    logger.error(`Error fetching page ${pageNum.toString()}: ${e instanceof Error ? e.message : String(e)}`);
    stats.pageErrors[pageNum] = e instanceof Error ? e.message : String(e);
  }
};

const processRemainingPages = async (
  service: SpatialService,
  stats: EnvStats,
  pages: number[],
  concurrencyLimit: number
): Promise<void> => {
  const NO_PAGES_LEFT = 0;
  const NO_ITEMS = 0;
  const activePromises = new Set<Promise<void>>();
  const totalToProcess = pages.length;

  const bar = createProgressBar("Validation |{bar}| {percentage}% | {value}/{total} Pages | ETA: {eta}s");
  const INITIAL_PROGRESS = 0;
  bar.start(totalToProcess, INITIAL_PROGRESS);

  const scheduleNext = () => {
    const pageNum = pages.shift();
    if (pageNum === undefined) {
      return;
    }
    const promise = processPage(service, stats, pageNum)
      .catch(() => {
        /* error already recorded */
      })
      .finally(() => {
        bar.increment();
        activePromises.delete(promise);
      });
    activePromises.add(promise);
  };

  while (activePromises.size < concurrencyLimit && pages.length > NO_PAGES_LEFT) {
    scheduleNext();
  }

  while (pages.length > NO_PAGES_LEFT) {
    if (activePromises.size === NO_ITEMS) {
      scheduleNext();
      continue;
    }
    await Promise.race(activePromises);
    scheduleNext();
  }

  await Promise.all(activePromises);
  bar.stop();
};

export async function validateEnvironment(env: EnvironmentConfig): Promise<EnvStats> {
  const PAGE_START = 1;
  const CONCURRENCY_LIMIT = 5;

  logger.info(`Starting validation for: ${env.name} (${env.domain})`);
  const stats = createInitialStats(env.name);
  const service = new SpatialService(env.domain, env.name);

  try {
    const initialRes = await service.fetchScanArtifacts(PAGE_START);
    const { pagination } = initialRes;
    stats.totalArtifacts = pagination.total;
    const lastPage = pagination.lastPage;

    logger.info(`Total artifacts to process: ${stats.totalArtifacts.toString()} (Pages: ${lastPage.toString()})`);

    applyPageArtifacts(stats, initialRes.data);

    const pages = buildRemainingPages(lastPage);
    await processRemainingPages(service, stats, pages, CONCURRENCY_LIMIT);
    logger.info(`${env.name} complete.`);
  } catch (error: unknown) {
    logger.error(`Failed to fetch from ${env.name}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return stats;
}

// validateArtifacts.ts - Removed generateValidationCharts and update main flow

export async function generateReport(allStats: EnvStats[]) {
  // Pass allStats directly; charts are built internally now
  const reportData = buildValidationReport(allStats);

  const reportFileName = "0 - Validation Report.pdf";
  await generatePdfReport(reportData, reportFileName);
  logger.info(`Report generated at: reports/${reportFileName}`);
}

export async function main() {
  const allStats: EnvStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await validateEnvironment(env);
    allStats.push(stats);
  }
  await generateReport(allStats);
}

export async function runCli(runner: () => Promise<void> = main): Promise<void> {
  await runner().catch((err: unknown) => logger.error(err));
}

if (require.main === module) {
  runCli().catch((err: unknown) => logger.error(err));
}
