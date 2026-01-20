import * as fs from "fs";
import * as path from "path";

import { RawScan } from "../../models/rawScan/rawScan";
import { RawScanMetadata } from "../../models/rawScan/rawScanMetadata";
import { computeRawScanMetadata } from "./metadata/computeRawScanMetadata";
import { isValidCachedMetadata } from "./metadata/rawScanMetadataSchema";

/**
 * Extracts metadata from a rawScan.json file in the given directory.
 * Caches results in rawScanMetadata.json.
 */
export function extractRawScanMetadata(dirPath: string): RawScanMetadata | null {
  const metaCachePath = path.join(dirPath, "rawScanMetadata.json");
  const JSON_INDENT = 2;

  // 1. Check Cache
  if (fs.existsSync(metaCachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(metaCachePath, "utf-8")) as Partial<RawScanMetadata>;

      if (isValidCachedMetadata(cached)) {
        return cached;
      }

      // Cache invalid, proceed to regeneration
    } catch {
      // Ignore cache errors
    }
  }

  const rawScanPath = path.join(dirPath, "rawScan.json");

  if (fs.existsSync(rawScanPath)) {
    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      const result = computeRawScanMetadata(rawScan);

      // Persist to cache
      try {
        fs.writeFileSync(metaCachePath, JSON.stringify(result, null, JSON_INDENT));
      } catch {
        // If write fails, still return
      }

      return result;
    } catch {
      return null;
    }
  }

  return null;
}
