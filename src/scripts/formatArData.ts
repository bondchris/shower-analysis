import * as fs from "fs";
import * as path from "path";

import { logger } from "../utils/logger";
import { createProgressBar } from "../utils/progress";

/**
 * Script to format and sort `arData.json` files.
 * - Ensures AR frame data is sorted chronologically by timestamp keys.
 * - This normalization helps with diffs and consistent processing.
 */

export function findArDataFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...findArDataFiles(fullPath));
      } else if (file === "arData.json") {
        results.push(fullPath);
      }
    } catch {
      // Ignore files we can't read
      logger.warn(`Skipping unreadable path: ${fullPath}`);
    }
  }
  return results;
}

export interface ArData {
  [key: string]: unknown; // Allow other properties
  data?: Record<string, unknown>;
}

export function sortArData(json: ArData): ArData {
  if (!json.data) {
    return json;
  }

  // Sort keys: numeric ascending
  const sortedKeys = Object.keys(json.data).sort((a, b) => parseFloat(a) - parseFloat(b));
  const sortedData: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedData[key] = json.data[key];
  }

  return {
    ...json,
    data: sortedData
  };
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

  logger.info(`Finding arData.json files in ${DATA_DIR}...`);
  const files = findArDataFiles(DATA_DIR);
  logger.info(`Found ${files.length.toString()} arData.json files.`);

  const bar = createProgressBar("Formatting |{bar}| {percentage}% | {value}/{total} Files");
  const INITIAL_PROGRESS = 0;
  bar.start(files.length, INITIAL_PROGRESS);

  let processed = 0;
  for (const file of files) {
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
        continue;
      }

      const newJson = sortArData(json);

      // Skip if no data or unchanged logic?
      // User requirement: "Skips files where JSON parses but data is missing" -> sortArData returns orig.
      // But if orig has no data, we shouldn't execute write?
      // Original code check: `if (json.data === undefined) continue;`
      if (json.data === undefined) {
        continue;
      }

      fs.writeFileSync(newPath, JSON.stringify(newJson, null, JSON_INDENT));
      processed++;
      bar.increment();
    } catch (e) {
      // bar.stop(); // Optional: stop on error or just log
      logger.error(`Failed to process ${file}: ${String(e)}`);
    }
  }

  bar.stop();

  logger.info(`Sorted ${processed.toString()} files. Skipped ${(files.length - processed).toString()} existing.`);
  return { found: files.length, processed, skipped: files.length - processed };
}

if (require.main === module) {
  run().catch((err: unknown) => logger.error(err));
}
