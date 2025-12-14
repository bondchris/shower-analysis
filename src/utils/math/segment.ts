import { Point } from "../../models/point";
import { EPSILON } from "./constants";
import { crossProduct, dotProduct, magnitudeSquared, subtract } from "./vector";

export const distToSegment = (p: Point, v: Point, w: Point): number => {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    !Number.isFinite(v.x) ||
    !Number.isFinite(v.y) ||
    !Number.isFinite(w.x) ||
    !Number.isFinite(w.y)
  ) {
    throw new Error("Invalid point coordinates");
  }
  // l2 = length squared of segment vw
  const l2 = magnitudeSquared(subtract(v, w));
  if (l2 < EPSILON) {
    return Math.sqrt(magnitudeSquared(subtract(p, v)));
  }
  // t = projection of p onto line vw, clamped between 0 and 1
  const pv = subtract(p, v);
  const wv = subtract(w, v);
  const dotP = dotProduct(pv, wv);

  let t = dotP / l2;
  const MIN_CLAMP = 0;
  const MAX_CLAMP = 1;
  t = Math.max(MIN_CLAMP, Math.min(MAX_CLAMP, t));

  // Projection Point = v + t * (w - v)
  // Reuse wv (w - v) which is already calculated
  const px = t * wv.x;
  const py = t * wv.y;
  const projection = new Point(v.x + px, v.y + py);
  return Math.sqrt(magnitudeSquared(subtract(p, projection)));
};

// Rename to doSegmentsIntersect for clarity
export const doSegmentsIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
  // Input Validation
  const points = [a, b, c, d];
  if (!points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return false;
  }

  const det = crossProduct(subtract(b, a), subtract(d, c));
  if (Math.abs(det) < EPSILON) {
    return false;
  }

  const lambda = crossProduct(subtract(d, a), subtract(d, c)) / det;
  const gamma = crossProduct(subtract(b, a), subtract(d, a)) / det;
  const ZERO = 0;
  const ONE = 1;

  // Strict intersection (0 < t < 1)
  return ZERO < lambda && lambda < ONE && ZERO < gamma && gamma < ONE;
};

export const getSegmentIntersection = (a: Point, b: Point, c: Point, d: Point): Point | null => {
  // Input Validation
  const points = [a, b, c, d];
  if (!points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return null;
  }

  const det = crossProduct(subtract(b, a), subtract(d, c));
  if (Math.abs(det) < EPSILON) {
    return null;
  }

  const lambda = crossProduct(subtract(d, a), subtract(d, c)) / det;
  const gamma = crossProduct(subtract(b, a), subtract(d, a)) / det;
  const ZERO = 0;
  const ONE = 1;

  // Strict intersection (0 < t < 1)
  if (ZERO < lambda && lambda < ONE && ZERO < gamma && gamma < ONE) {
    // Intersection point = a + lambda * (b - a)
    const ab = subtract(b, a);
    const dx = lambda * ab.x;
    const dy = lambda * ab.y;
    return new Point(a.x + dx, a.y + dy);
  }

  return null;
};
