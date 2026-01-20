/**
 * Spherical Coverage Analysis for AR Camera Data
 *
 * This module computes how much of a spherical viewing space the camera covered during
 * an AR scanning session. It uses an equirectangular projection where:
 *
 * **Coordinate System:**
 * - Latitude (row): Maps Y-axis direction to vertical position. Ranges from -π/2 (bottom)
 *   to +π/2 (top), normalized to grid rows 0-71. Row 0 = looking straight down (-90°),
 *   row 36 = horizon (0°), row 71 = looking straight up (+90°).
 * - Longitude (col): Maps XZ-plane direction to horizontal position using atan2(x, z).
 *   Ranges from -π to +π, normalized to grid columns 0-143. Column 0 = -180°,
 *   column 72 = 0° (forward), column 143 = +180°.
 *
 * **Grid Resolution:**
 * - 72 rows × 144 columns = 10,368 bins
 * - Each bin represents 2.5° latitude × 2.5° longitude
 *
 * **Algorithm Overview:**
 * 1. For each AR frame, sample rays across the camera's field of view
 * 2. Transform rays to be relative to the initial camera orientation
 * 3. Convert 3D ray directions to latitude/longitude grid coordinates
 * 4. Build a convex hull around the sample points to approximate the visible region
 * 5. Rasterize the hull onto the grid using scanline filling
 * 6. Accumulate viewing time per grid cell
 */
import { ArData } from "../../models/arData/arData";
import { Intrinsics9 } from "../../models/arData/cameraIntrinsics";
import { CoverageSphere } from "../../models/arData/coverageSphere";
import { Matrix16, Position3D, dotProduct3D, normalize3D } from "../math/transform";

interface RotationBasis {
  forward: Position3D;
  right: Position3D;
  up: Position3D;
}

interface ValidFrame {
  basis: RotationBasis;
  cameraIntrinsics: Intrinsics9;
  cameraResolution: { width: number; height: number };
  timestamp: number;
}

interface GridPoint {
  col: number;
  row: number;
}

const GRID_ROWS = 72;
const GRID_COLS = 144;

