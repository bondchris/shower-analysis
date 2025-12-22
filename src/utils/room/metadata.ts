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
        cached.openingCount !== undefined &&
        cached.hasLowCeiling !== undefined &&
        cached.hasNonRectangularEmbedded !== undefined;

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
      const RECTANGULAR_CORNER_COUNT = 4;
      const DEFAULT_STORY_INDEX = 0;
      const MIN_POLYGON_CORNERS_LENGTH = 0;

      const stories = Array.from(new Set(rawScan.walls.map((w) => w.story ?? DEFAULT_STORY_INDEX))).sort(
        (a, b) => a - b
      );
      const hasNonRectWall = rawScan.walls.some(
        (w) => w.polygonCorners !== undefined && w.polygonCorners.length > MIN_NON_RECT_CORNERS
      );
      const LOW_CEILING_THRESHOLD_FEET = 7.5;
      const LOW_CEILING_THRESHOLD_METERS = convert(LOW_CEILING_THRESHOLD_FEET).from("ft").to("m");
      const hasLowCeiling = rawScan.walls.some((w) => {
        const minHeight = w.getMinimumCeilingHeight();
        return minHeight !== null && minHeight < LOW_CEILING_THRESHOLD_METERS;
      });
      const roomAreaSqMeters = sumBy(rawScan.floors, "area");

      const result: RawScanMetadata = {
        doorCount: rawScan.doors.length,
        hasBed: rawScan.objects.some((o) => o.category.bed !== undefined),
        hasChair: rawScan.objects.some((o) => o.category.chair !== undefined),
        hasColinearWallErrors: checkColinearWalls(rawScan),
        hasCrookedWallErrors: checkCrookedWalls(rawScan),
        hasCurvedEmbedded:
          rawScan.doors.some((d) => {
            if (d.parentIdentifier === null) {
              return false;
            }
            const curveValue = d.curve as unknown;
            return curveValue !== null && curveValue !== undefined;
          }) ||
          rawScan.windows.some((w) => {
            if (w.parentIdentifier === null) {
              return false;
            }
            const curveValue = w.curve as unknown;
            return curveValue !== null && curveValue !== undefined;
          }) ||
          rawScan.openings.some((o) => {
            if (o.parentIdentifier === null || o.parentIdentifier === undefined) {
              return false;
            }
            const curveValue = o.curve as unknown;
            return curveValue !== null && curveValue !== undefined;
          }),
        hasCurvedWall: rawScan.walls.some((w) => w.curve !== undefined && w.curve !== null),
        hasDishwasher: rawScan.objects.some((o) => o.category.dishwasher !== undefined),
        hasDoorBlockingError: checkDoorBlocking(rawScan),
        hasExternalOpening: checkExternalOpening(rawScan),
        hasFireplace: rawScan.objects.some((o) => o.category.fireplace !== undefined),
        hasLowCeiling: hasLowCeiling,
        hasMultipleStories: stories.length > SINGLE_STORY_COUNT,
        hasNibWalls: checkNibWalls(rawScan),
        hasNonRectWall: hasNonRectWall,
        hasNonRectangularEmbedded:
          rawScan.doors.some(
            (d) =>
              d.parentIdentifier !== null &&
              d.polygonCorners.length > MIN_POLYGON_CORNERS_LENGTH &&
              d.polygonCorners.length !== RECTANGULAR_CORNER_COUNT
          ) ||
          rawScan.windows.some(
            (w) =>
              w.parentIdentifier !== null &&
              w.polygonCorners.length > MIN_POLYGON_CORNERS_LENGTH &&
              w.polygonCorners.length !== RECTANGULAR_CORNER_COUNT
          ) ||
          rawScan.openings.some(
            (o) =>
              o.parentIdentifier !== null &&
              o.parentIdentifier !== undefined &&
              o.polygonCorners !== undefined &&
              o.polygonCorners.length > MIN_POLYGON_CORNERS_LENGTH &&
              o.polygonCorners.length !== RECTANGULAR_CORNER_COUNT
          ),
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
