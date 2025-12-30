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
 *   - `reports/video-analysis.pdf` - Video duration, framerate, resolution
 *   - `reports/ardata-analysis.pdf` - Device models, camera settings, lighting
 *   - `reports/scan-analysis.pdf` - Room dimensions, features, objects, errors
 */

// 1. Video Metadata
async function addVideoMetadata(dir: string, metadata: ArtifactAnalysis): Promise<void> {
  const videoMeta = await extractVideoMetadata(dir);
  if (videoMeta) {
    metadata.width = videoMeta.width;
    metadata.height = videoMeta.height;
    metadata.fps = videoMeta.fps;
    metadata.duration = videoMeta.duration;
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
  const videoReportFile = "video-analysis.pdf";
  const arDataReportFile = "ardata-analysis.pdf";
  const scanReportFile = "scan-analysis.pdf";

  logger.info("Generating Video Analysis PDF...");
  const videoReportData = buildVideoAnalysisReport(metadataList, avgDuration, videoCount);
  await generatePdfReport(videoReportData, videoReportFile);
  logger.info(`Report generated at: ${videoReportFile}`);

  logger.info("Generating AR Data Analysis PDF...");
  const arDataReportData = buildArDataAnalysisReport(metadataList, videoCount);
  await generatePdfReport(arDataReportData, arDataReportFile);
  logger.info(`Report generated at: ${arDataReportFile}`);

  logger.info("Generating Scan Analysis PDF...");
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

if (require.main === module) {
  main().catch((err: unknown) => logger.error(err));
}
