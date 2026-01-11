import * as path from "path";

import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { buildArDataAnalysisReport } from "../templates/arDataAnalysisReport";
import { buildScanAnalysisReport } from "../templates/scanAnalysisReport";
import { buildVideoAnalysisReport } from "../templates/videoAnalysisReport";
import { extractArDataMetadata } from "../utils/arData/metadata";
import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";
import { extractRawScanMetadata } from "../utils/room/metadata";
import { extractVideoMetadata } from "../utils/video/metadata";

/**
 * Script to analyze local artifacts and generate PDF reports.
 * - Extracts metadata (resolution, duration, room features).
 * - Runs all room utility checks (intersections, gaps, etc.).
 * - Generates charts (histograms, bar charts) for data distribution.
 * - Outputs three separate reports:
 *   - `reports/3.1 - Video Analysis.pdf` - Video duration, framerate, resolution
 *   - `reports/3.2 - AR Data Analysis.pdf` - Device models, camera settings, lighting
 *   - `reports/3.3 - Scan Analysis.pdf` - Room dimensions, features, objects, errors
 */

// 1. Video Metadata
async function addVideoMetadata(dir: string, metadata: ArtifactAnalysis): Promise<void> {
  const videoMeta = await extractVideoMetadata(dir);
  if (videoMeta) {
    const missingBitrate = 0;
    const missingLevel = 0;
    const missingBFrames = 0;
    const missingBitDepth = 0;
    const missingGop = 0;
    const missingLaplacian = 0;
    metadata.width = videoMeta.width;
    metadata.height = videoMeta.height;
    metadata.fps = videoMeta.fps;
    metadata.duration = videoMeta.duration;
    metadata.bitrate = videoMeta.bitrate ?? missingBitrate;
    metadata.codecName = videoMeta.codecName ?? "";
    metadata.videoProfile = videoMeta.profile ?? "";
    metadata.videoLevel = videoMeta.level ?? missingLevel;
    metadata.bFrameCount = videoMeta.bFrames ?? missingBFrames;
    metadata.colorTransfer = videoMeta.colorTransfer ?? "";
    metadata.colorRange = videoMeta.colorRange ?? "";
    metadata.colorSpace = videoMeta.colorSpace ?? "";
    metadata.pixelFormat = videoMeta.pixelFormat ?? "";
    metadata.bitDepth = videoMeta.bitDepth ?? missingBitDepth;
    metadata.entropyCoding = videoMeta.entropyCoding ?? "";
    metadata.gopSize = videoMeta.gopSize ?? missingGop;
    metadata.maxGopDistance = videoMeta.maxGopDistance ?? missingGop;
    metadata.avgGopDistance = videoMeta.avgGopDistance ?? missingGop;
    metadata.minGopDistance = videoMeta.minGopDistance ?? missingGop;
    metadata.gopVariance = videoMeta.gopVariance ?? missingGop;
    metadata.laplacianMedian = videoMeta.laplacianMedian ?? missingLaplacian;
    metadata.laplacianStdDev = videoMeta.laplacianStdDev ?? missingLaplacian;
    metadata.laplacianSampleCount = videoMeta.laplacianSampleCount ?? missingLaplacian;
    metadata.meanHue = videoMeta.meanHue ?? missingLaplacian;
    metadata.hueVariance = videoMeta.hueVariance ?? missingLaplacian;
    metadata.meanSaturation = videoMeta.meanSaturation ?? missingLaplacian;
    metadata.saturationVariance = videoMeta.saturationVariance ?? missingLaplacian;
    metadata.meanBrightness = videoMeta.meanBrightness ?? missingLaplacian;
    metadata.brightnessVariance = videoMeta.brightnessVariance ?? missingLaplacian;
    metadata.redMean = videoMeta.redMean ?? missingLaplacian;
    metadata.greenMean = videoMeta.greenMean ?? missingLaplacian;
    metadata.blueMean = videoMeta.blueMean ?? missingLaplacian;
    metadata.redVariance = videoMeta.redVariance ?? missingLaplacian;
    metadata.greenVariance = videoMeta.greenVariance ?? missingLaplacian;
    metadata.blueVariance = videoMeta.blueVariance ?? missingLaplacian;
    metadata.clippedPixelPercentage = videoMeta.clippedPixelPercentage ?? missingLaplacian;
    metadata.colorSampleCount = videoMeta.colorSampleCount ?? missingLaplacian;
  }
}

// 2. RawScan Analysis (Room Dimensions, Features)
function addRawScanMetadata(dirPath: string, metadata: ArtifactAnalysis): void {
  const rawMeta = extractRawScanMetadata(dirPath);
  if (rawMeta) {
    Object.assign(metadata, rawMeta);
  }
}

// 3. ArData Analysis
function addArDataMetadata(dirPath: string, metadata: ArtifactAnalysis): void {
  const arMeta = extractArDataMetadata(dirPath);
  if (arMeta) {
    Object.assign(metadata, arMeta);
  }
}

export async function analyzeArtifact(dir: string): Promise<ArtifactAnalysis> {
  const metadata = new ArtifactAnalysis();
  await addVideoMetadata(dir, metadata);
  addRawScanMetadata(dir, metadata);
  addArDataMetadata(dir, metadata);
  return metadata;
}

export async function createInspectionReports(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number,
  artifactDirs?: string[]
): Promise<void> {
  const videoReportFile = "3.1 - Video Analysis.pdf";
  const arDataReportFile = "3.2 - AR Data Analysis.pdf";
  const scanReportFile = "3.3 - Scan Analysis.pdf";

  logger.info("Generating 3.1 - Video Analysis PDF...");
  const videoReportData = buildVideoAnalysisReport(metadataList, avgDuration, videoCount);
  await generatePdfReport(videoReportData, videoReportFile);
  logger.info(`Report generated at: ${videoReportFile}`);

  logger.info("Generating 3.2 - AR Data Analysis PDF...");
  const arDataReportData = buildArDataAnalysisReport(metadataList, videoCount);
  await generatePdfReport(arDataReportData, arDataReportFile);
  logger.info(`Report generated at: ${arDataReportFile}`);

  logger.info("Generating 3.3 - Scan Analysis PDF...");
  const scanReportData = buildScanAnalysisReport(metadataList, videoCount, artifactDirs);
  await generatePdfReport(scanReportData, scanReportFile);
  logger.info(`Report generated at: ${scanReportFile}`);
}

export async function main(): Promise<void> {
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
    const metadata = await analyzeArtifact(dir);
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
  const durations = metadataList
    .map((m) => m.duration)
    .filter((d): d is number => typeof d === "number" && !Number.isNaN(d));

  const avgDuration =
    durations.length > INITIAL_COUNT
      ? durations.reduce((a, b) => a + b, INITIAL_COUNT) / durations.length
      : INITIAL_COUNT;

  // PDF Generation
  const videoCount = metadataList.length;
  await createInspectionReports(metadataList, avgDuration, videoCount, artifactDirs);
}

export async function runCli(runner: () => Promise<void> = main): Promise<void> {
  await runner().catch((err: unknown) => logger.error(err));
}

if (require.main === module) {
  runCli().catch((err: unknown) => logger.error(err));
}
