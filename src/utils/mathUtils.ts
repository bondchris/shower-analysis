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
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dx2 = dx * dx;
    const dy2 = dy * dy;
    const len = Math.sqrt(dx2 + dy2);
    if (len < MIN_EDGE_LENGTH) {
      return false;
    }

    // Angle Integity Check (Angle at p2)
    // Vector BA (p2 -> p1) and BC (p2 -> p3)
    const vBAx = x1 - x2;
    const vBAy = y1 - y2;
    const vBCx = x3 - x2;
    const vBCy = y3 - y2;

    const vBAx2 = vBAx * vBAx;
    const vBAy2 = vBAy * vBAy;
    const lenBA = Math.sqrt(vBAx2 + vBAy2);

    const vBCx2 = vBCx * vBCx;
    const vBCy2 = vBCy * vBCy;
    const lenBC = Math.sqrt(vBCx2 + vBCy2);

    if (lenBA < EPSILON || lenBC < EPSILON) {
      return false;
    } // Should be caught by edge length, but safety.

    // Dot product
    const dotX = vBAx * vBCx;
    const dotY = vBAy * vBCy;
    const dot = dotX + dotY;
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
  const vecA = { x: a2.x - a1.x, y: a2.y - a1.y };
  const vecB = { x: b2.x - b1.x, y: b2.y - b1.y };
  const crossTerm1 = vecA.x * vecB.y;
  const crossTerm2 = vecA.y * vecB.x;
  const cross = crossTerm1 - crossTerm2;
  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  const vecAtoB1 = { x: b1.x - a1.x, y: b1.y - a1.y };
  const cross2Term1 = vecA.x * vecAtoB1.y;
  const cross2Term2 = vecA.y * vecAtoB1.x;
  const cross2 = cross2Term1 - cross2Term2;
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
        const dx = ax - bx;
        const dy = ay - by;
        const dx2 = dx * dx;
        const dy2 = dy * dy;
        const distSq = dx2 + dy2;
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
        const termX = normal.x * p.x;
        const termY = normal.y * p.y;
        const projected = termX + termY;
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
        const termX = normal.x * p.x;
        const termY = normal.y * p.y;
        const projected = termX + termY;
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
