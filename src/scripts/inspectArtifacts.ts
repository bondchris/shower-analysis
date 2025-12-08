import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

import { ArData } from "../models/arData";
import { RawScan } from "../models/rawScan";

const MIN_CORNERS = 3;
const INDEX_X = 0;
const INDEX_Z = 2;
const DIVISOR = 2.0;
const INITIAL_COUNT = 0;
const NEXT_OFFSET = 1;
const DEFAULT_DECIMALS = 0;

interface SimpleFloor {
  polygonCorners?: number[][];
  dimensions?: number[];
}
interface SimpleRawScan {
  floors?: SimpleFloor[];
}

function calculatePolygonArea(corners: number[][]): number {
  if (corners.length < MIN_CORNERS) {
    return INITIAL_COUNT;
  }
  let area = INITIAL_COUNT;
  for (let i = INITIAL_COUNT; i < corners.length; i++) {
    const j = (i + NEXT_OFFSET) % corners.length;
    const p1 = corners[i];
    const p2 = corners[j];
    if (p1 !== undefined && p2 !== undefined && p1.length >= MIN_CORNERS && p2.length >= MIN_CORNERS) {
      const x1 = p1[INDEX_X];
      const z1 = p1[INDEX_Z];
      const x2 = p2[INDEX_X];
      const z2 = p2[INDEX_Z];
      if (x1 !== undefined && z1 !== undefined && x2 !== undefined && z2 !== undefined) {
        area += x1 * z2;
        area -= x2 * z1;
      }
    }
  }
  return Math.abs(area) / DIVISOR;
}

interface VideoMetadata {
  path: string;
  filename: string;
  environment: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  lensModel?: string;
  avgAmbientIntensity?: number;
  avgColorTemperature?: number;
  avgIso?: number;
  avgBrightness?: number;
  roomAreaSqFt?: number;
}

// 1. Video Metadata Extraction
async function getVideoMetadata(filePath: string): Promise<VideoMetadata | null> {
  const SPLIT_LENGTH = 2;
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const PATH_OFFSET_ENVIRONMENT = 3;
  const DEFAULT_VALUE = 0;

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
// Chart Service

interface HistogramOptions {
  binSize: number;
  decimalPlaces?: number;
  height?: number;
  max: number;
  min: number;
  width?: number;
}

async function createHistogram(
  data: number[],
  label: string,
  title: string,
  options: HistogramOptions
): Promise<Buffer> {
  const { binSize, decimalPlaces = DEFAULT_DECIMALS, height, max, min, width } = options;
  const INCREMENT_STEP = 1;
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 400;
  const CHART_WIDTH = width ?? DEFAULT_WIDTH;
  const CHART_HEIGHT = height ?? DEFAULT_HEIGHT;
  const EXTRA_BUCKETS = 2; // Underflow and Overflow
  const UNDERFLOW_INDEX = 0;
  const OFFSET = 1;
  const MAX_TICKS = 20;

  const numMainBins = Math.ceil((max - min) / binSize);
  const buckets: number[] = new Array(numMainBins + EXTRA_BUCKETS).fill(INITIAL_COUNT) as number[];
  const labels: string[] = [];

  labels.push(`< ${min.toString()}`);
  for (let i = 0; i < numMainBins; i++) {
    const startOffset = i * binSize;
    const start = min + startOffset;
    const endOffset = (i + INCREMENT_STEP) * binSize;
    const end = min + endOffset;
    labels.push(`${start.toFixed(decimalPlaces)}-${end.toFixed(decimalPlaces)}`);
  }
  labels.push(`> ${max.toString()}`);

  const chartCallback = (ChartJS: typeof import("chart.js").Chart) => {
    ChartJS.defaults.responsive = false;
    ChartJS.defaults.maintainAspectRatio = false;
  };
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ chartCallback, height: CHART_HEIGHT, width: CHART_WIDTH });

  for (const val of data) {
    if (val < min) {
      const valUnder = buckets[UNDERFLOW_INDEX];
      if (valUnder !== undefined) {
        buckets[UNDERFLOW_INDEX] = valUnder + INCREMENT_STEP;
      }
    } else if (val >= max) {
      const idxOver = buckets.length - INCREMENT_STEP;
      const valOver = buckets[idxOver];
      if (valOver !== undefined) {
        buckets[idxOver] = valOver + INCREMENT_STEP;
      }
    } else {
      const binIdx = Math.floor((val - min) / binSize) + OFFSET;
      const count = buckets[binIdx];
      if (count !== undefined) {
        buckets[binIdx] = count + INCREMENT_STEP;
      }
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
        x: { ticks: { autoSkip: true, maxTicksLimit: MAX_TICKS }, title: { display: true, text: label } },
        y: { beginAtZero: true, title: { display: true, text: "Count" } }
      }
    },
    type: "bar"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

