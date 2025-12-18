import * as fs from "fs";
import * as path from "path";

import convert from "convert-units";
import ffmpeg from "fluent-ffmpeg";
import { sumBy } from "lodash";

import { CaptureCharts, buildDataAnalysisReport } from "../templates/dataAnalysisReport";
import { ArData } from "../models/arData/arData";
import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { RawScan } from "../models/rawScan/rawScan";
import * as ChartUtils from "../utils/chartUtils";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";
import { checkColinearWalls } from "../utils/room/checkColinearWalls";
import { checkCrookedWalls } from "../utils/room/checkCrookedWalls";
import { checkDoorBlocking } from "../utils/room/checkDoorBlocking";
import { checkExternalOpening } from "../utils/room/checkExternalOpening";
import { checkIntersections } from "../utils/room/checkIntersections";
import { checkNibWalls } from "../utils/room/checkNibWalls";
import { checkToiletGaps } from "../utils/room/checkToiletGaps";
import { checkTubGaps } from "../utils/room/checkTubGaps";
import { checkWallGaps } from "../utils/room/checkWallGaps";

/**
 * Script to analyze local artifacts and generate a PDF report.
 * - Extracts metadata (resolution, duration, room features).
 * - Runs all room utility checks (intersections, gaps, etc.).
 * - Generates charts (histograms, bar charts) for data distribution.
 * - Outputs `reports/data-analysis.pdf`.
 */

// 1. Video Metadata Extraction
async function addVideoMetadata(dirPath: string, metadata: ArtifactAnalysis): Promise<boolean> {
  const filePath = path.join(dirPath, "video.mp4");
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const PATH_OFFSET_ENVIRONMENT = 3;
  const DEFAULT_VALUE = 0;

  const result = await new Promise<boolean>((resolve) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err !== null && err !== undefined) {
        resolve(false);
        return;
      }

      const stream = meta.streams.find((s) => s.codec_type === "video");
      if (stream === undefined) {
        resolve(false);
        return;
      }

      let fps = DEFAULT_VALUE;
      // Handle fraction fps if present (e.g. "30/1")
      if (stream.r_frame_rate !== undefined) {
        if (stream.r_frame_rate.includes("/")) {
          const parts = stream.r_frame_rate.split("/");
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

      // Populate valid metadata
      metadata.duration = meta.format.duration ?? DEFAULT_VALUE;
      metadata.environment = environment;
      metadata.filename = path.basename(path.dirname(filePath));
      metadata.fps = fps;
      metadata.height = stream.height ?? DEFAULT_VALUE;
      metadata.path = filePath;
      metadata.width = stream.width ?? DEFAULT_VALUE;

      resolve(true);
    });
  });
  return result;
}

// Helper interface for local chart data preparation
interface ChartDef {
  check: (m: ArtifactAnalysis) => boolean;
  count: number;
  label: string;
}

