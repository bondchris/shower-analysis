import convert from "convert-units";

import { Point } from "../../models/point";
import { RawScan } from "../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../math/constants";
import { distToSegment } from "../math/segment";
import { transformPoint } from "../math/transform";
import { TOUCHING_THRESHOLD_METERS } from "./constants";

// Helper: Check for Wall Gaps (< 1 foot)
export function checkWallGaps(rawScan: RawScan): boolean {
  const walls = rawScan.walls;

  const TWELVE_INCHES = 12;
  const GAP_WALL_MIN = TOUCHING_THRESHOLD_METERS;
  const GAP_WALL_MAX = convert(TWELVE_INCHES).from("in").to("m");
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const MIN_CORNERS = 0;
  const NEXT_IDX_ONE = 1;

  // 1. Collect Wall Segments (World Space)
  const roomWalls: { corners: Point[]; story?: number }[] = [];

  for (const w of walls) {
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

    const wallCornersWorld: Point[] = [];
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
          transformPoint(new Point(p[PT_X_IDX] ?? DEFAULT_VALUE, p[PT_Z_IDX] ?? DEFAULT_VALUE), w.transform)
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
