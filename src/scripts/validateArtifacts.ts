import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import * as stream from "stream";
import { promisify } from "util";

import { ENVIRONMENTS } from "../../config/config";
import { Artifact, SpatialService } from "../services/spatialService";
import * as ChartUtils from "../utils/chartUtils";

/**
 * Script to validate data integrity of artifacts on the server.
 * - Fetches all artifact metadata from the API.
 * - Checks for missing required fields (id, projectId, scanDate, etc.).
 * - Dynamically tracks and reports presence counts for ALL properties found in artifacts.
 * - Generates a report showing error and warning trends over time and by environment.
 */

const finished = promisify(stream.finished);

const REQUIRED_FIELDS: (keyof Artifact)[] = ["id", "scanDate", "rawScan", "arData", "video"];
const WARNING_FIELDS: (keyof Artifact)[] = ["projectId"];

interface EnvStats {
  artifactsWithIssues: number;
  artifactsWithWarnings: number;
  errorsByDate: Record<string, number>;
  warningsByDate: Record<string, number>;
  cleanScansByDate: Record<string, number>;
  totalScansByDate: Record<string, number>;
  missingCounts: Record<string, number>;
  warningCounts: Record<string, number>;
  propertyCounts: Record<string, number>;
  name: string;
  processed: number;
  totalArtifacts: number;
}

async function validateEnvironment(env: { domain: string; name: string }): Promise<EnvStats> {
  const PAGE_START = 1;
  const INITIAL_ERROR_COUNT = 0;
  const ERROR_INCREMENT = 1;
  const NO_MISSING_FIELDS = 0;
  const DATE_PART_INDEX = 0;
  const NO_PAGES_LEFT = 0;
  const NOT_FOUND = -1;
  const PROMISE_REMOVE_COUNT = 1;
  const CONCURRENCY_LIMIT = 5;

  console.log(`\nStarting validation for: ${env.name} (${env.domain})`);
  const stats: EnvStats = {
    artifactsWithIssues: 0,
    artifactsWithWarnings: 0,
    cleanScansByDate: {},
    errorsByDate: {},
    missingCounts: {},
    name: env.name,
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

    console.log(`Total artifacts to process: ${stats.totalArtifacts.toString()} (Pages: ${lastPage.toString()})`);

    const pages = Array.from({ length: lastPage }, (_, i) => i + PAGE_START);

    const activePromises: Promise<void>[] = [];
    let completed = 0;
    const totalToProcess = pages.length;

    const processPage = async (pageNum: number) => {
      try {
        const res = await service.fetchScanArtifacts(pageNum);

        for (const item of res.data) {
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
            if (typeof item.scanDate === "string") {
              const date = item.scanDate.split("T")[DATE_PART_INDEX]; // YYYY-MM-DD
              if (date !== undefined && !date.startsWith("0001")) {
                const currentCount = stats.errorsByDate[date] ?? INITIAL_ERROR_COUNT;
                stats.errorsByDate[date] = currentCount + ERROR_INCREMENT;
              }
            }
          }

          if (missingWarnings.length > NO_MISSING_FIELDS) {
            stats.artifactsWithWarnings++;
            for (const field of missingWarnings) {
              stats.warningCounts[field] = (stats.warningCounts[field] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;
            }

            // Track warning by date
            if (typeof item.scanDate === "string") {
              const date = item.scanDate.split("T")[DATE_PART_INDEX]; // YYYY-MM-DD
              if (date !== undefined && !date.startsWith("0001")) {
                const currentCount = stats.warningsByDate[date] ?? INITIAL_ERROR_COUNT;
                stats.warningsByDate[date] = currentCount + ERROR_INCREMENT;
              }
            }
          }

          // Track success percentages
          if (typeof item.scanDate === "string") {
            const date = item.scanDate.split("T")[DATE_PART_INDEX]; // YYYY-MM-DD
            if (date !== undefined && !date.startsWith("0001")) {
              const currentTotal = stats.totalScansByDate[date] ?? INITIAL_ERROR_COUNT;
              stats.totalScansByDate[date] = currentTotal + ERROR_INCREMENT;

              if (issues.length === NO_MISSING_FIELDS) {
                const currentClean = stats.cleanScansByDate[date] ?? INITIAL_ERROR_COUNT;
                stats.cleanScansByDate[date] = currentClean + ERROR_INCREMENT;
              }
            }
          }
        }
      } catch (e) {
        console.error(`\nError fetching page ${pageNum.toString()}:`, e instanceof Error ? e.message : e);
      } finally {
        completed++;
        process.stdout.write(`\rProcessed pages ${completed.toString()}/${totalToProcess.toString()}...`);
      }
    };

    while (pages.length > NO_PAGES_LEFT) {
      if (activePromises.length < CONCURRENCY_LIMIT) {
        const pageNum = pages.shift();
        if (pageNum !== undefined) {
          const p = processPage(pageNum).then(() => {
            const idx = activePromises.indexOf(p);
            if (idx !== NOT_FOUND) {
              activePromises.splice(idx, PROMISE_REMOVE_COUNT).forEach(() => {
                /** no-op */
              });
            }
          });

          activePromises.push(p);
        }
      } else {
        // Wait for at least one to finish
        await Promise.race(activePromises);
      }
    }

    // Wait for remaining
    await Promise.all(activePromises);

    console.log(`\n${env.name} complete.`);
  } catch (error) {
    console.error(`\nFailed to fetch from ${env.name}:`, error instanceof Error ? error.message : error);
  }

  return stats;
}

