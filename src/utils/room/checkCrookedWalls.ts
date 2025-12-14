import convert from "convert-units"; // eslint-disable-line no-unused-vars

import { Point } from "../../models/point";
import { RawScan } from "../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../math/constants";
import { distToSegment } from "../math/segment";
import { transformPoint } from "../math/transform";
import { subtract } from "../math/vector";
import { TOUCHING_THRESHOLD_METERS } from "./constants";

// Helper: Check for Crooked Walls (Angles not multiple of 90 deg)
export function checkCrookedWalls(rawScan: RawScan): boolean {
  const walls = rawScan.walls;

  const DEFAULT_VALUE = 0;
  const NEXT_IDX = 1;
  const DEG_180 = 180;
  const DEG_360 = 360;

  const DIST_THRESHOLD = TOUCHING_THRESHOLD_METERS;
  const ANGLE_THRESHOLD = 5.0; // 5 degrees
  const DIM_IDX_X = 0;

  for (let i = 0; i < walls.length; i++) {
    const w1 = walls[i];
    if (w1?.transform?.length !== TRANSFORM_SIZE) {
      continue;
    }
    // Get w1 edge points
    const ZERO = 0;
    const l1 = w1.dimensions?.[DIM_IDX_X] ?? DEFAULT_VALUE;
    const p1Start: Point = transformPoint(new Point(ZERO, ZERO), w1.transform);
    const p1End: Point = transformPoint(new Point(l1, ZERO), w1.transform);

    // Get vector 1
    const v1 = subtract(p1End, p1Start);
    const angle1 = Math.atan2(v1.y, v1.x); // Radians

    for (let j = i + NEXT_IDX; j < walls.length; j++) {
      const w2 = walls[j];
      if (w2?.transform?.length !== TRANSFORM_SIZE) {
        continue;
      }
      // Story check
      if (w1.story !== w2.story) {
        continue;
      }

      const l2 = w2.dimensions?.[DIM_IDX_X] ?? DEFAULT_VALUE;
      const p2Start: Point = transformPoint(new Point(ZERO, ZERO), w2.transform);
      const p2End: Point = transformPoint(new Point(l2, ZERO), w2.transform);

      // Check distance (Connectivity)
      // distance between segment S1 and S2.
      // distToSegment gives point to segment.
      // Approximation: Check distance from endpoints of S2 to S1, and S1 to S2.
      // If min dist <= threshold -> CONNECTED.
      // Note: This matches "Endpoint to Segment" interpretation.
      const d1 = distToSegment(p2Start, p1Start, p1End);
      const d2 = distToSegment(p2End, p1Start, p1End);
      const d3 = distToSegment(p1Start, p2Start, p2End);
      const d4 = distToSegment(p1End, p2Start, p2End);

      const minDist = Math.min(d1, d2, d3, d4);

      if (minDist <= DIST_THRESHOLD) {
        // Connected. Check Angle.
        const v2 = subtract(p2End, p2Start);
        const angle2 = Math.atan2(v2.y, v2.x);

        let angleDiff = Math.abs(
          convert(angle1 - angle2)
            .from("rad")
            .to("deg")
        );
        // Normalize to [0, 180] deviation from parallel
        // If angleDiff is 360 -> 0.
        // If 180 -> 180.
        // We want deviation from 0 OR 180.
        // E.g. 179 -> 1 deg deviation. 181 -> 1 deg deviation.
        // Standardize to 0..360 first
        angleDiff = angleDiff % DEG_360;
        if (angleDiff > DEG_180) {
          angleDiff = DEG_360 - angleDiff; // 0..180
        }

        // Now angleDiff is [0, 180]. intersection angle.
        // Deviation from collinear means near 0 or near 180.
        const devFrom0 = angleDiff;
        const devFrom180 = Math.abs(DEG_180 - angleDiff);

        const deviation = Math.min(devFrom0, devFrom180);

        // "Crooked" if <= 5.0 deg. (Meaning roughly collinear).
        // Wait, "Crooked" means "intended linear but slightly off".
        // The user spec said: "Angle = 0 (perfectly colinear) -> crooked."
        // So we are detecting "Shallow Angle Joins" or "Colinear Joins".
        // Yes, the function name implies "Crooked", but usually that implies "Badly joined".
        // User spec: 8. Angle = 0 -> Crooked. 9. 4.99 -> Crooked. 11. 5.01 -> Not crooked.
        // So this function detects ANY shallow join <= 5 deg.
        if (deviation <= ANGLE_THRESHOLD) {
          return true;
        }
      }
    }
  }

  return false;
}
