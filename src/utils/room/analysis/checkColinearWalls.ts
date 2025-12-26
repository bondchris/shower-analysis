import convert from "convert-units";

import { Point } from "../../../models/point";
import { RawScan } from "../../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../../math/constants";
import { distToSegment } from "../../math/segment";
import { transformPoint } from "../../math/transform";
import { dotProduct, magnitudeSquared, subtract } from "../../math/vector";
import { COLINEAR_WALL_GAP_MAX_INCHES, COLINEAR_WALL_PARALLEL_THRESHOLD } from "../constants";

/**
 * Checks for walls that are effectively duplicates or overlapping (Collinear).
 *
 * Logic:
 * 1. Walls must be parallel (Dot product > 0.996, ~5 degrees).
 * 2. Walls must be touching or overlapping (Distance between them < 3 inches).
 *
 * This detects double-scanned walls or segmentation errors.
 */
export function checkColinearWalls(rawScan: RawScan): boolean {
  const walls = rawScan.walls;
  // Touching/Gap: < 3 inches (0.0762m)
  // Parallel: Dot product > 0.996 (approx 5 degrees)
  const TOUCH_THRESHOLD = convert(COLINEAR_WALL_GAP_MAX_INCHES).from("in").to("m");
  const HALF_DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;
  const MIN_POINT_SIZE = 2;
  const MIN_CORNERS = 0;
  const NEXT_IDX_ONE = 1;

  // 1. Collect Wall Segments (World Space) and Metadata
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
    const rw: { corners: Point[]; story?: number } = { corners: wallCornersWorld };
    if (w.story !== undefined) {
      rw.story = w.story;
    }
    roomWalls.push(rw);
  }

  let colinearErrorFound = false;

  for (const [i, wA] of roomWalls.entries()) {
    let maxLenA = 0;
    let vAx = 0;
    let vAy = 0;

    for (let k = 0; k < wA.corners.length; k++) {
      const p1 = expectDefined(wA.corners[k], "Wall A Corner Missing");
      const p2 = expectDefined(wA.corners[(k + NEXT_IDX_ONE) % wA.corners.length], "Wall A Corner Missing");

      const v = subtract(p2, p1);
      const len = Math.sqrt(magnitudeSquared(v));
      if (len > maxLenA) {
        maxLenA = len;
        vAx = v.x / len;
        vAy = v.y / len;
      }
    }

    // Use slice to avoid indexed access for wB
    for (const wB of roomWalls.slice(i + NEXT_IDX_ONE)) {
      // Check Story (if both defined)
      if (wA.story !== undefined && wB.story !== undefined && wA.story !== wB.story) {
        continue;
      }

      // Check Parallel First
      let maxLenB = 0;
      let vBx = 0;
      let vBy = 0;

      for (let k = 0; k < wB.corners.length; k++) {
        const p1 = expectDefined(wB.corners[k], "Wall B Corner Missing");
        const p2 = expectDefined(wB.corners[(k + NEXT_IDX_ONE) % wB.corners.length], "Wall B Corner Missing");

        const v = subtract(p2, p1);
        const len = Math.sqrt(magnitudeSquared(v));
        if (len > maxLenB) {
          maxLenB = len;
          vBx = v.x / len;
          vBy = v.y / len;
        }
      }

      const dot = Math.abs(dotProduct(new Point(vAx, vAy), new Point(vBx, vBy)));

      if (dot <= COLINEAR_WALL_PARALLEL_THRESHOLD) {
        continue; // Not parallel
      }

      // Check Gap / Overlap using distToSegment
      // If parallel, we check if any part of B is close to A (or vice versa)
      let minDist = Number.MAX_VALUE;

      // Check distance from A corners to B segments
      for (const pA of wA.corners) {
        for (let k = 0; k < wB.corners.length; k++) {
          const pB1 = expectDefined(wB.corners[k], "Wall B Corner Missing");
          const pB2 = expectDefined(wB.corners[(k + NEXT_IDX_ONE) % wB.corners.length], "Wall B Corner Missing");
          const d = distToSegment(pA, pB1, pB2);
          if (d < minDist) {
            minDist = d;
          }
        }
      }

      // Check distance from B corners to A segments
      for (const pB of wB.corners) {
        for (let k = 0; k < wA.corners.length; k++) {
          const pA1 = expectDefined(wA.corners[k], "Wall A Corner Missing");
          const pA2 = expectDefined(wA.corners[(k + NEXT_IDX_ONE) % wA.corners.length], "Wall A Corner Missing");
          const d = distToSegment(pB, pA1, pA2);
          if (d < minDist) {
            minDist = d;
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

// Exported for testing purposes to achieve 100% coverage on the helper itself
export function expectDefined<T>(value: T | undefined, msg: string): T {
  if (value === undefined) {
    throw new Error(msg);
  }
  return value;
}
