import * as fs from "fs";
import * as path from "path";

import { RawScan } from "../../models/rawScan/rawScan";
import { computeRawScanMetadata } from "./metadata/computeRawScanMetadata";
import { isValidCachedMetadata } from "./metadata/rawScanMetadataSchema";

export interface RawScanMetadata {
  roomAreaSqFt: number;
  wallCount: number;
  hasNonRectWall: boolean;
  hasCurvedWall: boolean;
  toiletCount: number;
  tubCount: number;
  sinkCount: number;
  storageCount: number;
  doorCount: number;
  windowCount: number;
  openingCount: number;
  hasWasherDryer: boolean;
  hasStove: boolean;
  hasTable: boolean;
  hasChair: boolean;
  hasBed: boolean;
  hasSofa: boolean;
  hasDishwasher: boolean;
  hasOven: boolean;
  hasRefrigerator: boolean;
  hasStairs: boolean;
  hasFireplace: boolean;
  hasTelevision: boolean;
  hasExternalOpening: boolean;
  hasSoffit: boolean;
  hasLowCeiling: boolean;
  hasToiletGapErrors: boolean;
  hasTubGapErrors: boolean;
  hasUnparentedEmbedded: boolean;
  hasCurvedEmbedded: boolean;
  hasNonRectangularEmbedded: boolean;
  hasWallGapErrors: boolean;
  hasColinearWallErrors: boolean;
  hasNibWalls: boolean;
  hasObjectIntersectionErrors: boolean;
  hasWallObjectIntersectionErrors: boolean;
  hasWallWallIntersectionErrors: boolean;
  hasEmbeddedObjectIntersectionErrors: boolean;
  hasCrookedWallErrors: boolean;
  hasDoorBlockingError: boolean;
  hasDoorFloorContactError: boolean;
  hasFloorsWithParentId: boolean;
  hasNonEmptyCompletedEdges: boolean;
  sectionLabels: string[];
  stories: number[];
  hasMultipleStories: boolean;
  // Dimension and area data (in meters/square meters)
  wallHeights: number[];
  wallWidths: number[];
  wallAreas: number[];
  wallWidthHeightPairs: { height: number; width: number }[];
  windowHeights: number[];
  windowWidths: number[];
  windowAreas: number[];
  windowWidthHeightPairs: { height: number; width: number }[];
  doorHeights: number[];
  doorWidths: number[];
  doorAreas: number[];
  doorWidthHeightPairs: { height: number; width: number }[];
  openingHeights: number[];
  openingWidths: number[];
  openingAreas: number[];
  openingWidthHeightPairs: { height: number; width: number }[];
  floorLengths: number[];
  floorWidths: number[];
  floorWidthHeightPairs: { height: number; width: number }[];
  tubLengths: number[];
  vanityLengths: number[];
  // Attribute counts
  doorIsOpenCounts: Record<string, number>;
  objectAttributeCounts: Record<string, Record<string, number>>;
  // Wall embedded counts
  wallsWithWindows: number;
  wallsWithDoors: number;
  wallsWithOpenings: number;
  // Vanity data
  vanityType: string | null;
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
