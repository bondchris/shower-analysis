import * as fs from "fs";
import * as path from "path";
import convert from "convert-units";
import { sumBy } from "lodash";

import { RawScan } from "../../models/rawScan/rawScan";
import { checkColinearWalls } from "../room/checkColinearWalls";
import { checkCrookedWalls } from "../room/checkCrookedWalls";
import { checkDoorBlocking } from "../room/checkDoorBlocking";
import { checkExternalOpening } from "../room/checkExternalOpening";
import { checkIntersections } from "../room/checkIntersections";
import { checkNibWalls } from "../room/checkNibWalls";
import { checkToiletGaps } from "../room/checkToiletGaps";
import { checkTubGaps } from "../room/checkTubGaps";
import { checkWallGaps } from "../room/checkWallGaps";

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
  hasToiletGapErrors: boolean;
  hasTubGapErrors: boolean;
  hasUnparentedEmbedded: boolean;
  hasWallGapErrors: boolean;
  hasColinearWallErrors: boolean;
  hasNibWalls: boolean;
  hasObjectIntersectionErrors: boolean;
  hasWallObjectIntersectionErrors: boolean;
  hasWallWallIntersectionErrors: boolean;
  hasCrookedWallErrors: boolean;
  hasDoorBlockingError: boolean;
  sectionLabels: string[];
  stories: number[];
  hasMultipleStories: boolean;
}

/**
 * Extracts metadata from a rawScan.json file in the given directory.
 * Caches results in rawScanMetadata.json.
 */
export function extractRawScanMetadata(dirPath: string): RawScanMetadata | null {
  const metaCachePath = path.join(dirPath, "rawScanMetadata.json");
  const JSON_INDENT = 2;
  const SINGLE_STORY_COUNT = 1;

  // 1. Check Cache
  if (fs.existsSync(metaCachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(metaCachePath, "utf-8")) as Partial<RawScanMetadata>;

      const isValid =
        cached.stories !== undefined &&
        cached.doorCount !== undefined &&
        cached.windowCount !== undefined &&
        cached.openingCount !== undefined;

      if (isValid) {
        return cached as RawScanMetadata;
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

      const intersectionResults = checkIntersections(rawScan);

      const MIN_NON_RECT_CORNERS = 4;
      const DEFAULT_STORY_INDEX = 0;

      const stories = Array.from(new Set(rawScan.walls.map((w) => w.story ?? DEFAULT_STORY_INDEX))).sort(
        (a, b) => a - b
      );
      const hasNonRectWall = rawScan.walls.some(
        (w) => w.polygonCorners !== undefined && w.polygonCorners.length > MIN_NON_RECT_CORNERS
      );
      const roomAreaSqMeters = sumBy(rawScan.floors, "area");

      const result: RawScanMetadata = {
        doorCount: rawScan.doors.length,
        hasBed: rawScan.objects.some((o) => o.category.bed !== undefined),
        hasChair: rawScan.objects.some((o) => o.category.chair !== undefined),
        hasColinearWallErrors: checkColinearWalls(rawScan),
        hasCrookedWallErrors: checkCrookedWalls(rawScan),
        hasCurvedWall: rawScan.walls.some((w) => w.curve !== undefined && w.curve !== null),
        hasDishwasher: rawScan.objects.some((o) => o.category.dishwasher !== undefined),
        hasDoorBlockingError: checkDoorBlocking(rawScan),
        hasExternalOpening: checkExternalOpening(rawScan),
        hasFireplace: rawScan.objects.some((o) => o.category.fireplace !== undefined),
        hasMultipleStories: stories.length > SINGLE_STORY_COUNT,
        hasNibWalls: checkNibWalls(rawScan),
        hasNonRectWall: hasNonRectWall,
        hasObjectIntersectionErrors: intersectionResults.hasObjectIntersectionErrors,
        hasOven: rawScan.objects.some((o) => o.category.oven !== undefined),
        hasRefrigerator: rawScan.objects.some((o) => o.category.refrigerator !== undefined),
        hasSofa: rawScan.objects.some((o) => o.category.sofa !== undefined),
        hasSoffit: rawScan.walls.some((w) => w.hasSoffit),
        hasStairs: rawScan.objects.some((o) => o.category.stairs !== undefined),
        hasStove: rawScan.objects.some((o) => o.category.stove !== undefined),
        hasTable: rawScan.objects.some((o) => o.category.table !== undefined),
        hasTelevision: rawScan.objects.some((o) => o.category.television !== undefined),
        hasToiletGapErrors: checkToiletGaps(rawScan),
        hasTubGapErrors: checkTubGaps(rawScan),
        hasUnparentedEmbedded:
          rawScan.doors.some((d) => d.parentIdentifier === null) ||
          rawScan.windows.some((w) => w.parentIdentifier === null) ||
          rawScan.openings.some((o) => o.parentIdentifier === null),
        hasWallGapErrors: checkWallGaps(rawScan),
        hasWallObjectIntersectionErrors: intersectionResults.hasWallObjectIntersectionErrors,
        hasWallWallIntersectionErrors: intersectionResults.hasWallWallIntersectionErrors,
        hasWasherDryer: rawScan.objects.some((o) => o.category.washerDryer !== undefined),
        openingCount: rawScan.openings.length,
        roomAreaSqFt: convert(roomAreaSqMeters).from("m2").to("ft2"),
        sectionLabels: rawScan.sections.map((s) => s.label),
        sinkCount: rawScan.objects.filter((o) => o.category.sink !== undefined).length,
        storageCount: rawScan.objects.filter((o) => o.category.storage !== undefined).length,
        stories,
        toiletCount: rawScan.objects.filter((o) => o.category.toilet !== undefined).length,
        tubCount: rawScan.objects.filter((o) => o.category.bathtub !== undefined).length,
        wallCount: rawScan.walls.length,
        windowCount: rawScan.windows.length
      };

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
