import * as fs from "fs";
import * as path from "path";

import { ArData } from "../../models/arData/arData";
import type { ObjectCategory } from "../../models/rawScan/objectItem";
import { RawScan } from "../../models/rawScan/rawScan";
import { buildValidFrames, getSortedTimestamps } from "../arData/metadata/framerateMetrics";
import { TRANSFORM_SIZE } from "../math/constants";
import { type Position3D, dotProduct3D, getForward3D, getPosition3D, normalize3D } from "../math/transform";

export type ObjectCategoryKey = keyof ObjectCategory;

export const OBJECT_CATEGORY_KEYS: ObjectCategoryKey[] = [
  "bathtub",
  "bed",
  "chair",
  "dishwasher",
  "fireplace",
  "oven",
  "refrigerator",
  "sink",
  "sofa",
  "stairs",
  "storage",
  "stove",
  "table",
  "television",
  "toilet",
  "washerDryer"
];

export const OBJECT_CATEGORY_DISPLAY_NAMES: Record<ObjectCategoryKey, string> = {
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

// Exported for targeted testing of frame spacing edge cases.
export function computeMedianFrameDeltaSeconds(sortedTimestamps: number[]): number {
  const minIntervalsForMedian = 2;
  const fallbackFps = 30;
  const oneSecond = 1;
  const fallbackDelta = oneSecond / fallbackFps;
  const nextIndexOffset = 1;
  const midpointDivisor = 2;
  const emptyLength = 0;
  const firstIndex = 0;

  if (sortedTimestamps.length < minIntervalsForMedian) {
    return fallbackDelta;
  }
  const deltas: number[] = [];
  for (let i = firstIndex; i < sortedTimestamps.length - nextIndexOffset; i++) {
    const curr = sortedTimestamps[i];
    const next = sortedTimestamps[i + nextIndexOffset];
    if (curr !== undefined && next !== undefined) {
      deltas.push(next - curr);
    }
  }
  if (deltas.length === emptyLength) {
    return fallbackDelta;
  }
  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / midpointDivisor);
  const median = sorted[mid];
  return median ?? fallbackDelta;
}

/**
 * Returns true when the object position is within the camera view cone
 * (60° half-angle). Uses dot(forward, toTarget) >= 0.5 as the threshold.
 */
function isObjectInView(cameraPos: Position3D, forward: Position3D, targetPos: Position3D): boolean {
  const toTarget: Position3D = {
    x: targetPos.x - cameraPos.x,
    y: targetPos.y - cameraPos.y,
    z: targetPos.z - cameraPos.z
  };
  const normalized = normalize3D(toTarget);
  const dot = dotProduct3D(forward, normalized);
  const viewConeDotThreshold = 0.5;
  return dot >= viewConeDotThreshold;
}

function hasCategory(obj: { category: ObjectCategory }, key: ObjectCategoryKey): boolean {
  return (obj.category[key] as unknown) !== undefined;
}

/**
 * Computes view time for all object categories from a single artifact directory.
 * Reads rawScan.json and arData.json once, then calculates view time for each
 * category that has objects. Returns a partial record with only categories that
 * have objects in this scan.
 */
