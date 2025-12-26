import convert from "convert-units";

import { Point } from "../../models/point";
import { EPSILON } from "./constants";
import { doSegmentsIntersect } from "./segment";
import { crossProduct, dotProduct, magnitudeSquared, subtract } from "./vector";

/**
 * Checks if a polygon is valid according to geometric and business rules.
 *
 * Rules:
 * 1. At least 3 points.
 * 2. Coordinates are finite and within reasonable bounds (+/- 10,000).
 * 3. No degenerate edges (length < 1mm).
 * 4. Angle Sanity: Polygons should not have extremely sharp spikes (< 5°) or be effectively flat (> 175°).
 *    This filters out scanning noise or "sliver" updates.
 * 5. Implicitly closed (last point != first point).
 * 6. Non-degenerate area (> EPSILON) and Clockwise winding (negative signed area).
 * 7. No self-intersections or collinear overlapping edges.
 */
export const checkPolygonIntegrity = (points: Point[]): boolean => {
  const MAX_COORDINATE = 10000;
  const MIN_EDGE_LENGTH = 0.001; // 1mm
  const MIN_ANGLE_DEG = 5;
  const MAX_ANGLE_DEG = 175;

  const NEXT_OFFSET = 1;
  const NEXT_OFFSET_2 = 2;
  const CLAMP_MAX = 1;
  const CLAMP_MIN = -1;
  const START_IDX = 0;
  const LAST_OFFSET = 1;
  const MIN_VERTICES = 3;

  if (points.length < MIN_VERTICES) {
    return false;
  }

  // 1. Coordinate Validity Check
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return false;
    }
    if (Math.abs(p.x) > MAX_COORDINATE || Math.abs(p.y) > MAX_COORDINATE) {
      return false;
    }
  }

  // 2. Implicit Closure Check
  const first = points[START_IDX];
  const last = points[points.length - LAST_OFFSET];
  if (first && last) {
    if (Math.abs(first.x - last.x) < EPSILON && Math.abs(first.y - last.y) < EPSILON) {
      return false;
    }
  }

  // 3. Edge Length and Angle Check
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + NEXT_OFFSET) % points.length];
    const p3 = points[(i + NEXT_OFFSET_2) % points.length];
    if (!p1 || !p2 || !p3) {
      continue;
    }

    // Edge Length Check (p1 -> p2)
    const len = Math.sqrt(magnitudeSquared(subtract(p2, p1)));
    if (len < MIN_EDGE_LENGTH) {
      return false;
    }

    // Angle Integity Check (Angle at p2)
    // Vector BA (p2 -> p1) and BC (p2 -> p3)
    const vBA = subtract(p1, p2);
    const vBC = subtract(p3, p2);

    const lenBA = Math.sqrt(magnitudeSquared(vBA));
    const lenBC = Math.sqrt(magnitudeSquared(vBC));

    if (lenBA < EPSILON || lenBC < EPSILON) {
      return false;
    } // Should be caught by edge length, but safety.

    // Dot product
    const dot = dotProduct(vBA, vBC);
    // Cos theta
    let cosTheta = dot / (lenBA * lenBC);
    // Clamp for float errors
    if (cosTheta > CLAMP_MAX) {
      cosTheta = CLAMP_MAX;
    }
    if (cosTheta < CLAMP_MIN) {
      cosTheta = CLAMP_MIN;
    }

    const angleRad = Math.acos(cosTheta);
    const angleDeg = convert(angleRad).from("rad").to("deg");

    if (angleDeg < MIN_ANGLE_DEG || angleDeg > MAX_ANGLE_DEG) {
      return false;
    }
  }

  // 4. Area and Winding Order (Clockwise)
  let area = 0;
  const AREA_DIVISOR = 2;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + NEXT_OFFSET) % points.length];
    if (!p1 || !p2) {
      continue;
    }
    const width = p2.x - p1.x;
    const height = p2.y + p1.y;
    area += width * height;
  }
  area /= AREA_DIVISOR;

  // Non-degenerate area check
  if (Math.abs(area) < EPSILON) {
    return false;
  }
  // Winding check: Must be effectively negative (Clockwise)
  if (area > -EPSILON) {
    return false;
  }

  // 4. Self-intersection and Collinear Overlap
  if (hasSelfIntersection(points)) {
    return false;
  }
  if (hasCollinearOverlaps(points)) {
    return false;
  }
  if (hasDuplicatePoints(points)) {
    return false;
  }

  return true;
};

