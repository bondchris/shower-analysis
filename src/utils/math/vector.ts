import { Point } from "../../models/point";
import { EPSILON } from "./constants";

/**
 * Calculates the dot product of two 2D vectors.
 * Dot Product = (a.x * b.x) + (a.y * b.y)
 */
export const dotProduct = (a: Point, b: Point): number => {
  const xTerm = a.x * b.x;
  const yTerm = a.y * b.y;
  return xTerm + yTerm;
};

/**
 * Calculates the squared magnitude of a vector.
 * Useful for distance comparisons without square roots.
 * |v|^2 = v . v
 */
export const magnitudeSquared = (v: Point): number => {
  return dotProduct(v, v);
};

/**
 * Calculates the cross product of two 2D vectors (z-component).
 * Cross Product = (a.x * b.y) - (a.y * b.x)
 */
export const crossProduct = (a: Point, b: Point): number => {
  const term1 = a.x * b.y;
  const term2 = a.y * b.x;
  return term1 - term2;
};

/**
 * Subtracts vector b from vector a (a - b).
 */
export const subtract = (a: Point, b: Point): Point => {
  return new Point(a.x - b.x, a.y - b.y);
};

/**
 * Adds two vectors (a + b).
 */
export const add = (a: Point, b: Point): Point => {
  return new Point(a.x + b.x, a.y + b.y);
};

/**
 * Scales a vector by a scalar value s.
 */
export const scale = (v: Point, s: number): Point => {
  return new Point(v.x * s, v.y * s);
};

/**
 * Calculates the squared distance between two points.
 */
export const distanceSquared = (a: Point, b: Point): number => {
  return magnitudeSquared(subtract(a, b));
};

/**
 * Calculates the magnitude (length) of a vector.
 */
export const magnitude = (v: Point): number => {
  return Math.sqrt(magnitudeSquared(v));
};

// Helper constants for vector operations
const ZERO = 0;
const ONE = 1;

/**
 * Returns a normalized (unit) vector.
 * Returns zero vector if magnitude is zero.
 */
export const normalize = (v: Point): Point => {
  const m = magnitude(v);
  if (m === ZERO) {
    return new Point(ZERO, ZERO);
  }
  return scale(v, ONE / m);
};

/**
 * Checks if two vectors are equal within an optional epsilon.
 * If epsilon is 0 (default), checks for exact equality.
 */
export const equals = (a: Point, b: Point, epsilon: number = EPSILON): boolean => {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
};

/**
 * Calculates the angle in radians between two vectors.
 * Returns 0 if either vector has zero magnitude.
 */
export const angleBetween = (v: Point, w: Point): number => {
  const dot = dotProduct(v, w);
  const magV = magnitude(v);
  const magW = magnitude(w);
  const ZERO = 0;
  const ONE = 1;

  if (magV === ZERO || magW === ZERO) {
    return ZERO;
  }

  const cosTheta = dot / (magV * magW);
  const CLAMP_MIN = -1;
  return Math.acos(Math.max(CLAMP_MIN, Math.min(ONE, cosTheta)));
};
