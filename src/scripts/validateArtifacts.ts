import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import * as stream from "stream";
import { promisify } from "util";

import { ENVIRONMENTS } from "../../config/config";
import { Artifact, SpatialService } from "../services/spatialService";

const finished = promisify(stream.finished);

const REQUIRED_FIELDS: (keyof Artifact)[] = ["id", "projectId", "scanDate", "rawScan", "arData", "video"];

interface EnvStats {
  artifactsWithIssues: number;
  errorsByDate: Record<string, number>;
  missingCounts: Record<string, number>;
  name: string;
  processed: number;
  totalArtifacts: number;
}

async function validateEnvironment(env: { domain: string; name: string }): Promise<EnvStats> {
  console.log(`\nStarting validation for: ${env.name} (${env.domain})`);
  const stats: EnvStats = {
    artifactsWithIssues: 0,
    errorsByDate: {},
    missingCounts: {},
    name: env.name,
    processed: 0,
    totalArtifacts: 0
  };

  const NO_MISSING_FIELDS = 0;
  const ERROR_INCREMENT = 1;
  const INITIAL_ERROR_COUNT = 0;
  const DATE_PART_INDEX = 0;
  const NO_PAGES_LEFT = 0;

  const service = new SpatialService(env.domain, env.name);
  const page = 1;

  try {
    const initialRes = await service.fetchScanArtifacts(page);
    const { pagination } = initialRes;
    stats.totalArtifacts = pagination.total;
    const lastPage = pagination.lastPage;

    console.log(`Total artifacts to process: ${stats.totalArtifacts.toString()} (Pages: ${lastPage.toString()})`);

    const CONCURRENCY_LIMIT = 5;
    const pages = Array.from({ length: lastPage }, (_, i) => i + page);

    const activePromises: Promise<void>[] = [];
    let completed = 0;
    const totalToProcess = pages.length;

    const processPage = async (pageNum: number) => {
      try {
        const res = await service.fetchScanArtifacts(pageNum);

        for (const item of res.data) {
          stats.processed++;
          const missingFields = REQUIRED_FIELDS.filter((field) => item[field] === undefined || item[field] === null);

          if (missingFields.length > NO_MISSING_FIELDS) {
            stats.artifactsWithIssues++;
            for (const field of missingFields) {
              stats.missingCounts[field] = (stats.missingCounts[field] ?? INITIAL_ERROR_COUNT) + ERROR_INCREMENT;
            }

            // Track error by date
            if (typeof item.scanDate === "string") {
              const date = item.scanDate.split("T")[DATE_PART_INDEX]; // YYYY-MM-DD
              if (date !== undefined) {
                const currentCount = stats.errorsByDate[date] ?? INITIAL_ERROR_COUNT;
                stats.errorsByDate[date] = currentCount + ERROR_INCREMENT;
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

    const NOT_FOUND = -1;
    const PROMISE_REMOVE_COUNT = 1;

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

async function createLineChart(
  labels: string[],
  datasets: { label: string; data: number[]; borderColor: string }[]
): Promise<Buffer> {
  const CHART_WIDTH = 600;
  const CHART_HEIGHT = 400;
  const CHART_BG_COLOR = "white";

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    backgroundColour: CHART_BG_COLOR,
    height: CHART_HEIGHT,
    width: CHART_WIDTH
  });
  const configuration: ChartConfiguration = {
    data: {
      datasets: datasets.map((ds) => ({
        backgroundColor: ds.borderColor,
        borderColor: ds.borderColor,
        data: ds.data,
        fill: false,
        label: ds.label,
        tension: 0.1
      })),
      labels
    },
    options: {
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: "Data Errors Over Time" }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Error Count" } }
      }
    },
    type: "line"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
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

  const PDF_SPACING = 2;
  const DEFAULT_WIDTH = 0;
  const PDF_MARGIN = 50;
  const PDF_HEADER_SIZE = 20;
  const PDF_BODY_SIZE = 12;
  const COL_WIDTH_LG = 140;
  const COL_WIDTH_SM = 70;
  const PDF_MAX_WIDTH = 500;
  const INITIAL_ERROR_COUNT = 0;
  const NO_MISSING_FIELDS = 0;
  const PAGE_ALIGN_LEFT = 0;
  const CHART_WIDTH = 600;
  const CENTER_DIVISOR = 2;

  // Title
  doc.fontSize(PDF_HEADER_SIZE).text("Validation Report", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(PDF_SPACING);

  // Summary Table Header
  const tableTop = doc.y;
  const colWidths = [COL_WIDTH_LG, COL_WIDTH_SM, COL_WIDTH_SM, COL_WIDTH_SM, COL_WIDTH_SM];
  const headers = ["Environment", "Total", "Processed", "Issues", "Missing Properties"];
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
    if (stats.artifactsWithIssues > NO_MISSING_FIELDS) {
      const sortedFields = Object.keys(stats.missingCounts).sort();
      missingPropsStr = sortedFields
        .map((field) => `${field}: ${(stats.missingCounts[field] ?? INITIAL_ERROR_COUNT).toString()}`)
        .join(", ");
    } else {
      missingPropsStr = "None";
    }

    const rowY = doc.y;
    // We adjust missing properties column width to take up remainder
    const propColWidth = PDF_MAX_WIDTH - (COL_WIDTH_LG + COL_WIDTH_SM + COL_WIDTH_SM + COL_WIDTH_SM);

    // Manual layout for this specific table structure
    doc.text(stats.name, PDF_MARGIN, rowY, { width: COL_WIDTH_LG });
    doc.text(stats.totalArtifacts.toString(), PDF_MARGIN + COL_WIDTH_LG, rowY, { width: COL_WIDTH_SM });
    doc.text(stats.processed.toString(), PDF_MARGIN + COL_WIDTH_LG + COL_WIDTH_SM, rowY, { width: COL_WIDTH_SM });
    doc.text(stats.artifactsWithIssues.toString(), PDF_MARGIN + COL_WIDTH_LG + COL_WIDTH_SM + COL_WIDTH_SM, rowY, {
      width: COL_WIDTH_SM
    });
    doc.text(missingPropsStr, PDF_MARGIN + COL_WIDTH_LG + COL_WIDTH_SM + COL_WIDTH_SM + COL_WIDTH_SM, rowY, {
      width: propColWidth
    });

    doc.moveDown();
  });

  doc.moveDown(PDF_SPACING);

  // Generate Graph
  const allDates = new Set<string>();
  allStats.forEach((s) => {
    Object.keys(s.errorsByDate).forEach((d) => {
      allDates.add(d);
    });
  });

  const MIN_DATA_POINTS = 0;
  if (allDates.size > MIN_DATA_POINTS) {
    const sortedDates = Array.from(allDates).sort();
    const datasets = allStats.map((s, i) => {
      // Pick a color based on index
      const colors = ["red", "blue", "green", "orange", "purple"];
      const color = colors[i % colors.length] ?? "black";

      const data = sortedDates.map((d) => s.errorsByDate[d] ?? INITIAL_ERROR_COUNT);
      return {
        borderColor: color,
        data,
        label: s.name
      };
    });

    try {
      const chartBuffer = await createLineChart(sortedDates, datasets);
      // Keep everything on one page if possible
      doc
        .fontSize(PDF_HEADER_SIZE)
        .text("Error Trends", PAGE_ALIGN_LEFT, doc.y, { align: "center", width: doc.page.width });
      doc.moveDown();
      doc.image(chartBuffer, (doc.page.width - CHART_WIDTH) / CENTER_DIVISOR, doc.y, { width: CHART_WIDTH }); // Center image
    } catch (e) {
      console.error("Failed to generate chart:", e);
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
