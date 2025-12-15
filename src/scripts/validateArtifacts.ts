import { LegendItem } from "chart.js";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import * as stream from "stream";
import { promisify } from "util";

import { ENVIRONMENTS } from "../../config/config";
import { Artifact, SpatialService } from "../services/spatialService";
import * as ChartUtils from "../utils/chartUtils";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";

/**
 * Script to validate data integrity of artifacts on the server.
 * - Fetches all artifact metadata from the API.
 * - Checks for missing required fields (id, projectId, scanDate, etc.).
 * - Dynamically tracks and reports presence counts for ALL properties found in artifacts.
 * - Generates a report showing error and warning trends over time and by environment.
 */

const finished = promisify(stream.finished);

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
  const doc = new PDFDocument();
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, "validation-report.pdf");
  const writeStream = fs.createWriteStream(reportPath);
  doc.pipe(writeStream);

  // PDF Layout Constants
  const PDF_SPACING = 2;
  const PDF_MARGIN = 50;
  const PDF_HEADER_SIZE = 20;
  const PDF_BODY_SIZE = 12;
  const CHART_WIDTH = 600;
  const CENTER_DIVISOR = 2;
  const MIN_DATA_POINTS = 0;
  const INITIAL_ERROR_COUNT = 0;
  const HEADER_FONT_SIZE = 10;
  const ROW_FONT_SIZE = 10;
  const HALF = 2;
  const PERCENTAGE_SCALE = 100;
  const MAX_PERCENTAGE = 100;
  const SEPARATOR_WIDTH = 0.5;
  const SEPARATOR_OFFSET = 5;
  const OFFSET_ONE = 1;
  const CHART_BAR_HEIGHT = 15;
  const MIN_CHART_HEIGHT = 300;
  const CHART_PADDING = 20;
  const HEADER_FOOTER_SPACE = 60;
  const DAY_OFFSET = 1;
  const DECIMAL_PLACES_AVG = 1;
  const VERTICAL_TEXT_OFFSET = 10;
  const STROKE_WIDTH_NORMAL = 1;

  const MARGIN_SIDES = 2;
  const CHART_BORDER_WIDTH_NORMAL = 1.5;

  const NO_STATS = 0;

  if (allStats.length === NO_STATS) {
    doc.fontSize(PDF_HEADER_SIZE).text("Validation Report", { align: "center" });
    doc.fontSize(PDF_BODY_SIZE).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(PDF_SPACING);
    doc.text("No environments / no data.", { align: "center" });
    doc.end();
    await finished(writeStream);
    return;
  }

  // Title
  doc.fontSize(PDF_HEADER_SIZE).text("Validation Report", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(PDF_SPACING);
  const tableTop = doc.y;

  // New Transposed Table Layout
  const METRIC_COL_WIDTH = 120;
  const START_X = PDF_MARGIN;
  const margins = PDF_MARGIN * MARGIN_SIDES;
  const availableWidth = doc.page.width - margins - METRIC_COL_WIDTH;
  const envColWidth = availableWidth / allStats.length;
  const ROW_HEIGHT = 20;

  const envHeaders = allStats.map((s) => s.name);

  // Draw Header
  doc.font("Helvetica-Bold");
  doc.fontSize(HEADER_FONT_SIZE); // Reduce font size for headers to prevent wrapping
  let currentX = START_X;
  // Leave first cell blank as requested
  currentX += METRIC_COL_WIDTH;

  // Helper to truncate text to fit width
  const truncateText = (text: string, maxWidth: number): string => {
    const ROLLBACK_CHAR = 1;
    const ELLIPSIS = "...";
    if (doc.widthOfString(text) <= maxWidth) {
      return text;
    }
    let truncated = text;
    const START_INDEX = 0;
    while (doc.widthOfString(truncated + ELLIPSIS) > maxWidth && truncated.length > START_INDEX) {
      truncated = truncated.slice(START_INDEX, -ROLLBACK_CHAR);
    }
    return truncated + ELLIPSIS;
  };

  envHeaders.forEach((header) => {
    const displayText = truncateText(header, envColWidth);
    doc.text(displayText, currentX, tableTop, { align: "center", width: envColWidth });
    currentX += envColWidth;
  });
  const ensureSpace = (height: number) => {
    if (doc.y + height > doc.page.height - PDF_MARGIN) {
      doc.addPage();
    }
  };

  doc.moveDown();
  doc.font("Helvetica");
  doc.fontSize(ROW_FONT_SIZE);

  // Define Metrics to Display
  const REQUIRED_FIELDS: (keyof Artifact)[] = ["id", "scanDate", "rawScan", "arData", "video"];
  const IGNORED_METRIC_FIELDS = ["id", "scanDate"];

  const dynamicMetrics = REQUIRED_FIELDS.filter((f) => !IGNORED_METRIC_FIELDS.includes(f)).map((field) => ({
    backgroundColor: "#FFF5F5",
    color: "gray",
    getValue: (s: EnvStats) => [{ text: (s.missingCounts[field] ?? INITIAL_ERROR_COUNT).toString() }],
    label: `Missing ${field}`
  }));

  const metrics = [
    {
      backgroundColor: "#F0F8FF",
      getValue: (s: EnvStats) => {
        const percentage =
          s.totalArtifacts > INITIAL_ERROR_COUNT
            ? Math.min(MAX_PERCENTAGE, Math.round((s.processed / s.totalArtifacts) * PERCENTAGE_SCALE))
            : INITIAL_ERROR_COUNT;
        return [
          { color: "black", text: s.processed.toString() },
          { color: "gray", text: ` (${percentage.toString()}%)` }
        ];
      },
      isBold: true,
      label: "Processed Artifacts"
    },
    {
      backgroundColor: "#FFEBEB",
      getValue: (s: EnvStats) => [{ text: s.artifactsWithIssues.toString() }],
      isBold: true,
      label: "Total Errors"
    },
    ...dynamicMetrics,
    {
      backgroundColor: "#FFF5F5",
      color: "gray",
      getValue: (s: EnvStats) => [{ text: (s.missingCounts["scanDate (invalid)"] ?? INITIAL_ERROR_COUNT).toString() }],
      label: "Invalid Date"
    },
    {
      backgroundColor: "#FFF8E1",
      getValue: (s: EnvStats) => [{ text: s.artifactsWithWarnings.toString() }],
      isBold: true,
      label: "Total Warnings"
    },
    {
      backgroundColor: "#FFFFF0",
      color: "gray",
      getValue: (s: EnvStats) => [{ text: (s.warningCounts["projectId"] ?? INITIAL_ERROR_COUNT).toString() }],
      label: "Missing ProjectId"
    }
  ];

  // Draw Data Rows
  metrics.forEach((metric) => {
    const rowY = doc.y;

    // Draw row background (highlight bold metrics or custom)
    const m = metric as { backgroundColor?: string; isBold?: boolean };
    const rowColor = m.backgroundColor ?? (m.isBold === true ? "#F5F5F5" : "white");

    if (rowColor !== "white") {
      doc.save();
      const envsWidth = envColWidth * allStats.length;
      const tableWidth = METRIC_COL_WIDTH + envsWidth;
      doc.fillColor(rowColor).rect(START_X, rowY, tableWidth, ROW_HEIGHT).fill();
      doc.restore();
    }

    let currentXRow = START_X;
    const verticalOffset = (ROW_HEIGHT - VERTICAL_TEXT_OFFSET) / HALF;
    const textY = rowY + verticalOffset; // Vertically center text

    // Draw Label
    doc.fillColor("black"); // Reset color for label
    doc.font(m.isBold === true ? "Helvetica-Bold" : "Helvetica");
    doc.text(metric.label, currentXRow, textY, { align: "left", width: METRIC_COL_WIDTH });
    currentXRow += METRIC_COL_WIDTH;

    // Draw Values for each Env
    doc.font("Helvetica");
    allStats.forEach((stats) => {
      const parts = metric.getValue(stats);
      // Calculate total width to center manually
      const totalWidth = parts.reduce((sum, p) => sum + doc.widthOfString(p.text), INITIAL_ERROR_COUNT);
      const centerOffset = (envColWidth - totalWidth) / HALF;
      let drawX = currentXRow + centerOffset;

      parts.forEach((part) => {
        const p = part as { text: string; color?: string };
        const partColor = p.color ?? (metric as { color?: string }).color ?? "black";
        doc.fillColor(partColor);
        doc.text(p.text, drawX, textY, { continued: false });
        drawX += doc.widthOfString(p.text);
      });

      currentXRow += envColWidth;
    });

    // Advance to next row
    doc.y = rowY + ROW_HEIGHT;
  });
  doc.fillColor("black"); // Reset final color

  const tableBottom = doc.y;

  // Draw Vertical Column Separators
  doc.lineWidth(SEPARATOR_WIDTH).strokeColor("#E0E0E0");
  let sepX = START_X + METRIC_COL_WIDTH;

  // Separator after Metric Column
  doc
    .moveTo(sepX, tableTop - SEPARATOR_OFFSET)
    .lineTo(sepX, tableBottom)
    .stroke();

  // Separators between Environment Columns
  for (let i = 0; i < allStats.length - OFFSET_ONE; i++) {
    sepX += envColWidth;
    doc
      .moveTo(sepX, tableTop - SEPARATOR_OFFSET)
      .lineTo(sepX, tableBottom)
      .stroke();
  }

  doc.strokeColor("black").lineWidth(STROKE_WIDTH_NORMAL); // Reset styles

  // Aggregate counts across all environments
  const consolidatedCounts: Record<string, number> = {};
  let grandTotal = 0;
  allStats.forEach((stats) => {
    grandTotal += stats.totalArtifacts;
    Object.entries(stats.propertyCounts).forEach(([key, count]) => {
      consolidatedCounts[key] = (consolidatedCounts[key] ?? INITIAL_ERROR_COUNT) + count;
    });
  });

  // Sort by count descending
  const sortedProps = Object.entries(consolidatedCounts)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count > INITIAL_ERROR_COUNT);

  const chartLabels = sortedProps.map(([k]) => k);
  const chartData = sortedProps.map(([, v]) => v);

  if (chartLabels.length > MIN_DATA_POINTS) {
    try {
      // Use constants defined above
      const contentHeight = chartLabels.length * CHART_BAR_HEIGHT;
      const dynamicHeight = Math.max(MIN_CHART_HEIGHT, contentHeight + HEADER_FOOTER_SPACE);

      const propertyChartBuffer = await ChartUtils.createBarChart(
        chartLabels,
        chartData,
        "Property Presence (All Environments)",
        { height: dynamicHeight, horizontal: true, totalForPercentages: grandTotal, width: CHART_WIDTH }
      );

      doc.moveDown();
      ensureSpace(dynamicHeight);
      doc.image(propertyChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
      doc.y += dynamicHeight + CHART_PADDING;
    } catch (e) {
      logger.error(`Failed to generate property chart: ${String(e)}`);
    }
  }

  doc.moveDown(PDF_SPACING);

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
    // Use constants defined above

    sortedDates.forEach((date, index) => {
      const dailyCount = aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT;
      cumulative += dailyCount;
      cumulativeData.push(cumulative);

      const daysPassed = index + DAY_OFFSET;

      const average = Number((cumulative / daysPassed).toFixed(DECIMAL_PLACES_AVG));
      dailyData.push(average);
    });

    // Environment colors definition moved to top of scope
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
        title: "Scan Volume (All Environments)",
        yLabelLeft: "Total Scans (Cumulative)",
        yLabelRight: "Avg Scans / Day"
      });
      ensureSpace(MIN_CHART_HEIGHT + CHART_PADDING);
      doc.moveDown();
      doc.image(volumeChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
      doc.y += 320; // 300 height + 20 padding
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
        title: "Scan Success Percentage Over Time",
        yLabel: "Success %"
      });
      ensureSpace(MIN_CHART_HEIGHT);
      doc.moveDown();
      doc.image(successChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
      doc.y += MIN_CHART_HEIGHT + CHART_PADDING;
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
      const errorChartBuffer = await ChartUtils.createLineChart(sortedDates, errorDatasets);
      ensureSpace(MIN_CHART_HEIGHT + CHART_PADDING);
      doc.moveDown();
      doc.image(errorChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
      doc.y += 320; // 300 height + 20 padding
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
        title: "Warnings Over Time",
        yLabel: "Warning Count"
      });
      ensureSpace(MIN_CHART_HEIGHT);
      doc.moveDown();
      doc.image(warningChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
      doc.y += MIN_CHART_HEIGHT + CHART_PADDING;
    } catch (e) {
      logger.error(`Failed to generate warning chart: ${String(e)}`);
    }
  }

  doc.end();
  await finished(writeStream);
  logger.info(`\nReport generated at: ${reportPath}`);
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
