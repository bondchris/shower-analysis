import * as fs from "fs";
import * as path from "path";

import { RawScan } from "../../models/rawScan/rawScan";
import { RawScanMetadata } from "../../models/rawScan/rawScanMetadata";
import { generateRoomLayoutPng } from "./layout";
import { computeRawScanMetadata } from "./metadata/computeRawScanMetadata";
import { isValidCachedMetadata } from "./metadata/rawScanMetadataSchema";

/**
 * Generates a room layout PNG for the artifact if rawScan.json exists.
 * Skips generation if the layout already exists.
 */
export async function generateLayoutForArtifact(dirPath: string): Promise<void> {
  const layoutPath = path.join(dirPath, "layout.png");
  const rawScanPath = path.join(dirPath, "rawScan.json");
  const imageSize = 800;
  const imagePadding = 60;

  if (fs.existsSync(layoutPath)) {
    return;
  }

  if (!fs.existsSync(rawScanPath)) {
    return;
  }

  try {
    const rawContent = fs.readFileSync(rawScanPath, "utf-8");
    const rawScan = new RawScan(JSON.parse(rawContent));
    await generateRoomLayoutPng(rawScan, layoutPath, {
      height: imageSize,
      padding: imagePadding,
      showLabels: true,
      width: imageSize
    });
  } catch {
    // Silently skip layout generation on error
  }
}

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
