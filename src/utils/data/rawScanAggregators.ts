import { countByKey, forEachMetadata, mergeCountMaps } from "./rawScanIterators";

/**
 * Extracts sink counts per artifact from metadata files.
 * Returns a record mapping sink count (as string) to number of artifacts with that count.
 */
export const getSinkCounts = (dirs: string[]) => countByKey(dirs, (m) => m.sinkCount.toString());

/**
 * Extracts vanity type classifications from metadata files.
 * Returns a record mapping vanity type to number of scans.
 */
export const getVanityTypes = (dirs: string[]) => countByKey(dirs, (m) => m.vanityType ?? null);

/**
 * Extracts vanity placement classifications from metadata files.
 * Returns a record mapping vanity placement ("regular" or "corner") to number of scans.
 */
export const getVanityPlacements = (dirs: string[]) => countByKey(dirs, (m) => m.vanityPlacement ?? null);

/**
 * Extracts door isOpen values from raw scan files.
 * Returns a record mapping isOpen values (as strings) to their counts.
 */
export const getDoorIsOpenCounts = (dirs: string[]) => mergeCountMaps(dirs, (m) => m.doorIsOpenCounts);

/**
 * Extracts object attribute counts from raw scan files.
 * Returns a record mapping attribute type to a record of attribute values and their counts.
 */
export const getObjectAttributeCounts = (dirs: string[], attributeType: string) =>
  mergeCountMaps(dirs, (m) => m.objectAttributeCounts[attributeType]);

/**
 * Counts walls with windows, doors, and openings across all raw scan files.
 * Returns counts for walls that have at least one window, door, or opening.
 */
export function getWallEmbeddedCounts(artifactDirs: string[]): {
  wallsWithWindows: number;
  wallsWithDoors: number;
  wallsWithOpenings: number;
  totalWalls: number;
} {
  const initialCount = 0;
  let wallsWithWindows = initialCount;
  let wallsWithDoors = initialCount;
  let wallsWithOpenings = initialCount;
  let totalWalls = initialCount;

  forEachMetadata(artifactDirs, (m) => {
    wallsWithWindows += m.wallsWithWindows;
    wallsWithDoors += m.wallsWithDoors;
    wallsWithOpenings += m.wallsWithOpenings;
    totalWalls += m.wallCount;
  });

  return {
    totalWalls,
    wallsWithDoors,
    wallsWithOpenings,
    wallsWithWindows
  };
}
