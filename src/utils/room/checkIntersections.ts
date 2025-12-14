import { Point } from "../../models/point";
import { RawScan } from "../../models/rawScan/rawScan";
import { EPSILON, TRANSFORM_SIZE } from "../math/constants";
import { doPolygonsIntersect } from "../math/polygon";
import { transformPoint } from "../math/transform";
import { crossProduct, dotProduct, magnitudeSquared, subtract } from "../math/vector";

// Helper: Check for Object Intersections (Object-Object and Wall-Object)
function checkObjectIntersectionsInternal(rawScan: RawScan): {
  hasObjectIntersectionErrors: boolean;
  hasWallObjectIntersectionErrors: boolean;
} {
  let wallObjIntersectionFound = false;
  const objects = rawScan.objects;
  let objIntersectionFound = false;

  // Pre-calculate AABBs
  const objAABBs: {
    isSink: boolean;
    isStorage: boolean;
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
    corners: Point[];
    innerCorners: Point[];
    story: number;
  }[] = [];

  const TOLERANCE = 0.0254; // 1 inch
  const DIM_X = 0;
  const DIM_Z = 2;
  const HALF = 2;
  const DEFAULT_DIM = 0;

  const INIT_COORD = 0;
  const ZERO = 0;
  const DIM_SIZE = 3;
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const MIN_ITEMS = 0;

  for (const o of objects) {
    // Check for degenerate dimensions (Zero Volume)
    if (o.dimensions.every((d) => d === ZERO)) {
      objAABBs.push({
        corners: [],
        innerCorners: [],
        isSink: false,
        isStorage: false,
        maxX: INIT_COORD,
        maxZ: INIT_COORD,
        minX: INIT_COORD,
        minZ: INIT_COORD,
        story: o.story
      });
      continue;
    }

    if (o.transform.length !== TRANSFORM_SIZE || o.dimensions.length !== DIM_SIZE) {
      objAABBs.push({
        corners: [],
        innerCorners: [],
        isSink: false,
        isStorage: false,
        maxX: INIT_COORD,
        maxZ: INIT_COORD,
        minX: INIT_COORD,
        minZ: INIT_COORD,
        story: o.story
      }); // Empty/Invalid
      continue;
    }

    const halfW = (o.dimensions[DIM_X] ?? DEFAULT_DIM) / HALF;
    const halfD = (o.dimensions[DIM_Z] ?? DEFAULT_DIM) / HALF;

    // Local corners (y is ignored for floor plan)
    const corners = [
      new Point(-halfW, -halfD),
      new Point(halfW, -halfD),
      new Point(halfW, halfD),
      new Point(-halfW, halfD)
    ];

    // Inner corners (shrunk by tolerance)
    const innerHalfW = Math.max(ZERO, halfW - TOLERANCE);
    const innerHalfD = Math.max(ZERO, halfD - TOLERANCE);
    const innerCornersLocal = [
      new Point(-innerHalfW, -innerHalfD),
      new Point(innerHalfW, -innerHalfD),
      new Point(innerHalfW, innerHalfD),
      new Point(-innerHalfW, innerHalfD)
    ];

    let minX = Number.MAX_VALUE;
    let minZ = Number.MAX_VALUE;
    let maxX = -Number.MAX_VALUE;
    let maxZ = -Number.MAX_VALUE;

    const worldCorners = corners.map((c) => transformPoint(c, o.transform));

    for (const worldP of worldCorners) {
      if (worldP.x < minX) {
        minX = worldP.x;
      }
      if (worldP.x > maxX) {
        maxX = worldP.x;
      }
      if (worldP.y < minZ) {
        minZ = worldP.y;
      }
      if (worldP.y > maxZ) {
        maxZ = worldP.y;
      }
    }

    objAABBs.push({
      corners: worldCorners,
      innerCorners: innerCornersLocal.map((c) => {
        return transformPoint(c, o.transform);
      }),
      isSink: o.category.sink !== undefined,
      isStorage: o.category.storage !== undefined,
      maxX,
      maxZ,
      minX,
      minZ,
      story: o.story
    });
  }

  // Object-Object Intersection
  for (let i = 0; i < objects.length; i++) {
    const boxA = objAABBs[i];
    if (!boxA) {
      continue;
    }
    if (boxA.corners.length === ZERO) {
      continue;
    }

    const NEXT_IDX = 1;
    for (let j = i + NEXT_IDX; j < objects.length; j++) {
      const boxB = objAABBs[j];
      if (!boxB) {
        continue;
      }
      if (boxB.corners.length === ZERO) {
        continue;
      }

      // Check Story
      if (boxA.story !== boxB.story) {
        continue;
      }

      // Exclude Sink <-> Storage
      if ((boxA.isSink && boxB.isStorage) || (boxA.isStorage && boxB.isSink)) {
        continue;
      }

      // AABB Check
      if (boxA.maxX < boxB.minX || boxA.minX > boxB.maxX || boxA.maxZ < boxB.minZ || boxA.minZ > boxB.maxZ) {
        continue;
      }

      // Polygons Intersect Check (SAT) using Inner Corners
      const intersects = doPolygonsIntersect(boxA.innerCorners, boxB.innerCorners);
      if (intersects) {
        objIntersectionFound = true;
        break;
      }
    }
    if (objIntersectionFound) {
      break;
    }
  }

  // Wall-Object Intersection
  for (const w of rawScan.walls) {
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    const DIM_LEN_IDX = 0;
    const DIM_THICK_IDX = 2;
    const THICKNESS_DEFAULT = 0.15; // 15cm approx if missing
    const halfLen = (w.dimensions?.[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
    const halfThick = (w.dimensions?.[DIM_THICK_IDX] ?? THICKNESS_DEFAULT) / HALF_DIVISOR;

    const wallFootprintLocal = [
      new Point(-halfLen, -halfThick),
      new Point(halfLen, -halfThick),
      new Point(halfLen, halfThick),
      new Point(-halfLen, halfThick)
    ];

    const wallPolyWorld: Point[] = [];
    for (const p of wallFootprintLocal) {
      // p.y is Local Z (Thickness)
      wallPolyWorld.push(transformPoint(new Point(p.x, p.y), w.transform));
    }

    // Check Intersection with Objects
    for (const box of objAABBs) {
      if (box.innerCorners.length === MIN_ITEMS) {
        continue;
      }
      if (w.story !== box.story) {
        continue;
      }
      if (doPolygonsIntersect(wallPolyWorld, box.innerCorners)) {
        wallObjIntersectionFound = true;
        break;
      }
    }
    if (wallObjIntersectionFound) {
      break;
    }
  }

  return {
    hasObjectIntersectionErrors: objIntersectionFound,
    hasWallObjectIntersectionErrors: wallObjIntersectionFound
  };
}

// Helper: Check for Wall-Wall Intersections (Non-End/Corner)
function checkWallIntersectionsInternal(rawScan: RawScan): boolean {
  const MIN_POLY_POINTS = 0;
  const DEFAULT_VALUE = 0;
  const MIN_ITEMS = 0;
  const HALF_DIVISOR = 2;
  const OFFSET_NEXT = 1;
  const UNIT_ONE = 1;

  // We need 2D Segments of Walls' center-lines.
  const wallSegments = rawScan.walls
    .map((w, i) => {
      if (w.transform?.length === TRANSFORM_SIZE) {
        let p1Local: Point | null = null;
        let p2Local: Point | null = null;
        // 1. Try PolygonCorners (Preferred)
        const wPolySafe = w as unknown as { polygonCorners?: number[][] };
        if (wPolySafe.polygonCorners !== undefined && wPolySafe.polygonCorners.length >= MIN_POLY_POINTS) {
          // Find min/max X in local space
          let minX = Number.MAX_VALUE;
          let maxX = -Number.MAX_VALUE;
          const PT_X_IDX = 0;

          // Safe Check for Corners Loop
          if (w.polygonCorners !== undefined) {
            for (const p of w.polygonCorners) {
              const val = p[PT_X_IDX] ?? DEFAULT_VALUE;
              if (val < minX) {
                minX = val;
              }
              if (val > maxX) {
                maxX = val;
              }
            }
          }
          // Avoid tiny walls? Original code didn't filter them.
          const ZERO = 0;
          if (maxX > minX) {
            p1Local = new Point(minX, ZERO);
            p2Local = new Point(maxX, ZERO);
          }
        }

        // 2. Fallback to Dimensions
        if (p1Local === null) {
          const wSafe = w as unknown as { dimensions?: number[] };
          if (wSafe.dimensions !== undefined && wSafe.dimensions.length > MIN_ITEMS) {
            const DIM_LEN_IDX = 0;
            const ZERO = 0;
            const halfLen = (wSafe.dimensions[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
            p1Local = new Point(-halfLen, ZERO);
            p2Local = new Point(halfLen, ZERO);
          }
        }

        if (p1Local !== null && p2Local !== null) {
          const p1 = transformPoint(p1Local, w.transform);
          const p2 = transformPoint(p2Local, w.transform);
          return { p1, p2, story: w.story, wallIndex: i }; // Changed wallIndex to i
        }
      }
      return null;
    })
    .filter((s) => s !== null) as { p1: Point; p2: Point; story: number; wallIndex: number }[];

  let wallIntersectErr = false;
  // Check pair-wise
  for (let i = 0; i < wallSegments.length; i++) {
    for (let j = i + OFFSET_NEXT; j < wallSegments.length; j++) {
      const s1 = wallSegments[i];
      const s2 = wallSegments[j];

      if (!s1 || !s2) {
        continue;
      }
      if (s1.story !== s2.story) {
        continue;
      }

      // proper intersection check (excluding endpoints)
      // https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
      const x1 = s1.p1.x;
      const y1 = s1.p1.y;
      const x2 = s1.p2.x;
      const y2 = s1.p2.y;
      const x3 = s2.p1.x;
      const y3 = s2.p1.y;
      const x4 = s2.p2.x;
      const y4 = s2.p2.y;

      const term1 = (x1 - x2) * (y3 - y4);
      const term2 = (y1 - y2) * (x3 - x4);
      const den = term1 - term2;
      if (Math.abs(den) < EPSILON) {
        // Parallel. Check for collinear overlap.
        // Area of triangle P1,P2,P3
        const area = Math.abs(crossProduct(subtract(s1.p2, s1.p1), subtract(s2.p1, s1.p1)));

        // If "area" is small, checks collinearity.
        const COLLINEAR_TOLERANCE = 1e-5; // Tolerance for collinearity (distance).
        if (area > COLLINEAR_TOLERANCE) {
          continue; // Parallel but separated
        }

        // Collinear. Check for Overlap.
        // Create 1D projection onto Line(P1-P2).
        // Parametric T for P3 on P1-P2: Use Dot Product.
        const dot11 = magnitudeSquared(subtract(s1.p2, s1.p1));
        if (dot11 < EPSILON) {
          continue; // Zero length segment?
        }

        const getT = (px: number, py: number): number => {
          const p = new Point(px, py);
          return dotProduct(subtract(p, s1.p1), subtract(s1.p2, s1.p1)) / dot11;
        };

        /*
                   S1 is T=[0, 1].
                   S2 (P3..P4). Compute T3, T4.
                   Check if Interval [0, 1] overlaps Interval [T3, T4].
                */
        const t3 = getT(x3, y3);
        const t4 = getT(x4, y4);

        const minT = Math.min(t3, t4);
        const maxT = Math.max(t3, t4);

        // Overlap Condition:
        // [0, 1] intersects [minT, maxT].
        // max(0, minT) < min(1, maxT)
        // STRICT inequality to exclude just touching endpoints (Corner joins).
        const ZERO_LIMIT = 0;
        const ONE_LIMIT = 1;
        const overlapStart = Math.max(ZERO_LIMIT, minT);
        const overlapEnd = Math.min(ONE_LIMIT, maxT);

        // Use tolerance to ignore endpoint-only connections.
        const OVERLAP_EPS = 1e-5;
        if (overlapEnd - overlapStart > OVERLAP_EPS) {
          wallIntersectErr = true;
          break;
        }

        continue;
      }

      const numTTerm1 = (x1 - x3) * (y3 - y4);
      const numTTerm2 = (y1 - y3) * (x3 - x4);
      const numT = numTTerm1 - numTTerm2;

      const numUTerm1 = (x1 - x2) * (y1 - y3);
      const numUTerm2 = (y1 - y2) * (x1 - x3);
      const numU = -(numUTerm1 - numUTerm2);
      const t = numT / den;
      const u = numU / den;

      // Relaxed slightly to exclude valid corners (endpoints) and floating point noise.
      const LOW = 0.00001; // 0.001% buffer
      const HIGH = UNIT_ONE - LOW;

      const tInternal = t > LOW && t < HIGH;
      const uInternal = u > LOW && u < HIGH;

      // Error if BOTH are internal (X-crossing).
      if (tInternal && uInternal) {
        wallIntersectErr = true;
        break;
      }
    }
    if (wallIntersectErr) {
      break;
    }
  }

  return wallIntersectErr;
}

// Unified Intersection Check
export function checkIntersections(rawScan: RawScan): {
  hasObjectIntersectionErrors: boolean;
  hasWallObjectIntersectionErrors: boolean;
  hasWallWallIntersectionErrors: boolean;
} {
  const objRes = checkObjectIntersectionsInternal(rawScan);
  const wallRes = checkWallIntersectionsInternal(rawScan);
  return {
    hasObjectIntersectionErrors: objRes.hasObjectIntersectionErrors,
    hasWallObjectIntersectionErrors: objRes.hasWallObjectIntersectionErrors,
    hasWallWallIntersectionErrors: wallRes
  };
}