// 2. RawScan Analysis
function addRawScanMetadata(dirPath: string, metadata: ArtifactAnalysis): void {
  const rawScanPath = path.join(dirPath, "rawScan.json");
  if (fs.existsSync(rawScanPath)) {
    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      metadata.roomAreaSqFt = convert(sumBy(rawScan.floors, "area")).from("m2").to("ft2");

      metadata.wallCount = rawScan.walls.length;

      const MIN_NON_RECT_CORNERS = 4;
      metadata.hasNonRectWall = rawScan.walls.some(
        (w) => w.polygonCorners !== undefined && w.polygonCorners.length > MIN_NON_RECT_CORNERS
      );
      metadata.hasCurvedWall = rawScan.walls.some((w) => w.curve !== undefined && w.curve !== null);

      metadata.toiletCount = rawScan.objects.filter((o) => o.category.toilet !== undefined).length;
      metadata.tubCount = rawScan.objects.filter((o) => o.category.bathtub !== undefined).length;
      metadata.sinkCount = rawScan.objects.filter((o) => o.category.sink !== undefined).length;
      metadata.storageCount = rawScan.objects.filter((o) => o.category.storage !== undefined).length;
      metadata.hasWasherDryer = rawScan.objects.some((o) => o.category.washerDryer !== undefined);
      metadata.hasStove = rawScan.objects.some((o) => o.category.stove !== undefined);
      metadata.hasTable = rawScan.objects.some((o) => o.category.table !== undefined);
      metadata.hasChair = rawScan.objects.some((o) => o.category.chair !== undefined);
      metadata.hasBed = rawScan.objects.some((o) => o.category.bed !== undefined);
      metadata.hasSofa = rawScan.objects.some((o) => o.category.sofa !== undefined);
      metadata.hasDishwasher = rawScan.objects.some((o) => o.category.dishwasher !== undefined);
      metadata.hasOven = rawScan.objects.some((o) => o.category.oven !== undefined);
      metadata.hasRefrigerator = rawScan.objects.some((o) => o.category.refrigerator !== undefined);
      metadata.hasStairs = rawScan.objects.some((o) => o.category.stairs !== undefined);
      metadata.hasFireplace = rawScan.objects.some((o) => o.category.fireplace !== undefined);
      metadata.hasTelevision = rawScan.objects.some((o) => o.category.television !== undefined);

      metadata.hasExternalOpening = checkExternalOpening(rawScan);

      metadata.hasSoffit = rawScan.walls.some((w) => w.hasSoffit);

      metadata.hasToiletGapErrors = checkToiletGaps(rawScan);

      metadata.hasTubGapErrors = checkTubGaps(rawScan);

      metadata.hasWallGapErrors = checkWallGaps(rawScan);

      metadata.hasColinearWallErrors = checkColinearWalls(rawScan);

      metadata.hasNibWalls = checkNibWalls(rawScan);

      const intersectionResults = checkIntersections(rawScan);
      metadata.hasObjectIntersectionErrors = intersectionResults.hasObjectIntersectionErrors;
      metadata.hasWallObjectIntersectionErrors = intersectionResults.hasWallObjectIntersectionErrors;
      metadata.hasWallWallIntersectionErrors = intersectionResults.hasWallWallIntersectionErrors;

      metadata.hasCrookedWallErrors = checkCrookedWalls(rawScan);

      metadata.hasDoorBlockingError = checkDoorBlocking(rawScan);
    } catch {
      // Ignore
    }
  }
}

// 3. ArData Analysis
function addArDataMetadata(dirPath: string, metadata: ArtifactAnalysis): void {
  const arDataPath = path.join(dirPath, "arData.json");
  const INITIAL_COUNT = 0;
  const NOT_SET = "";
  const MIN_VALID_FRAMES = 0;

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
          const model = firstFrame.exifData.LensModel;
          if (model !== undefined && model !== NOT_SET) {
            metadata.lensModel = model;
          }
        }
      }

      // Calculate Averages
      let totalIntensity = 0;
      let totalTemperature = 0;
      let totalISO = 0;
      let totalBrightness = 0; // Exif BrightnessValue
      let count = 0;

      for (const frame of frames) {
        // Check for existence explicitly if needed, but safe navigation usage suggests they are optional
        // Using strict checks to satisfy linter
        // exifData is required per interface, so no check needed
        if (frame.lightEstimate) {
          // ambientIntensity and ambientColorTemperature are required in LightEstimate interface
          totalIntensity += frame.lightEstimate.ambientIntensity;
          totalTemperature += frame.lightEstimate.ambientColorTemperature;
          count++;
        }

        // ISOSpeedRatings check (exifData is required)
        const isoRatings = frame.exifData.ISOSpeedRatings;
        if (isoRatings !== undefined && isoRatings !== NOT_SET) {
          // Strip non-numeric chars (sometimes comes as "( 125 )" or similar)
          const isoStr = isoRatings.replace(/[^0-9.]/g, "");
          const isoVal = parseFloat(isoStr);
          if (!isNaN(isoVal)) {
            totalISO += isoVal;
          }
        }

        // BrightnessValue check
        const brightness = frame.exifData.BrightnessValue;
        if (brightness !== undefined && brightness !== NOT_SET) {
          // BrightnessValue is typically a number string, but sanity check
          const briVal = parseFloat(brightness);
          if (!isNaN(briVal)) {
            totalBrightness += briVal;
          }
        }
      }

      if (count > MIN_VALID_FRAMES) {
        metadata.avgAmbientIntensity = totalIntensity / count;
        metadata.avgColorTemperature = totalTemperature / count;
        metadata.avgIso = totalISO / count;
        metadata.avgBrightness = totalBrightness / count;
      }
    } catch {
      // Ignore
    }
  }
}

function findArtifactDirectories(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);

  // Check if this directory is an artifact directory (contains video.mp4, arData.json, and rawScan.json)
  if (list.includes("video.mp4") && list.includes("arData.json") && list.includes("rawScan.json")) {
    results.push(dir);
  }

  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findArtifactDirectories(fullPath));
    }
  }
  return results;
}

