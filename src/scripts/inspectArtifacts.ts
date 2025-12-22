import * as path from "path";

import { buildDataAnalysisReport } from "../templates/dataAnalysisReport";
import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";
import { generatePdfReport } from "../utils/reportGenerator";
import { extractArDataMetadata } from "../utils/arData/metadata";
import { extractRawScanMetadata } from "../utils/room/metadata";
import { extractVideoMetadata } from "../utils/video/metadata";

/**
 * Script to analyze local artifacts and generate a PDF report.
 * - Extracts metadata (resolution, duration, room features).
 * - Runs all room utility checks (intersections, gaps, etc.).
 * - Generates charts (histograms, bar charts) for data distribution.
 * - Outputs `reports/data-analysis.pdf`.
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

export async function createInspectionReport(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number,
  reportPath: string,
  artifactDirs?: string[]
): Promise<void> {
  logger.info("Generating PDF...");

  const reportData = buildDataAnalysisReport(metadataList, avgDuration, videoCount, artifactDirs);

  await generatePdfReport(reportData, reportPath);

  logger.info(`Report generated at: ${reportPath}`);
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
  const REPORT_FILE = "data-analysis.pdf";
  await createInspectionReport(metadataList, avgDuration, videoCount, REPORT_FILE, artifactDirs);
}

if (require.main === module) {
  main().catch((err: unknown) => logger.error(err));
}
