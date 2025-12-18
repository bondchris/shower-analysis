import * as fs from "fs";
import * as path from "path";

import convert from "convert-units";
import ffmpeg from "fluent-ffmpeg";
import { sumBy } from "lodash";

import { buildDataAnalysisReport } from "../templates/dataAnalysisReport";
import { ArData } from "../models/arData/arData";
import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { RawScan } from "../models/rawScan/rawScan";
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

async function createInspectionReport(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number,
  reportPath: string
): Promise<void> {
  logger.info("Generating PDF...");

  const reportData = buildDataAnalysisReport(metadataList, avgDuration, videoCount);

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

  // PDF Generation
  const videoCount = metadataList.length;
  const REPORT_FILE = "data-analysis.pdf";
  await createInspectionReport(metadataList, avgDuration, videoCount, REPORT_FILE);
}

main().catch((err: unknown) => logger.error(err));
