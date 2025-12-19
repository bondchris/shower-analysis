import * as fs from "fs";
import * as path from "path";

import convert from "convert-units";
import ffmpeg from "fluent-ffmpeg";
import { sumBy } from "lodash";

import { buildDataAnalysisReport } from "../templates/dataAnalysisReport";
import { ArData } from "../models/arData/arData";
import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { RawScan } from "../models/rawScan/rawScan";
import { findArtifactDirectories } from "../utils/data/artifactIterator";
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

async function getVideoMetadata(filePath: string): Promise<ffmpeg.FfprobeData> {
  const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        resolve(metadata);
      }
    });
  });
  return data;
}

// 1. Video Metadata (Resolution, FPS, Duration)
async function addVideoMetadata(dirPath: string, metadata: ArtifactAnalysis): Promise<boolean> {
  const videoPath = path.join(dirPath, "video.mp4");
  const EXPECTED_PARTS = 2;
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const RADIX = 10;
  const ZERO_DENOMINATOR = 0;

  if (fs.existsSync(videoPath)) {
    try {
      const vidMeta = await getVideoMetadata(videoPath);
      const stream = vidMeta.streams.find((s) => s.codec_type === "video");

      if (stream) {
        if (stream.width !== undefined && stream.height !== undefined) {
          metadata.width = stream.width;
          metadata.height = stream.height;
        }
        if (stream.r_frame_rate !== undefined) {
          // r_frame_rate is usually "30/1" or similar
          const parts = stream.r_frame_rate.split("/");
          if (
            parts.length === EXPECTED_PARTS &&
            parts[NUMERATOR_IDX] !== undefined &&
            parts[DENOMINATOR_IDX] !== undefined
          ) {
            const num = parseInt(parts[NUMERATOR_IDX], RADIX);
            const den = parseInt(parts[DENOMINATOR_IDX], RADIX);
            if (den !== ZERO_DENOMINATOR) {
              metadata.fps = Math.round(num / den);
            }
          }
        }
      }

      const format = vidMeta.format;
      if (format.duration !== undefined) {
        metadata.duration = format.duration;
      }

      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// 2. RawScan Analysis (Room Dimensions, Features)
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
    await addVideoMetadata(dir, metadata);
    addRawScanMetadata(dir, metadata);
    addArDataMetadata(dir, metadata);

    metadataList.push(metadata);
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
