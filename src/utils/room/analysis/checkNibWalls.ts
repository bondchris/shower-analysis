import convert from "convert-units";

import { Point } from "../../../models/point";
import { RawScan } from "../../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../../math/constants";
import { transformPoint } from "../../math/transform";
import { magnitudeSquared, subtract } from "../../math/vector";
import { NIB_WALL_THRESHOLD_FT } from "../constants";

/**
 * Checks for "Nib Walls" (Small stub walls).
 *
 * Definition: A standalone wall segment shorter than 1 foot (0.3048m).
 *
 * These are often noise artifacts or tiny protrusions that should be merged or ignored.
 */
export function checkNibWalls(rawScan: RawScan): boolean {
  const walls = rawScan.walls;
  const NIB_WALL_THRESHOLD = convert(NIB_WALL_THRESHOLD_FT).from("ft").to("m");
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const MIN_CORNERS = 0;
  const MIN_LENGTH = 0;

  // 1. Collect Wall Segments (World Space)
  const roomWalls: { corners: Point[] }[] = [];

  for (const w of walls) {
    if (w.story !== undefined && w.story !== rawScan.story) {
      continue;
    }
    if (w.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }

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

    const wallCornersWorld: Point[] = [];
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
        const d = Math.sqrt(magnitudeSquared(subtract(p2, p1)));
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
