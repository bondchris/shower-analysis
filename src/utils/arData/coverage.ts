import { ArData } from "../../models/arData/arData";

export interface CoverageSphere {
  cols: number;
  frameCount: number;
  grid: number[][];
  rows: number;
  sampleCountPerFrame: number;
  sampledSeconds: number;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface RotationBasis {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
}

type Matrix16 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

type Intrinsics9 = [number, number, number, number, number, number, number, number, number];

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const normalize = (vector: Vector3): Vector3 => {
  const defaultComponent = 0;
  const minLength = 1e-6;
  const unitMagnitude = 1;
  const squaredX = vector.x * vector.x;
  const squaredY = vector.y * vector.y;
  const squaredZ = vector.z * vector.z;
  const length = Math.sqrt(squaredX + squaredY + squaredZ);
  if (length < minLength) {
    return { x: defaultComponent, y: defaultComponent, z: defaultComponent };
  }
  const invLength = unitMagnitude / length;
  return {
    x: vector.x * invLength,
    y: vector.y * invLength,
    z: vector.z * invLength
  };
};

const dot = (a: Vector3, b: Vector3): number => {
  const productX = a.x * b.x;
  const productY = a.y * b.y;
  const productZ = a.z * b.z;
  return productX + productY + productZ;
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

  const forward = normalize({
    x: transform[forwardXIndex],
    y: transform[forwardYIndex],
    z: transform[forwardZIndex]
  });
  const right = normalize({
    x: transform[rightXIndex],
    y: transform[rightYIndex],
    z: transform[rightZIndex]
  });
  const up = normalize({
    x: transform[upXIndex],
    y: transform[upYIndex],
    z: transform[upZIndex]
  });

  const isDegenerate = (basisVector: Vector3) => {
    const magnitude = Math.abs(basisVector.x) + Math.abs(basisVector.y) + Math.abs(basisVector.z);
    return magnitude < minBasisMagnitude;
  };

  if (isDegenerate(forward) || isDegenerate(right) || isDegenerate(up)) {
    return null;
  }

  return { forward, right, up };
};

const multiplyToInitialBasis = (initial: RotationBasis, current: RotationBasis): RotationBasis => {
  const buildColumn = (worldAxis: Vector3): Vector3 => {
    return {
      x: dot(worldAxis, initial.right),
      y: dot(worldAxis, initial.up),
      z: dot(worldAxis, initial.forward)
    };
  };

  return {
    forward: normalize(buildColumn(current.forward)),
    right: normalize(buildColumn(current.right)),
    up: normalize(buildColumn(current.up))
  };
};

const applyBasis = (basis: RotationBasis, vector: Vector3): Vector3 => {
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

export const buildSampleRays = (
  cameraIntrinsics: Intrinsics9,
  cameraResolution: { width: number; height: number },
  sampleRows: number,
  sampleCols: number
): Vector3[] => {
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

  const rays: Vector3[] = [];
  const width = cameraResolution.width;
  const height = cameraResolution.height;

  for (let row = 0; row < sampleRows; row++) {
    const pixelY = ((row + halfPixel) / sampleRows) * height;
    const y = (pixelY - cy) / fy;
    for (let col = 0; col < sampleCols; col++) {
      const pixelX = ((col + halfPixel) / sampleCols) * width;
      const x = (pixelX - cx) / fx;
      rays.push(normalize({ x, y, z: unitDepth }));
    }
  }

  return rays;
};

export const computeSphericalCoverage = (
  arData: ArData,
  options?: { rayBuilder?: typeof buildSampleRays }
): CoverageSphere | null => {
  const MINIMUM_FRAMES_REQUIRED = 2;
  const START_INDEX = 0;
  const NEXT_INDEX_OFFSET = 1;
  const DEFAULT_VALUE = 0;
  const GRID_ROWS = 72;
  const GRID_COLS = 144;
  const SAMPLE_ROW_COUNT = 12;
  const SAMPLE_COL_COUNT = 16;
  const FALLBACK_FPS = 30;
  const HALF_TURN = 2;
  const GRID_COL_HALF_SPAN = GRID_COLS / HALF_TURN;
  const NEGATIVE_ONE = -1;
  const POSITIVE_ONE = 1;
  const MIDPOINT_DIVISOR = 2;
  const UNIT_VALUE = 1;
  const INTRINSICS_SIZE = 9;
  const TRANSFORM_SIZE = 16;
  const HALF_CIRCLE_RADIANS = Math.PI / HALF_TURN;
  const FULL_CIRCLE_RADIANS = Math.PI * HALF_TURN;
  const MIN_HULL_STACK_SIZE = 2;
  const MIN_POINTS_FOR_POLYGON = 3;
  const SCANLINE_CENTER_OFFSET = 0.5;

  const isNumberArray = (value: unknown, expectedLength?: number): value is number[] => {
    const hasValidLength = expectedLength === undefined || (Array.isArray(value) && value.length === expectedLength);
    return (
      Array.isArray(value) &&
      hasValidLength &&
      value.every((element) => typeof element === "number" && Number.isFinite(element))
    );
  };

  const hasValidResolution = (
    resolution: { width?: unknown; height?: unknown } | undefined
  ): resolution is { width: number; height: number } => {
    return (
      resolution !== undefined &&
      typeof resolution.width === "number" &&
      Number.isFinite(resolution.width) &&
      typeof resolution.height === "number" &&
      Number.isFinite(resolution.height)
    );
  };

  const isIntrinsicsArray = (value: unknown): value is Intrinsics9 => {
    return isNumberArray(value, INTRINSICS_SIZE);
  };

  const isTransformArray = (value: unknown): value is Matrix16 => {
    return isNumberArray(value, TRANSFORM_SIZE);
  };

  const sortedTimestampKeys = Object.keys(arData.data)
    .map((key) => parseFloat(key))
    .filter((value): value is number => Number.isFinite(value))
    .sort((a, b) => a - b)
    .filter((value): value is number => Number.isFinite(value));

  if (sortedTimestampKeys.length < MINIMUM_FRAMES_REQUIRED) {
    return null;
  }

  const validFrames: {
    basis: RotationBasis;
    cameraIntrinsics: Intrinsics9;
    cameraResolution: { width: number; height: number };
    timestamp: number;
  }[] = [];

  for (const key of sortedTimestampKeys) {
    const frame = arData.data[key.toString()] as
      | {
          cameraIntrinsics?: unknown;
          cameraResolution?: { width?: unknown; height?: unknown };
          cameraTransform?: unknown;
        }
      | undefined;

    if (
      frame === undefined ||
      !isIntrinsicsArray(frame.cameraIntrinsics) ||
      !hasValidResolution(frame.cameraResolution) ||
      !isTransformArray(frame.cameraTransform)
    ) {
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

  const [firstFrame] = validFrames;
  if (firstFrame === undefined) {
    return null;
  }

  const initialBasis = firstFrame.basis;

  const coverageGrid: number[][] = new Array<number[]>(GRID_ROWS);

  const sampleCount = SAMPLE_ROW_COUNT * SAMPLE_COL_COUNT;
  const sampleCache = new Map<string, Vector3[]>();
  const rayBuilder = options?.rayBuilder ?? buildSampleRays;

  type Frame = (typeof validFrames)[number];
  const framePairs: { frame: Frame; next: Frame }[] = validFrames
    .slice(START_INDEX, validFrames.length - NEXT_INDEX_OFFSET)
    .map((frame, index) => ({
      frame,
      next: validFrames[index + NEXT_INDEX_OFFSET + START_INDEX]
    }))
    .filter((pair): pair is { frame: Frame; next: Frame } => pair.next !== undefined);

  const timeDeltas: number[] = framePairs.map((pair) => pair.next.timestamp - pair.frame.timestamp);
  const sortedDeltas = [...timeDeltas].sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedDeltas.length / MIDPOINT_DIVISOR);
  const medianDelta = sortedDeltas[medianIndex] ?? DEFAULT_VALUE;
  const defaultDelta = Math.max(medianDelta, UNIT_VALUE / FALLBACK_FPS);

  let sampledSeconds = DEFAULT_VALUE;
  let frameCount = DEFAULT_VALUE;

  for (const [index, frame] of validFrames.entries()) {
    const originBasis = initialBasis;
    const nextFrame = validFrames[index + NEXT_INDEX_OFFSET];
    const rawDelta = nextFrame !== undefined ? nextFrame.timestamp - frame.timestamp : defaultDelta;
    const deltaSeconds = Math.max(rawDelta, defaultDelta);

    const relativeBasis = multiplyToInitialBasis(originBasis, frame.basis);

    const cameraIntrinsics = frame.cameraIntrinsics;
    const cameraResolution = frame.cameraResolution;
    const cacheKey = `${cameraIntrinsics.join("_")}_${cameraResolution.width.toString()}_${cameraResolution.height.toString()}`;

    let rays = sampleCache.get(cacheKey);
    if (rays === undefined) {
      rays = rayBuilder(cameraIntrinsics, cameraResolution, SAMPLE_ROW_COUNT, SAMPLE_COL_COUNT);
      sampleCache.set(cacheKey, rays);
    }

    frameCount += NEXT_INDEX_OFFSET;
    sampledSeconds += deltaSeconds;

    const samplePoints: { row: number; col: number }[] = [];
    for (const ray of rays) {
      const direction = normalize(applyBasis(relativeBasis, ray));
      const safeY = clamp(direction.y, NEGATIVE_ONE, POSITIVE_ONE);
      const latitude = Math.asin(safeY);
      const longitude = Math.atan2(direction.x, direction.z);

      const latNormalized = (latitude + HALF_CIRCLE_RADIANS) / Math.PI;
      const lonNormalized = (longitude + Math.PI) / FULL_CIRCLE_RADIANS;

      const rowIndexFloat = latNormalized * GRID_ROWS;
      const colIndexFloat = lonNormalized * GRID_COLS;
      samplePoints.push({
        col: colIndexFloat,
        row: rowIndexFloat
      });
    }

    if (samplePoints.length === DEFAULT_VALUE) {
      continue;
    }

    const adjustedPoints = (() => {
      const minCol = Math.min(...samplePoints.map((p) => p.col));
      const maxCol = Math.max(...samplePoints.map((p) => p.col));
      const span = maxCol - minCol;
      if (span <= GRID_COL_HALF_SPAN) {
        return samplePoints;
      }
      return samplePoints.map((p) => ({
        col: p.col < GRID_COL_HALF_SPAN ? p.col + GRID_COLS : p.col,
        row: p.row
      }));
    })();

    const sortedPoints = adjustedPoints
      .map((p) => ({ col: p.col, row: p.row }))
      .sort((a, b) => (a.col === b.col ? a.row - b.row : a.col - b.col));

    const cross = (
      origin: { col: number; row: number },
      a: { col: number; row: number },
      b: { col: number; row: number }
    ) => {
      const deltaAX = a.col - origin.col;
      const deltaAY = a.row - origin.row;
      const deltaBX = b.col - origin.col;
      const deltaBY = b.row - origin.row;
      const scaledCrossPrimary = deltaAX * deltaBY;
      const scaledCrossSecondary = deltaAY * deltaBX;
      return scaledCrossPrimary - scaledCrossSecondary;
    };

    const buildHull = () => {
      if (sortedPoints.length < MIN_POINTS_FOR_POLYGON) {
        return sortedPoints;
      }
      const lower: { col: number; row: number }[] = [];
      for (const point of sortedPoints) {
        while (lower.length >= MIN_HULL_STACK_SIZE) {
          const secondLast = lower[lower.length - MIN_HULL_STACK_SIZE] as { col: number; row: number };
          const last = lower[lower.length - NEXT_INDEX_OFFSET] as { col: number; row: number };
          if (cross(secondLast, last, point) <= DEFAULT_VALUE) {
            lower.pop();
          } else {
            break;
          }
        }
        lower.push(point);
      }

      const upper: { col: number; row: number }[] = [];
      for (let i = sortedPoints.length - NEXT_INDEX_OFFSET; i >= START_INDEX; i -= NEXT_INDEX_OFFSET) {
        const point = sortedPoints[i] as { col: number; row: number };
        while (upper.length >= MIN_HULL_STACK_SIZE) {
          const secondLast = upper[upper.length - MIN_HULL_STACK_SIZE] as { col: number; row: number };
          const last = upper[upper.length - NEXT_INDEX_OFFSET] as { col: number; row: number };
          if (cross(secondLast, last, point) <= DEFAULT_VALUE) {
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

    const hull = buildHull();

    const modCol = (value: number) => {
      return ((value % GRID_COLS) + GRID_COLS) % GRID_COLS;
    };

    if (hull.length >= MIN_POINTS_FOR_POLYGON) {
      const minRow = Math.max(
        START_INDEX,
        Math.floor(
          Math.min(
            ...hull.map((p) => {
              return p.row;
            })
          )
        )
      );
      const maxRow = Math.min(
        GRID_ROWS - NEXT_INDEX_OFFSET,
        Math.ceil(
          Math.max(
            ...hull.map((p) => {
              return p.row;
            })
          )
        )
      );

      const hullLength = hull.length;
      for (let targetRow = minRow; targetRow <= maxRow; targetRow++) {
        const scanlineY = targetRow + SCANLINE_CENTER_OFFSET;
        const intersections: number[] = [];
        for (let j = START_INDEX; j < hullLength; j++) {
          const current = hull[j] as { col: number; row: number };
          const next = hull[(j + NEXT_INDEX_OFFSET) % hullLength] as { col: number; row: number };

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
        for (let k = START_INDEX; k + NEXT_INDEX_OFFSET < intersectionValues.length; k += MIDPOINT_DIVISOR) {
          const start = Number(intersectionValues[k]);
          const end = Number(intersectionValues[k + NEXT_INDEX_OFFSET]);
          const colStart = Math.floor(Math.min(start, end));
          const colEnd = Math.floor(Math.max(start, end));
          for (let c = colStart; c <= colEnd; c++) {
            const wrappedCol = modCol(c);
            const coverageRow = coverageGrid[targetRow] ?? (coverageGrid[targetRow] = new Array<number>(GRID_COLS));
            const existingValue = coverageRow[wrappedCol] ?? DEFAULT_VALUE;
            coverageRow[wrappedCol] = existingValue + deltaSeconds;
          }
        }
      }
    } else {
      for (const point of sortedPoints) {
        const wrappedCol = modCol(Math.floor(point.col));
        const wrappedRow = clamp(Math.floor(point.row), START_INDEX, GRID_ROWS - NEXT_INDEX_OFFSET);
        const coverageRow = coverageGrid[wrappedRow] ?? (coverageGrid[wrappedRow] = new Array<number>(GRID_COLS));
        const existingValue = coverageRow[wrappedCol] ?? DEFAULT_VALUE;
        coverageRow[wrappedCol] = existingValue + deltaSeconds;
      }
    }
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
