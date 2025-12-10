export const getPosition = (transform: number[]): { x: number; y: number } => {
  const TRANSFORM_SIZE = 16;
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

  const termX1 = p.x * m0;
  const termX2 = p.y * m8;
  const x = termX1 + termX2 + mTx;

  const termZ1 = p.x * m2;
  const termZ2 = p.y * m10;
  const y = termZ1 + termZ2 + mTz;

  return { x, y };
};

export const distToSegment = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number => {
  // l2 = length squared of segment vw
  const EXPONENT_SQUARED = 2;
  const l2 = Math.pow(v.x - w.x, EXPONENT_SQUARED) + Math.pow(v.y - w.y, EXPONENT_SQUARED);
  const ZERO_LENGTH = 0;
  if (l2 === ZERO_LENGTH) {
    return Math.sqrt(Math.pow(p.x - v.x, EXPONENT_SQUARED) + Math.pow(p.y - v.y, EXPONENT_SQUARED));
  }
  // t = projection of p onto line vw, clamped between 0 and 1
  // t = dot(p - v, w - v) / l2
  const pXDiff = p.x - v.x;
  const vXDiff = w.x - v.x;
  const pYDiff = p.y - v.y;
  const vYDiff = w.y - v.y;
  const term1 = pXDiff * vXDiff;
  const term2 = pYDiff * vYDiff;
  const dotP = term1 + term2;
  let t = dotP / l2;
  const MIN_CLAMP = 0;
  const MAX_CLAMP = 1;
  t = Math.max(MIN_CLAMP, Math.min(MAX_CLAMP, t));
  // Projection Point = v + t * (w - v)
  const tX = t * (w.x - v.x);
  const projX = v.x + tX;
  const tY = t * (w.y - v.y);
  const projY = v.y + tY;
  return Math.sqrt(Math.pow(p.x - projX, EXPONENT_SQUARED) + Math.pow(p.y - projY, EXPONENT_SQUARED));
};