interface BarChartOptions {
  height?: number;
  horizontal?: boolean;
  width?: number;
}

async function createBarChart(
  labels: string[],
  data: number[],
  title: string,
  options: BarChartOptions = {}
): Promise<Buffer> {
  const { height, horizontal = false, width } = options;
  const INCREMENT_STEP = 1;
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 400;
  const CHART_WIDTH = width ?? DEFAULT_WIDTH;
  const CHART_HEIGHT = height ?? DEFAULT_HEIGHT;

  const chartCallback = (ChartJS: typeof import("chart.js").Chart) => {
    ChartJS.defaults.responsive = false;
    ChartJS.defaults.maintainAspectRatio = false;
  };
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ chartCallback, height: CHART_HEIGHT, width: CHART_WIDTH });

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
      indexAxis: horizontal ? "y" : "x",
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { beginAtZero: true, ticks: { autoSkip: false } }
      }
    },
    type: "bar"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

// Main Execution
async function main(): Promise<void> {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const REPORT_PATH = path.join(process.cwd(), "reports", "data-analysis.pdf");
  const INITIAL_COUNT = 0;
  const PROGRESS_UPDATE_INTERVAL = 10;
  const DECIMAL_PLACES = 2;
  const INCREMENT_STEP = 1;

  // PDF Constants
  const MARGIN = 50;
  const PDF_TITLE_SIZE = 25;
  const PDF_BODY_SIZE = 12;
  const SPACING_SMALL = 0.5;
  const PDF_SUBTITLE_SIZE = 16;

  // Histogram Constants
  const MIN_CORNERS = 3;
  const DIMENSIONS_LENGTH = 3;
  const INDEX_X = 0;
  const INDEX_Z = 2;
  const SQ_M_TO_SQ_FT = 10.7639;

  console.log("Finding video files...");
  const videoFiles = findVideoFiles(DATA_DIR);
  console.log(`Found ${videoFiles.length.toString()} video files.`);

  console.log(" extracting metadata...");
  const metadataList: VideoMetadata[] = [];
  let processed = INITIAL_COUNT;

  for (const file of videoFiles) {
    const metadata = await getVideoMetadata(file);
    if (metadata !== null) {
      // 1. RawScan Analysis (Room Area)
      const rawScanPath = path.join(path.dirname(file), "rawScan.json");
      if (fs.existsSync(rawScanPath)) {
        try {
          const rawContent = fs.readFileSync(rawScanPath, "utf-8");
          const rawScan = JSON.parse(rawContent) as SimpleRawScan;

          if (rawScan.floors !== undefined && Array.isArray(rawScan.floors)) {
            let totalAreaSqM = INITIAL_COUNT;

            for (const floor of rawScan.floors) {
              if (
                floor.polygonCorners !== undefined &&
                Array.isArray(floor.polygonCorners) &&
                floor.polygonCorners.length >= MIN_CORNERS
              ) {
                totalAreaSqM += calculatePolygonArea(floor.polygonCorners);
              } else if (
                floor.dimensions !== undefined &&
                Array.isArray(floor.dimensions) &&
                floor.dimensions.length === DIMENSIONS_LENGTH
              ) {
                const dimX = floor.dimensions[INDEX_X];
                const dimZ = floor.dimensions[INDEX_Z];
                if (dimX !== undefined && dimZ !== undefined) {
                  totalAreaSqM += dimX * dimZ;
                }
              }
            }
            if (totalAreaSqM > INITIAL_COUNT) {
              metadata.roomAreaSqFt = totalAreaSqM * SQ_M_TO_SQ_FT;
            }
          }
        } catch {
          // Ignore
        }
      }

      // 2. ArData Analysis (Lighting & Lens)
      const arDataPath = path.join(path.dirname(file), "arData.json");
      if (fs.existsSync(arDataPath)) {
        try {
          const content = fs.readFileSync(arDataPath, "utf-8");
          const json = JSON.parse(content) as unknown;
          const _arData = new ArData(json);
          const frames = Object.values(_arData.data);

          if (frames.length > INITIAL_COUNT) {
            // Lens Model
            const firstFrame = frames[INITIAL_COUNT];
            if (firstFrame) {
              const lens = firstFrame.exifData.LensModel;
              if (lens !== undefined && lens.length > INITIAL_COUNT) {
                metadata.lensModel = lens;
              }
            }

            // Lighting Stats
            let cBri = INITIAL_COUNT;
            let cInt = INITIAL_COUNT;
            let cIso = INITIAL_COUNT;
            let cTemp = INITIAL_COUNT;
            let totalBri = INITIAL_COUNT;
            let totalInt = INITIAL_COUNT;
            let totalIso = INITIAL_COUNT;
            let totalTemp = INITIAL_COUNT;

            for (const f of frames) {
              // Intensity
              if (f.lightEstimate?.ambientIntensity !== undefined) {
                totalInt += f.lightEstimate.ambientIntensity;
                cInt++;
              }
              // Temp
              if (f.lightEstimate?.ambientColorTemperature !== undefined) {
                totalTemp += f.lightEstimate.ambientColorTemperature;
                cTemp++;
              }
              // ISO & Brightness from Exif
              const exif = f.exifData;
              if (exif.ISOSpeedRatings !== undefined) {
                const MATCH_INDEX = 0;
                const match = /(\d+(\.\d+)?)/.exec(exif.ISOSpeedRatings);
                if (match) {
                  const iso = parseFloat(match[MATCH_INDEX]);
                  if (!isNaN(iso)) {
                    totalIso += iso;
                    cIso++;
                  }
                }
              }
              if (exif.BrightnessValue !== undefined) {
                const bri = parseFloat(exif.BrightnessValue);
                if (!isNaN(bri)) {
                  totalBri += bri;
                  cBri++;
                }
              }
            }

            if (cInt > INITIAL_COUNT) {
              metadata.avgAmbientIntensity = totalInt / cInt;
            }
            if (cTemp > INITIAL_COUNT) {
              metadata.avgColorTemperature = totalTemp / cTemp;
            }
            if (cIso > INITIAL_COUNT) {
              metadata.avgIso = totalIso / cIso;
            }
            if (cBri > INITIAL_COUNT) {
              metadata.avgBrightness = totalBri / cBri;
            }
          }
        } catch {
          // Ignore
        }
      }

      metadataList.push(metadata);
    }

    if (processed % PROGRESS_UPDATE_INTERVAL === INITIAL_COUNT) {
      process.stdout.write(".");
    }
    processed++;
  }
  console.log("\nMetadata extraction complete.\n");

  if (metadataList.length === INITIAL_COUNT) {
    console.log("No metadata available to report.");
    return;
  }

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

  // --- Analysis ---
  const DURATION_CHART_WIDTH = 1020;
  const DURATION_CHART_HEIGHT = 320;
  const durations = metadataList.map((m) => m.duration);
  const avgDuration =
    durations.length > INITIAL_COUNT
      ? durations.reduce((a, b) => a + b, INITIAL_COUNT) / durations.length
      : INITIAL_COUNT;

  // Lens Models
  const lensMap: Record<string, number> = {};
  for (const m of metadataList) {
    if (m.lensModel !== undefined && m.lensModel.length > INITIAL_COUNT) {
      lensMap[m.lensModel] = (lensMap[m.lensModel] ?? INITIAL_COUNT) + INCREMENT_STEP;
    }
  }
  // Sort by count descending
  const lensLabels = Object.keys(lensMap).sort((a, b) => (lensMap[b] ?? INITIAL_COUNT) - (lensMap[a] ?? INITIAL_COUNT));
  const lensCounts = lensLabels.map((l) => lensMap[l] ?? INITIAL_COUNT);
  const lensChart = await createBarChart(lensLabels, lensCounts, "Lens Model Distribution", {
    height: DURATION_CHART_HEIGHT,
    horizontal: true,
    width: DURATION_CHART_WIDTH
  });

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v): v is number => v !== undefined);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v): v is number => v !== undefined);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v): v is number => v !== undefined);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v): v is number => v !== undefined);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v): v is number => v !== undefined);

  // Charts
  console.log("Generating charts...");

  // Duration: min 0, max 120, bin 10
  const durationChart = await createHistogram(durations, "Seconds", "Duration", {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    max: 120,
    min: 0,
    width: DURATION_CHART_WIDTH
  });

  // Ambient: 950-1050, bin 5
  const ambChart = await createHistogram(intensityVals, "Lumens", "Ambient Intensity", {
    binSize: 5,
    max: 1050,
    min: 950
  });

  // Temp: 4000-5500, bin 250
  const tempChart = await createHistogram(tempVals, "Kelvin", "Color Temperature", {
    binSize: 250,
    max: 5500,
    min: 4000
  });

  // ISO: 100-600, bin 50
  const isoChart = await createHistogram(isoVals, "ISO", "ISO Speed", { binSize: 50, max: 600, min: 100 });

  // Brightness: 0-5, bin 0.5, dec 1
  const briChart = await createHistogram(briVals, "Value", "Brightness", {
    binSize: 0.5,
    decimalPlaces: 1,
    max: 5,
    min: 0
  });

  // Room Area: 0-150, bin 10
  const areaChart = await createHistogram(areaVals, "Sq Ft", "Room Area", { binSize: 10, max: 150, min: 0 });

  // Existing FPS/Res logic
  const framerates = metadataList.map((m) => Math.round(m.fps));
  const fpsDistribution: Record<string, number> = {};
  framerates.forEach((fps) => {
    fpsDistribution[String(fps)] = (fpsDistribution[String(fps)] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const fpsLabels = Object.keys(fpsDistribution).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsDistribution[l] ?? INITIAL_COUNT);
  const fpsChart = await createBarChart(fpsLabels, fpsCounts, "Framerate");

  const resolutions = metadataList.map((m) => `${m.width.toString()}x${m.height.toString()}`);
  const resDistribution: Record<string, number> = {};
  resolutions.forEach((res) => {
    resDistribution[res] = (resDistribution[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const resLabels = Object.keys(resDistribution).sort();
  const resCounts = resLabels.map((l) => resDistribution[l] ?? INITIAL_COUNT);
  const resChart = await createBarChart(resLabels, resCounts, "Resolution");

  // PDF Generation
  console.log("Generating PDF...");
  const doc = new PDFDocument({ margin: MARGIN });
  doc.pipe(fs.createWriteStream(REPORT_PATH));

  // --- Page 1: Summary ---
  const summaryText = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES)}s | Videos: ${metadataList.length.toString()}`;
  doc.fontSize(PDF_TITLE_SIZE).text("Artifact Data Analysis", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(summaryText, { align: "center" });
  doc.moveDown(SPACING_SMALL);

  // Layout Constants
  const Y_START = 130;
  const H = 160;
  const W = 250;
  const FULL_W = 510;
  const LEFT_X = 50;
  const RIGHT_X = 310;
  const GAP_Y = 190;
  const TEXT_PADDING = 5;

  // Row 1: Duration (Full Width)
  doc.image(durationChart, LEFT_X, Y_START, { height: H, width: FULL_W });
  doc.text("Duration", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: FULL_W });

  // Row 2: Lens Model (Full Width, Horizontal)
  const Y_ROW2 = Y_START + GAP_Y;
  doc.image(lensChart, LEFT_X, Y_ROW2, { height: H, width: FULL_W });
  doc.text("Lens Model", LEFT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: FULL_W });

  // Row 3: Framerate (Left) & Resolution (Right)
  const Y_ROW3 = Y_ROW2 + GAP_Y;
  doc.image(fpsChart, LEFT_X, Y_ROW3, { height: H, width: W });
  doc.text("Framerate", LEFT_X, Y_ROW3 + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(resChart, RIGHT_X, Y_ROW3, { height: H, width: W });
  doc.text("Resolution", RIGHT_X, Y_ROW3 + H + TEXT_PADDING, { align: "center", width: W });

  // --- Page 2: Lighting ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Lighting & Exposure", { align: "center" });

  // Row 1: Ambient (Left) & Temp (Right)
  doc.image(ambChart, LEFT_X, Y_START, { height: H, width: W });
  doc.text("Ambient Intensity", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(tempChart, RIGHT_X, Y_START, { height: H, width: W });
  doc.text("Color Temperature", RIGHT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  // Row 2: ISO (Left) & Brightness (Right)
  doc.image(isoChart, LEFT_X, Y_ROW2, { height: H, width: W });
  doc.text("ISO Speed", LEFT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(briChart, RIGHT_X, Y_ROW2, { height: H, width: W });
  doc.text("Brightness Value", RIGHT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: W });

  // --- Page 3: Room Analysis ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Room Analysis", { align: "center" });

  doc.image(areaChart, LEFT_X, Y_START, { height: H, width: W });
  doc.text("Room Area (Sq Ft)", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  doc.end();
  console.log(`Report generated at: ${REPORT_PATH}`);
}

main().catch(console.error);
