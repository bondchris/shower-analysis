import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

import { RawScan } from "./raw-scan";

const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
const REPORT_PATH = path.join(process.cwd(), "reports", "data-analysis.pdf");

// Constants
const SPLIT_LENGTH = 2;
const MARGIN = 50;
const SPACING_SMALL = 0.5;
const CHART_IMAGE_WIDTH_DURATION = 360;
const CHART_WIDTH_BAR = 200;
const CHART_HEIGHT_BAR = 140;
const TEXT_OFFSET = 5;
const TABLE_OFFSET = 20;
const LINE_HEIGHT = 10;
const INDENT = 40;
const INDENT_SMALL = 20;
const LEFT_COL_X = 70;
const RIGHT_COL_X = 340;
const CHART_WIDTH = 600;
const CHART_HEIGHT = 400;
const PDF_TITLE_SIZE = 25;
const PDF_SUBTITLE_SIZE = 16;
const PDF_BODY_SIZE = 12;
const INITIAL_COUNT = 0;
const DEFAULT_VALUE = 0;
const MIN_BUCKET_INDEX = 0;
const INCREMENT_STEP = 1;
const DECIMAL_PLACES = 2;
const PATH_OFFSET_ENVIRONMENT = 3;
const FONT_SIZE_SMALL = 8;
const TOP_N_ITEMS = 10;
const PROGRESS_UPDATE_INTERVAL = 10;
const BINS_COUNT = 10;
const LOW_FPS_THRESHOLD = 10;
const NUMERATOR_IDX = 0;
const DENOMINATOR_IDX = 1;

interface VideoMetadata {
  path: string;
  filename: string;
  environment: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
}

// 1. Video Metadata Extraction
async function getVideoMetadata(filePath: string): Promise<VideoMetadata | null> {
  const minMetadata = await new Promise<VideoMetadata | null>((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        console.error(`Error probing ${filePath}:`, err);
        resolve(null);
        return;
      }

      const stream = metadata.streams.find((s) => s.codec_type === "video");
      if (stream === undefined) {
        resolve(null);
        return;
      }

      // Extract FPS (e.g., "60/1" -> 60)
      let fps = DEFAULT_VALUE;
      if (stream.r_frame_rate !== undefined) {
        const parts = stream.r_frame_rate.split("/");
        if (parts.length === SPLIT_LENGTH) {
          const num = parts[NUMERATOR_IDX];
          const den = parts[DENOMINATOR_IDX];
          if (num !== undefined && den !== undefined) {
            fps = parseFloat(num) / parseFloat(den);
          }
        } else {
          fps = parseFloat(stream.r_frame_rate);
        }
      }

      const parts = filePath.split(path.sep);
      const environment = parts[parts.length - PATH_OFFSET_ENVIRONMENT] ?? "unknown";

      resolve({
        duration: metadata.format.duration ?? DEFAULT_VALUE,
        environment,
        filename: path.basename(filePath),
        fps,
        height: stream.height ?? DEFAULT_VALUE,
        path: filePath,
        width: stream.width ?? DEFAULT_VALUE
      });
    });
  });
  return minMetadata;
}

function findVideoFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findVideoFiles(fullPath));
    } else if (file === "video.mp4") {
      results.push(fullPath);
    }
  }
  return results;
}

// Chart Service
const chartCallback = (ChartJS: typeof import("chart.js").Chart) => {
  ChartJS.defaults.responsive = false;
  ChartJS.defaults.maintainAspectRatio = false;
};
const chartJSNodeCanvas = new ChartJSNodeCanvas({ chartCallback, height: CHART_HEIGHT, width: CHART_WIDTH });

async function createHistogram(data: number[], label: string, title: string): Promise<Buffer> {
  if (data.length === INITIAL_COUNT) {
    return Promise.resolve(Buffer.from([]));
  }
  const min = Math.floor(Math.min(...data));
  const max = Math.ceil(Math.max(...data));
  const bins = BINS_COUNT;
  const step = (max - min) / bins || INCREMENT_STEP;

  // Explicitly type buckets as number[]
  const buckets: number[] = new Array(bins).fill(INITIAL_COUNT) as number[];
  const labels: string[] = [];

  for (let i = INITIAL_COUNT; i < bins; i++) {
    const currentStep = i * step;
    const nextStep = (i + INCREMENT_STEP) * step;
    const start = min + currentStep;
    const end = min + nextStep;
    labels.push(`${start.toFixed(DECIMAL_PLACES)}-${end.toFixed(DECIMAL_PLACES)}`);
  }

  for (const val of data) {
    let bucketIndex = Math.floor((val - min) / step);
    if (bucketIndex >= bins) {
      bucketIndex = bins - INCREMENT_STEP;
    }
    if (bucketIndex < MIN_BUCKET_INDEX) {
      bucketIndex = MIN_BUCKET_INDEX;
    }
    const currentVal = buckets[bucketIndex];
    if (currentVal !== undefined) {
      buckets[bucketIndex] = currentVal + INCREMENT_STEP;
    }
  }

  const configuration: ChartConfiguration = {
    data: {
      datasets: [
        {
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: INCREMENT_STEP,
          data: buckets,
          label
        }
      ],
      labels
    },
    options: {
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title }
      },
      scales: {
        x: { title: { display: true, text: label } },
        y: { beginAtZero: true, title: { display: true, text: "Count" } }
      }
    },
    type: "bar"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

