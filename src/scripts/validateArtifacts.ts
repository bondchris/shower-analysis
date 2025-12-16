import { LegendItem } from "chart.js";
import { sumBy } from "lodash";

import { ENVIRONMENTS } from "../../config/config";
import { Artifact, SpatialService } from "../services/spatialService";
import * as ChartUtils from "../utils/chartUtils";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { ReportSection, generatePdfReport } from "../utils/reportGenerator";

const CHART_BAR_HEIGHT = 15;
const MIN_CHART_HEIGHT = 300;
const HEADER_FOOTER_SPACE = 60;

/**
 * Script to validate data integrity of artifacts on the server.
 * - Fetches all artifact metadata from the API.
 * - Checks for missing required fields (id, projectId, scanDate, etc.).
 * - Dynamically tracks and reports presence counts for ALL properties found in artifacts.
 * - Generates a report showing error and warning trends over time and by environment.
 */

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

export interface EnvStats {
  artifactsWithIssues: number;
  artifactsWithWarnings: number;
  errorsByDate: Record<string, number>;
  warningsByDate: Record<string, number>;
  cleanScansByDate: Record<string, number>;
  totalScansByDate: Record<string, number>;
  missingCounts: Record<string, number>;
  warningCounts: Record<string, number>;
  processed: number;
  totalArtifacts: number;
  propertyCounts: Record<string, number>;
  name: string;
  pageErrors: Record<number, string>;
}

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
      } catch (e) {
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
  } catch (error) {
    logger.error(`Failed to fetch from ${env.name}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return stats;
}

export async function generateReport(allStats: EnvStats[]) {
  const INITIAL_ERROR_COUNT = 0;
  const ZERO = 0;
  const PERCENTAGE_BASE = 100;
  const MIN_DATA_POINTS = 0;
  const NO_STATS = 0;
  const DECIMAL_PLACES = 1;
  const LAST_ELEMENT_OFFSET = 1;

  const grandTotal = sumBy(allStats, "totalArtifacts");

  if (allStats.length === NO_STATS) {
    await generatePdfReport(
      {
        sections: [{ data: "No environments / no data.", type: "text" }],
        title: "Validation Report"
      },
      "validation-report.pdf"
    );
    return;
  }

  const sections: ReportSection[] = [];

  // Standardized Table Logic (Exploded Rows for Errors & Warnings)
  // Columns: [Label, ...Environment Names, All]
  const totalProcessed = sumBy(allStats, "processed");
  const totalErrors = sumBy(allStats, "artifactsWithIssues");
  const totalWarnings = sumBy(allStats, "artifactsWithWarnings");

  const headers = ["", ...allStats.map((s) => s.name), "Total"];
  const tableData: string[][] = [];
  const rowClasses: Record<number, string> = {};

  // 1. Processed Row
  const processedRow = ["Processed Artifacts"];
  allStats.forEach((stat) => {
    const total = stat.totalArtifacts; // Use stat.totalArtifacts as the total for this environment
    if (total > ZERO) {
      const percentage = ((stat.processed / total) * PERCENTAGE_BASE).toFixed(DECIMAL_PLACES);
      // De-emphasize the percentage visually
      processedRow.push(
        `${stat.processed.toString()} <span style="font-weight:normal;color:#6b7280;font-size:0.9em">(${percentage}%)</span>`
      );
    } else {
      processedRow.push("0 (0.0%)");
    }
  });
  processedRow.push(`<span style="font-weight:normal;color:#6b7280">${totalProcessed.toString()}</span>`);
  tableData.push(processedRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-info";

  // 2. Total Errors Row
  const totalErrorsRow = ["Total Errors"];
  allStats.forEach((stat) => {
    totalErrorsRow.push(String(stat.artifactsWithIssues));
  });
  totalErrorsRow.push(`<span style="font-weight:normal;color:#6b7280">${totalErrors.toString()}</span>`);
  tableData.push(totalErrorsRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-error";

  // 3. Error Detail Rows
  // Collect all unique error keys across all environments
  const allErrorKeys = new Set<string>();
  allStats.forEach((stat) => {
    Object.keys(stat.missingCounts).forEach((k) => allErrorKeys.add(k));
  });
  Array.from(allErrorKeys)
    .sort()
    .forEach((key) => {
      const row = [key]; // e.g. "Missing rawScan"
      let rowTotal = 0;
      allStats.forEach((stat) => {
        const count = stat.missingCounts[key] ?? INITIAL_ERROR_COUNT;
        row.push(String(count));
        rowTotal += count;
      });
      row.push(`<span style="font-weight:normal;color:#6b7280">${rowTotal.toString()}</span>`);
      tableData.push(row);
      rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-error-light";
    });

  // 4. Total Warnings Row
  const totalWarningsRow = ["Total Warnings"];
  allStats.forEach((stat) => {
    totalWarningsRow.push(String(stat.artifactsWithWarnings));
  });
  totalWarningsRow.push(`<span style="font-weight:normal;color:#6b7280">${totalWarnings.toString()}</span>`);
  tableData.push(totalWarningsRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-warning";

  // 5. Warning Detail Rows
  const allWarningKeys = new Set<string>();
  allStats.forEach((stat) => {
    Object.keys(stat.warningCounts).forEach((k) => allWarningKeys.add(k));
  });
  Array.from(allWarningKeys)
    .sort()
    .forEach((key) => {
      const row = [key]; // e.g. "Missing ProjectId"
      let rowTotal = 0;
      allStats.forEach((stat) => {
        const count = stat.warningCounts[key] ?? INITIAL_ERROR_COUNT;
        row.push(String(count));
        rowTotal += count;
      });
      row.push(`<span style="font-weight:normal;color:#6b7280">${rowTotal.toString()}</span>`);
      tableData.push(row);
      rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-warning-light";
    });

  sections.push({
    data: tableData,
    options: { headers, rowClasses },
    type: "table"
  });

  // Convert charts to base64 for HTML embedding
  const charts: ReportSection[] = [];

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

      const propertyChartBuffer = await ChartUtils.createBarChart(chartLabels, chartData, "", {
        height: dynamicHeight,
        horizontal: true,
        totalForPercentages: grandTotal,
        width: 600
      });
      charts.push({
        data: `data:image/png;base64,${propertyChartBuffer.toString("base64")}`,
        title: "Property Presence",
        type: "chart"
      });
    } catch (e) {
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
        backgroundColor: "rgba(220, 220, 220, 0.5)",
        borderColor: "black",
        borderWidth: 2,
        data: cumulativeData,
        fill: true,
        label: "Total Cumulative Scans",
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
      label: "Cumulative Avg Scans/Day",
      type: "line",
      yAxisID: "y1"
    });

    try {
      const volumeChartBuffer = await ChartUtils.createMixedChart(sortedDates, volumeDatasets, {
        legendSort: (a: LegendItem, b: LegendItem) => {
          // Force "Cumulative Avg Scans/Day" to the end (Far Right)
          // Sort is Descending (High -> Low).
          // assign -1 to Avg so it is smaller than everything else (indices 0+).
          const LEGEND_SORT_LAST = -1;
          const DEFAULT_INDEX = 0;
          const getVal = (item: LegendItem): number => {
            return item.text === "Cumulative Avg Scans/Day" ? LEGEND_SORT_LAST : (item.datasetIndex ?? DEFAULT_INDEX);
          };
          return getVal(b) - getVal(a);
        },
        title: "",
        yLabelLeft: "Total Scans (Cumulative)",
        yLabelRight: "Avg Scans / Day"
      });
      charts.push({
        data: `data:image/png;base64,${volumeChartBuffer.toString("base64")}`,
        title: "Scan Volume (All Environments)",
        type: "chart"
      });
    } catch (e) {
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
      const successChartBuffer = await ChartUtils.createLineChart(sortedDates, successDatasets, {
        title: "",
        yLabel: "Success %"
      });
      charts.push({
        data: `data:image/png;base64,${successChartBuffer.toString("base64")}`,
        title: "Scan Success Percentage Over Time",
        type: "chart"
      });
    } catch (e) {
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
      const errorChartBuffer = await ChartUtils.createLineChart(sortedDates, errorDatasets, {
        title: "",
        yLabel: "Error Count"
      });
      charts.push({
        data: `data:image/png;base64,${errorChartBuffer.toString("base64")}`,
        title: "Errors Over Time",
        type: "chart"
      });
    } catch (e) {
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
      const warningChartBuffer = await ChartUtils.createLineChart(sortedDates, warningDatasets, {
        title: "",
        yLabel: "Warning Count"
      });
      charts.push({
        data: `data:image/png;base64,${warningChartBuffer.toString("base64")}`,
        title: "Warnings Over Time",
        type: "chart"
      });
    } catch (e) {
      logger.error(`Failed to generate warning chart: ${String(e)}`);
    }
  }

  // Generate Final PDF
  await generatePdfReport(
    {
      sections: [...sections, ...charts],
      title: "Validation Report"
    },
    "validation-report.pdf"
  );

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
