import * as fs from "fs";
import * as path from "path";

import { findArtifactDirectories } from "../utils/data/artifactIterator";
import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";

/**
 * Script to format and sort JSON files (arData.json and rawScan.json).
 * - Ensures keys are sorted consistently at all levels (recursively).
 * - For arData.json: AR frame data is sorted chronologically by timestamp keys in the data property.
 * - For rawScan.json: All keys are sorted alphabetically.
 * - This normalization helps with diffs and consistent processing.
 */

export interface ArData {
  [key: string]: unknown; // Allow other properties
  data?: Record<string, unknown>;
}

/**
 * Recursively sorts all keys in an object (and nested objects) alphabetically.
 * Arrays are preserved as-is, only object keys are sorted.
 */
function sortObjectKeysRecursively(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeysRecursively(item));
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sortedObj[key] = sortObjectKeysRecursively((obj as Record<string, unknown>)[key]);
  }

  return sortedObj;
}

/**
 * Sorts arData.json with special handling for the data property (numeric sort).
 * All other keys and nested objects are sorted alphabetically.
 */
export function sortArData(json: ArData): ArData {
  if (!json.data) {
    return sortObjectKeysRecursively(json) as ArData;
  }

  // Sort data keys: numeric ascending
  const sortedKeys = Object.keys(json.data).sort((a, b) => parseFloat(a) - parseFloat(b));
  const sortedData: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedData[key] = sortObjectKeysRecursively(json.data[key]);
  }

  // Sort all other top-level keys alphabetically
  const otherKeys = Object.keys(json)
    .filter((k) => k !== "data")
    .sort();
  const result: ArData = {};
  for (const key of otherKeys) {
    result[key] = sortObjectKeysRecursively(json[key]);
  }

  result.data = sortedData;

  return result;
}

/**
 * Sorts rawScan.json (or any JSON object) with all keys sorted alphabetically at all levels.
 */
export function sortRawScan(json: unknown): unknown {
  return sortObjectKeysRecursively(json);
}

export interface RunStats {
  processed: number;
  found: number;
  skipped: number;
}

export async function run(dataDir?: string): Promise<RunStats> {
  await Promise.resolve(); // Ensure async behavior
  const DATA_DIR = dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const JSON_INDENT = 2;

  logger.info(`Finding JSON files in ${DATA_DIR}...`);
  const artifactDirs = findArtifactDirectories(DATA_DIR);

  // Find both arData.json and rawScan.json files
  const arDataFiles = artifactDirs.map((dir) => path.join(dir, "arData.json")).filter((f) => fs.existsSync(f));
  const rawScanFiles = artifactDirs.map((dir) => path.join(dir, "rawScan.json")).filter((f) => fs.existsSync(f));

  const totalFiles = arDataFiles.length + rawScanFiles.length;
  logger.info(
    `Found ${arDataFiles.length.toString()} arData.json files and ${rawScanFiles.length.toString()} rawScan.json files.`
  );

  const bar = createProgressBar("Formatting |{bar}| {percentage}% | {value}/{total} Files");
  const INITIAL_PROGRESS = 0;
  bar.start(totalFiles, INITIAL_PROGRESS);

  let processed = 0;

  // Process arData.json files
  for (const file of arDataFiles) {
    try {
      const newPath = path.join(path.dirname(file), "arDataFormatted.json");
      if (fs.existsSync(newPath)) {
        bar.increment();
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      let json: ArData = {};
      try {
        json = JSON.parse(content) as ArData;
      } catch {
        logger.error(`Failed to parse JSON in ${file}`);
        bar.increment();
        continue;
      }

      const newJson = sortArData(json);

      // Skip if no data property
      if (json.data === undefined) {
        bar.increment();
        continue;
      }

      fs.writeFileSync(newPath, JSON.stringify(newJson, null, JSON_INDENT));
      processed++;
      bar.increment();
    } catch (e) {
      logger.error(`Failed to process ${file}: ${String(e)}`);
      bar.increment();
    }
  }

  // Process rawScan.json files
  for (const file of rawScanFiles) {
    try {
      const newPath = path.join(path.dirname(file), "rawScanFormatted.json");
      if (fs.existsSync(newPath)) {
        bar.increment();
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      let json: unknown = null;
      try {
        json = JSON.parse(content);
      } catch {
        logger.error(`Failed to parse JSON in ${file}`);
        bar.increment();
        continue;
      }

      const newJson = sortRawScan(json);

      fs.writeFileSync(newPath, JSON.stringify(newJson, null, JSON_INDENT));
      processed++;
      bar.increment();
    } catch (e) {
      logger.error(`Failed to process ${file}: ${String(e)}`);
      bar.increment();
    }
  }

  bar.stop();

  const skipped = totalFiles - processed;
  logger.info(`Sorted ${processed.toString()} files. Skipped ${skipped.toString()} existing.`);
  return { found: totalFiles, processed, skipped };
}

if (require.main === module) {
  run().catch((err: unknown) => logger.error(err));
}
