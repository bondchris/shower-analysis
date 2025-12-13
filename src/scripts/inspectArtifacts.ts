import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import { sumBy } from "lodash";
import * as path from "path";
import PDFDocument from "pdfkit";

import { ArData } from "../models/arData/arData";
import { ArtifactMetadata } from "../models/artifactMetadata";
import { RawScan } from "../models/rawScan/rawScan";
import * as ChartUtils from "../utils/chartUtils";
import {
  checkColinearWalls,
  checkCrookedWalls,
  checkDoorBlocking,
  checkExternalOpening,
  checkIntersections,
  checkNibWalls,
  checkToiletGaps,
  checkTubGaps,
  checkWallGaps
} from "../utils/roomUtils";

// 1. Video Metadata Extraction
async function addVideoMetadata(dirPath: string, metadata: ArtifactMetadata): Promise<boolean> {
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

interface ChartDef {
  check: (m: ArtifactMetadata) => boolean;
  count: number;
  label: string;
}

interface CaptureCharts {
  ambient: Buffer;
  area: Buffer;
  brightness: Buffer;
  duration: Buffer;
  errors: Buffer;
  features: Buffer;
  fps: Buffer;
  iso: Buffer;
  lens: Buffer;
  resolution: Buffer;
  temperature: Buffer;
}

// 2. RawScan Analysis
function addRawScanMetadata(dirPath: string, metadata: ArtifactMetadata): void {
  const rawScanPath = path.join(dirPath, "rawScan.json");
  if (fs.existsSync(rawScanPath)) {
    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      const SQ_M_TO_SQ_FT = 10.7639;
      metadata.roomAreaSqFt = sumBy(rawScan.floors, "area") * SQ_M_TO_SQ_FT;

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
function addArDataMetadata(dirPath: string, metadata: ArtifactMetadata): void {
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

async function generateCharts(metadataList: ArtifactMetadata[]): Promise<CaptureCharts> {
  const INITIAL_COUNT = 0;
  const INCREMENT_STEP = 1;
  const NOT_SET = "";
  const NO_RESULTS = 0;
  // Chart Params
  const DURATION_CHART_WIDTH = 1020;
  const DURATION_CHART_HEIGHT = 320;

  // Histogram Constants
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  const charts = {} as CaptureCharts;

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
  charts.lens = await ChartUtils.createBarChart(lensLabels, lensCounts, "Lens Model Distribution", {
    height: DURATION_CHART_HEIGHT,
    horizontal: true,
    width: DURATION_CHART_WIDTH
  });

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > NO_RESULTS);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > NO_RESULTS);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > NO_RESULTS);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== NO_RESULTS);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > NO_RESULTS);
  const durations = metadataList.map((m) => m.duration);

  // Duration: min 10, max 120, bin 10
  charts.duration = await ChartUtils.createHistogram(durations, "Seconds", "Duration", {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 120,
    min: 10,
    width: DURATION_CHART_WIDTH
  });

  // Ambient: 980-1040, bin 5
  charts.ambient = await ChartUtils.createHistogram(intensityVals, "Lumens", "Ambient Intensity", {
    binSize: 5,
    max: 1040,
    min: 980
  });

  // Temp: 4000-6000, bin 250
  charts.temperature = await ChartUtils.createHistogram(tempVals, "Kelvin", "Color Temperature", {
    binSize: 250,
    colorByValue: ChartUtils.kelvinToRgb,
    max: 6000,
    min: 4000
  });

  // ISO: 0-800, bin 50
  charts.iso = await ChartUtils.createHistogram(isoVals, "ISO", "ISO Speed", {
    binSize: 50,
    hideUnderflow: true,
    max: 800,
    min: 0
  });

  // Brightness: 0-6, bin 1
  charts.brightness = await ChartUtils.createHistogram(briVals, "Value (EV)", "Brightness Value", {
    binSize: 1,
    decimalPlaces: 1,
    max: 6,
    min: 0
  });

  // Room Area: 0-150, bin 10
  charts.area = await ChartUtils.createHistogram(areaVals, "Sq Ft", "Room Area", {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 150,
    min: 0,
    width: DURATION_CHART_WIDTH
  });

  // Existing FPS/Res logic
  const framerates = metadataList.map((m) => Math.round(m.fps));
  const fpsDistribution: Record<string, number> = {};
  framerates.forEach((fps) => {
    fpsDistribution[String(fps)] = (fpsDistribution[String(fps)] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const fpsLabels = Object.keys(fpsDistribution).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsDistribution[l] ?? INITIAL_COUNT);
  charts.fps = await ChartUtils.createBarChart(fpsLabels, fpsCounts, "Framerate");

  const resolutions = metadataList.map((m) => `${m.width.toString()}x${m.height.toString()}`);
  const resDistribution: Record<string, number> = {};
  resolutions.forEach((res) => {
    resDistribution[res] = (resDistribution[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const resLabels = Object.keys(resDistribution).sort();
  const resCounts = resLabels.map((l) => resDistribution[l] ?? INITIAL_COUNT);
  charts.resolution = await ChartUtils.createBarChart(resLabels, resCounts, "Resolution");

  // Feature Prevalence
  const featureDefs: ChartDef[] = [
    { check: (m: ArtifactMetadata) => m.hasNonRectWall, count: INITIAL_COUNT, label: "Non-Rectangular Walls" },
    { check: (m: ArtifactMetadata) => m.hasCurvedWall, count: INITIAL_COUNT, label: "Curved Walls" },
    { check: (m: ArtifactMetadata) => m.toiletCount >= MIN_TOILETS, count: INITIAL_COUNT, label: "2+ Toilets" },
    { check: (m: ArtifactMetadata) => m.tubCount >= MIN_TUBS, count: INITIAL_COUNT, label: "2+ Tubs" },
    { check: (m: ArtifactMetadata) => m.wallCount < MIN_WALLS, count: INITIAL_COUNT, label: "< 4 Walls" },
    {
      check: (m: ArtifactMetadata) => m.sinkCount === INITIAL_COUNT && m.storageCount === INITIAL_COUNT,
      count: INITIAL_COUNT,
      label: "No Vanity"
    },
    { check: (m: ArtifactMetadata) => m.hasExternalOpening, count: INITIAL_COUNT, label: "External Opening" },
    { check: (m: ArtifactMetadata) => m.hasSoffit, count: INITIAL_COUNT, label: "Soffit" },
    { check: (m: ArtifactMetadata) => m.hasNibWalls, count: INITIAL_COUNT, label: "Nib Walls (< 1ft)" },
    { check: (m: ArtifactMetadata) => m.hasWasherDryer, count: INITIAL_COUNT, label: "Washer/Dryer" },
    { check: (m: ArtifactMetadata) => m.hasStove, count: INITIAL_COUNT, label: "Stove" },
    { check: (m: ArtifactMetadata) => m.hasTable, count: INITIAL_COUNT, label: "Table" },
    { check: (m: ArtifactMetadata) => m.hasChair, count: INITIAL_COUNT, label: "Chair" },
    { check: (m: ArtifactMetadata) => m.hasBed, count: INITIAL_COUNT, label: "Bed" },
    { check: (m: ArtifactMetadata) => m.hasSofa, count: INITIAL_COUNT, label: "Sofa" },
    { check: (m: ArtifactMetadata) => m.hasDishwasher, count: INITIAL_COUNT, label: "Dishwasher" },
    { check: (m: ArtifactMetadata) => m.hasOven, count: INITIAL_COUNT, label: "Oven" },
    { check: (m: ArtifactMetadata) => m.hasRefrigerator, count: INITIAL_COUNT, label: "Refrigerator" },
    { check: (m: ArtifactMetadata) => m.hasStairs, count: INITIAL_COUNT, label: "Stairs" },
    { check: (m: ArtifactMetadata) => m.hasFireplace, count: INITIAL_COUNT, label: "Fireplace" },
    { check: (m: ArtifactMetadata) => m.hasTelevision, count: INITIAL_COUNT, label: "Television" }
  ];

  const errorDefs: ChartDef[] = [
    { check: (m: ArtifactMetadata) => m.hasToiletGapErrors, count: INITIAL_COUNT, label: 'Toilet Gap > 1"' },
    { check: (m: ArtifactMetadata) => m.hasTubGapErrors, count: INITIAL_COUNT, label: 'Tub Gap 1"-6"' },
    { check: (m: ArtifactMetadata) => m.hasWallGapErrors, count: INITIAL_COUNT, label: 'Wall Gaps 1"-12"' },
    { check: (m: ArtifactMetadata) => m.hasColinearWallErrors, count: INITIAL_COUNT, label: "Colinear Walls" },
    {
      check: (m: ArtifactMetadata) => m.hasObjectIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Object Intersections"
    },
    {
      check: (m: ArtifactMetadata) => m.hasWallObjectIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Wall <-> Object Intersections"
    },
    {
      check: (m: ArtifactMetadata) => m.hasWallWallIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Wall <-> Wall Intersections"
    },
    { check: (m: ArtifactMetadata) => m.hasCrookedWallErrors, count: INITIAL_COUNT, label: "Crooked Walls" },
    { check: (m: ArtifactMetadata) => m.hasDoorBlockingError, count: INITIAL_COUNT, label: "Door Blocked" }
  ];

  for (const m of metadataList) {
    for (const def of featureDefs) {
      if (def.check(m)) {
        def.count++;
      }
    }
    for (const def of errorDefs) {
      if (def.check(m)) {
        def.count++;
      }
    }
  }

  const FEATURE_CHART_HEIGHT = 1500;
  charts.features = await ChartUtils.createBarChart(
    featureDefs.map((d) => d.label),
    featureDefs.map((d) => d.count),
    "Feature Prevalence",
    {
      height: FEATURE_CHART_HEIGHT,
      horizontal: true,
      totalForPercentages: metadataList.length,
      width: DURATION_CHART_WIDTH
    }
  );

  charts.errors = await ChartUtils.createBarChart(
    errorDefs.map((d) => d.label),
    errorDefs.map((d) => d.count),
    "Capture Errors",
    {
      height: 320,
      horizontal: true,
      totalForPercentages: metadataList.length,
      width: DURATION_CHART_WIDTH
    }
  );

  return charts;
}

function generatePdfReport(charts: CaptureCharts, avgDuration: number, videoCount: number, reportPath: string): void {
  const SPACING_SMALL = 10;
  const MARGIN = 50;
  const CHART_SPACING = 30;
  const PDF_TITLE_SIZE = 24;
  const PDF_SUBTITLE_SIZE = 18;
  const PDF_BODY_SIZE = 12;

  console.log("Generating PDF...");
  const doc = new PDFDocument({ margin: MARGIN });
  doc.pipe(fs.createWriteStream(reportPath));

  // Layout Constants
  const Y_START = 130;
  const H = 160;
  const W = 250;
  const GAP_Y = 200;
  const FULL_W = 510;
  const LEFT_X = 50;
  const TEXT_PADDING = 15;
  const RIGHT_X = LEFT_X + W + CHART_SPACING;

  // --- Page 1: Summary ---
  const DECIMAL_PLACES = 1;
  const summaryText = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES)}s | Videos: ${videoCount.toString()}`;
  doc.fontSize(PDF_TITLE_SIZE).text("Artifact Data Analysis", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(summaryText, { align: "center" });
  doc.moveDown(SPACING_SMALL);

  // Row 1: Duration (Full Width)
  doc.image(charts.duration, LEFT_X, Y_START, { height: H, width: FULL_W });
  doc.text("Duration", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: FULL_W });

  // Row 2: Lens Model (Full Width, Horizontal)
  const Y_ROW2 = Y_START + GAP_Y;
  doc.image(charts.lens, LEFT_X, Y_ROW2, { height: H, width: FULL_W });
  doc.text("Lens Model", LEFT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: FULL_W });

  // Row 3: Framerate (Left) & Resolution (Right)
  const Y_ROW3 = Y_ROW2 + GAP_Y;
  doc.image(charts.fps, LEFT_X, Y_ROW3, { height: H, width: W });
  doc.text("Framerate", LEFT_X, Y_ROW3 + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(charts.resolution, RIGHT_X, Y_ROW3, { height: H, width: W });
  doc.text("Resolution", RIGHT_X, Y_ROW3 + H + TEXT_PADDING, { align: "center", width: W });

  // --- Page 2: Lighting ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Lighting & Exposure", { align: "center" });

  // Row 1: Ambient (Left) & Temp (Right)
  doc.image(charts.ambient, LEFT_X, Y_START, { height: H, width: W });
  doc.text("Ambient Intensity", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(charts.temperature, RIGHT_X, Y_START, { height: H, width: W });
  doc.text("Color Temperature", RIGHT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  // Row 2: ISO (Left) & Brightness (Right)
  doc.image(charts.iso, LEFT_X, Y_ROW2, { height: H, width: W });
  doc.text("ISO Speed", LEFT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(charts.brightness, RIGHT_X, Y_ROW2, { height: H, width: W });
  doc.text("Brightness Value", RIGHT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: W });

  // --- Page 3: Room Analysis ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Room Analysis", { align: "center" });

  doc.image(charts.area, LEFT_X, Y_START, { height: H, width: FULL_W });
  doc.text("Room Area (Sq Ft)", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: FULL_W });

  doc.image(charts.errors, LEFT_X, Y_START + GAP_Y, { height: H, width: FULL_W });
  doc.text("Capture Errors", LEFT_X, Y_START + GAP_Y + H + TEXT_PADDING, {
    align: "center",
    width: FULL_W
  });

  // --- Page 4: Feature Prevalence ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Feature Prevalence", { align: "center" });

  const FEATURE_PDF_HEIGHT = 600;
  doc.image(charts.features, LEFT_X, Y_START, { height: FEATURE_PDF_HEIGHT, width: FULL_W });

  doc.end();
  console.log(`Report generated at: ${reportPath}`);
}

async function main(): Promise<void> {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const REPORT_PATH = path.join(process.cwd(), "reports", "data-analysis.pdf");
  const INITIAL_COUNT = 0;
  const PROGRESS_UPDATE_INTERVAL = 10;

  console.log("Finding artifacts...");
  const artifactDirs = findArtifactDirectories(DATA_DIR);
  console.log(`Found ${artifactDirs.length.toString()} artifact directories.`);

  console.log(" extracting metadata...");
  const metadataList: ArtifactMetadata[] = [];

  let processed = INITIAL_COUNT;

  for (const dir of artifactDirs) {
    const metadata = new ArtifactMetadata();
    const success = await addVideoMetadata(dir, metadata);
    if (success) {
      addRawScanMetadata(dir, metadata);
      addArDataMetadata(dir, metadata);

      metadataList.push(metadata);
      if (processed % PROGRESS_UPDATE_INTERVAL === INITIAL_COUNT) {
        process.stdout.write(".");
      }
      processed++;
    }
  }

  console.log("\nMetadata extraction complete.\n");

  if (metadataList.length === INITIAL_COUNT) {
    console.log("No metadata available to report.");
    return;
  }

  // --- Analysis ---
  const durations = metadataList.map((m) => m.duration);
  const avgDuration =
    durations.length > INITIAL_COUNT
      ? durations.reduce((a, b) => a + b, INITIAL_COUNT) / durations.length
      : INITIAL_COUNT;

  // Charts
  console.log("Generating charts...");
  const charts = await generateCharts(metadataList);

  // PDF Generation
  generatePdfReport(charts, avgDuration, metadataList.length, REPORT_PATH);
}

main().catch(console.error);
