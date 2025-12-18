import { sumBy } from "lodash";

import { ENVIRONMENTS } from "../../config/config";
import { EnvStats } from "../models/envStats";
import { Artifact, SpatialService } from "../services/spatialService";
import { ValidationCharts, buildValidationReport } from "../templates/validationReport";
import * as ChartUtils from "../utils/chartUtils";
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

export function applyArtifactToStats(stats: EnvStats, item: Artifact): void {
  const REQUIRED_FIELDS: (keyof Artifact)[] = ["id", "scanDate", "rawScan", "arData", "video"];
  const WARNING_FIELDS: (keyof Artifact)[] = ["projectId"];
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

function generateValidationCharts(allStats: EnvStats[]): ValidationCharts {
  const charts: ValidationCharts = {};
  const INITIAL_ERROR_COUNT = 0;
  const MIN_DATA_POINTS = 0;
  const PAGE_VIEWPORT_WIDTH = 794;
  const PAGE_MARGIN = 40;
  const DOUBLE = 2;
  const pageMarginDouble = PAGE_MARGIN * DOUBLE;
  const PAGE_CONTENT_WIDTH = PAGE_VIEWPORT_WIDTH - pageMarginDouble; // A4 width (~794px) minus margins
  const PROPERTY_WIDTH_RATIO = 0.9;
  const CHART_BAR_HEIGHT = 15;
  const MIN_CHART_HEIGHT = 300;
  const HEADER_FOOTER_SPACE = 60;

  const processedTotal = sumBy(allStats, "processed");

  // Aggregate counts across all environments for property chart
  const consolidatedCounts: Record<string, number> = {};
  allStats.forEach((stats) => {
    Object.entries(stats.propertyCounts).forEach(([key, count]) => {
      consolidatedCounts[key] = (consolidatedCounts[key] ?? INITIAL_ERROR_COUNT) + count;
    });
  });

  // Sort by count descending
  const sortedProps = Object.entries(consolidatedCounts)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count > INITIAL_ERROR_COUNT);

  if (sortedProps.length > MIN_DATA_POINTS) {
    try {
      const chartLabels = sortedProps.map(([k]) => k);
      const chartData = sortedProps.map(([, v]) => v);

      const contentHeight = chartLabels.length * CHART_BAR_HEIGHT;
      const dynamicHeight = Math.max(MIN_CHART_HEIGHT, contentHeight + HEADER_FOOTER_SPACE);

      const propertyChartWidth = Math.round(PAGE_CONTENT_WIDTH * PROPERTY_WIDTH_RATIO);
      charts.propertyPresence = ChartUtils.getBarChartConfig(chartLabels, chartData, {
        height: dynamicHeight,
        horizontal: true,
        title: "",
        totalForPercentages: processedTotal,
        width: propertyChartWidth
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate property chart: ${String(e)}`);
    }
  }

  // Generate Graphs
  const allDates = new Set<string>();
  allStats.forEach((s) => {
    Object.keys(s.errorsByDate).forEach((d) => {
      allDates.add(d);
    });
    Object.keys(s.warningsByDate).forEach((d) => {
      allDates.add(d);
    });
    Object.keys(s.totalScansByDate).forEach((d) => {
      allDates.add(d);
    });
  });

  if (allDates.size > MIN_DATA_POINTS) {
    const sortedDates = Array.from(allDates).sort();
    const DEFAULT_SCANS_COUNT = 0;
    const DAY_OFFSET = 1;
    const DECIMAL_PLACES_AVG = 1;
    const CHART_BORDER_WIDTH_NORMAL = 1.5;

    // Calculate Volume-based Sort Order (Largest -> Smallest)
    const envTotalVolume = new Map<string, number>();
    allStats.forEach((stats) => {
      let total = 0;
      sortedDates.forEach((date) => {
        total += stats.totalScansByDate[date] ?? DEFAULT_SCANS_COUNT;
      });
      envTotalVolume.set(stats.name, total);
    });

    const orderedStats = [...allStats].sort(
      (a, b) =>
        (envTotalVolume.get(a.name) ?? DEFAULT_SCANS_COUNT) - (envTotalVolume.get(b.name) ?? DEFAULT_SCANS_COUNT)
    );

    // Environment colors (Shared across all charts)
    const envColors: Record<string, string> = {
      "Bond Demo": "rgba(127, 24, 127, 1)",
      "Bond Production": "rgba(0, 100, 0, 1)",
      "Lowe's Production": "rgba(1, 33, 105, 1)",
      "Lowe's Staging": "rgba(0, 117, 206, 1)"
    };
    const DEFAULT_COLOR = "rgba(0, 0, 0, 1)";

    // --- 1. Aggregated Scan Volume Chart ---
    // Calculate data first
    const aggregatedScansByDate: Record<string, number> = {};
    allStats.forEach((stats) => {
      Object.entries(stats.totalScansByDate).forEach(([date, count]) => {
        aggregatedScansByDate[date] = (aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT) + count;
      });
    });

    let cumulative = 0;
    const cumulativeData: number[] = [];
    const dailyData: number[] = []; // Cumulative Average

    sortedDates.forEach((date, index) => {
      const dailyCount = aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT;
      cumulative += dailyCount;
      cumulativeData.push(cumulative);

      const daysPassed = index + DAY_OFFSET;

      const average = Number((cumulative / daysPassed).toFixed(DECIMAL_PLACES_AVG));
      dailyData.push(average);
    });

    const BASE_LAYER_ORDER = 100;

    const volumeDatasets: ChartUtils.MixedChartDataset[] = [
      {
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        borderColor: "black",
        borderWidth: 2,
        data: cumulativeData,
        fill: true,
        label: "Total",
        order: 200, // Ensure Total is always at the Bottom/Back (High Order = Back)
        type: "line",
        yAxisID: "y"
      }
    ];

    // Add individual environment lines
    // Push in Reverse Order (Large -> Small) so Large draws First (Back) and Small draws Last (Front)
    [...orderedStats].reverse().forEach((stats, i) => {
      let envCumulative = 0;
      const envData: number[] = [];
      sortedDates.forEach((date) => {
        const dailyCount = stats.totalScansByDate[date] ?? INITIAL_ERROR_COUNT;
        envCumulative += dailyCount;
        envData.push(envCumulative);
      });

      const borderColor = envColors[stats.name] ?? DEFAULT_COLOR;
      const backgroundColor = borderColor;

      volumeDatasets.push({
        backgroundColor,
        borderColor,
        borderWidth: 1.5,
        data: envData,
        fill: true,
        label: stats.name,
        order: BASE_LAYER_ORDER - i, // Large (i=0) -> 100 (Back). Small (i=N) -> 100-N (Front).
        type: "line",
        yAxisID: "y"
      });
    });

    // Add Average line last
    volumeDatasets.push({
      borderColor: "rgba(255, 99, 132, 1)", // Red
      borderWidth: 1.5,
      data: dailyData,
      fill: false,
      label: "Avg/Day",
      order: 300, // Top/Front
      type: "line",
      yAxisID: "y1"
    });

    try {
      const SCAN_VOLUME_CHART_HEIGHT = 420;
      charts.scanVolume = ChartUtils.getMixedChartConfig(sortedDates, volumeDatasets, {
        height: SCAN_VOLUME_CHART_HEIGHT,
        title: "",
        yLabelLeft: "Total Scans (Cumulative)",
        yLabelRight: "Avg Scans / Day"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate aggregated volume chart: ${String(e)}`);
    }

    // --- 2. Scan Success Percentage Chart ---
    const successDatasets = orderedStats.map((s) => {
      const color = envColors[s.name] ?? DEFAULT_COLOR;
      const data = sortedDates.map((d) => {
        const PERCENTAGE_BASE = 100;
        const ZERO = 0;
        const total = s.totalScansByDate[d] ?? ZERO;
        if (total === ZERO) {
          return null;
        }
        const clean = s.cleanScansByDate[d] ?? ZERO;
        return Math.round((clean / total) * PERCENTAGE_BASE);
      });
      return {
        borderColor: color,
        borderWidth: CHART_BORDER_WIDTH_NORMAL,
        data,
        label: s.name
      };
    });

    try {
      charts.success = ChartUtils.getLineChartConfig(sortedDates, successDatasets, {
        title: "",
        yLabel: "Success %"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate success chart: ${String(e)}`);
    }

    // --- 3. Error Chart ---
    const errorDatasets = orderedStats.map((s) => {
      const color = envColors[s.name] ?? DEFAULT_COLOR;
      const data = sortedDates.map((d) => {
        const total = s.totalScansByDate[d] ?? INITIAL_ERROR_COUNT;
        if (total === INITIAL_ERROR_COUNT) {
          return null;
        }
        return s.errorsByDate[d] ?? INITIAL_ERROR_COUNT;
      });
      return {
        borderColor: color,
        borderWidth: 1.5,
        data,
        label: s.name
      };
    });

    try {
      charts.errors = ChartUtils.getLineChartConfig(sortedDates, errorDatasets, {
        title: "",
        yLabel: "Error Count"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate code error chart: ${String(e)}`);
    }

    // --- 4. Warning Chart ---
    const warningDatasets = orderedStats.map((s) => {
      const color = envColors[s.name] ?? DEFAULT_COLOR;
      const data = sortedDates.map((d) => {
        const total = s.totalScansByDate[d] ?? INITIAL_ERROR_COUNT;
        if (total === INITIAL_ERROR_COUNT) {
          return null;
        }
        return s.warningsByDate[d] ?? INITIAL_ERROR_COUNT;
      });
      return {
        borderColor: color,
        borderWidth: 1.5,
        data,
        label: s.name
      };
    });

    try {
      charts.warnings = ChartUtils.getLineChartConfig(sortedDates, warningDatasets, {
        title: "",
        yLabel: "Warning Count"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate warning chart: ${String(e)}`);
    }
  }

  return charts;
}

export async function generateReport(allStats: EnvStats[]) {
  const charts = generateValidationCharts(allStats);
  const reportData = buildValidationReport(allStats, charts);

  await generatePdfReport(reportData, "validation-report.pdf");
  logger.info(`Report generated at: reports/validation-report.pdf`);
}

async function main() {
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
