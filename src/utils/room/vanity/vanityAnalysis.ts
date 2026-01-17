import { RawScan } from "../../../models/rawScan/rawScan";
import { ObjectItem } from "../../../models/rawScan/objectItem";
import { Point } from "../../../models/point";
import { Wall } from "../../../models/rawScan/wall";
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
  isCornerVanity: boolean;
}

const DIM_X = 0;
const DIM_Z = 2;
const HALF_DIVISOR = 2;
const DEFAULT_DIM = 0;
const INVALID_DIMENSION = 0;
const DIM_SIZE = 3;
const TOLERANCE = 0.0254; // 1 inch
const DIMENSION_INDEX_LENGTH = 0;
const MIN_VALUE = 0;

// Corner vanity detection constants
const CORNER_ANGLE_THRESHOLD_DEGREES = 15; // Angle tolerance for considering edges parallel
const WALL_PROXIMITY_THRESHOLD_METERS = 0.3; // ~12 inches - how close vanity must be to wall
const DEFAULT_FORWARD_Y = -1;
const DOT_CLAMP_MIN = -1;
const DOT_CLAMP_MAX = 1;
const DEFAULT_EDGE_X = 1;
const DEFAULT_EDGE_Y = 0;
const MIN_RECTANGLE_CORNERS = 4;
const NO_NEARBY_WALLS = 0;
const NEXT_INDEX_OFFSET = 1;
const DEFAULT_COORD = 0;

/**
 * Extracts the forward direction (Z-axis) from a 4x4 transform matrix, projected onto the XZ plane.
 * Returns a normalized 2D vector as a Point.
 */
function getForwardDirection(transform: number[]): Point {
  const forwardXIdx = 8;
  const forwardZIdx = 10;
  const defaultValue = 0;

  if (transform.length !== TRANSFORM_SIZE) {
    return new Point(defaultValue, DEFAULT_FORWARD_Y);
  }

  const fx = transform[forwardXIdx] ?? defaultValue;
  const fz = transform[forwardZIdx] ?? defaultValue;

  const fxSquared = fx * fx;
  const fzSquared = fz * fz;
  const magnitude = Math.sqrt(fxSquared + fzSquared);
  const minMagnitude = 0.0001;
  if (magnitude < minMagnitude) {
    return new Point(defaultValue, DEFAULT_FORWARD_Y);
  }

  return new Point(fx / magnitude, fz / magnitude);
}

/**
 * Calculates the angle in degrees between two 2D vectors (Points).
 * Returns an angle between 0 and 90 degrees (absolute difference).
 */
function angleBetweenVectors(v1: Point, v2: Point): number {
  const v1xv2x = v1.x * v2.x;
  const v1yv2y = v1.y * v2.y;
  const dot = v1xv2x + v1yv2y;
  const clampedDot = Math.max(DOT_CLAMP_MIN, Math.min(DOT_CLAMP_MAX, dot));
  const angleRadians = Math.acos(Math.abs(clampedDot));
  const degreesInSemicircle = 180;
  return (angleRadians * degreesInSemicircle) / Math.PI;
}

/**
 * Returns the direction vector of an edge defined by two points.
 * The vector is normalized.
 */
function getEdgeDirection(p1: Point, p2: Point): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dxSquared = dx * dx;
  const dySquared = dy * dy;
  const magnitude = Math.sqrt(dxSquared + dySquared);
  const minMagnitude = 0.0001;
  if (magnitude < minMagnitude) {
    return new Point(DEFAULT_EDGE_X, DEFAULT_EDGE_Y);
  }
  return new Point(dx / magnitude, dy / magnitude);
}

/**
 * Calculates the minimum distance from a point to a wall's closest edge.
 * Uses the wall's transform position and dimensions.
 */
function distanceToWall(point: Point, wall: Wall): number {
  if (wall.transform === undefined) {
    return Number.MAX_VALUE;
  }
  if (wall.transform.length !== TRANSFORM_SIZE) {
    return Number.MAX_VALUE;
  }

  const txIdx = 12;
  const tzIdx = 14;
  const wallCenter = new Point(wall.transform[txIdx] ?? DEFAULT_COORD, wall.transform[tzIdx] ?? DEFAULT_COORD);

  const dx = point.x - wallCenter.x;
  const dy = point.y - wallCenter.y;
  const dxSquared = dx * dx;
  const dySquared = dy * dy;
  return Math.sqrt(dxSquared + dySquared);
}

