import { RawScan } from "../../../models/rawScan/rawScan";

export interface WallEmbeddedCounts {
  wallsWithWindows: number;
  wallsWithDoors: number;
  wallsWithOpenings: number;
}

/**
 * Counts walls with windows, doors, and openings.
 * Returns counts for walls that have at least one window, door, or opening.
 */
export function extractWallEmbeddedCounts(rawScan: RawScan): WallEmbeddedCounts {
  const wallsWithWindowsSet = new Set<string>();
  const wallsWithDoorsSet = new Set<string>();
  const wallsWithOpeningsSet = new Set<string>();

  for (const window of rawScan.windows) {
    if (window.parentIdentifier !== null) {
      wallsWithWindowsSet.add(window.parentIdentifier);
    }
  }

  for (const door of rawScan.doors) {
    if (door.parentIdentifier !== null) {
      wallsWithDoorsSet.add(door.parentIdentifier);
    }
  }

  for (const opening of rawScan.openings) {
    if (opening.parentIdentifier !== null && opening.parentIdentifier !== undefined) {
      wallsWithOpeningsSet.add(opening.parentIdentifier);
    }
  }

  return {
    wallsWithDoors: wallsWithDoorsSet.size,
    wallsWithOpenings: wallsWithOpeningsSet.size,
    wallsWithWindows: wallsWithWindowsSet.size
  };
}
