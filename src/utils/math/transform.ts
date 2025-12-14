import { Point } from "../../models/point";
import { TRANSFORM_SIZE } from "./constants";
import { dotProduct } from "./vector";

export const getPosition = (transform: number[]): Point => {
  const X_IDX = 12;
  const Z_IDX = 14;
  const DEFAULT_VALUE = 0;

  // Check if transform is valid (size 16)
  if (transform.length !== TRANSFORM_SIZE) {
    return new Point(DEFAULT_VALUE, DEFAULT_VALUE);
  }
  // Use X (idx 12) and Z (idx 14) for floor plane position
  return new Point(transform[X_IDX] ?? DEFAULT_VALUE, transform[Z_IDX] ?? DEFAULT_VALUE);
};

/**
 * Transforms a 2D point using a 4x4 matrix, assuming a top-down projection.
 *
 * Coordinate Space Mapping:
 * - Input Point.y is treated as Local Z (RoomPlan depth).
 * - Output Point.y corresponds to World Z (Floor plan Y).
 *
 * This effectively projects the 3D X-Z plane onto a 2D surface.
 */
export const transformPoint = (p: Point, m: number[]): Point => {
  // X-Z Plane Transform (Top Down)
  // Note: Input p.y corresponds to Local Z. Output p.y corresponds to World Z.
  const MAT_M0 = 0; // r0, c0 (Xx)
  const MAT_M2 = 2; // r2, c0 (Xz)
  const MAT_M8 = 8; // r0, c2 (Zx)
  const MAT_M10 = 10; // r2, c2 (Zz)
  const MAT_TX = 12; // r0, c3 (Tx)
  const MAT_TZ = 14; // r2, c3 (Tz)
  const DEFAULT_VALUE = 0;

  const m0 = m[MAT_M0] ?? DEFAULT_VALUE;
  const m8 = m[MAT_M8] ?? DEFAULT_VALUE;
  const mTx = m[MAT_TX] ?? DEFAULT_VALUE;

  const m2 = m[MAT_M2] ?? DEFAULT_VALUE;
  const m10 = m[MAT_M10] ?? DEFAULT_VALUE;
  const mTz = m[MAT_TZ] ?? DEFAULT_VALUE;

  const x = dotProduct(p, new Point(m0, m8)) + mTx;
  const y = dotProduct(p, new Point(m2, m10)) + mTz;

  return new Point(x, y);
};
