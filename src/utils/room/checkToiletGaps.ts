import { Point } from "../../models/point";
import { RawScan } from "../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../math/constants";
import { distToSegment } from "../math/segment";
import { transformPoint } from "../math/transform";
import { TOUCHING_THRESHOLD_METERS } from "./constants";

// Helper: Check for Toilet Gaps (> 1 inch from wall)
export function checkToiletGaps(rawScan: RawScan): boolean {
  const toilets = rawScan.objects.filter((o) => o.category.toilet !== undefined);
  const walls = rawScan.walls;

  const MIN_DIMENSIONS = 3;
  const Z_DIM_IDX = 2; // Dimensions[2] is Depth (Z) in local space
  const HALF_DIVISOR = 2;
  const GAP_THRESHOLD_METERS = TOUCHING_THRESHOLD_METERS;
  const DEFAULT_VALUE = 0;
  const PT_X_IDX = 0;
  const PT_Z_IDX = 1;

  // Prepare Walls (Projected to 2D World X-Z plane)
  // We use `transformPoint` which maps {x, y} (Input: Local X, Z) -> {x, y} (Output: World X, Z).
  const roomWalls: { corners: Point[] }[] = [];
  const MIN_CORNERS = 0;

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

    const wallCornersWorld: Point[] = [];
    const MIN_POINT_SIZE = 2;
    for (const p of pCorners) {
      if (p.length >= MIN_POINT_SIZE) {
        // Map Local (X, Z) -> transformPoint expects {x, y}
        const ptLocal = new Point(
          p[PT_X_IDX] ?? DEFAULT_VALUE,
          p[PT_Z_IDX] ?? DEFAULT_VALUE // y is Local Z
        );

        wallCornersWorld.push(transformPoint(ptLocal, w.transform));
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
    const ZERO = 0;
    const backfaceLocal = new Point(ZERO, -halfDepth);

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
      const MIN_POINT_SIZE_LOCAL = 2;
      if (!rw || rw.corners.length < MIN_POINT_SIZE_LOCAL) {
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
