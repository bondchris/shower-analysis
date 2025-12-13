import { segmentsIntersect } from "./segment";
import { crossProduct, dotProduct, magnitudeSquared, subtract } from "./vector";

/**
 * Checks if a polygon is valid:
 * 1. At least 3 points.
 * 2. Coordinates finite and within bounds (+/- 10,000).
 * 3. No zero-length edges (> 1mm).
 * 4. Angle Sanity: No sharp spikes (< 5°) or flat angles (> 175°).
 * 5. No 3-point collinearity (redundant with angle check but kept for robustness).
 * 6. Implicitly closed (p0 !== p[n-1]).
 * 7. Non-degenerate area (> EPSILON) and Clockwise winding.
 * 8. No self-intersections.
 * 9. No collinear overlapping edges.
 */
export const checkPolygonIntegrity = (corners: number[][]): boolean => {
  const EPSILON = 1e-9;
  const MAX_COORDINATE = 10000;
  const MIN_EDGE_LENGTH = 0.001; // 1mm
  const MIN_ANGLE_DEG = 5;
  const MAX_ANGLE_DEG = 175;

  const X_IDX = 0;
  const Y_IDX = 1;
  const COORD_ZERO = 0;
  const NEXT_OFFSET = 1;
  const NEXT_OFFSET_2 = 2;
  const AREA_DIVISOR = 2;
  const CLAMP_MAX = 1;
  const CLAMP_MIN = -1;
  const RAD_TO_DEG = 180;
  const START_IDX = 0;
  const LAST_OFFSET = 1;
  const MIN_VERTICES = 3;

  if (corners.length < MIN_VERTICES) {
    return false;
  }

  // 1. Coordinate Validity Check
  for (const p of corners) {
    const x = p[X_IDX] ?? COORD_ZERO;
    const y = p[Y_IDX] ?? COORD_ZERO;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }
    if (Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) {
      return false;
    }
  }

  // 2. Implicit Closure Check
  const first = corners[START_IDX];
  const last = corners[corners.length - LAST_OFFSET];
  if (first !== undefined && last !== undefined) {
    const x1 = first[X_IDX] ?? COORD_ZERO;
    const y1 = first[Y_IDX] ?? COORD_ZERO;
    const xn = last[X_IDX] ?? COORD_ZERO;
    const yn = last[Y_IDX] ?? COORD_ZERO;
    if (Math.abs(x1 - xn) < EPSILON && Math.abs(y1 - yn) < EPSILON) {
      return false;
    }
  }

  // 3. Edge Length and Angle Check
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + NEXT_OFFSET) % corners.length];
    const p3 = corners[(i + NEXT_OFFSET_2) % corners.length];
    if (!p1 || !p2 || !p3) {
      continue;
    }

    const x1 = p1[X_IDX] ?? COORD_ZERO;
    const y1 = p1[Y_IDX] ?? COORD_ZERO;
    const x2 = p2[X_IDX] ?? COORD_ZERO;
    const y2 = p2[Y_IDX] ?? COORD_ZERO;
    const x3 = p3[X_IDX] ?? COORD_ZERO;
    const y3 = p3[Y_IDX] ?? COORD_ZERO;

    // Edge Length Check (p1 -> p2)
    const len = Math.sqrt(magnitudeSquared({ x: x2 - x1, y: y2 - y1 }));
    if (len < MIN_EDGE_LENGTH) {
      return false;
    }

    // Angle Integity Check (Angle at p2)
    // Vector BA (p2 -> p1) and BC (p2 -> p3)
    const vBAx = x1 - x2;
    const vBAy = y1 - y2;
    const vBCx = x3 - x2;
    const vBCy = y3 - y2;

    const lenBA = Math.sqrt(magnitudeSquared({ x: vBAx, y: vBAy }));
    const lenBC = Math.sqrt(magnitudeSquared({ x: vBCx, y: vBCy }));

    if (lenBA < EPSILON || lenBC < EPSILON) {
      return false;
    } // Should be caught by edge length, but safety.

    // Dot product
    // Dot product
    const dot = dotProduct({ x: vBAx, y: vBAy }, { x: vBCx, y: vBCy });
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
    const angleDeg = angleRad * (RAD_TO_DEG / Math.PI);

    if (angleDeg < MIN_ANGLE_DEG || angleDeg > MAX_ANGLE_DEG) {
      return false;
    }
  }

  // 4. Area and Winding Order (Clockwise)
  let area = 0;
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + NEXT_OFFSET) % corners.length];
    if (!p1 || !p2) {
      continue;
    }
    const x1 = p1[X_IDX] ?? COORD_ZERO;
    const y1 = p1[Y_IDX] ?? COORD_ZERO;
    const x2 = p2[X_IDX] ?? COORD_ZERO;
    const y2 = p2[Y_IDX] ?? COORD_ZERO;
    const width = x2 - x1;
    const height = y2 + y1;
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
  if (hasSelfIntersection(corners)) {
    return false;
  }
  if (hasCollinearOverlaps(corners)) {
    return false;
  }
  if (hasDuplicatePoints(corners)) {
    return false;
  }

  return true;
};

