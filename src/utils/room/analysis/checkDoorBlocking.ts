import { Point } from "../../../models/point";
import { RawScan } from "../../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../../math/constants";
import { doPolygonsIntersect } from "../../math/polygon";
import { transformPoint } from "../../math/transform";
import { DOOR_CLEARANCE_METERS, STEP_OVER_HEIGHT_METERS } from "../constants";

/**
 * Checks if any object is blocking a door's swing path or entry.
 *
 * Logic:
 * 1. Creates a "Clearance Box" projecting 0.6m (2ft) in front of the door.
 * 2. Checks for intersection with any object on the same story.
 * 3. EXCEPTION: "Low Profile" objects (rugs, thresholds) < 5cm height are ignored.
 * 4. EXCEPTION: Objects attached to the door (via parentIdentifier) are ignored.
 */
export function checkDoorBlocking(rawScan: RawScan): boolean {
  const WIDTH_SHRINK = 0.1; // Shrink width slightly to avoid grazing
  const DIVISOR = 2;
  const VAL_ZERO = 0;
  const DIM_X_IDX = 0;
  const DIM_Z_IDX = 2;

  const objPolys: {
    category: string;
    corners: Point[];
    story: number;
    minY: number;
    maxY: number;
    parentIdentifier: string | null;
  }[] = [];
  for (const o of rawScan.objects) {
    // Get footprint
    if (o.transform.length !== TRANSFORM_SIZE) {
      continue;
    }
    const dX = o.dimensions[DIM_X_IDX] ?? VAL_ZERO;
    const dZ = o.dimensions[DIM_Z_IDX] ?? VAL_ZERO;
    const hX = dX / DIVISOR;
    const hZ = dZ / DIVISOR;

    // Height Check Prep
    const DIM_Y_IDX = 1;
    const MAT_TY_IDX = 13;
    const dY = o.dimensions[DIM_Y_IDX] ?? VAL_ZERO;
    const hY = dY / DIVISOR;
    const oTy = o.transform[MAT_TY_IDX] ?? VAL_ZERO;
    const minY = oTy - hY;
    const maxY = oTy + hY;

    // Local corners (bottom footprint)
    const localCorners = [new Point(-hX, -hZ), new Point(hX, -hZ), new Point(hX, hZ), new Point(-hX, hZ)];
    const worldCorners = localCorners.map((p) => transformPoint(p, o.transform));
    objPolys.push({
      category: JSON.stringify(o.category),
      corners: worldCorners,
      maxY,
      minY,
      parentIdentifier: o.parentIdentifier ?? null,
      story: o.story
    });
  }

  let doorBlocked = false;

  for (const door of rawScan.doors) {
    if (door.transform.length !== TRANSFORM_SIZE) {
      continue;
    }
    const dW = door.dimensions[DIM_X_IDX] ?? VAL_ZERO;
    const halfDW = Math.max(VAL_ZERO, dW - WIDTH_SHRINK) / DIVISOR;

    // Door Height range
    const DIM_Y_IDX = 1;
    const MAT_TY_IDX = 13;
    const dH = door.dimensions[DIM_Y_IDX] ?? VAL_ZERO;
    const hH = dH / DIVISOR;
    const dTy = door.transform[MAT_TY_IDX] ?? VAL_ZERO;
    const doorMinY = dTy - hH;
    const doorMaxY = dTy + hH;

    // Clearance box - Directional (Front only: 0 to +CLEARANCE)
    // Assuming Local Y+ is "Front" (or Z+ mapped to Y in 2D proj)
    const ZERO = 0;
    const clearanceBox = [
      new Point(-halfDW, ZERO),
      new Point(halfDW, ZERO),
      new Point(halfDW, DOOR_CLEARANCE_METERS),
      new Point(-halfDW, DOOR_CLEARANCE_METERS)
    ];
    const clearancePoly = clearanceBox.map((p) => transformPoint(p, door.transform));

    for (const objRes of objPolys) {
      if (door.story !== objRes.story) {
        continue;
      }

      // Check Parent (Attachment)
      // If object is attached to the door, it does not block it.
      if (objRes.parentIdentifier === door.identifier) {
        continue;
      }

      // Height overlap check
      // 1. Completely Above Door: objMinY > doorMaxY
      // 2. Completely Below Door (Floor?): objMaxY < doorMinY
      // 3. Low Profile (Step-over): objMaxY < doorMinY + STEP_OVER_HEIGHT_METERS
      //    (This covers #2 as well if STEP_OVER_HEIGHT_METERS >= 0)
      if (objRes.minY > doorMaxY || objRes.maxY < doorMinY + STEP_OVER_HEIGHT_METERS) {
        continue;
      }

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