const hasFiniteIntrinsics = (intrinsics: Intrinsics9): boolean => {
  return intrinsics.every((value) => Number.isFinite(value));
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const buildRotationBasis = (transform: Matrix16): RotationBasis | null => {
  const minBasisMagnitude = 1e-6;
  const forwardXIndex = 8;
  const forwardYIndex = 9;
  const forwardZIndex = 10;
  const rightXIndex = 0;
  const rightYIndex = 1;
  const rightZIndex = 2;
  const upXIndex = 4;
  const upYIndex = 5;
  const upZIndex = 6;

  const forward = normalize3D({
    x: transform[forwardXIndex],
    y: transform[forwardYIndex],
    z: transform[forwardZIndex]
  });
  const right = normalize3D({
    x: transform[rightXIndex],
    y: transform[rightYIndex],
    z: transform[rightZIndex]
  });
  const up = normalize3D({
    x: transform[upXIndex],
    y: transform[upYIndex],
    z: transform[upZIndex]
  });

  const isDegenerate = (basisVector: Position3D) => {
    const magnitude = Math.abs(basisVector.x) + Math.abs(basisVector.y) + Math.abs(basisVector.z);
    return magnitude < minBasisMagnitude;
  };

  if (isDegenerate(forward) || isDegenerate(right) || isDegenerate(up)) {
    return null;
  }

  return { forward, right, up };
};

const multiplyToInitialBasis = (initial: RotationBasis, current: RotationBasis): RotationBasis => {
  const buildColumn = (worldAxis: Position3D): Position3D => {
    return {
      x: dotProduct3D(worldAxis, initial.right),
      y: dotProduct3D(worldAxis, initial.up),
      z: dotProduct3D(worldAxis, initial.forward)
    };
  };

  return {
    forward: normalize3D(buildColumn(current.forward)),
    right: normalize3D(buildColumn(current.right)),
    up: normalize3D(buildColumn(current.up))
  };
};

const applyBasis = (basis: RotationBasis, vector: Position3D): Position3D => {
  const rightContributionX = basis.right.x * vector.x;
  const upContributionX = basis.up.x * vector.y;
  const forwardContributionX = basis.forward.x * vector.z;
  const rightContributionY = basis.right.y * vector.x;
  const upContributionY = basis.up.y * vector.y;
  const forwardContributionY = basis.forward.y * vector.z;
  const rightContributionZ = basis.right.z * vector.x;
  const upContributionZ = basis.up.z * vector.y;
  const forwardContributionZ = basis.forward.z * vector.z;
  return {
    x: rightContributionX + upContributionX + forwardContributionX,
    y: rightContributionY + upContributionY + forwardContributionY,
    z: rightContributionZ + upContributionZ + forwardContributionZ
  };
};

interface BuildValidFramesResult {
  rawTimestampCount: number;
  validFrames: ValidFrame[];
}

const buildValidFrames = (arData: ArData): BuildValidFramesResult => {
  const sortedTimestampKeys = Object.keys(arData.data)
    .map((key) => parseFloat(key))
    .filter((value): value is number => Number.isFinite(value))
    .sort((a, b) => a - b)
    .filter((value): value is number => Number.isFinite(value));

  const validFrames: ValidFrame[] = [];

  for (const key of sortedTimestampKeys) {
    const frame = arData.data[key.toString()];

    if (frame?.cameraIntrinsics === undefined || !hasFiniteIntrinsics(frame.cameraIntrinsics)) {
      continue;
    }

    const basis = buildRotationBasis(frame.cameraTransform);
    if (basis === null) {
      continue;
    }

    validFrames.push({
      basis,
      cameraIntrinsics: frame.cameraIntrinsics,
      cameraResolution: frame.cameraResolution,
      timestamp: key
    });
  }

  return { rawTimestampCount: sortedTimestampKeys.length, validFrames };
};

const computeMedianDelta = (validFrames: ValidFrame[]): number => {
  const fallbackFps = 30;
  const minFramesForDelta = 2;
  const medianDivisor = 2;
  const defaultMedian = 0;
  const nextIndexOffset = 1;

  if (validFrames.length < minFramesForDelta) {
    return nextIndexOffset / fallbackFps;
  }

  const timeDeltas: number[] = [];
  for (let i = 0; i < validFrames.length - nextIndexOffset; i++) {
    const current = validFrames[i];
    const next = validFrames[i + nextIndexOffset];
    if (current !== undefined && next !== undefined) {
      timeDeltas.push(next.timestamp - current.timestamp);
    }
  }

  if (timeDeltas.length === defaultMedian) {
    return nextIndexOffset / fallbackFps;
  }

  const sortedDeltas = [...timeDeltas].sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedDeltas.length / medianDivisor);
  const medianDelta = sortedDeltas[medianIndex] ?? defaultMedian;
  return Math.max(medianDelta, nextIndexOffset / fallbackFps);
};

/**
 * Computes 2D cross product for three points to determine turn direction.
 * Used by the convex hull algorithm to determine if points form a left or right turn.
 * @returns Positive for counter-clockwise (left turn), negative for clockwise (right turn)
 */
const cross2D = (origin: GridPoint, a: GridPoint, b: GridPoint): number => {
  const deltaAX = a.col - origin.col;
  const deltaAY = a.row - origin.row;
  const deltaBX = b.col - origin.col;
  const deltaBY = b.row - origin.row;
  const crossPrimary = deltaAX * deltaBY;
  const crossSecondary = deltaAY * deltaBX;
  return crossPrimary - crossSecondary;
};

/**
 * Builds a convex hull around a set of 2D grid points using Andrew's monotone chain algorithm.
 *
 * **Why Convex Hull?**
 * The camera's field of view projects onto the sphere as a roughly rectangular region.
 * Rather than rasterizing individual sample points (which would leave gaps), we compute
 * the convex hull to get a continuous polygon that can be efficiently filled. This ensures
 * complete coverage of the visible region without oversampling.
 *
 * **Algorithm:**
 * 1. Sort points by X coordinate (column), breaking ties by Y (row)
 * 2. Build lower hull by processing points left-to-right, keeping only right turns
 * 3. Build upper hull by processing points right-to-left, keeping only right turns
 * 4. Concatenate lower and upper hulls (removing duplicated endpoints)
 *
 * @param points - Sample points from ray casting in grid coordinates
 * @returns Vertices of the convex hull in counter-clockwise order
 */