// Private helpers
const hasCollinearOverlaps = (corners: number[][]): boolean => {
  const X_IDX = 0;
  const Y_IDX = 1;
  const COORD_ZERO = 0;
  const n = corners.length;
  const ADJACENT_OFFSET = 1;
  const NEXT_OFFSET = 1;
  const START_IDX = 0;

  for (let i = 0; i < n; i++) {
    const pA1 = corners[i];
    const pA2 = corners[(i + NEXT_OFFSET) % n];
    if (!pA1 || !pA2) {
      continue;
    }

    const a1 = { x: pA1[X_IDX] ?? COORD_ZERO, y: pA1[Y_IDX] ?? COORD_ZERO };
    const a2 = { x: pA2[X_IDX] ?? COORD_ZERO, y: pA2[Y_IDX] ?? COORD_ZERO };

    // Check against other edges
    for (let j = i + ADJACENT_OFFSET; j < n; j++) {
      // Skip adjacent edges
      if (Math.abs(i - j) === ADJACENT_OFFSET || (i === START_IDX && j === n - ADJACENT_OFFSET)) {
        continue;
      }

      const pB1 = corners[j];
      const pB2 = corners[(j + NEXT_OFFSET) % n];
      if (!pB1 || !pB2) {
        continue;
      }

      const b1 = { x: pB1[X_IDX] ?? COORD_ZERO, y: pB1[Y_IDX] ?? COORD_ZERO };
      const b2 = { x: pB2[X_IDX] ?? COORD_ZERO, y: pB2[Y_IDX] ?? COORD_ZERO };

      if (areSegmentsCollinearOverlapping(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
};

const areSegmentsCollinearOverlapping = (
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): boolean => {
  const EPSILON = 1e-9;
  const vecA = subtract(a2, a1);
  const vecB = subtract(b2, b1);
  const cross = crossProduct(vecA, vecB);
  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  const vecAtoB1 = subtract(b1, a1);
  const cross2 = crossProduct(vecA, vecAtoB1);
  if (Math.abs(cross2) > EPSILON) {
    return false;
  }

  const isVertical = Math.abs(vecA.x) < EPSILON;
  const project = (p: { x: number; y: number }) => (isVertical ? p.y : p.x);

  let tA1 = project(a1);
  let tA2 = project(a2);
  let tB1 = project(b1);
  let tB2 = project(b2);

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

const hasSelfIntersection = (corners: number[][]): boolean => {
  const X_IDX = 0;
  const Y_IDX = 1;
  const COORD_ZERO = 0;
  const START_IDX = 0;
  const ADJACENT_OFFSET = 1;
  const NEXT_OFFSET = 1;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + NEXT_OFFSET) % n];
    if (!p1 || !p2) {
      continue;
    }

    const NEXT_EDGE_OFFSET = 2;
    for (let j = i + NEXT_EDGE_OFFSET; j < n; j++) {
      if (i === START_IDX && j === n - ADJACENT_OFFSET) {
        continue;
      }

      const p3 = corners[j];
      const p4 = corners[(j + NEXT_OFFSET) % n];
      if (!p3 || !p4) {
        continue;
      }

      if (
        segmentsIntersect(
          { x: p1[X_IDX] ?? COORD_ZERO, y: p1[Y_IDX] ?? COORD_ZERO },
          { x: p2[X_IDX] ?? COORD_ZERO, y: p2[Y_IDX] ?? COORD_ZERO },
          { x: p3[X_IDX] ?? COORD_ZERO, y: p3[Y_IDX] ?? COORD_ZERO },
          { x: p4[X_IDX] ?? COORD_ZERO, y: p4[Y_IDX] ?? COORD_ZERO }
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

const hasDuplicatePoints = (corners: number[][]): boolean => {
  const EPSILON = 1e-9;
  const EPSILON_SQ = EPSILON * EPSILON;
  const X_IDX = 0;
  const Y_IDX = 1;
  const COORD_ZERO = 0;
  const NEXT_OFFSET = 1;

  const n = corners.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + NEXT_OFFSET; j < n; j++) {
      const pA = corners[i];
      const pB = corners[j];
      if (pA && pB) {
        const ax = pA[X_IDX] ?? COORD_ZERO;
        const ay = pA[Y_IDX] ?? COORD_ZERO;
        const bx = pB[X_IDX] ?? COORD_ZERO;
        const by = pB[Y_IDX] ?? COORD_ZERO;
        const distSq = magnitudeSquared({ x: ax - bx, y: ay - by });
        if (distSq < EPSILON_SQ) {
          return true;
        }
      }
    }
  }
  return false;
};

export function doPolygonsIntersect(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  const polygons = [a, b];
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const NEXT_OFF = 1;
      const p1 = polygon[i];
      const p2 = polygon[(i + NEXT_OFF) % polygon.length];

      if (!p1 || !p2) {
        continue;
      }

      const normal = { x: -(p2.y - p1.y), y: p2.x - p1.x };

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of a) {
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
      for (const p of b) {
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
}
