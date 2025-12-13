import { RawScan } from "../models/rawScan/rawScan";
import { distToSegment, doPolygonsIntersect, transformPoint } from "./mathUtils";

// Helper: Check for External Openings (Wall on Floor Perimeter)
export function checkExternalOpening(rawScan: RawScan): boolean {
  const INITIAL_COUNT = 0;
  if (rawScan.floors.length <= INITIAL_COUNT) {
    return false;
  }
  const floor = rawScan.floors[INITIAL_COUNT];
  if (!floor) {
    return false;
  }
  const corners = floor.polygonCorners;
  const MIN_CORNERS = 3;

  if (!corners || corners.length < MIN_CORNERS) {
    return false;
  }

  const PERIMETER_THRESHOLD = 0.5;
  const TX_IDX = 12;
  const TY_IDX = 13;
  const MAT_SIZE = 16;
  const DEFAULT_COORD = 0;
  const X_IDX = 0;
  const Y_IDX = 1;
  const NEXT_IDX = 1;

  for (const o of rawScan.openings) {
    if (o.parentIdentifier === undefined || o.parentIdentifier === null) {
      continue;
    }
    // Check story (if present on object) against rawScan.story
    // If object has no story, we assume it's valid or relies on parent wall check.
    // User requirement: "Have a different story... Expect: false".
    if (o.story !== undefined && o.story !== rawScan.story) {
      continue;
    }

    const wall = rawScan.walls.find((w) => w.identifier === o.parentIdentifier);
    if (!wall || wall.transform?.length !== MAT_SIZE) {
      continue;
    }

    const wx = wall.transform[TX_IDX] ?? DEFAULT_COORD;
    const wy = wall.transform[TY_IDX] ?? DEFAULT_COORD;

    for (let i = 0; i < corners.length; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + NEXT_IDX) % corners.length];
      if (!p1 || !p2) {
        continue;
      }

      const dist = distToSegment(
        { x: wx, y: wy },
        { x: p1[X_IDX] ?? DEFAULT_COORD, y: p1[Y_IDX] ?? DEFAULT_COORD },
        { x: p2[X_IDX] ?? DEFAULT_COORD, y: p2[Y_IDX] ?? DEFAULT_COORD }
      );

      if (dist < PERIMETER_THRESHOLD) {
        return true;
      }
    }
  }
  return false;
}

