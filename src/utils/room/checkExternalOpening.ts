import { Point } from "../../models/point";
import { RawScan } from "../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../math/constants";
import { distToSegment } from "../math/segment";

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
    if (!wall || wall.transform?.length !== TRANSFORM_SIZE) {
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
        new Point(wx, wy),
        new Point(p1[X_IDX] ?? DEFAULT_COORD, p1[Y_IDX] ?? DEFAULT_COORD),
        new Point(p2[X_IDX] ?? DEFAULT_COORD, p2[Y_IDX] ?? DEFAULT_COORD)
      );

      if (dist < PERIMETER_THRESHOLD) {
        return true;
      }
    }
  }
  return false;
}
