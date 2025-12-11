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
  checkNibWalls,
  checkObjectIntersections,
  checkToiletGaps,
  checkTubGaps,
  checkWallGaps,
  checkWallIntersections
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

      const intersectionResults = checkObjectIntersections(rawScan);
      metadata.hasObjectIntersectionErrors = intersectionResults.hasObjectIntersectionErrors;
      metadata.hasWallObjectIntersectionErrors = intersectionResults.hasWallObjectIntersectionErrors;

      metadata.hasWallWallIntersectionErrors = checkWallIntersections(rawScan);

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

async function main(): Promise<void> {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const REPORT_PATH = path.join(process.cwd(), "reports", "data-analysis.pdf");
  const INITIAL_COUNT = 0;
  const PROGRESS_UPDATE_INTERVAL = 10;
  const DECIMAL_PLACES = 2;
  const INCREMENT_STEP = 1;

  const MARGIN = 50;
  const PDF_TITLE_SIZE = 25;
  const PDF_BODY_SIZE = 12;
  const SPACING_SMALL = 0.5;
  const PDF_SUBTITLE_SIZE = 16;
  const CHART_SPACING = 10;

  // Histogram Constants
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  console.log("Finding artifacts...");
  const artifactDirs = findArtifactDirectories(DATA_DIR);
  console.log(`Found ${artifactDirs.length.toString()} artifact directories.`);

  console.log(" extracting metadata...");
  const metadataList: ArtifactMetadata[] = [];
  const NOT_SET = "";
  const NO_RESULTS = 0;
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
    if (m.lensModel !== NOT_SET) {
      lensMap[m.lensModel] = (lensMap[m.lensModel] ?? INITIAL_COUNT) + INCREMENT_STEP;
    }
  }
  // Sort by count descending
  const lensLabels = Object.keys(lensMap).sort((a, b) => (lensMap[b] ?? INITIAL_COUNT) - (lensMap[a] ?? INITIAL_COUNT));
  const lensCounts = lensLabels.map((l) => lensMap[l] ?? INITIAL_COUNT);
  const lensChart = await ChartUtils.createBarChart(lensLabels, lensCounts, "Lens Model Distribution", {
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

  // Charts
  console.log("Generating charts...");

  // Duration: min 10, max 120, bin 10
  const durationChart = await ChartUtils.createHistogram(durations, "Seconds", "Duration", {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 120,
    min: 10,
    width: DURATION_CHART_WIDTH
  });

  // Ambient: 980-1040, bin 5
  const ambChart = await ChartUtils.createHistogram(intensityVals, "Lumens", "Ambient Intensity", {
    binSize: 5,
    max: 1040,
    min: 980
  });

  // Temp: 4000-6000, bin 250
  const tempChart = await ChartUtils.createHistogram(tempVals, "Kelvin", "Color Temperature", {
    binSize: 250,
    colorByValue: ChartUtils.kelvinToRgb,
    max: 6000,
    min: 4000
  });

  // ISO: 0-800, bin 50
  const isoChart = await ChartUtils.createHistogram(isoVals, "ISO", "ISO Speed", {
    binSize: 50,
    hideUnderflow: true,
    max: 800,
    min: 0
  });

  // Brightness: 0-6, bin 1
  const briChart = await ChartUtils.createHistogram(briVals, "Value (EV)", "Brightness Value", {
    binSize: 1,
    decimalPlaces: 1,
    max: 6,
    min: 0
  });

  // Room Area: 0-150, bin 10
  const areaChart = await ChartUtils.createHistogram(areaVals, "Sq Ft", "Room Area", {
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
  const fpsChart = await ChartUtils.createBarChart(fpsLabels, fpsCounts, "Framerate");

  const resolutions = metadataList.map((m) => `${m.width.toString()}x${m.height.toString()}`);
  const resDistribution: Record<string, number> = {};
  resolutions.forEach((res) => {
    resDistribution[res] = (resDistribution[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const resLabels = Object.keys(resDistribution).sort();
  const resCounts = resLabels.map((l) => resDistribution[l] ?? INITIAL_COUNT);
  const resChart = await ChartUtils.createBarChart(resLabels, resCounts, "Resolution");

  // Layout Constants (Needed for PDF layout)
  const Y_START = 130;
  const H = 160;
  const W = 250;
  const GAP_Y = 200;
  const FULL_W = 510;
  const LEFT_X = 50;
  const TEXT_PADDING = 15;
  const RIGHT_X = LEFT_X + W + CHART_SPACING;

  // Feature Prevalence
  let countNonRect = INITIAL_COUNT;
  let countTwoToilets = INITIAL_COUNT;
  let countTwoTubs = INITIAL_COUNT;
  let countFewWalls = INITIAL_COUNT;
  let countCurvedWalls = INITIAL_COUNT;
  let countNoVanity = INITIAL_COUNT;
  let countExternalOpening = INITIAL_COUNT;
  let countSoffit = INITIAL_COUNT;
  let countToiletGapErrors = INITIAL_COUNT;
  let countTubGapErrors = INITIAL_COUNT;
  let countWallGapErrors = INITIAL_COUNT;
  let countColinearWallErrors = INITIAL_COUNT;
  let countNibWalls = INITIAL_COUNT;
  let countObjectIntersectionErrors = INITIAL_COUNT;
  let countWallObjectIntersectionErrors = INITIAL_COUNT;
  let countWallWallIntersectionErrors = INITIAL_COUNT;
  let countCrookedWallErrors = INITIAL_COUNT;
  let countDoorBlockingErrors = INITIAL_COUNT;
  let countWasherDryer = INITIAL_COUNT;
  let countStove = INITIAL_COUNT;
  let countTable = INITIAL_COUNT;
  let countChair = INITIAL_COUNT;
  let countBed = INITIAL_COUNT;
  let countSofa = INITIAL_COUNT;
  let countDishwasher = INITIAL_COUNT;
  let countOven = INITIAL_COUNT;
  let countRefrigerator = INITIAL_COUNT;
  let countStairs = INITIAL_COUNT;
  let countFireplace = INITIAL_COUNT;
  let countTelevision = INITIAL_COUNT;

  for (const m of metadataList) {
    if (m.hasNonRectWall) {
      countNonRect++;
    }
    if (m.hasCurvedWall) {
      countCurvedWalls++;
    }
    if (m.toiletCount >= MIN_TOILETS) {
      countTwoToilets++;
    }
    if (m.tubCount >= MIN_TUBS) {
      countTwoTubs++;
    }
    if (m.wallCount < MIN_WALLS) {
      countFewWalls++;
    }
    const sinks = m.sinkCount;
    const storage = m.storageCount;
    if (sinks === INITIAL_COUNT && storage === INITIAL_COUNT) {
      countNoVanity++;
    }
    if (m.hasExternalOpening) {
      countExternalOpening++;
    }
    if (m.hasSoffit) {
      countSoffit++;
    }
    if (m.hasToiletGapErrors) {
      countToiletGapErrors++;
    }
    if (m.hasTubGapErrors) {
      countTubGapErrors++;
    }
    if (m.hasWallGapErrors) {
      countWallGapErrors++;
    }
    if (m.hasColinearWallErrors) {
      countColinearWallErrors++;
    }
    if (m.hasNibWalls) {
      countNibWalls++;
    }
    if (m.hasObjectIntersectionErrors) {
      countObjectIntersectionErrors++;
    }
    if (m.hasWallObjectIntersectionErrors) {
      countWallObjectIntersectionErrors++;
    }
    if (m.hasWallWallIntersectionErrors) {
      countWallWallIntersectionErrors++;
    }
    if (m.hasCrookedWallErrors) {
      countCrookedWallErrors++;
    }
    if (m.hasDoorBlockingError) {
      countDoorBlockingErrors++;
    }
    // New Feature Counts
    if (m.hasWasherDryer) {
      countWasherDryer++;
    }
    if (m.hasStove) {
      countStove++;
    }
    if (m.hasTable) {
      countTable++;
    }
    if (m.hasChair) {
      countChair++;
    }
    if (m.hasBed) {
      countBed++;
    }
    if (m.hasSofa) {
      countSofa++;
    }
    if (m.hasDishwasher) {
      countDishwasher++;
    }
    if (m.hasOven) {
      countOven++;
    }
    if (m.hasRefrigerator) {
      countRefrigerator++;
    }
    if (m.hasStairs) {
      countStairs++;
    }
    if (m.hasFireplace) {
      countFireplace++;
    }
    if (m.hasTelevision) {
      countTelevision++;
    }
  }

  const featureLabels = [
    "Non-Rectangular Walls",
    "Curved Walls",
    "2+ Toilets",
    "2+ Tubs",
    "< 4 Walls",
    "No Vanity",
    "External Opening",
    "Soffit",
    "Nib Walls (< 1ft)",
    "Washer/Dryer",
    "Stove",
    "Table",
    "Chair",
    "Bed",
    "Sofa",
    "Dishwasher",
    "Oven",
    "Refrigerator",
    "Stairs",
    "Fireplace",
    "Television"
  ];
  const featureCounts = [
    countNonRect,
    countCurvedWalls,
    countTwoToilets,
    countTwoTubs,
    countFewWalls,
    countNoVanity,
    countExternalOpening,
    countSoffit,
    countNibWalls,
    countWasherDryer,
    countStove,
    countTable,
    countChair,
    countBed,
    countSofa,
    countDishwasher,
    countOven,
    countRefrigerator,
    countStairs,
    countFireplace,
    countTelevision
  ];
  const FEATURE_CHART_HEIGHT = 1500;
  const featureChart = await ChartUtils.createBarChart(featureLabels, featureCounts, "Feature Prevalence", {
    height: FEATURE_CHART_HEIGHT,
    horizontal: true,
    totalForPercentages: metadataList.length,
    width: DURATION_CHART_WIDTH
  });

  // Error Chart
  const errorLabels = [
    'Toilet Gap > 1"',
    'Tub Gap 1"-6"',
    'Wall Gaps 1"-12"',
    "Colinear Walls",
    "Object Intersections",
    "Wall <-> Object Intersections",
    "Wall <-> Wall Intersections",
    "Crooked Walls",
    "Door Blocked"
  ];
  const errorCounts = [
    countToiletGapErrors,
    countTubGapErrors,
    countWallGapErrors,
    countColinearWallErrors,
    countObjectIntersectionErrors,
    countWallObjectIntersectionErrors,
    countWallWallIntersectionErrors,
    countCrookedWallErrors,
    countDoorBlockingErrors
  ];
  const errorChart = await ChartUtils.createBarChart(errorLabels, errorCounts, "Capture Errors", {
    height: DURATION_CHART_HEIGHT,
    horizontal: true,
    totalForPercentages: metadataList.length,
    width: DURATION_CHART_WIDTH
  });

  // PDF Generation
  console.log("Generating PDF...");
  const doc = new PDFDocument({ margin: MARGIN });
  doc.pipe(fs.createWriteStream(REPORT_PATH));

  // --- Page 1: Summary ---
  const summaryText = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES)}s | Videos: ${metadataList.length.toString()}`;
  doc.fontSize(PDF_TITLE_SIZE).text("Artifact Data Analysis", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(summaryText, { align: "center" });
  doc.moveDown(SPACING_SMALL);

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

  doc.image(areaChart, LEFT_X, Y_START, { height: H, width: FULL_W });
  doc.text("Room Area (Sq Ft)", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: FULL_W });

  doc.image(errorChart, LEFT_X, Y_START + GAP_Y, { height: H, width: FULL_W });
  doc.text("Capture Errors", LEFT_X, Y_START + GAP_Y + H + TEXT_PADDING, {
    align: "center",
    width: FULL_W
  });

  // --- Page 4: Feature Prevalence ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Feature Prevalence", { align: "center" });

  const FEATURE_PDF_HEIGHT = 600;
  doc.image(featureChart, LEFT_X, Y_START, { height: FEATURE_PDF_HEIGHT, width: FULL_W });

  doc.end();
  console.log(`Report generated at: ${REPORT_PATH}`);
}

main().catch(console.error);
