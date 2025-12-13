import { RawScan } from "../../models/rawScan/rawScan";
import { distToSegment, transformPoint } from "../mathUtils";

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