async function createBarChart(labels: string[], data: number[], title: string): Promise<Buffer> {
  const configuration: ChartConfiguration = {
    data: {
      datasets: [
        {
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: INCREMENT_STEP,
          data,
          label: "Count"
        }
      ],
      labels
    },
    options: {
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    },
    type: "bar"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

// Main Execution
async function main() {
  console.log("Finding video files...");
  const videoFiles = findVideoFiles(DATA_DIR);
  console.log(`Found ${videoFiles.length.toString()} video files.`);

  console.log(" extracting metadata...");
  const metadataList: VideoMetadata[] = [];
  let processed = INITIAL_COUNT;
  for (const file of videoFiles) {
    const metadata = await getVideoMetadata(file);
    if (metadata !== null) {
      metadataList.push(metadata);
    }
    processed++;
    if (processed % PROGRESS_UPDATE_INTERVAL === INITIAL_COUNT) {
      process.stdout.write(".");
    }
  }
  console.log("\nMetadata extraction complete.\n");

  if (metadataList.length === INITIAL_COUNT) {
    console.log("No metadata available to report.");
    return;
  }

  // --- Low FPS Analysis (<= 10fps) ---
  console.log("--- Low FPS Videos ---");
  const lowFpsVideos = metadataList.filter((m) => m.fps <= LOW_FPS_THRESHOLD);
  if (lowFpsVideos.length > INITIAL_COUNT) {
    lowFpsVideos.forEach((v) => {
      console.log(`- ${v.path} (${v.fps.toFixed(DECIMAL_PLACES)} fps) [${v.environment}]`);
    });
  } else {
    console.log("None found.");
  }
  console.log("----------------------\n");

  // Validate Raw Scans
  console.log("Validating Raw Scans...");
  const invalidScans: string[] = [];
  for (const m of metadataList) {
    const rawScanPath = path.join(path.dirname(m.path), "rawScan.json");
    if (fs.existsSync(rawScanPath)) {
      try {
        const content = fs.readFileSync(rawScanPath, "utf-8");
        const json = JSON.parse(content) as unknown;
        const _scan = new RawScan(json); // Validates on construction
        // Use variable to avoid unused error
        process.stdout.write(_scan.version ? "" : "");
      } catch (e) {
        invalidScans.push(`${m.filename} [${m.environment}]: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (invalidScans.length > INITIAL_COUNT) {
    console.log("\n--- Invalid Raw Scans ---");
    invalidScans.forEach((s) => {
      console.log(`- ${s}`);
    });
    console.log("-------------------------\n");
  } else {
    console.log("All raw scans are valid.\n");
  }

  // Identifyshortest videos
  console.log("\n--- 10 Shortest Videos ---");
  const sortedByDuration = [...metadataList].sort((a, b) => a.duration - b.duration);
  sortedByDuration.slice(INITIAL_COUNT, TOP_N_ITEMS).forEach((m) => {
    console.log(`- ${m.path} (${m.duration.toFixed(DECIMAL_PLACES)}s) [${m.environment}]`);
  });
  console.log("--------------------------\n");

  // --- Analysis ---
  const durations = metadataList.map((m) => m.duration);
  const avgDuration =
    durations.length > INITIAL_COUNT
      ? durations.reduce((a: number, b: number) => a + b, INITIAL_COUNT) / durations.length
      : DEFAULT_VALUE;

  const framerates = metadataList.map((m) => Math.round(m.fps)); // distinct framerates
  const fpsDistribution: Record<string, number> = {};
  framerates.forEach((fps: number) => {
    const key = fps.toString();
    fpsDistribution[key] = (fpsDistribution[key] ?? INITIAL_COUNT) + INCREMENT_STEP; // ONE is implicitly 1 count increment
  });

  const resolutions = metadataList.map((m) => `${m.width.toString()}x${m.height.toString()}`);
  const resDistribution: Record<string, number> = {};
  resolutions.forEach((res: string) => {
    resDistribution[res] = (resDistribution[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });

  console.log(`Unique Framerates: ${Object.keys(fpsDistribution).length.toString()}`);
  console.log(`Unique Resolutions: ${Object.keys(resDistribution).length.toString()}`);

  console.log("Generating charts...");

  // Duration Histogram
  const durationChart = await createHistogram(durations, "Seconds", "Video Duration Distribution");

  // FPS Bar Chart
  const fpsLabels = Object.keys(fpsDistribution).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsDistribution[l] ?? INITIAL_COUNT);
  const fpsChart = await createBarChart(fpsLabels, fpsCounts, "Framerate Distribution");

  // Resolution Bar Chart
  const resLabels = Object.keys(resDistribution).sort();
  const resCounts = resLabels.map((l) => resDistribution[l] ?? INITIAL_COUNT);
  const resChart = await createBarChart(resLabels, resCounts, "Resolution Distribution");

  console.log("Generating PDF...");
  const doc = new PDFDocument({ margin: MARGIN });
  doc.pipe(fs.createWriteStream(REPORT_PATH));

  const summaryText = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES)}s | Min: ${Math.min(...durations).toFixed(DECIMAL_PLACES)}s | Max: ${Math.max(...durations).toFixed(DECIMAL_PLACES)}s`;
  doc.fontSize(PDF_TITLE_SIZE).text("Artifact Data Analysis", { align: "center" });
  doc
    .fontSize(PDF_BODY_SIZE)
    .text(`Date: ${new Date().toLocaleDateString()} | Videos: ${metadataList.length.toString()}`, { align: "center" });
  doc.moveDown(SPACING_SMALL);

  doc.fontSize(PDF_SUBTITLE_SIZE).text("Summary Statistics", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(summaryText, { align: "center" });
  doc.moveDown(SPACING_SMALL);

  // Charts
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Visualizations", { align: "center" });
  doc.moveDown(SPACING_SMALL);

  // Duration Chart (Centered)
  const durHeight = CHART_IMAGE_WIDTH_DURATION * (CHART_HEIGHT / CHART_WIDTH);
  const xCentered = (doc.page.width - CHART_IMAGE_WIDTH_DURATION) / DECIMAL_PLACES;

  doc.image(durationChart, xCentered, doc.y, { width: CHART_IMAGE_WIDTH_DURATION });
  doc.y += durHeight;
  doc.fontSize(TOP_N_ITEMS).text("Duration Distribution", { align: "center" }); // 10px?
  doc.moveDown(SPACING_SMALL);

  // Side-by-side Bar Charts
  const yStart = doc.y;

  // FPS (Left)
  doc.image(fpsChart, LEFT_COL_X, yStart, { width: CHART_WIDTH_BAR });
  doc.text("Framerate", LEFT_COL_X, yStart + CHART_HEIGHT_BAR + TEXT_OFFSET, {
    align: "center",
    width: CHART_WIDTH_BAR
  });

  // FPS Data Table
  let yText = yStart + CHART_HEIGHT_BAR + TABLE_OFFSET;
  doc.fontSize(FONT_SIZE_SMALL);
  const sortedFps = Object.keys(fpsDistribution).sort((a, b) => Number(a) - Number(b));
  for (const key of sortedFps) {
    const val = fpsDistribution[key] ?? INITIAL_COUNT;
    doc.text(`${key} fps: ${val.toString()}`, LEFT_COL_X + INDENT, yText, { align: "left", width: CHART_WIDTH_BAR });
    yText += LINE_HEIGHT;
  }

  // Resolution (Right)
  doc.image(resChart, RIGHT_COL_X, yStart, { width: CHART_WIDTH_BAR });
  doc.text("Resolution", RIGHT_COL_X, yStart + CHART_HEIGHT_BAR + TEXT_OFFSET, {
    align: "center",
    width: CHART_WIDTH_BAR
  });

  // Resolution Data Table
  yText = yStart + CHART_HEIGHT_BAR + TABLE_OFFSET;
  doc.fontSize(FONT_SIZE_SMALL);
  const sortedRes = Object.keys(resDistribution).sort();
  for (const key of sortedRes) {
    const val = resDistribution[key] ?? INITIAL_COUNT;
    doc.text(`${key}: ${val.toString()}`, RIGHT_COL_X + INDENT_SMALL, yText, { align: "left", width: CHART_WIDTH_BAR });
    yText += LINE_HEIGHT;
  }

  doc.end();
  console.log(`Report generated at: ${REPORT_PATH}`);
}

main().catch(console.error);
