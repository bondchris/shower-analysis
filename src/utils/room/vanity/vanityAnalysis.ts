import { RawScan } from "../../../models/rawScan/rawScan";
import { ObjectItem } from "../../../models/rawScan/objectItem";
import { Point } from "../../../models/point";
import { TRANSFORM_SIZE } from "../../math/constants";
import { doPolygonsIntersect } from "../../math/polygon";
import { transformPoint } from "../../math/transform";

export interface ObjectBoundingBox {
  corners: Point[];
  innerCorners: Point[];
  isSink: boolean;
  isStorage: boolean;
  object: ObjectItem;
  story: number;
}

export interface VanityCandidate {
  selectedObject: ObjectItem | null;
  vanityType: "normal" | "sink only" | "storage only" | "no vanity";
}

const DIM_X = 0;
const DIM_Z = 2;
const HALF_DIVISOR = 2;
const DEFAULT_DIM = 0;
const ZERO = 0;
const DIM_SIZE = 3;
const TOLERANCE = 0.0254; // 1 inch
const DIMENSION_INDEX_LENGTH = 0;
const MIN_VALUE = 0;

/**
 * Builds bounding boxes for all objects in a raw scan that are sinks or storages.
 * Returns boxes with world-space corners and inner corners (with tolerance).
 */
export function buildObjectBoxes(rawScan: RawScan): ObjectBoundingBox[] {
  const objectBoxes: ObjectBoundingBox[] = [];

  for (const obj of rawScan.objects) {
    const isSink = obj.category.sink !== undefined;
    const isStorage = obj.category.storage !== undefined;

    if (
      obj.dimensions.every((d) => d === ZERO) ||
      obj.transform.length !== TRANSFORM_SIZE ||
      obj.dimensions.length !== DIM_SIZE
    ) {
      continue;
    }

    const halfW = (obj.dimensions[DIM_X] ?? DEFAULT_DIM) / HALF_DIVISOR;
    const halfD = (obj.dimensions[DIM_Z] ?? DEFAULT_DIM) / HALF_DIVISOR;

    const corners = [
      new Point(-halfW, -halfD),
      new Point(halfW, -halfD),
      new Point(halfW, halfD),
      new Point(-halfW, halfD)
    ];

    const innerHalfW = Math.max(ZERO, halfW - TOLERANCE);
    const innerHalfD = Math.max(ZERO, halfD - TOLERANCE);
    const innerCornersLocal = [
      new Point(-innerHalfW, -innerHalfD),
      new Point(innerHalfW, -innerHalfD),
      new Point(innerHalfW, innerHalfD),
      new Point(-innerHalfW, innerHalfD)
    ];

    const worldCorners = corners.map((c) => transformPoint(c, obj.transform));
    const worldInnerCorners = innerCornersLocal.map((c) => transformPoint(c, obj.transform));

    objectBoxes.push({
      corners: worldCorners,
      innerCorners: worldInnerCorners,
      isSink,
      isStorage,
      object: obj,
      story: obj.story
    });
  }

  return objectBoxes;
}

/**
 * Finds the vanity candidate object and determines the vanity type.
 * Vanity detection logic:
 * 1. If there's a storage object intersecting with a sink, use that storage object (normal).
 * 2. If there's not, then look for a sink and use that (sink only).
 * 3. If there's no sink in the room at all, then look for the largest storage object (storage only).
 * 4. If there are no sink and no storage objects, then the room has no vanity (no vanity).
 */
export function findVanityCandidate(rawScan: RawScan): VanityCandidate {
  const objectBoxes = buildObjectBoxes(rawScan);
  const sinks: ObjectItem[] = [];
  const storages: ObjectItem[] = [];

  for (const obj of rawScan.objects) {
    if (obj.category.sink !== undefined) {
      sinks.push(obj);
    }
    if (obj.category.storage !== undefined) {
      storages.push(obj);
    }
  }

  // Find storage intersecting with sink (normal vanity)
  let selectedStorage: ObjectItem | null = null;

  for (const storageBox of objectBoxes) {
    if (!storageBox.isStorage) {
      continue;
    }

    for (const sinkBox of objectBoxes) {
      if (!sinkBox.isSink) {
        continue;
      }

      if (storageBox.story !== sinkBox.story) {
        continue;
      }

      if (doPolygonsIntersect(storageBox.innerCorners, sinkBox.innerCorners)) {
        selectedStorage = storageBox.object;
        break;
      }
    }

    if (selectedStorage !== null) {
      break;
    }
  }

  const FIRST_SINK_INDEX = 0;
  // If no intersection, prefer sink, then largest storage
  if (selectedStorage === null && sinks.length > ZERO) {
    const firstSink = sinks[FIRST_SINK_INDEX];
    if (firstSink !== undefined) {
      selectedStorage = firstSink;
    }
  } else if (selectedStorage === null && storages.length > ZERO) {
    const largestStorage = storages.reduce((largest, current) => {
      const largestArea = (largest.dimensions[DIM_X] ?? DEFAULT_DIM) * (largest.dimensions[DIM_Z] ?? DEFAULT_DIM);
      const currentArea = (current.dimensions[DIM_X] ?? DEFAULT_DIM) * (current.dimensions[DIM_Z] ?? DEFAULT_DIM);
      return currentArea > largestArea ? current : largest;
    });
    selectedStorage = largestStorage;
  }

  // Determine vanity type
  let vanityType: "normal" | "sink only" | "storage only" | "no vanity" = "no vanity";
  if (selectedStorage !== null) {
    // Check if we found an intersection (normal vanity)
    const hasStorageSinkIntersection = objectBoxes.some((storageBox) => {
      if (!storageBox.isStorage || storageBox.object !== selectedStorage) {
        return false;
      }
      return objectBoxes.some((sinkBox) => {
        if (!sinkBox.isSink) {
          return false;
        }
        if (storageBox.story !== sinkBox.story) {
          return false;
        }
        return doPolygonsIntersect(storageBox.innerCorners, sinkBox.innerCorners);
      });
    });

    if (hasStorageSinkIntersection) {
      vanityType = "normal";
    } else if (sinks.length > ZERO) {
      vanityType = "sink only";
    } else {
      vanityType = "storage only";
    }
  }

  return {
    selectedObject: selectedStorage,
    vanityType
  };
}

/**
 * Extracts vanity lengths from a raw scan.
 * Returns an array of lengths in meters.
 */
export function getVanityLengths(rawScan: RawScan): number[] {
  const vanityLengths: number[] = [];
  const candidate = findVanityCandidate(rawScan);

  if (candidate.selectedObject !== null && Array.isArray(candidate.selectedObject.dimensions)) {
    const length = candidate.selectedObject.dimensions[DIMENSION_INDEX_LENGTH];
    if (length !== undefined && length > MIN_VALUE) {
      vanityLengths.push(length);
    }
  }

  return vanityLengths;
}

/**
 * Determines the vanity type for a raw scan.
 * Returns: "normal", "sink only", "storage only", or "no vanity".
 */
export function getVanityType(rawScan: RawScan): "normal" | "sink only" | "storage only" | "no vanity" {
  return findVanityCandidate(rawScan).vanityType;
}
