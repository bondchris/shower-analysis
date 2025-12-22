import convert from "convert-units";

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
    const FULL_CIRCLE_DEG = 360;
    const SOFFIT_MIN_ANGLE = 260;
    const SOFFIT_MAX_ANGLE = 280;
    const X_IDX = 0;
    const Y_IDX = 1;
    const OFFSET_PREV = 1;
    const OFFSET_NEXT = 1;

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
      let angleDiff = convert(angle2 - angle1)
        .from("rad")
        .to("deg");

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

  /**
   * Returns the minimum ceiling height of this wall in meters.
   * For rectangular walls, this is dimensions[1].
   * For non-rectangular walls with polygonCorners, this is the minimum height
   * from the bounding box or calculated from corner Y values.
   * Returns null if height cannot be determined.
   */
  getMinimumCeilingHeight(): number | null {
    const DIMENSION_INDEX_HEIGHT = 1;
    const MIN_DIMENSIONS_LENGTH = 2;
    const MIN_POLYGON_CORNERS = 3;
    const POLYGON_CORNER_Y_INDEX = 1;
    const MIN_POINT_COORDINATES = 3;
    const MIN_HEIGHT_VALUE = 0;

    // Check walls with polygonCorners (non-rectangular walls)
    // For these, dimensions is a bounding box, so we need to check if the bounding box height
    // or any individual corner height indicates a low ceiling
    // polygonCorners are [X, Y, Z] where Y is the vertical offset from wall center
    if (
      this.polygonCorners !== undefined &&
      Array.isArray(this.polygonCorners) &&
      this.polygonCorners.length >= MIN_POLYGON_CORNERS
    ) {
      // Calculate minimum height from actual corner Y values
      // Y values are relative to wall center, so we need to find the minimum height
      // from the base (lowest Y) to the lowest point on the top edge (for V-shaped walls)
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const corner of this.polygonCorners) {
        if (Array.isArray(corner) && corner.length >= MIN_POINT_COORDINATES) {
          const yValue = corner[POLYGON_CORNER_Y_INDEX];
          if (yValue !== undefined) {
            if (yValue < minY) {
              minY = yValue;
            }
            if (yValue > maxY) {
              maxY = yValue;
            }
          }
        }
      }
      // Find the minimum Y value that's greater than minY (lowest point on top edge)
      // This handles V-shaped walls where the top has a notch
      if (minY !== Number.POSITIVE_INFINITY && maxY !== Number.NEGATIVE_INFINITY) {
        let minTopY = Number.POSITIVE_INFINITY;
        for (const corner of this.polygonCorners) {
          if (Array.isArray(corner) && corner.length >= MIN_POINT_COORDINATES) {
            const yValue = corner[POLYGON_CORNER_Y_INDEX];
            if (yValue !== undefined && yValue > minY) {
              if (yValue < minTopY) {
                minTopY = yValue;
              }
            }
          }
        }
        // If we found a top point, return the height from base to that point
        if (minTopY !== Number.POSITIVE_INFINITY) {
          return minTopY - minY;
        }
        // Fallback: if all points are at the same Y, return the full span
        const heightSpan = maxY - minY;
        if (heightSpan > MIN_HEIGHT_VALUE) {
          return heightSpan;
        }
      }
      return null;
    }
    // Check rectangular walls using dimensions
    if (Array.isArray(this.dimensions) && this.dimensions.length >= MIN_DIMENSIONS_LENGTH) {
      const height = this.dimensions[DIMENSION_INDEX_HEIGHT];
      if (height !== undefined && height > MIN_HEIGHT_VALUE) {
        return height;
      }
    }
    return null;
  }
}