function generateCharts(metadataList: ArtifactAnalysis[]): CaptureCharts {
  const charts: Partial<CaptureCharts> = {};
  // A4 viewport at 96 DPI from reportGenerator; keep sizing as ratios
  const PAGE_VIEWPORT_WIDTH = 794;
  const PAGE_VIEWPORT_HEIGHT = 1123;
  const PAGE_MARGIN = 40;
  const DOUBLE = 2;
  const pageMarginDouble = PAGE_MARGIN * DOUBLE;
  const PAGE_CONTENT_WIDTH = PAGE_VIEWPORT_WIDTH - pageMarginDouble;
  const PAGE_CONTENT_HEIGHT = PAGE_VIEWPORT_HEIGHT - pageMarginDouble;

  const FULL_WIDTH_RATIO = 0.9;
  const HALF_WIDTH_RATIO = 0.47;
  const HISTO_WIDTH_RATIO = FULL_WIDTH_RATIO;
  const ERRORS_WIDTH_RATIO = 0.82;
  const LENS_WIDTH_RATIO = 0.9;
  const DURATION_HEIGHT_RATIO = 0.32;
  const HALF_HEIGHT_RATIO = 0.26;
  const LENS_HEIGHT_RATIO = 0.35;
  const FEATURE_HEIGHT_RATIO = 0.52;
  const MIN_DURATION_HEIGHT = 260;
  const MIN_HALF_HEIGHT = 260;
  const MIN_LENS_HEIGHT = 340;
  const MIN_FEATURE_HEIGHT = 400;

  const DURATION_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * FULL_WIDTH_RATIO);
  const HALF_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HALF_WIDTH_RATIO);
  const HISTO_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HISTO_WIDTH_RATIO);
  const ERRORS_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * ERRORS_WIDTH_RATIO);
  const DURATION_CHART_HEIGHT = Math.max(MIN_DURATION_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * DURATION_HEIGHT_RATIO));
  const HALF_CHART_HEIGHT = Math.max(MIN_HALF_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * HALF_HEIGHT_RATIO));
  const LENS_CHART_HEIGHT = Math.max(MIN_LENS_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * LENS_HEIGHT_RATIO));
  const FEATURE_CHART_HEIGHT = Math.max(MIN_FEATURE_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * FEATURE_HEIGHT_RATIO));
  const NOT_SET = "not_set";
  const INCREMENT_STEP = 1;
  const INITIAL_COUNT = 0;
  const NO_RESULTS = 0;

  // Histogram Constants
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  // Duration
  const durations = metadataList.map((m) => m.duration);
  charts.duration = ChartUtils.getHistogramConfig(durations, {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 120,
    min: 10,
    // Label and title defaults handled in config builder or can be explicit
    title: "",
    width: DURATION_CHART_WIDTH,
    xLabel: "Seconds"
  });

  // Lens Models
  const lensMap: Record<string, number> = {};
  for (const m of metadataList) {
    if (m.lensModel !== NOT_SET) {
      lensMap[m.lensModel] = (lensMap[m.lensModel] ?? INITIAL_COUNT) + INCREMENT_STEP;
    }
  }
  // Sort by count descending
  const lensLabels = Object.keys(lensMap).sort((a, b) => (lensMap[b] ?? INITIAL_COUNT) - (lensMap[a] ?? INITIAL_COUNT));
  const lensCounts = lensLabels.map((l) => lensMap[l] ?? INITIAL_COUNT);
  charts.lens = ChartUtils.getBarChartConfig(lensLabels, lensCounts, {
    height: LENS_CHART_HEIGHT,
    horizontal: true,
    title: "",
    width: Math.round(PAGE_CONTENT_WIDTH * LENS_WIDTH_RATIO)
  });

  // Framerate
  const fpsMap: Record<string, number> = {};
  for (const m of metadataList) {
    const fps = Math.round(m.fps).toString();
    fpsMap[fps] = (fpsMap[fps] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const fpsLabels = Object.keys(fpsMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsMap[l] ?? INITIAL_COUNT);
  charts.fps = ChartUtils.getBarChartConfig(fpsLabels, fpsCounts, {
    height: HALF_CHART_HEIGHT,
    title: "",
    width: HALF_CHART_WIDTH
  });

  // Resolution
  const resMap: Record<string, number> = {};
  for (const m of metadataList) {
    const res = `${m.width.toString()}x${m.height.toString()}`;
    resMap[res] = (resMap[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const resLabels = Object.keys(resMap).sort();
  const resCounts = resLabels.map((l) => resMap[l] ?? INITIAL_COUNT);
  charts.resolution = ChartUtils.getBarChartConfig(resLabels, resCounts, {
    height: HALF_CHART_HEIGHT,
    title: "",
    width: HALF_CHART_WIDTH
  });

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > NO_RESULTS);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > NO_RESULTS);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > NO_RESULTS);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== NO_RESULTS);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > NO_RESULTS);

  // Ambient: 980-1040, bin 5
  charts.ambient = ChartUtils.getHistogramConfig(intensityVals, {
    binSize: 5,
    height: HALF_CHART_HEIGHT,
    max: 1040,
    min: 980,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "Lumens"
  });

  // Temp: 4000-6000, bin 250
  charts.temperature = ChartUtils.getHistogramConfig(tempVals, {
    binSize: 250,
    colorByValue: ChartUtils.kelvinToRgb,
    height: HALF_CHART_HEIGHT,
    max: 6000,
    min: 4000,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "Kelvin"
  });

  // ISO: 0-800, bin 50
  charts.iso = ChartUtils.getHistogramConfig(isoVals, {
    binSize: 50,
    height: HALF_CHART_HEIGHT,
    max: 800,
    min: 0,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "ISO"
  });

  // Brightness: 0-6, bin 1
  charts.brightness = ChartUtils.getHistogramConfig(briVals, {
    binSize: 1,
    decimalPlaces: 1,
    height: HALF_CHART_HEIGHT,
    max: 6,
    min: 0,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "Value (EV)"
  });

  // Room Area: 0-150, bin 10
  charts.area = ChartUtils.getHistogramConfig(areaVals, {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 150,
    min: 0,
    title: "",
    width: DURATION_CHART_WIDTH,
    xLabel: "Sq Ft"
  });

  // Capture Errors & Features
  const errorDefs: ChartDef[] = [
    { check: (m: ArtifactAnalysis) => m.hasToiletGapErrors, count: INITIAL_COUNT, label: 'Toilet Gap > 1"' },
    { check: (m: ArtifactAnalysis) => m.hasTubGapErrors, count: INITIAL_COUNT, label: 'Tub Gap 1"-6"' },
    { check: (m: ArtifactAnalysis) => m.hasWallGapErrors, count: INITIAL_COUNT, label: 'Wall Gaps 1"-12"' },
    { check: (m: ArtifactAnalysis) => m.hasColinearWallErrors, count: INITIAL_COUNT, label: "Colinear Walls" },
    {
      check: (m: ArtifactAnalysis) => m.hasObjectIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Object Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallObjectIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Wall <-> Object Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallWallIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Wall <-> Wall Intersections"
    },
    { check: (m: ArtifactAnalysis) => m.hasCrookedWallErrors, count: INITIAL_COUNT, label: "Crooked Walls" },
    { check: (m: ArtifactAnalysis) => m.hasDoorBlockingError, count: INITIAL_COUNT, label: "Door Blocked" }
  ];

  const featureDefs: ChartDef[] = [
    { check: (m: ArtifactAnalysis) => m.hasNonRectWall, count: INITIAL_COUNT, label: "Non-Rectangular Walls" },
    { check: (m: ArtifactAnalysis) => m.hasCurvedWall, count: INITIAL_COUNT, label: "Curved Walls" },
    { check: (m: ArtifactAnalysis) => m.toiletCount >= MIN_TOILETS, count: INITIAL_COUNT, label: "2+ Toilets" },
    { check: (m: ArtifactAnalysis) => m.tubCount >= MIN_TUBS, count: INITIAL_COUNT, label: "2+ Tubs" },
    { check: (m: ArtifactAnalysis) => m.wallCount < MIN_WALLS, count: INITIAL_COUNT, label: "< 4 Walls" },
    {
      check: (m: ArtifactAnalysis) => m.sinkCount === INITIAL_COUNT && m.storageCount === INITIAL_COUNT,
      count: INITIAL_COUNT,
      label: "No Vanity"
    },
    { check: (m: ArtifactAnalysis) => m.hasExternalOpening, count: INITIAL_COUNT, label: "External Opening" },
    { check: (m: ArtifactAnalysis) => m.hasSoffit, count: INITIAL_COUNT, label: "Soffit" },
    { check: (m: ArtifactAnalysis) => m.hasNibWalls, count: INITIAL_COUNT, label: "Nib Walls (< 1ft)" },
    { check: (m: ArtifactAnalysis) => m.hasWasherDryer, count: INITIAL_COUNT, label: "Washer/Dryer" },
    { check: (m: ArtifactAnalysis) => m.hasStove, count: INITIAL_COUNT, label: "Stove" },
    { check: (m: ArtifactAnalysis) => m.hasTable, count: INITIAL_COUNT, label: "Table" },
    { check: (m: ArtifactAnalysis) => m.hasChair, count: INITIAL_COUNT, label: "Chair" },
    { check: (m: ArtifactAnalysis) => m.hasBed, count: INITIAL_COUNT, label: "Bed" },
    { check: (m: ArtifactAnalysis) => m.hasSofa, count: INITIAL_COUNT, label: "Sofa" },
    { check: (m: ArtifactAnalysis) => m.hasDishwasher, count: INITIAL_COUNT, label: "Dishwasher" },
    { check: (m: ArtifactAnalysis) => m.hasOven, count: INITIAL_COUNT, label: "Oven" },
    { check: (m: ArtifactAnalysis) => m.hasRefrigerator, count: INITIAL_COUNT, label: "Refrigerator" },
    { check: (m: ArtifactAnalysis) => m.hasStairs, count: INITIAL_COUNT, label: "Stairs" },
    { check: (m: ArtifactAnalysis) => m.hasFireplace, count: INITIAL_COUNT, label: "Fireplace" },
    { check: (m: ArtifactAnalysis) => m.hasTelevision, count: INITIAL_COUNT, label: "Television" }
  ];

  for (const m of metadataList) {
    for (const d of errorDefs) {
      if (d.check(m)) {
        d.count++;
      }
    }
    for (const d of featureDefs) {
      if (d.check(m)) {
        d.count++;
      }
    }
  }

  charts.features = ChartUtils.getBarChartConfig(
    featureDefs.map((d) => d.label),
    featureDefs.map((d) => d.count),
    {
      height: FEATURE_CHART_HEIGHT,
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: DURATION_CHART_WIDTH
    }
  );

  charts.errors = ChartUtils.getBarChartConfig(
    errorDefs.map((d) => d.label),
    errorDefs.map((d) => d.count),
    {
      height: 320,
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: ERRORS_CHART_WIDTH
    }
  );

  return charts as CaptureCharts;
}

