export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Calculates the dot product of two 2D vectors.
 * Dot Product = (a.x * b.x) + (a.y * b.y)
 */
export const dotProduct = (a: Vector2D, b: Vector2D): number => {
  const xTerm = a.x * b.x;
  const yTerm = a.y * b.y;
  return xTerm + yTerm;
};

/**
 * Calculates the squared magnitude of a vector.
 * Useful for distance comparisons without square roots.
 * |v|^2 = v . v
 */
export const magnitudeSquared = (v: Vector2D): number => {
  return dotProduct(v, v);
};

/**
 * Calculates the cross product of two 2D vectors (z-component).
 * Cross Product = (a.x * b.y) - (a.y * b.x)
 */
export const crossProduct = (a: Vector2D, b: Vector2D): number => {
  const term1 = a.x * b.y;
  const term2 = a.y * b.x;
  return term1 - term2;
};

/**
 * Subtracts vector b from vector a (a - b).
 */
export const subtract = (a: Vector2D, b: Vector2D): Vector2D => {
  return { x: a.x - b.x, y: a.y - b.y };
};