// Private helpers
const hasCollinearOverlaps = (points: Point[]): boolean => {
  const n = points.length;
  const ADJACENT_OFFSET = 1;
  const NEXT_OFFSET = 1;
  const START_IDX = 0;

  for (let i = 0; i < n; i++) {
    const pA1 = points[i];
    const pA2 = points[(i + NEXT_OFFSET) % n];
    if (!pA1 || !pA2) {
      continue;
    }

    // Check against other edges
    for (let j = i + ADJACENT_OFFSET; j < n; j++) {
      // Skip adjacent edges
      if (Math.abs(i - j) === ADJACENT_OFFSET || (i === START_IDX && j === n - ADJACENT_OFFSET)) {
        continue;
      }

      const pB1 = points[j];
      const pB2 = points[(j + NEXT_OFFSET) % n];
      if (!pB1 || !pB2) {
        continue;
      }

      if (areSegmentsCollinearOverlapping(pA1, pA2, pB1, pB2)) {
        return true;
      }
    }
  }
  return false;
};

const areSegmentsCollinearOverlapping = (p1: Point, p2: Point, q1: Point, q2: Point): boolean => {
  const vecA = subtract(p2, p1);
  const vecB = subtract(q2, q1);
  const cross = crossProduct(vecA, vecB);
  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  const vecAtoB1 = subtract(q1, p1); // q1 - p1
  const cross2 = crossProduct(vecA, vecAtoB1);
  if (Math.abs(cross2) > EPSILON) {
    return false;
  }

  const isVertical = Math.abs(vecA.x) < EPSILON;
  const project = (p: Point) => (isVertical ? p.y : p.x);

  let tA1 = project(p1);
  let tA2 = project(p2);
  let tB1 = project(q1);
  let tB2 = project(q2);

  if (tA1 > tA2) {
    [tA1, tA2] = [tA2, tA1];
  }
  if (tB1 > tB2) {
    [tB1, tB2] = [tB2, tB1];
  }

  const overlapStart = Math.max(tA1, tB1);
  const overlapEnd = Math.min(tA2, tB2);

  return overlapEnd - overlapStart > EPSILON;
};

const hasSelfIntersection = (points: Point[]): boolean => {
  const cleanPoints = (points as (Point | null | undefined)[]).filter((p): p is Point => p !== null && p !== undefined);
  const n = cleanPoints.length;
  const START_IDX = 0;
  const ADJACENT_OFFSET = 1;
  const NEXT_OFFSET = 1;

  for (let i = 0; i < n; i++) {
    const p1 = cleanPoints[i];
    const p2 = cleanPoints[(i + NEXT_OFFSET) % n];

    if (!p1 || !p2) {
      continue;
    }

    const NEXT_EDGE_OFFSET = 2;
    for (let j = i + NEXT_EDGE_OFFSET; j < n; j++) {
      if (i === START_IDX && j === n - ADJACENT_OFFSET) {
        continue;
      }

      const p3 = cleanPoints[j];
      const p4 = cleanPoints[(j + NEXT_OFFSET) % n];

      if (!p3 || !p4) {
        continue;
      }

      if (doSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  return false;
};

const hasDuplicatePoints = (points: Point[]): boolean => {
  const EPSILON_SQ = EPSILON * EPSILON;
  const NEXT_OFFSET = 1;

  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + NEXT_OFFSET; j < n; j++) {
      const pA = points[i];
      const pB = points[j];
      if (pA && pB) {
        const distSq = magnitudeSquared(subtract(pB, pA));
        if (distSq < EPSILON_SQ) {
          return true;
        }
      }
    }
  }
  return false;
};

// Public API
/**
 * Checks if two convex polygons intersect using the Separating Axis Theorem (SAT).
 * Returns true if an overlap exists on all axes.
 * Note: Assumes polygons are convex.
 */
export const doPolygonsIntersect = (poly1: Point[], poly2: Point[]): boolean => {
  const cleanPoly1 = (poly1 as (Point | null | undefined)[]).filter((p): p is Point => p !== null && p !== undefined);
  const cleanPoly2 = (poly2 as (Point | null | undefined)[]).filter((p): p is Point => p !== null && p !== undefined);
  const polygons = [cleanPoly1, cleanPoly2];

  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const NEXT_OFF = 1;
      const p1 = polygon[i];
      const p2 = polygon[(i + NEXT_OFF) % polygon.length];

      if (!p1 || !p2) {
        continue;
      }

      const normal = new Point(-(p2.y - p1.y), p2.x - p1.x);

      const FIRST_POLY_IDX = 0;
      const SECOND_POLY_IDX = 1;

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of polygons[FIRST_POLY_IDX] ?? []) {
        const projected = dotProduct(normal, p);
        if (projected < minA) {
          minA = projected;
        }
        if (projected > maxA) {
          maxA = projected;
        }
      }

      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of polygons[SECOND_POLY_IDX] ?? []) {
        const projected = dotProduct(normal, p);
        if (projected < minB) {
          minB = projected;
        }
        if (projected > maxB) {
          maxB = projected;
        }
      }

      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }
  return true;
};
