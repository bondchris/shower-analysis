import { crossProduct, dotProduct, magnitudeSquared, subtract } from "./vector";

export const distToSegment = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number => {
  // l2 = length squared of segment vw
  const l2 = magnitudeSquared({ x: v.x - w.x, y: v.y - w.y });
  const ZERO_LENGTH = 0;
  if (l2 === ZERO_LENGTH) {
    return Math.sqrt(magnitudeSquared(subtract(p, v)));
  }
  // t = projection of p onto line vw, clamped between 0 and 1
  // t = dot(p - v, w - v) / l2
  const pv = subtract(p, v);
  const wv = subtract(w, v);

  const dotP = dotProduct(pv, wv);
  let t = dotP / l2;
  const MIN_CLAMP = 0;
  const MAX_CLAMP = 1;
  t = Math.max(MIN_CLAMP, Math.min(MAX_CLAMP, t));
  // Projection Point = v + t * (w - v)
  const tX = t * (w.x - v.x);
  const projX = v.x + tX;
  const tY = t * (w.y - v.y);
  const projY = v.y + tY;
  return Math.sqrt(magnitudeSquared({ x: p.x - projX, y: p.y - projY }));
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

  const det = crossProduct(subtract(b, a), subtract(d, c));
  const ZERO = 0;
  if (det === ZERO) {
    return false;
  }

  const lambda = crossProduct(subtract(d, a), subtract(d, c)) / det;
  const gamma = crossProduct(subtract(b, a), subtract(d, a)) / det;
  const ONE = 1;

  // Strict intersection (0 < t < 1)
  return ZERO < lambda && lambda < ONE && ZERO < gamma && gamma < ONE;
};
