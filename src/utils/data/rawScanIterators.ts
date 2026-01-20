import * as fs from "fs";
import * as path from "path";

import { RawScan } from "../../models/rawScan/rawScan";
import { RawScanMetadata } from "../../models/rawScan/rawScanMetadata";
import { extractRawScanMetadata } from "../room/metadata";

/**
 * Iterates over artifact directories and invokes a callback with extracted metadata.
 * Skips directories where metadata extraction fails.
 */
export function forEachMetadata(
  artifactDirs: string[],
  fn: (metadata: RawScanMetadata, dir: string) => void
): void {
  for (const dir of artifactDirs) {
    const metadata = extractRawScanMetadata(dir);
    if (metadata === null) {
      continue;
    }
    fn(metadata, dir);
  }
}

/**
 * Collects items from metadata across multiple artifact directories.
 * Uses a selector function to extract arrays of items from each metadata object.
 */
export function collectFromMetadata<T>(
  artifactDirs: string[],
  selector: (m: RawScanMetadata) => T[]
): T[] {
  const out: T[] = [];
  forEachMetadata(artifactDirs, (m) => out.push(...selector(m)));
  return out;
}

/**
 * Iterates over artifact directories and invokes a callback with parsed RawScan objects.
 * Skips directories without rawScan.json or with invalid JSON.
 */
export function forEachRawScan(artifactDirs: string[], fn: (rawScan: RawScan, dir: string) => void): void {
  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawScan = new RawScan(JSON.parse(fs.readFileSync(rawScanPath, "utf-8")));
      fn(rawScan, dir);
    } catch {
      // skip invalid
    }
  }
}

/**
 * Finds artifact directories where a predicate is true for the RawScan.
 */
export function getArtifactsWhere(artifactDirs: string[], predicate: (rawScan: RawScan) => boolean): Set<string> {
  const out = new Set<string>();
  forEachRawScan(artifactDirs, (rawScan, dir) => {
    if (predicate(rawScan)) {
      out.add(dir);
    }
  });
  return out;
}

/**
 * Counts artifacts by a key extracted from metadata.
 * Returns a record mapping keys to their counts.
 */
export function countByKey(
  artifactDirs: string[],
  keyFn: (m: RawScanMetadata) => string | null
): Record<string, number> {
  const out: Record<string, number> = {};
  const initialCount = 0;
  const increment = 1;

  forEachMetadata(artifactDirs, (m) => {
    const key = keyFn(m);
    if (key === null) {
      return;
    }
    out[key] = (out[key] ?? initialCount) + increment;
  });
  return out;
}

/**
 * Merges count maps from multiple metadata objects.
 * Returns a combined record with summed counts.
 */
export function mergeCountMaps(
  artifactDirs: string[],
  mapFn: (m: RawScanMetadata) => Record<string, number> | undefined
): Record<string, number> {
  const out: Record<string, number> = {};
  const initialCount = 0;

  forEachMetadata(artifactDirs, (m) => {
    const map = mapFn(m);
    if (!map) {
      return;
    }
    for (const [k, v] of Object.entries(map)) {
      out[k] = (out[k] ?? initialCount) + v;
    }
  });
  return out;
}