async function generateReport(allStats: EnvStats[]) {
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
  const DEFAULT_WIDTH = 0;
  const PDF_MARGIN = 50;
  const PDF_HEADER_SIZE = 20;
  const PDF_BODY_SIZE = 12;
  const COL_WIDTH_LG = 110;
  const COL_WIDTH_SM = 70;
  const PDF_MAX_WIDTH = 500;
  const COL_SMALL_COUNT = 4;
  const PAGE_ALIGN_LEFT = 0;
  const CHART_WIDTH = 600;
  const CENTER_DIVISOR = 2;
  const MIN_PARTS = 0;
  const COL_IDX_ERRORS = 2;
  const COL_IDX_WARNINGS = 3;
  const COL_IDX_MISSING = 4;
  const MIN_DATA_POINTS = 0;

  const INITIAL_ERROR_COUNT = 0;
  const NO_MISSING_FIELDS = 0;

  const colSmallTotal = COL_WIDTH_SM * COL_SMALL_COUNT;
  const COL_MISSING_PROP_WIDTH = PDF_MAX_WIDTH - (COL_WIDTH_LG + colSmallTotal);

  // Title
  doc.fontSize(PDF_HEADER_SIZE).text("Validation Report", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(PDF_SPACING);
  const tableTop = doc.y;
  const colWidths = [COL_WIDTH_LG, COL_WIDTH_SM, COL_WIDTH_SM, COL_WIDTH_SM, COL_WIDTH_SM, COL_MISSING_PROP_WIDTH];
  const headers = ["Environment", "Total", "Processed", "Errors", "Warnings", "Missing Properties"];
  let currentX = PDF_MARGIN;

  doc.font("Helvetica-Bold");
  headers.forEach((header, i) => {
    doc.text(header, currentX, tableTop, { align: "left", width: colWidths[i] ?? DEFAULT_WIDTH });
    currentX += colWidths[i] ?? DEFAULT_WIDTH;
  });
  doc.moveDown();
  doc.font("Helvetica");

  // Data Rows
  allStats.forEach((stats) => {
    let missingPropsStr = "";
    const errorFields = Object.keys(stats.missingCounts).sort();
    const warningFields = Object.keys(stats.warningCounts).sort();
    const parts: string[] = [];

    if (stats.artifactsWithIssues > NO_MISSING_FIELDS) {
      errorFields.forEach((field) => {
        parts.push(`${field}: ${(stats.missingCounts[field] ?? INITIAL_ERROR_COUNT).toString()}`);
      });
    }

    if (stats.artifactsWithWarnings > NO_MISSING_FIELDS) {
      warningFields.forEach((field) => {
        parts.push(`${field}: ${(stats.warningCounts[field] ?? INITIAL_ERROR_COUNT).toString()}`);
      });
    }

    if (parts.length > MIN_PARTS) {
      missingPropsStr = parts.join("\n");
    } else {
      missingPropsStr = "None";
    }

    const rowY = doc.y;
    let maxY = rowY;

    // We adjust missing properties column width to take up remainder
    const colMissingOffset = COL_WIDTH_SM * COL_IDX_MISSING;
    const propColWidth = PDF_MAX_WIDTH - (COL_WIDTH_LG + colMissingOffset);

    // Manual layout for this specific table structure
    doc.text(stats.name, PDF_MARGIN, rowY, { width: COL_WIDTH_LG });
    if (doc.y > maxY) {
      maxY = doc.y;
    }

    doc.text(stats.totalArtifacts.toString(), PDF_MARGIN + COL_WIDTH_LG, rowY, { width: COL_WIDTH_SM });
    if (doc.y > maxY) {
      maxY = doc.y;
    }

    doc.text(stats.processed.toString(), PDF_MARGIN + COL_WIDTH_LG + COL_WIDTH_SM, rowY, { width: COL_WIDTH_SM });
    if (doc.y > maxY) {
      maxY = doc.y;
    }

    const colErrorsOffset = COL_WIDTH_SM * COL_IDX_ERRORS;
    doc.text(stats.artifactsWithIssues.toString(), PDF_MARGIN + COL_WIDTH_LG + colErrorsOffset, rowY, {
      width: COL_WIDTH_SM
    });
    if (doc.y > maxY) {
      maxY = doc.y;
    }

    const colWarningsOffset = COL_WIDTH_SM * COL_IDX_WARNINGS;
    doc.text(stats.artifactsWithWarnings.toString(), PDF_MARGIN + COL_WIDTH_LG + colWarningsOffset, rowY, {
      width: COL_WIDTH_SM
    });
    if (doc.y > maxY) {
      maxY = doc.y;
    }

    doc.text(missingPropsStr, PDF_MARGIN + COL_WIDTH_LG + colMissingOffset, rowY, {
      width: propColWidth
    });
    if (doc.y > maxY) {
      maxY = doc.y;
    }

    doc.y = maxY;
    doc.moveDown();
  });

  doc.moveDown(PDF_SPACING);

  // Property Presence Chart
  doc.addPage();

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
      const CHART_HEIGHT = 400;
      const propertyChartBuffer = await ChartUtils.createBarChart(
        chartLabels,
        chartData,
        "Property Presence (All Environments)",
        { height: CHART_HEIGHT, horizontal: true, totalForPercentages: grandTotal, width: CHART_WIDTH }
      );

      doc
        .fontSize(PDF_HEADER_SIZE)
        .text("Property Presence", PAGE_ALIGN_LEFT, doc.y, { align: "center", width: doc.page.width });
      doc.moveDown();
      doc.image(propertyChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
    } catch (e) {
      console.error("Failed to generate property chart:", e);
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

    // Error Chart
    const errorDatasets = allStats.map((s, i) => {
      const colors = ["red", "blue", "green", "orange", "purple"];
      const color = colors[i % colors.length] ?? "black";
      const data = sortedDates.map((d) => {
        const total = s.totalScansByDate[d] ?? INITIAL_ERROR_COUNT;
        if (total === INITIAL_ERROR_COUNT) {
          return null;
        }
        return s.errorsByDate[d] ?? INITIAL_ERROR_COUNT;
      });
      return {
        borderColor: color,
        data,
        label: s.name
      };
    });

    try {
      const errorChartBuffer = await ChartUtils.createLineChart(sortedDates, errorDatasets);
      doc.addPage();
      doc
        .fontSize(PDF_HEADER_SIZE)
        .text("Error Trends", PAGE_ALIGN_LEFT, doc.y, { align: "center", width: doc.page.width });
      doc.moveDown();
      doc.image(errorChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
    } catch (e) {
      console.error("Failed to generate code error chart:", e);
    }

    // Warning Chart
    const warningDatasets = allStats.map((s, i) => {
      const colors = ["red", "blue", "green", "orange", "purple"];
      const color = colors[i % colors.length] ?? "black";
      const data = sortedDates.map((d) => {
        const total = s.totalScansByDate[d] ?? INITIAL_ERROR_COUNT;
        if (total === INITIAL_ERROR_COUNT) {
          return null;
        }
        return s.warningsByDate[d] ?? INITIAL_ERROR_COUNT;
      });
      return {
        borderColor: color,
        data,
        label: s.name
      };
    });

    try {
      const warningChartBuffer = await ChartUtils.createLineChart(sortedDates, warningDatasets, {
        title: "Warnings Over Time",
        yLabel: "Warning Count"
      });
      doc.addPage();
      doc
        .fontSize(PDF_HEADER_SIZE)
        .text("Warning Trends", PAGE_ALIGN_LEFT, doc.y, { align: "center", width: doc.page.width });
      doc.moveDown();
      doc.image(warningChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
    } catch (e) {
      console.error("Failed to generate warning chart:", e);
    }

    // Success Percentage Chart
    const successDatasets = allStats.map((s, i) => {
      const colors = ["red", "blue", "green", "orange", "purple"];
      const color = colors[i % colors.length] ?? "black";
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
        data,
        label: s.name
      };
    });

    try {
      const successChartBuffer = await ChartUtils.createLineChart(sortedDates, successDatasets, {
        title: "Scan Success Percentage Over Time",
        yLabel: "Success %"
      });
      doc.addPage();
      doc
        .fontSize(PDF_HEADER_SIZE)
        .text("Success Trends", PAGE_ALIGN_LEFT, doc.y, { align: "center", width: doc.page.width });
      doc.moveDown();
      doc.image(successChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
    } catch (e) {
      console.error("Failed to generate success chart:", e);
    }

    // Aggregated Scan Volume Chart
    const aggregatedScansByDate: Record<string, number> = {};
    allStats.forEach((stats) => {
      Object.entries(stats.totalScansByDate).forEach(([date, count]) => {
        aggregatedScansByDate[date] = (aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT) + count;
      });
    });

    let cumulative = 0;
    const cumulativeData: number[] = [];
    const dailyData: number[] = []; // Now Cumulative Average
    const DAY_OFFSET = 1;

    sortedDates.forEach((date, index) => {
      const dailyCount = aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT;
      cumulative += dailyCount;
      cumulativeData.push(cumulative);

      const daysPassed = index + DAY_OFFSET;
      const DECIMAL_PLACES = 1;
      const average = Number((cumulative / daysPassed).toFixed(DECIMAL_PLACES));
      dailyData.push(average);
    });

    const volumeDatasets: ChartUtils.MixedChartDataset[] = [
      {
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)", // Blue
        data: cumulativeData,
        fill: true,
        label: "Cumulative Scans",
        order: 2,
        type: "line",
        yAxisID: "y"
      },
      {
        borderColor: "rgba(255, 99, 132, 1)", // Red
        data: dailyData,
        fill: false,
        label: "Cumulative Avg Scans/Day",
        order: 1,
        type: "line",
        yAxisID: "y1"
      }
    ];

    try {
      const volumeChartBuffer = await ChartUtils.createMixedChart(sortedDates, volumeDatasets, {
        title: "Scan Volume (All Environments)",
        yLabelLeft: "Total Scans (Cumulative)",
        yLabelRight: "Avg Scans / Day"
      });
      doc.addPage();
      doc
        .fontSize(PDF_HEADER_SIZE)
        .text("Scan Volume - Aggregated", PAGE_ALIGN_LEFT, doc.y, { align: "center", width: doc.page.width });
      doc.moveDown();
      doc.image(volumeChartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH });
    } catch (e) {
      console.error("Failed to generate aggregated volume chart:", e);
    }
  }

  doc.end();
  await finished(writeStream);
  console.log(`\nReport generated at: ${reportPath}`);
}

async function main() {
  const allStats: EnvStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await validateEnvironment(env as { domain: string; name: string });
    allStats.push(stats);
  }
  await generateReport(allStats);
}

main().catch(console.error);