async function createInspectionReport(
  charts: CaptureCharts,
  avgDuration: number,
  videoCount: number,
  reportPath: string
): Promise<void> {
  logger.info("Generating PDF...");

  const reportData = buildDataAnalysisReport(charts, avgDuration, videoCount);

  await generatePdfReport(reportData, reportPath);

  logger.info(`Report generated at: ${reportPath}`);
}

async function main(): Promise<void> {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const INITIAL_COUNT = 0;

  logger.info("Finding artifacts...");
  const artifactDirs = findArtifactDirectories(DATA_DIR);
  logger.info(`Found ${artifactDirs.length.toString()} artifact directories.`);

  logger.info(" extracting metadata...");
  const metadataList: ArtifactAnalysis[] = [];

  const bar = createProgressBar("Extracting |{bar}| {percentage}% | {value}/{total} Artifacts | ETA: {eta}s");
  const INITIAL_PROGRESS = 0;
  bar.start(artifactDirs.length, INITIAL_PROGRESS);

  for (const dir of artifactDirs) {
    const metadata = new ArtifactAnalysis();
    const success = await addVideoMetadata(dir, metadata);
    if (success) {
      addRawScanMetadata(dir, metadata);
      addArDataMetadata(dir, metadata);

      metadataList.push(metadata);
    }
    bar.increment();
  }
  bar.stop();

  logger.info("Metadata extraction complete.");

  if (metadataList.length === INITIAL_COUNT) {
    logger.info("No metadata available to report.");
    return;
  }

  // --- Analysis ---
  const durations = metadataList.map((m) => m.duration);
  const avgDuration =
    durations.length > INITIAL_COUNT
      ? durations.reduce((a, b) => a + b, INITIAL_COUNT) / durations.length
      : INITIAL_COUNT;

  // Charts
  logger.info("Generating charts...");
  const charts = generateCharts(metadataList);

  // PDF Generation
  const videoCount = metadataList.length;
  const REPORT_FILE = "data-analysis.pdf";
  await createInspectionReport(charts, avgDuration, videoCount, REPORT_FILE);
}

main().catch((err: unknown) => logger.error(err));
