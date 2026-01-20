import convert from "convert-units";

import { forEachMetadata, getArtifactsWhere } from "./rawScanIterators";
import {
  MIN_WALL_AREA_SQ_FT,
  NARROW_DOOR_WIDTH_FT,
  NARROW_OPENING_WIDTH_FT,
  SHORT_DOOR_HEIGHT_FT
} from "../room/constants";

/**
 * Checks if any entity has a dimension below a threshold.
 */
function anyEntityHasDimBelow(
  entities: { dimensions?: number[] }[],
  dimIndex: number,
  threshold: number
): boolean {
  const minDimensionValue = 0;
  const minDimensionsLength = 2;

  for (const e of entities) {
    if (Array.isArray(e.dimensions) && e.dimensions.length >= minDimensionsLength) {
      const v = e.dimensions[dimIndex];
      if (v !== undefined && v > minDimensionValue && v < threshold) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds artifact directories containing raw scans with unexpected versions.
 */
export function getUnexpectedVersionArtifactDirs(artifactDirs: string[]): Set<string> {
  const expectedVersion = 2;
  return getArtifactsWhere(artifactDirs, (rawScan) => rawScan.version !== expectedVersion);
}

/**
 * Returns a set of artifact directories that have at least one wall with area less than 1.5 sq ft.
 * Areas are calculated in square meters and compared against the threshold (approximately 0.139 sq m).
 */
export function getArtifactsWithSmallWalls(artifactDirs: string[]): Set<string> {
  const out = new Set<string>();
  const minWallAreaSqM = convert(MIN_WALL_AREA_SQ_FT).from("ft2").to("m2");
  const minAreaValue = 0;

  forEachMetadata(artifactDirs, (m, dir) => {
    if (m.wallAreas.some((a) => a > minAreaValue && a < minWallAreaSqM)) {
      out.add(dir);
    }
  });

  return out;
}

/**
 * Returns a set of artifact directories that have at least one door with width less than 2.5 ft (30 inches).
 * Widths are calculated in meters and compared against the threshold (approximately 0.762 m).
 */
export const getArtifactsWithNarrowDoors = (dirs: string[]) => {
  const dimensionIndexWidth = 0;
  return getArtifactsWhere(dirs, (rs) =>
    anyEntityHasDimBelow(rs.doors, dimensionIndexWidth, convert(NARROW_DOOR_WIDTH_FT).from("ft").to("m"))
  );
};

/**
 * Returns a set of artifact directories that have at least one opening with width less than 3 ft.
 * Widths are calculated in meters and compared against the threshold (approximately 0.914 m).
 */
export const getArtifactsWithNarrowOpenings = (dirs: string[]) => {
  const dimensionIndexWidth = 0;
  return getArtifactsWhere(dirs, (rs) => {
    return anyEntityHasDimBelow(rs.openings, dimensionIndexWidth, convert(NARROW_OPENING_WIDTH_FT).from("ft").to("m"));
  });
};

/**
 * Returns a set of artifact directories that have at least one door with height less than 6.5 ft.
 * Heights are calculated in meters and compared against the threshold (approximately 1.981 m).
 */
export const getArtifactsWithShortDoors = (dirs: string[]) => {
  const dimensionIndexHeight = 1;
  return getArtifactsWhere(dirs, (rs) =>
    anyEntityHasDimBelow(rs.doors, dimensionIndexHeight, convert(SHORT_DOOR_HEIGHT_FT).from("ft").to("m"))
  );
};