/**
 * Determines if a vanity is a corner vanity by checking if any of its edges
 * are parallel to nearby walls. A corner vanity has its back at an angle to
 * the walls rather than being flush against a single wall.
 */
function detectCornerVanity(vanityCorners: Point[], walls: Wall[]): boolean {
  if (vanityCorners.length < MIN_RECTANGLE_CORNERS) {
    return false;
  }

  // Calculate vanity center
  let centerX = 0;
  let centerY = 0;
  for (const corner of vanityCorners) {
    centerX += corner.x;
    centerY += corner.y;
  }
  const vanityCenter = new Point(centerX / vanityCorners.length, centerY / vanityCorners.length);

  // Find walls that are close to the vanity
  const nearbyWalls: Wall[] = [];
  for (const wall of walls) {
    const distance = distanceToWall(vanityCenter, wall);
    if (distance < WALL_PROXIMITY_THRESHOLD_METERS) {
      nearbyWalls.push(wall);
    }
  }

  // If no nearby walls, use all walls but with a more generous threshold
  const wallsToCheck = nearbyWalls.length > NO_NEARBY_WALLS ? nearbyWalls : walls;

  // Get all edge directions of the vanity (4 edges for a rectangle)
  const edgeDirections: Point[] = [];
  for (let i = 0; i < vanityCorners.length; i++) {
    const cornerStart = vanityCorners[i];
    const cornerEnd = vanityCorners[(i + NEXT_INDEX_OFFSET) % vanityCorners.length];
    if (cornerStart !== undefined && cornerEnd !== undefined) {
      edgeDirections.push(getEdgeDirection(cornerStart, cornerEnd));
    }
  }

  // For each wall, check if any vanity edge is parallel to it
  for (const wall of wallsToCheck) {
    if (wall.transform === undefined) {
      continue;
    }

    // Wall's forward direction gives us the wall normal
    // The wall's edge direction is perpendicular to the normal
    const wallNormal = getForwardDirection(wall.transform);
    // Wall edge direction is 90 degrees rotated from normal
    const wallEdgeDirection = new Point(-wallNormal.y, wallNormal.x);

    for (const edgeDir of edgeDirections) {
      const angle = angleBetweenVectors(edgeDir, wallEdgeDirection);
      if (angle < CORNER_ANGLE_THRESHOLD_DEGREES) {
        // Found an edge parallel to a wall - this is a regular vanity
        return false;
      }
    }
  }

  // No edge is parallel to any nearby wall - this is a corner vanity
  return true;
}

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
      obj.dimensions.every((d) => d === INVALID_DIMENSION) ||
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

    const minInnerDimension = 0;
    const innerHalfW = Math.max(minInnerDimension, halfW - TOLERANCE);
    const innerHalfD = Math.max(minInnerDimension, halfD - TOLERANCE);
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

  const firstSinkIndex = 0;
  const noObjects = 0;
  // If no intersection, prefer sink, then largest storage
  if (selectedStorage === null && sinks.length > noObjects) {
    const firstSink = sinks[firstSinkIndex];
    if (firstSink !== undefined) {
      selectedStorage = firstSink;
    }
  } else if (selectedStorage === null && storages.length > noObjects) {
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
    } else {
      const hasSinks = sinks.length > noObjects;
      if (hasSinks) {
        vanityType = "sink only";
      } else {
        vanityType = "storage only";
      }
    }
  }

  // Determine if it's a corner vanity
  let isCornerVanity = false;
  if (selectedStorage !== null) {
    // Find the object box for the selected vanity
    const vanityBox = objectBoxes.find((box) => box.object === selectedStorage);
    if (vanityBox !== undefined) {
      isCornerVanity = detectCornerVanity(vanityBox.corners, rawScan.walls);
    }
  }

  return {
    isCornerVanity,
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

/**
 * Determines the vanity placement for a raw scan.
 * Returns: "regular" for a vanity flush against a wall,
 *          "corner" for a vanity placed diagonally in a corner,
 *          or null if there is no vanity.
 */
export function getVanityPlacement(rawScan: RawScan): "regular" | "corner" | null {
  const candidate = findVanityCandidate(rawScan);
  if (candidate.selectedObject === null) {
    return null;
  }
  return candidate.isCornerVanity ? "corner" : "regular";
}
