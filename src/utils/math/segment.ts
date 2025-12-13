import { Point } from "../../models/point";
import { crossProduct, dotProduct, magnitudeSquared, subtract } from "./vector";

export const distToSegment = (p: Point, v: Point, w: Point): number => {
  // l2 = length squared of segment vw
  const l2 = magnitudeSquared(new Point(v.x - w.x, v.y - w.y));
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
  return Math.sqrt(magnitudeSquared(new Point(p.x - projX, p.y - projY)));
};

export const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
  // Input Validation
  const points = [a, b, c, d];
  if (!points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
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
