import * as fs from "fs";
import * as path from "path";
import convert from "convert-units";

import { RawScan } from "../../models/rawScan/rawScan";
import { RawScanMetadata, extractRawScanMetadata } from "../room/metadata";
import {
  MIN_WALL_AREA_SQ_FT,
  NARROW_DOOR_WIDTH_FT,
  NARROW_OPENING_WIDTH_FT,
  SHORT_DOOR_HEIGHT_FT
} from "../room/constants";

type ObjectConfidenceCounts = Record<string, [number, number, number]>; // [high, medium, low]

type ConfidenceBucket = "high" | "medium" | "low";

const OBJECT_CATEGORY_LABELS: Record<string, string> = {
  bathtub: "Bathtub",
  bed: "Bed",
  chair: "Chair",
  dishwasher: "Dishwasher",
  fireplace: "Fireplace",
  oven: "Oven",
  refrigerator: "Refrigerator",
  sink: "Sink",
  sofa: "Sofa",
  stairs: "Stairs",
  storage: "Storage",
  stove: "Stove",
  table: "Table",
  television: "Television",
  toilet: "Toilet",
  washerDryer: "Washer/Dryer"
};

const CONFIDENCE_INDEX_HIGH = 0;
const CONFIDENCE_INDEX_MEDIUM = 1;
const CONFIDENCE_INDEX_LOW = 2;

const BUCKET_INDEX: Record<ConfidenceBucket, typeof CONFIDENCE_INDEX_HIGH | typeof CONFIDENCE_INDEX_MEDIUM | typeof CONFIDENCE_INDEX_LOW> = {
  high: CONFIDENCE_INDEX_HIGH,
  low: CONFIDENCE_INDEX_LOW,
  medium: CONFIDENCE_INDEX_MEDIUM
};

// Iteration helpers

function forEachMetadata(
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

function collectFromMetadata<T>(
  artifactDirs: string[],
  selector: (m: RawScanMetadata) => T[]
): T[] {
  const out: T[] = [];
  forEachMetadata(artifactDirs, (m) => out.push(...selector(m)));
  return out;
}

function forEachRawScan(artifactDirs: string[], fn: (rawScan: RawScan, dir: string) => void): void {
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

// Generic helpers for entity checks

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

function getArtifactsWhere(artifactDirs: string[], predicate: (rawScan: RawScan) => boolean): Set<string> {
  const out = new Set<string>();
  forEachRawScan(artifactDirs, (rawScan, dir) => {
    if (predicate(rawScan)) {
      out.add(dir);
    }
  });
  return out;
}

// Object category mapping

function getObjectTypeFromCategory(category: Record<string, unknown>): string | null {
  for (const [key, label] of Object.entries(OBJECT_CATEGORY_LABELS)) {
    if (category[key] !== undefined) {
      return label;
    }
  }
  return null;
}

// Confidence bucket system

function getConfidenceBucket(conf?: { high?: unknown; medium?: unknown; low?: unknown }): ConfidenceBucket | null {
  if (!conf) {
    return null;
  }
  if (conf.high !== undefined) {
    return "high";
  }
  if (conf.medium !== undefined) {
    return "medium";
  }
  if (conf.low !== undefined) {
    return "low";
  }
  return null;
}

function bumpConfidence(counts: ObjectConfidenceCounts, type: string, bucket: ConfidenceBucket): void {
  const confidenceZeroValue = 0;
  const defaultCounts: [number, number, number] = [confidenceZeroValue, confidenceZeroValue, confidenceZeroValue];
  counts[type] ??= defaultCounts;
  counts[type][BUCKET_INDEX[bucket]]++;
}

// Generic reducers

function countByKey(
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

function mergeCountMaps(
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

// Conversion helpers

function convertAll(values: number[], from: convert.Unit, to: convert.Unit): number[] {
  return values.map((v) => convert(v).from(from).to(to));
}

// Public API

/**
 * Extracts object confidence counts from raw scan files.
 * Counts objects by type and confidence level (high, medium, low).
 */
export function getObjectConfidenceCounts(artifactDirs: string[]): ObjectConfidenceCounts {
  const counts: ObjectConfidenceCounts = {};

  forEachRawScan(artifactDirs, (rawScan) => {
    for (const obj of rawScan.objects) {
      const type = getObjectTypeFromCategory(obj.category as Record<string, unknown>);
      const bucket = getConfidenceBucket(obj.confidence as { high?: unknown; medium?: unknown; low?: unknown });
      if (type !== null && bucket !== null) {
        bumpConfidence(counts, type, bucket);
      }
    }

    for (const door of rawScan.doors) {
      const bucket = getConfidenceBucket(door.confidence as { high?: unknown; medium?: unknown; low?: unknown });
      if (bucket !== null) {
        bumpConfidence(counts, "Door", bucket);
      }
    }

    for (const window of rawScan.windows) {
      const bucket = getConfidenceBucket(window.confidence as { high?: unknown; medium?: unknown; low?: unknown });
      if (bucket !== null) {
        bumpConfidence(counts, "Window", bucket);
      }
    }

    for (const opening of rawScan.openings) {
      const bucket = getConfidenceBucket(
        opening.confidence as { high?: unknown; medium?: unknown; low?: unknown } | undefined
      );
      if (bucket !== null) {
        bumpConfidence(counts, "Opening", bucket);
      }
    }
  });

  return counts;
}

/**
 * Finds artifact directories containing raw scans with unexpected versions.
 */
export function getUnexpectedVersionArtifactDirs(artifactDirs: string[]): Set<string> {
  const out = new Set<string>();
  const expectedVersion = 2;

  forEachRawScan(artifactDirs, (rawScan, dir) => {
    if (rawScan.version !== expectedVersion) {
      out.add(dir);
    }
  });

  return out;
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

// Metadata collection functions (one-liners)

export const getWindowAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowAreas);
export const getDoorAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorAreas);
export const getOpeningAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingAreas);
export const getWallAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallAreas);

export const getTubLengths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.tubLengths);
export const getVanityLengths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.vanityLengths);

export const getWallHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallHeights);
export const getWallWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallWidths);

export const getWallWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallWidthHeightPairs);
export const getDoorWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorWidthHeightPairs);
export const getWindowWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowWidthHeightPairs);
export const getOpeningWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingWidthHeightPairs);

export const getWindowHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowHeights);
export const getWindowWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowWidths);
export const getDoorHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorHeights);
export const getDoorWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorWidths);
export const getOpeningHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingHeights);
export const getOpeningWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingWidths);

export const getFloorLengths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.floorLengths);
export const getFloorWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.floorWidths);
export const getFloorWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.floorWidthHeightPairs);

// Conversion functions

export const convertAreasToSquareFeet = (a: number[]) => convertAll(a, "m2", "ft2");
export const convertLengthsToFeet = (l: number[]) => convertAll(l, "m", "ft");
export const convertLengthsToInches = (l: number[]) => convertAll(l, "m", "in");

// Aggregation functions

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