const buildConvexHull = (points: GridPoint[]): GridPoint[] => {
  const minPointsForPolygon = 3;
  const minHullStackSize = 2;
  const lastIndexOffset = 1;
  const secondLastOffset = 2;
  const startIndex = 0;
  const crossProductThreshold = 0;

  if (points.length < minPointsForPolygon) {
    return points;
  }

  const sortedPoints = [...points].sort((a, b) => (a.col === b.col ? a.row - b.row : a.col - b.col));

  const lower: { col: number; row: number }[] = [];
  for (const point of sortedPoints) {
    while (lower.length >= minHullStackSize) {
      const secondLast = lower[lower.length - secondLastOffset] as { col: number; row: number };
      const last = lower[lower.length - lastIndexOffset] as { col: number; row: number };
      if (cross2D(secondLast, last, point) <= crossProductThreshold) {
        lower.pop();
      } else {
        break;
      }
    }
    lower.push(point);
  }

  const upper: { col: number; row: number }[] = [];
  for (let i = sortedPoints.length - lastIndexOffset; i >= startIndex; i--) {
    const point = sortedPoints[i] as { col: number; row: number };
    while (upper.length >= minHullStackSize) {
      const secondLast = upper[upper.length - secondLastOffset] as { col: number; row: number };
      const last = upper[upper.length - lastIndexOffset] as { col: number; row: number };
      if (cross2D(secondLast, last, point) <= crossProductThreshold) {
        upper.pop();
      } else {
        break;
      }
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
};

/**
 * Rasterizes a convex hull polygon onto the coverage grid using scanline filling.
 *
 * **Algorithm:**
 * For each row that intersects the hull:
 * 1. Find all X-coordinates where the scanline crosses hull edges
 * 2. Sort intersections left-to-right
 * 3. Fill pixels between each pair of intersections (even-odd fill rule)
 *
 * **Column Wrapping:**
 * Grid columns wrap around (column 144 → column 0) to handle the 360°/0° boundary.
 * This is critical because the longitude seam at ±180° should connect seamlessly.
 *
 * **Fallback for Small Hulls:**
 * If fewer than 3 points exist (can't form a polygon), individual points are
 * rasterized directly rather than attempting scanline fill.
 *
 * @param hull - Convex hull vertices in counter-clockwise order
 * @param coverageGrid - Grid to accumulate coverage time into (mutated)
 * @param deltaSeconds - Time duration to add to each covered cell
 * @param gridRows - Number of rows in the grid
 * @param gridCols - Number of columns in the grid
 */
const rasterizeHull = (
  hull: GridPoint[],
  coverageGrid: number[][],
  deltaSeconds: number,
  gridRows: number,
  gridCols: number
): void => {
  const minPointsForPolygon = 3;
  const scanlineCenterOffset = 0.5;
  const startIndex = 0;
  const nextIndexOffset = 1;
  const intersectionPairStep = 2;
  const defaultValue = 0;

  const modCol = (value: number): number => {
    return ((value % gridCols) + gridCols) % gridCols;
  };

  if (hull.length >= minPointsForPolygon) {
    const minRow = Math.max(startIndex, Math.floor(Math.min(...hull.map((p) => p.row))));
    const maxRow = Math.min(gridRows - nextIndexOffset, Math.ceil(Math.max(...hull.map((p) => p.row))));

    const hullLength = hull.length;
    for (let targetRow = minRow; targetRow <= maxRow; targetRow++) {
      const scanlineY = targetRow + scanlineCenterOffset;
      const intersections: number[] = [];

      for (let j = startIndex; j < hullLength; j++) {
        const current = hull[j] as { col: number; row: number };
        const next = hull[(j + nextIndexOffset) % hullLength] as { col: number; row: number };

        const y1 = current.row;
        const y2 = next.row;
        if ((y1 <= scanlineY && y2 > scanlineY) || (y2 <= scanlineY && y1 > scanlineY)) {
          const deltaY = y2 - y1;
          const deltaX = next.col - current.col;
          const t = (scanlineY - y1) / deltaY;
          const scaledDeltaX = t * deltaX;
          const x = current.col + scaledDeltaX;
          intersections.push(x);
        }
      }

      intersections.sort((a, b) => a - b);
      const intersectionValues = Float64Array.from(intersections);
      for (let k = startIndex; k + nextIndexOffset < intersectionValues.length; k += intersectionPairStep) {
        const start = Number(intersectionValues[k]);
        const end = Number(intersectionValues[k + nextIndexOffset]);
        const colStart = Math.floor(Math.min(start, end));
        const colEnd = Math.floor(Math.max(start, end));
        for (let c = colStart; c <= colEnd; c++) {
          const wrappedCol = modCol(c);
          const coverageRow = coverageGrid[targetRow] ?? (coverageGrid[targetRow] = new Array<number>(gridCols));
          const existingValue = coverageRow[wrappedCol] ?? defaultValue;
          coverageRow[wrappedCol] = existingValue + deltaSeconds;
        }
      }
    }
  } else {
    for (const point of hull) {
      const wrappedCol = modCol(Math.floor(point.col));
      const wrappedRow = clamp(Math.floor(point.row), startIndex, gridRows - nextIndexOffset);
      const coverageRow = coverageGrid[wrappedRow] ?? (coverageGrid[wrappedRow] = new Array<number>(gridCols));
      const existingValue = coverageRow[wrappedCol] ?? defaultValue;
      coverageRow[wrappedCol] = existingValue + deltaSeconds;
    }
  }
};

export const buildSampleRays = (
  cameraIntrinsics: Intrinsics9,
  cameraResolution: { width: number; height: number },
  sampleRows: number,
  sampleCols: number
): Position3D[] => {
  const minFocalLength = 1e-6;
  const fxIndex = 0;
  const fyIndex = 4;
  const cxIndex = 6;
  const cyIndex = 7;
  const halfPixel = 0.5;
  const unitDepth = 1;
  const fx = cameraIntrinsics[fxIndex];
  const fy = cameraIntrinsics[fyIndex];
  const cx = cameraIntrinsics[cxIndex];
  const cy = cameraIntrinsics[cyIndex];

  if (!Number.isFinite(fx) || !Number.isFinite(fy) || Math.abs(fx) < minFocalLength || Math.abs(fy) < minFocalLength) {
    return [];
  }

  const rays: Position3D[] = [];
  const width = cameraResolution.width;
  const height = cameraResolution.height;

  for (let row = 0; row < sampleRows; row++) {
    const pixelY = ((row + halfPixel) / sampleRows) * height;
    const y = (pixelY - cy) / fy;
    for (let col = 0; col < sampleCols; col++) {
      const pixelX = ((col + halfPixel) / sampleCols) * width;
      const x = (pixelX - cx) / fx;
      rays.push(normalize3D({ x, y, z: unitDepth }));
    }
  }

  return rays;
};

/**
 * Computes spherical coverage from AR camera tracking data.
 *
 * This function analyzes where the camera looked during a scanning session and produces
 * a coverage grid showing cumulative viewing time for each direction on the sphere.
 *
 * **Process:**
 * 1. Extract valid frames with camera intrinsics and transforms
 * 2. For each frame, generate sample rays across the camera's field of view
 * 3. Transform rays relative to the initial camera orientation (first frame = origin)
 * 4. Convert ray directions to spherical coordinates (latitude/longitude)
 * 5. Build convex hull around sample points and rasterize to grid
 * 6. Accumulate viewing time based on frame duration
 *
 * **Coordinate Normalization:**
 * All camera orientations are transformed relative to the first valid frame. This means
 * the coverage sphere shows relative viewing directions, not absolute world coordinates.
 * The "forward" direction in the sphere corresponds to where the camera initially pointed.
 *
 * @param arData - AR session data containing camera transforms per timestamp
 * @param options - Optional ray builder for testing/customization
 * @returns Coverage sphere with grid of viewing times, or null if insufficient data
 */
export const computeSphericalCoverage = (
  arData: ArData,
  options?: { rayBuilder?: typeof buildSampleRays }
): CoverageSphere | null => {
  const minimumFramesRequired = 2;
  const sampleRowCount = 12;
  const sampleColCount = 16;
  const halfTurn = 2;
  const gridColHalfSpan = GRID_COLS / halfTurn;
  const halfCircleRadians = Math.PI / halfTurn;
  const fullCircleRadians = Math.PI * halfTurn;
  const nextIndexOffset = 1;
  const unitClamp = 1;
  const emptyLength = 0;

  const { rawTimestampCount, validFrames } = buildValidFrames(arData);
  if (rawTimestampCount < minimumFramesRequired) {
    return null;
  }

  const [firstFrame] = validFrames;
  if (firstFrame === undefined) {
    return null;
  }

  const initialBasis = firstFrame.basis;
  const coverageGrid: number[][] = new Array<number[]>(GRID_ROWS);
  const sampleCount = sampleRowCount * sampleColCount;
  const sampleCache = new Map<string, Position3D[]>();
  const rayBuilder = options?.rayBuilder ?? buildSampleRays;
  const defaultDelta = computeMedianDelta(validFrames);

  let sampledSeconds = emptyLength;
  let frameCount = emptyLength;

  for (const [index, frame] of validFrames.entries()) {
    const nextFrame = validFrames[index + nextIndexOffset];
    const rawDelta = nextFrame !== undefined ? nextFrame.timestamp - frame.timestamp : defaultDelta;
    const deltaSeconds = Math.max(rawDelta, defaultDelta);

    const relativeBasis = multiplyToInitialBasis(initialBasis, frame.basis);

    const cacheKey = `${frame.cameraIntrinsics.join("_")}_${frame.cameraResolution.width.toString()}_${frame.cameraResolution.height.toString()}`;
    let rays = sampleCache.get(cacheKey);
    if (rays === undefined) {
      rays = rayBuilder(frame.cameraIntrinsics, frame.cameraResolution, sampleRowCount, sampleColCount);
      sampleCache.set(cacheKey, rays);
    }

    frameCount += nextIndexOffset;
    sampledSeconds += deltaSeconds;

    const samplePoints: GridPoint[] = [];
    for (const ray of rays) {
      const direction = normalize3D(applyBasis(relativeBasis, ray));
      const safeY = clamp(direction.y, -unitClamp, unitClamp);
      const latitude = Math.asin(safeY);
      const longitude = Math.atan2(direction.x, direction.z);

      const latNormalized = (latitude + halfCircleRadians) / Math.PI;
      const lonNormalized = (longitude + Math.PI) / fullCircleRadians;

      samplePoints.push({
        col: lonNormalized * GRID_COLS,
        row: latNormalized * GRID_ROWS
      });
    }

    if (samplePoints.length === emptyLength) {
      continue;
    }

    const adjustedPoints = adjustForSeamWrapping(samplePoints, gridColHalfSpan, GRID_COLS);
    const hull = buildConvexHull(adjustedPoints);
    rasterizeHull(hull, coverageGrid, deltaSeconds, GRID_ROWS, GRID_COLS);
  }

  return {
    cols: GRID_COLS,
    frameCount,
    grid: coverageGrid,
    rows: GRID_ROWS,
    sampleCountPerFrame: sampleCount,
    sampledSeconds
  };
};

/**
 * Adjusts point coordinates to handle the 0°/360° longitude seam.
 *
 * **The Problem:**
 * When the camera looks toward the ±180° longitude boundary, sample points may span
 * across the seam. For example, points might have columns [1, 2, 141, 142, 143].
 * Without adjustment, the convex hull would incorrectly span the entire width of the grid
 * (column 1 to 143) instead of the small region crossing the seam.
 *
 * **The Solution:**
 * If points span more than half the grid width (72 columns = 180°), they likely cross
 * the seam. We "unwrap" points on the left side by adding gridCols (144) to their column
 * index, creating coordinates like [1, 2, 141, 142, 143] → [145, 146, 141, 142, 143].
 * This makes the span only 5 columns instead of 142.
 *
 * The convex hull and rasterization then work on this unwrapped space, and column
 * wrapping during rasterization maps extended columns back to valid indices.
 *
 * @param points - Sample points in grid coordinates
 * @param halfSpan - Half the grid width (threshold for detecting seam crossing)
 * @param gridCols - Total number of columns in the grid
 * @returns Points with column indices adjusted for seam crossing
 */
const adjustForSeamWrapping = (points: GridPoint[], halfSpan: number, gridCols: number): GridPoint[] => {
  const minCol = Math.min(...points.map((p) => p.col));
  const maxCol = Math.max(...points.map((p) => p.col));
  const span = maxCol - minCol;

  if (span <= halfSpan) {
    return points;
  }

  return points.map((p) => ({
    col: p.col < halfSpan ? p.col + gridCols : p.col,
    row: p.row
  }));
};

/**
 * Aggregates multiple coverage spheres into a single combined view.
 *
 * Combines coverage data from multiple scans by averaging the viewing time for each
 * grid cell across all scans that viewed that cell. Cells that were never viewed in
 * any scan remain at zero.
 *
 * @param spheres - Array of coverage spheres from individual scans
 * @returns Aggregated statistics and averaged grid, or null if no valid spheres
 */
export const aggregateCoverageSpheres = (
  spheres: CoverageSphere[]
): {
  cols: number;
  contributingArtifacts: number;
  grid: number[][];
  maxBinSeconds: number;
  nonZeroBins: number;
  rows: number;
  totalBins: number;
  totalSeconds: number;
} | null => {
  const emptyCount = 0;
  const startIndex = 0;
  const countIncrement = 1;
  if (spheres.length === emptyCount) {
    return null;
  }

  const firstValid = spheres.find(
    (sphere) => sphere.rows > emptyCount && sphere.cols > emptyCount && sphere.grid.length > emptyCount
  );
  if (firstValid === undefined) {
    return null;
  }

  const rows = firstValid.rows;
  const cols = firstValid.cols;
  const grid: number[][] = new Array<number[]>(rows);
  const seenCounts: number[][] = new Array<number[]>(rows);
  let contributingArtifacts = emptyCount;
  let totalSeconds = emptyCount;

  for (const sphere of spheres) {
    if (sphere.rows !== rows || sphere.cols !== cols || sphere.grid.length !== rows) {
      continue;
    }
    contributingArtifacts += countIncrement;
    for (let r = startIndex; r < rows; r++) {
      const row = sphere.grid[r];
      if (row?.length !== cols) {
        continue;
      }
      const targetRow = grid[r] ?? (grid[r] = new Array<number>(cols));
      const countRow = seenCounts[r] ?? (seenCounts[r] = new Array<number>(cols));
      for (let c = startIndex; c < cols; c++) {
        const cellValue = row[c];
        const value = typeof cellValue === "number" && Number.isFinite(cellValue) ? cellValue : emptyCount;
        if (value > emptyCount) {
          const existingCount = countRow[c] ?? emptyCount;
          countRow[c] = existingCount + countIncrement;
        }
        const accumulatedValue = targetRow[c] ?? emptyCount;
        targetRow[c] = accumulatedValue + value;
      }
    }
  }

  const averagedGrid: number[][] = new Array<number[]>(rows);
  let maxBinSeconds = emptyCount;
  let nonZeroBins = emptyCount;

  for (let r = startIndex; r < rows; r++) {
    const sumRow = grid[r] ?? new Array<number>(cols);
    const countRow = seenCounts[r] ?? new Array<number>(cols);
    const targetRow = averagedGrid[r] ?? (averagedGrid[r] = new Array<number>(cols).fill(emptyCount));
    for (let c = startIndex; c < cols; c++) {
      const sumValue = sumRow[c] ?? emptyCount;
      const countValue = countRow[c] ?? emptyCount;
      const averaged = countValue > emptyCount ? sumValue / countValue : emptyCount;
      targetRow[c] = averaged;
      if (averaged > emptyCount) {
        nonZeroBins += countIncrement;
        maxBinSeconds = Math.max(maxBinSeconds, averaged);
        totalSeconds += averaged;
      }
    }
  }

  const totalBins = rows * cols;

  return {
    cols,
    contributingArtifacts,
    grid: averagedGrid,
    maxBinSeconds,
    nonZeroBins,
    rows,
    totalBins,
    totalSeconds
  };
};
