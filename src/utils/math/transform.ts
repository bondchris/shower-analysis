import { TRANSFORM_SIZE } from "./constants";
import { dotProduct } from "./vector";

export const getPosition = (transform: number[]): { x: number; y: number } => {
  const X_IDX = 12;
  const Z_IDX = 14;
  const DEFAULT_VALUE = 0;

  // Check if transform is valid (size 16)
  if (transform.length !== TRANSFORM_SIZE) {
    return { x: 0, y: 0 };
  }
  // Use X (idx 12) and Z (idx 14) for floor plane position
  return {
    x: transform[X_IDX] ?? DEFAULT_VALUE,
    y: transform[Z_IDX] ?? DEFAULT_VALUE
  };
};

export const transformPoint = (p: { x: number; y: number }, m: number[]): { x: number; y: number } => {
  // X-Z Plane Transform (Top Down)
  // x' = x*m0 + z*m8 + tx
  // z' = x*m2 + z*m10 + tz
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

  /*
   * x' = dot({x, y}, {m0, m8}) + mTx
   * z' = dot({x, y}, {m2, m10}) + mTz
   */
  const x = dotProduct(p, { x: m0, y: m8 }) + mTx;
  const y = dotProduct(p, { x: m2, y: m10 }) + mTz;

  return { x, y };
};
