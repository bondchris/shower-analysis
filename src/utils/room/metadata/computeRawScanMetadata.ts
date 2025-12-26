import convert from "convert-units";
import { sumBy } from "lodash";

import { RawScan } from "../../../models/rawScan/rawScan";
import { RawScanMetadata } from "../metadata";
import { checkColinearWalls } from "../analysis/checkColinearWalls";
import { checkCrookedWalls } from "../analysis/checkCrookedWalls";
import { checkDoorBlocking } from "../analysis/checkDoorBlocking";
import { checkDoorFloorContact } from "../analysis/checkDoorFloorContact";
import { checkExternalOpening } from "../analysis/checkExternalOpening";
import { checkIntersections } from "../analysis/checkIntersections";
import { checkNibWalls } from "../analysis/checkNibWalls";
import { checkToiletGaps } from "../analysis/checkToiletGaps";
import { checkTubGaps } from "../analysis/checkTubGaps";
import { checkWallGaps } from "../analysis/checkWallGaps";
import { LOW_CEILING_THRESHOLD_FT } from "../constants";
import { getVanityType } from "../vanity/vanityAnalysis";
import { extractAttributeData } from "./extractAttributeData";
import { extractDimensionAreaData } from "./extractDimensionAreaData";
import { extractWallEmbeddedCounts } from "./extractWallEmbeddedCounts";
import {
  hasCurvedEmbedded,
  hasNonEmptyCompletedEdges,
  hasNonRectangularEmbedded,
  hasUnparentedEmbedded
} from "./rawScanPredicates";

const MIN_NON_RECT_CORNERS = 4;
const DEFAULT_STORY_INDEX = 0;
const SINGLE_STORY_COUNT = 1;

/**
 * Computes metadata from a RawScan.
 * This is a pure function that does no file I/O or caching.
 */
export function computeRawScanMetadata(rawScan: RawScan): RawScanMetadata {
  const intersectionResults = checkIntersections(rawScan);

  const stories = Array.from(new Set(rawScan.walls.map((w) => w.story ?? DEFAULT_STORY_INDEX))).sort((a, b) => a - b);
  const hasNonRectWall = rawScan.walls.some(
    (w) => w.polygonCorners !== undefined && w.polygonCorners.length > MIN_NON_RECT_CORNERS
  );
  const LOW_CEILING_THRESHOLD_METERS = convert(LOW_CEILING_THRESHOLD_FT).from("ft").to("m");
  const hasLowCeiling = rawScan.walls.some((w) => {
    const minHeight = w.getMinimumCeilingHeight();
    return minHeight !== null && minHeight < LOW_CEILING_THRESHOLD_METERS;
  });
  const roomAreaSqMeters = sumBy(rawScan.floors, "area");

  const dimensionAreaData = extractDimensionAreaData(rawScan);
  const attributeData = extractAttributeData(rawScan);
  const wallEmbeddedCounts = extractWallEmbeddedCounts(rawScan);
  const vanityType = getVanityType(rawScan);

  const result: RawScanMetadata = {
    doorCount: rawScan.doors.length,
    hasBed: rawScan.objects.some((o) => o.category.bed !== undefined),
    hasChair: rawScan.objects.some((o) => o.category.chair !== undefined),
    hasColinearWallErrors: checkColinearWalls(rawScan),
    hasCrookedWallErrors: checkCrookedWalls(rawScan),
    hasCurvedEmbedded: hasCurvedEmbedded(rawScan),
    hasCurvedWall: rawScan.walls.some((w) => w.curve !== undefined && w.curve !== null),
    hasDishwasher: rawScan.objects.some((o) => o.category.dishwasher !== undefined),
    hasDoorBlockingError: checkDoorBlocking(rawScan),
    hasDoorFloorContactError: checkDoorFloorContact(rawScan),
    hasEmbeddedObjectIntersectionErrors: intersectionResults.hasEmbeddedObjectIntersectionErrors,
    hasExternalOpening: checkExternalOpening(rawScan),
    hasFireplace: rawScan.objects.some((o) => o.category.fireplace !== undefined),
    hasFloorsWithParentId: rawScan.floors.some((f) => f.parentIdentifier !== null),
    hasLowCeiling: hasLowCeiling,
    hasMultipleStories: stories.length > SINGLE_STORY_COUNT,
    hasNibWalls: checkNibWalls(rawScan),
    hasNonEmptyCompletedEdges: hasNonEmptyCompletedEdges(rawScan),
    hasNonRectWall: hasNonRectWall,
    hasNonRectangularEmbedded: hasNonRectangularEmbedded(rawScan),
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
    hasUnparentedEmbedded: hasUnparentedEmbedded(rawScan),
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
    windowCount: rawScan.windows.length,
    // Dimension and area data
    ...dimensionAreaData,
    // Attribute counts
    ...attributeData,
    // Wall embedded counts
    ...wallEmbeddedCounts,
    // Vanity data
    vanityType
  };

  return result;
}
