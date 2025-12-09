import { Surface, SurfaceData } from "./surface";

export interface WallCategory {
  wall?: Record<string, never>;
}

export interface WallData extends SurfaceData {
  category: WallCategory;
}

export class Wall extends Surface {
  public category: WallCategory;

  constructor(data: WallData) {
    super(data);
    this.category = data.category;
  }

  get hasSoffit(): boolean {
    const corners = this.polygonCorners;
    const MIN_POLY_CORNERS = 3;
    const DEFAULT_COORD = 0;
    const ANGLE_NORMALIZER_ZERO = 0;
    const SEMI_CIRCLE_DEG = 180;
    const FULL_CIRCLE_DEG = 360;
    const SOFFIT_MIN_ANGLE = 260;
    const SOFFIT_MAX_ANGLE = 280;
    const X_IDX = 0;
    const Y_IDX = 1;
    const OFFSET_PREV = 1;
    const OFFSET_NEXT = 1;
    const RAD_TO_DEG = SEMI_CIRCLE_DEG / Math.PI;

    if (!corners || corners.length < MIN_POLY_CORNERS) {
      return false;
    }

    // Project to 2D (assume Wall local space is X-Y plane, Z is constant/thickness)
    // Calculate signed angles
    for (let i = 0; i < corners.length; i++) {
      const pPrev = corners[(i - OFFSET_PREV + corners.length) % corners.length];
      const pCurr = corners[i];
      const pNext = corners[(i + OFFSET_NEXT) % corners.length];

      if (!pPrev || !pCurr || !pNext) {
        continue;
      }

      // Vector BA (Curr -> Prev)
      const v1x = (pPrev[X_IDX] ?? DEFAULT_COORD) - (pCurr[X_IDX] ?? DEFAULT_COORD);
      const v1y = (pPrev[Y_IDX] ?? DEFAULT_COORD) - (pCurr[Y_IDX] ?? DEFAULT_COORD);

      // Vector BC (Curr -> Next)
      const v2x = (pNext[X_IDX] ?? DEFAULT_COORD) - (pCurr[X_IDX] ?? DEFAULT_COORD);
      const v2y = (pNext[Y_IDX] ?? DEFAULT_COORD) - (pCurr[Y_IDX] ?? DEFAULT_COORD);

      // Angle of BA
      const angle1 = Math.atan2(v1y, v1x);
      // Angle of BC
      const angle2 = Math.atan2(v2y, v2x);

      // Interior angle? We need the angle on the "inside" of the polygon.
      // Assuming CCW winding for "inside" to be left?
      // Or just difference between angles?
      // Standard approach: (angle2 - angle1)
      let angleDiff = (angle2 - angle1) * RAD_TO_DEG;

      // Normalize to [0, 360)
      if (angleDiff < ANGLE_NORMALIZER_ZERO) {
        angleDiff += FULL_CIRCLE_DEG;
      }

      // If polygon is CCW, interior angles are on left.
      // A notch (re-entrant corner) would have angle > 180.
      // A soffit notch is typically 270 degrees (90 degrees inverse).
      if (angleDiff >= SOFFIT_MIN_ANGLE && angleDiff <= SOFFIT_MAX_ANGLE) {
        return true;
      }
    }

    return false;
  }
}