function computeAllViewTimesForArtifact(dirPath: string): Partial<Record<ObjectCategoryKey, number>> {
  const rawScanPath = path.join(dirPath, "rawScan.json");
  const arDataPath = path.join(dirPath, "arData.json");
  if (!fs.existsSync(rawScanPath) || !fs.existsSync(arDataPath)) {
    return {};
  }

  let parsed: { arData: ArData; rawScan: RawScan } | null = null;
  try {
    const rawJson = JSON.parse(fs.readFileSync(rawScanPath, "utf-8")) as unknown;
    const arJson = JSON.parse(fs.readFileSync(arDataPath, "utf-8")) as unknown;
    parsed = {
      arData: new ArData(arJson),
      rawScan: new RawScan(rawJson)
    };
  } catch {
    return {};
  }
  const { arData, rawScan } = parsed as { arData: ArData; rawScan: RawScan };

  const emptyLength = 0;
  const positionsByCategory: Partial<Record<ObjectCategoryKey, Position3D[]>> = {};
  for (const key of OBJECT_CATEGORY_KEYS) {
    const objects = rawScan.objects.filter((o) => hasCategory(o, key));
    if (objects.length === emptyLength) {
      continue;
    }
    const positions = objects
      .filter((o) => Array.isArray(o.transform) && o.transform.length === TRANSFORM_SIZE)
      .map((o) => getPosition3D(o.transform));
    if (positions.length > emptyLength) {
      positionsByCategory[key] = positions;
    }
  }

  const categoriesWithObjects = Object.keys(positionsByCategory) as ObjectCategoryKey[];
  if (categoriesWithObjects.length === emptyLength) {
    return {};
  }

  const sortedTimestamps = getSortedTimestamps(arData);
  const validFrames = buildValidFrames(arData, sortedTimestamps);
  const minFramesForDuration = 2;
  if (validFrames.length < minFramesForDuration) {
    const result: Partial<Record<ObjectCategoryKey, number>> = {};
    const noDuration = 0;
    for (const key of categoriesWithObjects) {
      result[key] = noDuration;
    }
    return result;
  }

  const medianDeltaSeconds = computeMedianFrameDeltaSeconds(sortedTimestamps);
  const totalsByCategory: Record<string, number> = {};
  const initialTotalSeconds = 0;
  for (const key of categoriesWithObjects) {
    totalsByCategory[key] = initialTotalSeconds;
  }

  const nextIndexOffset = 1;
  const lastFrameIndex = validFrames.length - nextIndexOffset;
  const firstIndex = 0;

  for (let i = firstIndex; i < validFrames.length; i++) {
    const frame = validFrames[i];
    if (frame === undefined) {
      continue;
    }
    const cameraPos = getPosition3D(frame.cameraTransform);
    const forward = getForward3D(frame.cameraTransform);
    const isLast = i === lastFrameIndex;
    const deltaSeconds = isLast
      ? medianDeltaSeconds
      : (validFrames[i + nextIndexOffset]?.timestamp ?? frame.timestamp) - frame.timestamp;
    const minDelta = 0;
    const clampedDelta = Math.max(minDelta, deltaSeconds);

    for (const key of categoriesWithObjects) {
      const positions = positionsByCategory[key] ?? [];
      const anyInView = positions.some((p) => isObjectInView(cameraPos, forward, p));
      if (anyInView) {
        const currentTotal = totalsByCategory[key] ?? initialTotalSeconds;
        totalsByCategory[key] = currentTotal + clampedDelta;
      }
    }
  }

  const result: Partial<Record<ObjectCategoryKey, number>> = {};
  for (const key of categoriesWithObjects) {
    result[key] = totalsByCategory[key] ?? initialTotalSeconds;
  }
  return result;
}

/**
 * Collects "time with object type in view" (seconds) per scan for all object
 * categories across the given artifact directories. Reads each artifact once
 * and computes all category view times in a single pass. Returns a record
 * mapping each category to an array of per-scan view times (only for scans
 * that have objects of that category).
 */
export function collectAllObjectViewTimes(artifactDirs: string[]): Record<ObjectCategoryKey, number[]> {
  const result: Record<ObjectCategoryKey, number[]> = {
    bathtub: [],
    bed: [],
    chair: [],
    dishwasher: [],
    fireplace: [],
    oven: [],
    refrigerator: [],
    sink: [],
    sofa: [],
    stairs: [],
    storage: [],
    stove: [],
    table: [],
    television: [],
    toilet: [],
    washerDryer: []
  };

  for (const dir of artifactDirs) {
    const viewTimes = computeAllViewTimesForArtifact(dir);
    for (const key of OBJECT_CATEGORY_KEYS) {
      const seconds = viewTimes[key];
      if (seconds !== undefined) {
        result[key].push(seconds);
      }
    }
  }

  return result;
}

/**
 * Computes the total time (seconds) the user spent with any object of the
 * given category in view for a single scan. Combines rawScan.json (object
 * positions) and arData.json (camera poses over time). Returns null if the
 * artifact has no objects of that category, no arData, or invalid data.
 */
export function computeObjectViewTimeSeconds(dirPath: string, categoryKey: ObjectCategoryKey): number | null {
  const viewTimes = computeAllViewTimesForArtifact(dirPath);
  const seconds = viewTimes[categoryKey];
  return seconds ?? null;
}

/**
 * Collects "time with object type in view" (seconds) per scan for the given
 * artifact directories and object category. Skips artifacts with no objects
 * of that category or no arData; the returned array has one value per scan
 * that has both.
 */
export function collectObjectViewTimePerScan(artifactDirs: string[], categoryKey: ObjectCategoryKey): number[] {
  const allViewTimes = collectAllObjectViewTimes(artifactDirs);
  return allViewTimes[categoryKey];
}
