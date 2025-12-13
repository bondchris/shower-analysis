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

export const segmentsIntersect = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): boolean => {
  // Input Validation
  if (
    !Number.isFinite(a.x) ||
    !Number.isFinite(a.y) ||
    !Number.isFinite(b.x) ||
    !Number.isFinite(b.y) ||
    !Number.isFinite(c.x) ||
    !Number.isFinite(c.y) ||
    !Number.isFinite(d.x) ||
    !Number.isFinite(d.y)
  ) {
    return false;
  }

  const detTerm1 = (b.x - a.x) * (d.y - c.y);
  const detTerm2 = (d.x - c.x) * (b.y - a.y);
  const det = detTerm1 - detTerm2;
  const ZERO = 0;
  if (det === ZERO) {
    return false;
  }

  const term1 = (d.y - c.y) * (d.x - a.x);
  const term2 = (c.x - d.x) * (d.y - a.y);
  const lambda = (term1 + term2) / det;

  const term3 = (a.y - b.y) * (d.x - a.x);
  const term4 = (b.x - a.x) * (d.y - a.y);
  const gamma = (term3 + term4) / det;
  const ONE = 1;

  // Strict intersection (0 < t < 1)
  return ZERO < lambda && lambda < ONE && ZERO < gamma && gamma < ONE;
};