// Helper: Check for Toilet Gaps (> 1 inch from wall)
export function checkToiletGaps(rawScan: RawScan): boolean {
  const toilets = rawScan.objects.filter((o) => o.category.toilet !== undefined);
  const walls = rawScan.walls;
  const TRANSFORM_SIZE = 16;
  const MIN_DIMENSIONS = 3;
  const Z_DIM_IDX = 2; // Dimensions[2] is Depth (Z) in local space
  const HALF_DIVISOR = 2;
  const GAP_THRESHOLD_METERS = 0.0254; // 1 inch
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;

  // Prepare Walls (Projected to 2D World X-Z plane)
  // We use `transformPoint` which maps {x, y} (Input: Local X, Z) -> {x, y} (Output: World X, Z).
  const roomWalls: { corners: { x: number; y: number }[] }[] = [];
  const MIN_CORNERS = 0;
  const MIN_POINT_SIZE = 2; // Defined here for scope access

  for (const w of walls) {
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    let pCorners = w.polygonCorners ?? [];
    const numCorners = pCorners.length;

    // Fallback to dimensions if no corners
    if (numCorners === MIN_CORNERS) {
      const DIM_LEN_IDX = 0; // Length is usually X
      const halfLen = (w.dimensions?.[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
      const ZERO_Z = 0;
      // Local wall segment along X axis
      pCorners = [
        [-halfLen, ZERO_Z],
        [halfLen, ZERO_Z]
      ];
    }

    const wallCornersWorld: { x: number; y: number }[] = [];
    const MIN_POINT_SIZE = 2;
    for (const p of pCorners) {
      if (p.length >= MIN_POINT_SIZE) {
        // Map Local (X, Z) -> transformPoint expects {x, y}
        const ptLocal = {
          x: p[PT_X_IDX] ?? DEFAULT_VALUE,
          y: p[PT_Z_IDX] ?? DEFAULT_VALUE // y is Local Z
        };

        const worldPt = transformPoint(ptLocal, w.transform);
        // Result worldPt is {x: WorldX, y: WorldZ}
        wallCornersWorld.push({ x: worldPt.x, y: worldPt.y });
      }
    }

    if (wallCornersWorld.length > MIN_CORNERS) {
      roomWalls.push({ corners: wallCornersWorld });
    }
  }

  /*
   * Logic:
   * Check strict "Backface" distance.
   * Assume "Back" is local -Z.
   * Distance > 1 inch -> Error.
   * No compatible walls -> Error.
   */

  let gapErrorFound = false;

  for (const toilet of toilets) {
    if (toilet.transform.length !== TRANSFORM_SIZE) {
      continue;
    }
    if (toilet.dimensions.length < MIN_DIMENSIONS) {
      // Cannot determine depth
      continue;
    }

    const halfDepth = (toilet.dimensions[Z_DIM_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;

    // Define Backface Point in Local Space (X, Z) -> {x, y}
    // Assume Back is -Z.
    const backfaceLocal = { x: 0, y: -halfDepth };

    const backfaceWorld = transformPoint(backfaceLocal, toilet.transform);
    // backfaceWorld is {x: WorldX, y: WorldZ}
    const backfacePos2D = backfaceWorld;

    let minBackfaceDist = Number.MAX_VALUE;
    let hasCompatibleWall = false;

    // TODO: Optimize this O(N*M) loop if necessary.
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) {
        continue;
      }

      // Story Check
      if (w.story !== undefined && w.story !== toilet.story) {
        continue;
      }

      const rw = roomWalls[i];
      if (!rw || rw.corners.length < MIN_POINT_SIZE) {
        continue; // Need segment
      }

      hasCompatibleWall = true;

      const NEXT_IDX = 1;
      for (let j = 0; j < rw.corners.length; j++) {
        const p1 = rw.corners[j];
        const p2 = rw.corners[(j + NEXT_IDX) % rw.corners.length];
        if (!p1 || !p2) {
          continue;
        }

        const dist = distToSegment(backfacePos2D, p1, p2);
        if (dist < minBackfaceDist) {
          minBackfaceDist = dist;
        }
      }
    }

    // Evaluation
    if (!hasCompatibleWall) {
      // "Expect: fail (no eligible walls)"
      // Treat no walls as infinite gap -> Error.
      gapErrorFound = true;
    } else if (minBackfaceDist > GAP_THRESHOLD_METERS) {
      gapErrorFound = true;
    }

    if (gapErrorFound) {
      break;
    }
  }

  return gapErrorFound;
}

// Helper: Check for Tub Gaps (1" < gap < 6")
export function checkTubGaps(rawScan: RawScan): boolean {
  const tubs = rawScan.objects.filter((o) => o.category.bathtub !== undefined);
  const walls = rawScan.walls;

  const GAP_TUB_MIN = 0.0254; // 1 inch
  const GAP_TUB_MAX = 0.1524; // 6 inches
  const TRANSFORM_SIZE = 16;
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const DIM_X = 0;
  const DIM_Z = 2;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const NEXT_IDX = 1;
  const MIN_CORNERS = 0;

  // 1. Collect Wall Segments (World Space)
  const roomWalls: { corners: { x: number; y: number }[]; story?: number }[] = [];

  for (const w of walls) {
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    const wallCornersWorld: { x: number; y: number }[] = [];
    let pCorners = w.polygonCorners ?? [];
    const numCorners = pCorners.length;

    if (numCorners === MIN_CORNERS) {
      const DIM_LEN_IDX = 0;
      const halfLen = (w.dimensions?.[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
      const ZERO_Z = 0;
      pCorners = [
        [-halfLen, ZERO_Z],
        [halfLen, ZERO_Z]
      ];
    }

    for (const p of pCorners) {
      if (p.length >= MIN_POINT_SIZE) {
        wallCornersWorld.push(
          transformPoint({ x: p[PT_X_IDX] ?? DEFAULT_VALUE, y: p[PT_Z_IDX] ?? DEFAULT_VALUE }, w.transform)
        );
      }
    }

    const MIN_WALL_CORNERS = 2;
    if (wallCornersWorld.length < MIN_WALL_CORNERS) {
      continue;
    }
    roomWalls.push({ corners: wallCornersWorld, ...(w.story !== undefined ? { story: w.story } : {}) });
  }

  let tubGapErrorFound = false;

  for (const tub of tubs) {
    const halfW = (tub.dimensions[DIM_X] ?? DEFAULT_VALUE) / HALF_DIVISOR;
    const halfD = (tub.dimensions[DIM_Z] ?? DEFAULT_VALUE) / HALF_DIVISOR;
    const tubCornersLocal = [
      { x: -halfW, y: -halfD },
      { x: halfW, y: -halfD },
      { x: halfW, y: halfD },
      { x: -halfW, y: halfD }
    ];

    const tubCornersWorld = tubCornersLocal.map((p) => transformPoint(p, tub.transform));

    for (const rw of roomWalls) {
      const wallCornersWorld = rw.corners;
      if (rw.story !== undefined && rw.story !== tub.story) {
        continue;
      }
      let minDist = Number.MAX_VALUE;

      // 2a. Tub Corners -> Wall Segments
      for (const tc of tubCornersWorld) {
        for (let i = 0; i < wallCornersWorld.length; i++) {
          const p1 = wallCornersWorld[i] as { x: number; y: number } | undefined;
          const p2 = wallCornersWorld[(i + NEXT_IDX) % wallCornersWorld.length] as { x: number; y: number } | undefined;
          if (!p1 || !p2) {
            continue;
          }

          const d = distToSegment(tc, p1, p2);
          if (d < minDist) {
            minDist = d;
          }
        }
      }

      // 2b. Wall Corners -> Tub Segments
      for (const wc of wallCornersWorld) {
        for (let i = 0; i < tubCornersWorld.length; i++) {
          const p1 = tubCornersWorld[i] as { x: number; y: number } | undefined;
          const p2 = tubCornersWorld[(i + NEXT_IDX) % tubCornersWorld.length] as { x: number; y: number } | undefined;
          if (!p1 || !p2) {
            continue;
          }

          const d = distToSegment(wc, p1, p2);
          if (d < minDist) {
            minDist = d;
          }
        }
      }

      // Logic: if ANY wall is within the Forbidden Zone (1" < gap < 6"), Flag Error.
      // We use inclusive bounds (-epsilon).
      const EPSILON = 1e-5;
      if (minDist >= GAP_TUB_MIN - EPSILON && minDist <= GAP_TUB_MAX + EPSILON) {
        tubGapErrorFound = true;
        break; // Optimization: One bad gap is enough to fail
      }
    }
    if (tubGapErrorFound) {
      break;
    }
  }

  return tubGapErrorFound;
}

// Helper: Check for Wall Gaps (Gap between wall endpoints)
export function checkWallGaps(rawScan: RawScan): boolean {
  const walls = rawScan.walls;
  const GAP_WALL_MIN = 0.0254; // 1 inch
  const GAP_WALL_MAX = 0.3048; // 12 inches
  const TRANSFORM_SIZE = 16;
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const MIN_CORNERS = 0;
  const NEXT_IDX_ONE = 1;

  // 1. Collect Wall Segments (World Space)
  const roomWalls: { corners: { x: number; y: number }[] }[] = [];

  for (const w of walls) {
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    const wallCornersWorld: { x: number; y: number }[] = [];
    let pCorners = w.polygonCorners ?? [];
    const numCorners = pCorners.length;

    if (numCorners === MIN_CORNERS) {
      const DIM_LEN_IDX = 0;
      const halfLen = (w.dimensions?.[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
      const ZERO_Z = 0;
      pCorners = [
        [-halfLen, ZERO_Z],
        [halfLen, ZERO_Z]
      ];
    }

    for (const p of pCorners) {
      if (p.length >= MIN_POINT_SIZE) {
        wallCornersWorld.push(
          transformPoint({ x: p[PT_X_IDX] ?? DEFAULT_VALUE, y: p[PT_Z_IDX] ?? DEFAULT_VALUE }, w.transform)
        );
      }
    }

    const MIN_WALL_CORNERS = 2;
    if (wallCornersWorld.length < MIN_WALL_CORNERS) {
      continue;
    }
    roomWalls.push({ corners: wallCornersWorld });
  }

  let wallGapErrorFound = false;

  // Compare every wall against every other wall
  for (let i = 0; i < roomWalls.length; i++) {
    const wA = roomWalls[i];
    if (!wA) {
      continue;
    }

    // Check against subsequent walls (unique pairs)
    for (let j = i + NEXT_IDX_ONE; j < roomWalls.length; j++) {
      const wB = roomWalls[j];
      if (!wB) {
        continue;
      }

      let minGapDist = Number.MAX_VALUE;

      // Check distance from every corner of A to every segment of B
      for (const pA of wA.corners) {
        for (let k = 0; k < wB.corners.length; k++) {
          const pB1 = wB.corners[k];
          const pB2 = wB.corners[(k + NEXT_IDX_ONE) % wB.corners.length];
          if (pB1 && pB2) {
            const d = distToSegment(pA, pB1, pB2);
            if (d < minGapDist) {
              minGapDist = d;
            }
          }
        }
      }

      // Check distance from every corner of B to every segment of A
      for (const pB of wB.corners) {
        for (let k = 0; k < wA.corners.length; k++) {
          const pA1 = wA.corners[k];
          const pA2 = wA.corners[(k + NEXT_IDX_ONE) % wA.corners.length];
          if (pA1 && pA2) {
            const d = distToSegment(pB, pA1, pA2);
            if (d < minGapDist) {
              minGapDist = d;
            }
          }
        }
      }

      if (minGapDist > GAP_WALL_MIN && minGapDist < GAP_WALL_MAX) {
        wallGapErrorFound = true;
        break;
      }
    }
    if (wallGapErrorFound) {
      break;
    }
  }

  return wallGapErrorFound;
}

// Helper: Check for Colinear Walls (Touching and Parallel)
export function checkColinearWalls(rawScan: RawScan): boolean {
  const walls = rawScan.walls;
  // Touching/Gap: < 3 inches (0.0762m)
  // Parallel: Dot product > 0.996 (approx 5 degrees)
  const TOUCH_THRESHOLD = 0.0762;
  const PARALLEL_THRESHOLD = 0.996;
  const TRANSFORM_SIZE = 16;
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const MIN_CORNERS = 0;
  const NEXT_IDX_ONE = 1;

  // 1. Collect Wall Segments (World Space) and Metadata
  const roomWalls: { corners: { x: number; y: number }[]; story?: number }[] = [];

  for (const w of walls) {
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    const wallCornersWorld: { x: number; y: number }[] = [];
    let pCorners = w.polygonCorners ?? [];
    const numCorners = pCorners.length;

    if (numCorners === MIN_CORNERS) {
      const DIM_LEN_IDX = 0;
      const halfLen = (w.dimensions?.[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
      const ZERO_Z = 0;
      pCorners = [
        [-halfLen, ZERO_Z],
        [halfLen, ZERO_Z]
      ];
    }

    for (const p of pCorners) {
      if (p.length >= MIN_POINT_SIZE) {
        wallCornersWorld.push(
          transformPoint({ x: p[PT_X_IDX] ?? DEFAULT_VALUE, y: p[PT_Z_IDX] ?? DEFAULT_VALUE }, w.transform)
        );
      }
    }

    const MIN_WALL_CORNERS = 2;
    if (wallCornersWorld.length < MIN_WALL_CORNERS) {
      continue;
    }
    const rw: { corners: { x: number; y: number }[]; story?: number } = { corners: wallCornersWorld };
    if (w.story !== undefined) {
      rw.story = w.story;
    }
    roomWalls.push(rw);
  }

  let colinearErrorFound = false;

  for (let i = 0; i < roomWalls.length; i++) {
    const wA = roomWalls[i];
    if (!wA) {
      continue;
    }

    let maxLenA = 0;
    let vAx = 0;
    let vAy = 0;
    const MIN_PTS = 2;
    if (wA.corners.length < MIN_PTS) {
      continue;
    }

    for (let k = 0; k < wA.corners.length; k++) {
      const p1 = wA.corners[k];
      const p2 = wA.corners[(k + NEXT_IDX_ONE) % wA.corners.length];
      if (!p1 || !p2) {
        continue;
      }

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const termX = dx * dx;
      const termY = dy * dy;
      const len = Math.sqrt(termX + termY);
      if (len > maxLenA) {
        maxLenA = len;
        vAx = dx / len;
        vAy = dy / len;
      }
    }

    for (let j = i + NEXT_IDX_ONE; j < roomWalls.length; j++) {
      const wB = roomWalls[j];
      if (!wB) {
        continue;
      }

      // Check Story (if both defined)
      if (wA.story !== undefined && wB.story !== undefined && wA.story !== wB.story) {
        continue;
      }

      // Check Parallel First
      let maxLenB = 0;
      let vBx = 0;
      let vBy = 0;
      if (wB.corners.length < MIN_PTS) {
        continue;
      }

      for (let k = 0; k < wB.corners.length; k++) {
        const p1 = wB.corners[k];
        const p2 = wB.corners[(k + NEXT_IDX_ONE) % wB.corners.length];
        if (!p1 || !p2) {
          continue;
        }

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const termX = dx * dx;
        const termY = dy * dy;
        const len = Math.sqrt(termX + termY);
        if (len > maxLenB) {
          maxLenB = len;
          vBx = dx / len;
          vBy = dy / len;
        }
      }

      const dotTerm1 = vAx * vBx;
      const dotTerm2 = vAy * vBy;
      const dot = Math.abs(dotTerm1 + dotTerm2);

      if (dot <= PARALLEL_THRESHOLD) {
        continue; // Not parallel
      }

      // Check Gap / Overlap using distToSegment
      // If parallel, we check if any part of B is close to A (or vice versa)
      let minDist = Number.MAX_VALUE;

      // Check distance from A corners to B segments
      for (const pA of wA.corners) {
        for (let k = 0; k < wB.corners.length; k++) {
          const pB1 = wB.corners[k];
          const pB2 = wB.corners[(k + NEXT_IDX_ONE) % wB.corners.length];
          if (pB1 && pB2) {
            const d = distToSegment(pA, pB1, pB2);
            if (d < minDist) {
              minDist = d;
            }
          }
        }
      }

      // Check distance from B corners to A segments
      for (const pB of wB.corners) {
        for (let k = 0; k < wA.corners.length; k++) {
          const pA1 = wA.corners[k];
          const pA2 = wA.corners[(k + NEXT_IDX_ONE) % wA.corners.length];
          if (pA1 && pA2) {
            const d = distToSegment(pB, pA1, pA2);
            if (d < minDist) {
              minDist = d;
            }
          }
        }
      }

      if (minDist < TOUCH_THRESHOLD) {
        colinearErrorFound = true;
        break;
      }
    }
    if (colinearErrorFound) {
      break;
    }
  }

  return colinearErrorFound;
}

// Helper: Check for Nib Walls (Length < 1ft / 0.3048m)
export function checkNibWalls(rawScan: RawScan): boolean {
  const walls = rawScan.walls;
  const NIB_WALL_THRESHOLD = 0.3048;
  const TRANSFORM_SIZE = 16;
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const MIN_CORNERS = 0;
  const MIN_LENGTH = 0;

  // 1. Collect Wall Segments (World Space)
  const roomWalls: { corners: { x: number; y: number }[] }[] = [];

  for (const w of walls) {
    if (w.story !== undefined && w.story !== rawScan.story) {
      continue;
    }
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    const wallCornersWorld: { x: number; y: number }[] = [];
    let pCorners = w.polygonCorners ?? [];
    const numCorners = pCorners.length;

    if (numCorners === MIN_CORNERS) {
      const DIM_LEN_IDX = 0;
      const halfLen = (w.dimensions?.[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
      const ZERO_Z = 0;
      pCorners = [
        [-halfLen, ZERO_Z],
        [halfLen, ZERO_Z]
      ];
    }

    for (const p of pCorners) {
      if (p.length >= MIN_POINT_SIZE) {
        wallCornersWorld.push(
          transformPoint({ x: p[PT_X_IDX] ?? DEFAULT_VALUE, y: p[PT_Z_IDX] ?? DEFAULT_VALUE }, w.transform)
        );
      }
    }

    const MIN_WALL_CORNERS = 2;
    if (wallCornersWorld.length < MIN_WALL_CORNERS) {
      continue;
    }
    roomWalls.push({ corners: wallCornersWorld });
  }

  let nibWallFound = false;

  for (const w of roomWalls) {
    let maxDist = 0;
    for (let i = 0; i < w.corners.length; i++) {
      const NEXT_IDX = 1;
      for (let j = i + NEXT_IDX; j < w.corners.length; j++) {
        const p1 = w.corners[i];
        const p2 = w.corners[j];
        if (!p1 || !p2) {
          continue;
        }
        const termX = (p2.x - p1.x) * (p2.x - p1.x);
        const termY = (p2.y - p1.y) * (p2.y - p1.y);
        const d = Math.sqrt(termX + termY);
        if (d > maxDist) {
          maxDist = d;
        }
      }
    }

    if (maxDist < NIB_WALL_THRESHOLD && maxDist > MIN_LENGTH) {
      nibWallFound = true;
      break;
    }
  }

  return nibWallFound;
}

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
    corners: { x: number; y: number }[];
    innerCorners: { x: number; y: number }[];
    story: number;
  }[] = [];

  const TOLERANCE = 0.0254; // 1 inch
  const DIM_X = 0;
  const DIM_Z = 2;
  const HALF = 2;
  const DEFAULT_DIM = 0;
  const TRANSFORM_SIZE = 16;
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
      { x: -halfW, y: -halfD },
      { x: halfW, y: -halfD },
      { x: halfW, y: halfD },
      { x: -halfW, y: halfD }
    ];

    // Inner corners (shrunk by tolerance)
    const innerHalfW = Math.max(ZERO, halfW - TOLERANCE);
    const innerHalfD = Math.max(ZERO, halfD - TOLERANCE);
    const innerCornersLocal = [
      { x: -innerHalfW, y: -innerHalfD },
      { x: innerHalfW, y: -innerHalfD },
      { x: innerHalfW, y: innerHalfD },
      { x: -innerHalfW, y: innerHalfD }
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
        const res = transformPoint(c, o.transform);
        return { x: res.x, y: res.y };
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
      { x: -halfLen, y: -halfThick },
      { x: halfLen, y: -halfThick },
      { x: halfLen, y: halfThick },
      { x: -halfLen, y: halfThick }
    ];

    const wallPolyWorld: { x: number; y: number }[] = [];
    for (const p of wallFootprintLocal) {
      // p.y is Local Z (Thickness)
      wallPolyWorld.push(transformPoint({ x: p.x, y: p.y }, w.transform));
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
  const TRANSFORM_SIZE = 16;
  const MIN_POLY_POINTS = 0;
  const DEFAULT_VALUE = 0;
  const MIN_ITEMS = 0;
  const HALF_DIVISOR = 2;
  const OFFSET_NEXT = 1;
  const UNIT_ONE = 1;

  // We need 2D Segments of Walls' center-lines.
  const wallSegments = rawScan.walls
    .map((w) => {
      if (w.transform?.length === TRANSFORM_SIZE) {
        let p1Local: { x: number; y: number } | null = null;
        let p2Local: { x: number; y: number } | null = null;
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
          if (maxX > minX) {
            p1Local = { x: minX, y: 0 };
            p2Local = { x: maxX, y: 0 };
          }
        }

        // 2. Fallback to Dimensions
        if (p1Local === null) {
          const wSafe = w as unknown as { dimensions?: number[] };
          if (wSafe.dimensions !== undefined && wSafe.dimensions.length > MIN_ITEMS) {
            const DIM_LEN_IDX = 0;
            const halfLen = (wSafe.dimensions[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
            p1Local = { x: -halfLen, y: 0 };
            p2Local = { x: halfLen, y: 0 };
          }
        }

        if (p1Local !== null && p2Local !== null) {
          const p1 = transformPoint(p1Local, w.transform);
          const p2 = transformPoint(p2Local, w.transform);
          return { p1, p2, story: w.story };
        }
      }
      return null;
    })
    .filter((s) => s !== null) as { p1: { x: number; y: number }; p2: { x: number; y: number }; story: number }[];

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
      const EPSILON = 1e-9;
      if (Math.abs(den) < EPSILON) {
        // Parallel. Check for collinear overlap.
        // 1. Are they collinear? Dist from P3 to Line(P1-P2) == 0.
        // Area of triangle P1,P2,P3 = 0.5 * |(x2-x1)(y3-y1) - (x3-x1)(y2-y1)|
        const vec1x = x2 - x1;
        const vec1y = y3 - y1;
        const vec2x = x3 - x1;
        const vec2y = y2 - y1;
        const cp1 = vec1x * vec1y;
        const cp2 = vec2x * vec2y;
        const crossProd = cp1 - cp2;
        const area = Math.abs(crossProd);

        // If "area" is small, checks collinearity.
        const COLLINEAR_TOLERANCE = 1e-5; // Tolerance for collinearity (distance).
        // Normalizing by lengthSquared might provide cleaner threshold?
        // Let's use simple cross product check.
        if (area > COLLINEAR_TOLERANCE) {
          continue; // Parallel but separated
        }

        // Collinear. Check for Overlap.
        // Create 1D projection onto Line(P1-P2).
        // Parametric T for P3 on P1-P2: Use Dot Product.
        const dotA = (x2 - x1) * (x2 - x1);
        const dotB = (y2 - y1) * (y2 - y1);
        const dot11 = dotA + dotB;
        if (dot11 < EPSILON) {
          continue; // Zero length segment?
        }

        const getT = (px: number, py: number): number => {
          const dx = px - x1;
          const dy = py - y1;
          const lineDx = x2 - x1;
          const lineDy = y2 - y1;
          const num1 = dx * lineDx;
          const num2 = dy * lineDy;
          return (num1 + num2) / dot11;
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

// Helper: Check for Crooked Walls (Angles not multiple of 90 deg)
export function checkCrookedWalls(rawScan: RawScan): boolean {
  const TRANSFORM_SIZE = 16;
  const MAT_IDX_M00 = 0;
  const MAT_IDX_M02 = 2;
  const DEFAULT_VALUE = 0;
  const MIN_ITEMS = 0;
  const IDX_FIRST = 0;
  const HALF_DIVISOR = 2;

  // Compute angles
  const angles: number[] = [];
  for (const w of rawScan.walls) {
    if (w.transform?.length === TRANSFORM_SIZE) {
      // Forward vector of wall from rotation matrix
      // Columns 0, 1, 2 are axes X, Y, Z.
      // Local X is "length".
      // World vector X' = (m0, m2)
      const m0 = w.transform[MAT_IDX_M00] ?? DEFAULT_VALUE;
      const m2 = w.transform[MAT_IDX_M02] ?? DEFAULT_VALUE;
      const ang = Math.atan2(m2, m0); // Radians
      angles.push(ang);
    }
  }

  if (angles.length > MIN_ITEMS) {
    // Compare all to angles[0]
    const base = angles[IDX_FIRST];
    // Check base is defined
    if (base !== undefined) {
      const PI_BY_2 = Math.PI / HALF_DIVISOR;

      let crookedFound = false;
      for (let i = 1; i < angles.length; i++) {
        const ang = angles[i];
        if (ang === undefined) {
          continue;
        }
        const diff2 = Math.abs(ang - base);
        // distance to nearest 90 deg multiple
        // k = round(diff2 / (PI/2))
        const step = PI_BY_2;
        const nearestK = Math.round(diff2 / step);
        const idealDiff = nearestK * step;
        const deviation = Math.abs(diff2 - idealDiff);

        // "Crooked" means intended linear but slightly off.
        // If it's drastically off (e.g. 45 deg), it's likely intentional geometry (diagonal).
        // Thresholds:
        // > 3 degrees (0.05 rad) -> Not straight
        // < 30 degrees (0.52 rad) -> Not diagonal
        const THRESHOLD_MIN = 0.05;
        const THRESHOLD_MAX = 0.52;

        if (deviation > THRESHOLD_MIN && deviation < THRESHOLD_MAX) {
          crookedFound = true;
          break;
        }
      }
      if (crookedFound) {
        return true;
      }
    }
  }
  return false;
}

// Helper: Check for Door Blocking (Door sweep intersects Object)
export function checkDoorBlocking(rawScan: RawScan): boolean {
  const DOOR_CLEARANCE_METERS = 0.6;
  const WIDTH_SHRINK = 0.1; // Shrink width slightly to avoid grazing
  const DIVISOR = 2;
  const VAL_ZERO = 0;
  const DIM_X_IDX = 0;
  const DIM_Z_IDX = 2;
  const TRANSFORM_SIZE = 16;

  const objPolys: { category: string; corners: { x: number; y: number }[] }[] = [];
  for (const o of rawScan.objects) {
    // Get footprint
    if (o.transform.length !== TRANSFORM_SIZE) {
      continue;
    }
    const dX = o.dimensions[DIM_X_IDX] ?? VAL_ZERO;
    const dZ = o.dimensions[DIM_Z_IDX] ?? VAL_ZERO;
    const hX = dX / DIVISOR;
    const hZ = dZ / DIVISOR;
    // Local corners (bottom footprint)
    const localCorners = [
      { x: -hX, y: -hZ },
      { x: hX, y: -hZ },
      { x: hX, y: hZ },
      { x: -hX, y: hZ }
    ];
    const worldCorners = localCorners.map((p) => transformPoint(p, o.transform));
    objPolys.push({ category: JSON.stringify(o.category), corners: worldCorners });
  }

  let doorBlocked = false;

  for (const door of rawScan.doors) {
    const dW = door.dimensions[DIM_X_IDX] ?? VAL_ZERO;
    const halfDW = Math.max(VAL_ZERO, dW - WIDTH_SHRINK) / DIVISOR;
    // Clearance box
    const clearanceBox = [
      { x: -halfDW, y: -DOOR_CLEARANCE_METERS },
      { x: halfDW, y: -DOOR_CLEARANCE_METERS },
      { x: halfDW, y: DOOR_CLEARANCE_METERS },
      { x: -halfDW, y: DOOR_CLEARANCE_METERS }
    ];
    const clearancePoly = clearanceBox.map((p) => transformPoint(p, door.transform));

    for (const objRes of objPolys) {
      const intersects = doPolygonsIntersect(clearancePoly, objRes.corners);
      if (intersects) {
        doorBlocked = true;
        break;
      }
    }
    if (doorBlocked) {
      break;
    }
  }

  return doorBlocked;
}
