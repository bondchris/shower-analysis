import { ENVIRONMENTS } from "../../config/config";
import { EnvStats } from "../models/envStats";
import { ArtifactResponse, SpatialService } from "../services/spatialService";
import { buildValidationReport } from "../templates/validationReport";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";

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
  const INITIAL_ERROR_COUNT = 0;
  const ERROR_INCREMENT = 1;
  const NO_MISSING_FIELDS = 0;

  stats.processed++;
  const missingFields = REQUIRED_FIELDS.filter((field) => item[field] === undefined || item[field] === null);
  const issues: string[] = [...missingFields];

  // Check for invalid date
  if (typeof item.scanDate === "string" && item.scanDate.startsWith("0001")) {
    issues.push("scanDate (invalid)");
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

  // Track property presence dynamically
  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      const val = (item as unknown as Record<string, unknown>)[key];
      if (val !== undefined && val !== null) {
        stats.propertyCounts[key] = (stats.propertyCounts[key] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;
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

export async function validateEnvironment(env: { domain: string; name: string }): Promise<EnvStats> {
  const PAGE_START = 1;
  const NO_PAGES_LEFT = 0;
  const CONCURRENCY_LIMIT = 5;
  const NO_ITEMS = 0;

  logger.info(`Starting validation for: ${env.name} (${env.domain})`);
  const stats: EnvStats = {
    artifactsWithIssues: 0,
    artifactsWithWarnings: 0,
    cleanScansByDate: {},
    errorsByDate: {},
    missingCounts: {},
    name: env.name,
    pageErrors: {},
    processed: 0,
    propertyCounts: {},
    totalArtifacts: 0,
    totalScansByDate: {},
    warningCounts: {},
    warningsByDate: {}
  };

  const service = new SpatialService(env.domain, env.name);

  try {
    const initialRes = await service.fetchScanArtifacts(PAGE_START);
    const { pagination } = initialRes;
    stats.totalArtifacts = pagination.total;
    const lastPage = pagination.lastPage;

    logger.info(`Total artifacts to process: ${stats.totalArtifacts.toString()} (Pages: ${lastPage.toString()})`);

    // Process initial page artifacts immediately
    for (const item of initialRes.data) {
      applyArtifactToStats(stats, item);
    }

    // Determine remaining pages to fetch
    const NEXT_PAGE_OFFSET = 1;
    const startPage = PAGE_START + NEXT_PAGE_OFFSET;
    const NO_PAGES = 0;
    const pagesRemaining = lastPage - PAGE_START;
    const pages = Array.from(
      { length: pagesRemaining > NO_PAGES ? pagesRemaining : NO_PAGES },
      (_, i) => i + startPage
    );

    const activePromises = new Set<Promise<void>>();
    const totalToProcess = pages.length;

    const bar = createProgressBar("Validation |{bar}| {percentage}% | {value}/{total} Pages | ETA: {eta}s");
    const INITIAL_PROGRESS = 0;
    bar.start(totalToProcess, INITIAL_PROGRESS);

    const processPage = async (pageNum: number) => {
      try {
        const res = await service.fetchScanArtifacts(pageNum);

        for (const item of res.data) {
          applyArtifactToStats(stats, item);
        }
      } catch (e: unknown) {
        logger.error(`Error fetching page ${pageNum.toString()}: ${e instanceof Error ? e.message : String(e)}`);
        stats.pageErrors[pageNum] = e instanceof Error ? e.message : String(e);
      } finally {
        bar.increment();
      }
    };

    while (pages.length > NO_PAGES_LEFT) {
      while (activePromises.size < CONCURRENCY_LIMIT && pages.length > NO_PAGES_LEFT) {
        const pageNum = pages.shift();
        if (pageNum !== undefined) {
          const promise = processPage(pageNum);
          activePromises.add(promise);
          // Remove from set when done
          promise
            .finally(() => {
              activePromises.delete(promise);
            })
            .catch(() => {
              /* no-op */
            });
        }
      }

      if (activePromises.size > NO_ITEMS && pages.length > NO_PAGES_LEFT) {
        await Promise.race(activePromises);
      }
    }

    // Wait for remaining
    await Promise.all(activePromises);
    bar.stop();

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

  await generatePdfReport(reportData, "validation-report.pdf");
  logger.info(`Report generated at: reports/validation-report.pdf`);
}

export async function main() {
  const allStats: EnvStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await validateEnvironment(env as { domain: string; name: string });
    allStats.push(stats);
  }
  await generateReport(allStats);
}

if (require.main === module) {
  main().catch((err: unknown) => logger.error(err));
}
