import { RawScan } from "../../../models/rawScan/rawScan";
import { TRANSFORM_SIZE } from "../../math/constants";
import { TOUCHING_THRESHOLD_METERS } from "../constants";

/**
 * Checks if any door does not touch the floor.
 *
 * Logic:
 * 1. For each door, calculate the bottom Y coordinate (doorMinY).
 * 2. Check if the door's bottom is within threshold distance of the floor level.
 * 3. Floor level is typically at Y=0, but we check the first floor's Y coordinate if available.
 * 4. If any door's bottom is more than threshold away from floor, flag as error.
 */
export function checkDoorFloorContact(rawScan: RawScan): boolean {
  const INITIAL_COUNT = 0;
  const DIM_Y_IDX = 1;
  const MAT_TY_IDX = 13;
  const DIVISOR = 2;
  const DEFAULT_VALUE = 0;
  const GAP_THRESHOLD_METERS = TOUCHING_THRESHOLD_METERS;

  // Determine floor Y level
  // Typically floors are at Y=0, but check first floor's transform if available
  let floorYLevel = DEFAULT_VALUE;
  if (rawScan.floors.length > INITIAL_COUNT) {
    const firstFloor = rawScan.floors[INITIAL_COUNT];
    if (firstFloor !== undefined) {
      if (firstFloor.transform?.length === TRANSFORM_SIZE) {
        floorYLevel = firstFloor.transform[MAT_TY_IDX] ?? DEFAULT_VALUE;
      } else if ((firstFloor.polygonCorners?.length ?? INITIAL_COUNT) > INITIAL_COUNT) {
        // If no transform, use first corner's Y coordinate
        const firstCorner = firstFloor.polygonCorners?.[INITIAL_COUNT];
        if (firstCorner !== undefined && firstCorner.length > DIM_Y_IDX) {
          const cornerY = firstCorner[DIM_Y_IDX];
          if (cornerY !== undefined) {
            floorYLevel = cornerY;
          }
        }
      }
    }
  }

  // Check each door
  for (const door of rawScan.doors) {
    if (door.transform.length !== TRANSFORM_SIZE) {
      continue;
    }

    const doorHeight = door.dimensions[DIM_Y_IDX] ?? DEFAULT_VALUE;
    const halfHeight = doorHeight / DIVISOR;
    const doorCenterY = door.transform[MAT_TY_IDX] ?? DEFAULT_VALUE;
    const doorMinY = doorCenterY - halfHeight;

    // Calculate distance from door bottom to floor
    const distanceFromFloor = Math.abs(doorMinY - floorYLevel);

    // If door bottom is more than threshold away from floor, it's an error
    if (distanceFromFloor > GAP_THRESHOLD_METERS) {
      return true;
    }
  }

  return false;
}
