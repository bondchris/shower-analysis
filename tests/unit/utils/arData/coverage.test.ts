import { describe, expect, it } from "vitest";

import { ArData } from "../../../../src/models/arData/arData";
import * as coverageUtils from "../../../../src/utils/arData/coverage";

const { aggregateCoverageSpheres, buildSampleRays, computeSphericalCoverage } = coverageUtils;
type CoverageSphere = coverageUtils.CoverageSphere;

const buildArData = (cameraIntrinsics?: number[], includeThirdFrame = false) => {
  const baseTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const rotatedTransform = [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const data: Record<string, unknown> = {
    "0": {
      cameraIntrinsics,
      cameraResolution: { height: 480, width: 640 },
      cameraTransform: baseTransform,
      exifData: {},
      timestamp: 0
    },
    "1": {
      cameraIntrinsics,
      cameraResolution: { height: 480, width: 640 },
      cameraTransform: rotatedTransform,
      exifData: {},
      timestamp: 1
    }
  };

  if (includeThirdFrame) {
    data["2"] = {
      cameraIntrinsics,
      cameraResolution: { height: 480, width: 640 },
      cameraTransform: baseTransform,
      exifData: {},
      timestamp: 2
    };
  }

  return new ArData({ data });
};

describe("buildSampleRays", () => {
  it("returns an empty array when focal lengths are invalid", () => {
    const rays = buildSampleRays([0, 0, 0, 0, 0, 0, 0, 0, 0], { height: 480, width: 640 }, 2, 2);
    expect(rays).toEqual([]);
  });
});

describe("computeSphericalCoverage", () => {
  const cameraIntrinsics = [100, 0, 0, 0, 100, 0, 320, 240, 1];
  const typedAggregate: (spheres: CoverageSphere[]) => ReturnType<typeof aggregateCoverageSpheres> =
    aggregateCoverageSpheres;

  it("returns null when intrinsics are missing", () => {
    const arData = buildArData();
    expect(computeSphericalCoverage(arData)).toBeNull();
  });

  it("returns null when basis vectors are degenerate", () => {
    const zeroTransform = new Array<number>(16).fill(0);
    const data: Record<string, unknown> = {
      "0": {
        cameraIntrinsics,
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: zeroTransform,
        exifData: {},
        timestamp: 0
      },
      "1": {
        cameraIntrinsics,
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: zeroTransform,
        exifData: {},
        timestamp: 1
      }
    };

    const arData = new ArData({ data });
    expect(computeSphericalCoverage(arData)).toBeNull();
  });

  it("returns null when all frames fail validation", () => {
    const invalidTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const invalidIntrinsics = [Infinity, 0, 0, 0, 100, 0, 320, 240, 1];
    const data: Record<string, unknown> = {
      "0": {
        cameraIntrinsics: invalidIntrinsics, // non-finite value
        cameraResolution: { height: 240, width: 320 },
        cameraTransform: invalidTransform,
        exifData: {},
        timestamp: 0
      },
      "1": {
        cameraIntrinsics: invalidIntrinsics,
        cameraResolution: { height: 240, width: 320 },
        cameraTransform: invalidTransform,
        exifData: {},
        timestamp: 1
      }
    };

    const arData = new ArData({ data });
    expect(computeSphericalCoverage(arData)).toBeNull();
  });

  it("uses a fallback delta when no frame-to-frame deltas are available", () => {
    const data: Record<string, unknown> = {
      "0": {
        cameraIntrinsics,
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        exifData: {},
        timestamp: 0
      },
      "1": {
        // missing intrinsics makes this frame invalid, so only one frame is used
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        exifData: {},
        timestamp: 1
      }
    };

    const arData = new ArData({ data });
    const sphere = computeSphericalCoverage(arData);

    expect(sphere).not.toBeNull();
    if (sphere !== null) {
      expect(sphere.sampledSeconds).toBeCloseTo(1 / 30, 5);
      expect(sphere.frameCount).toBe(1);
    }
  });

  it("uses the first valid frame when the earliest frame is incomplete", () => {
    const data: Record<string, unknown> = {
      "0": {
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        exifData: {},
        timestamp: 0
      },
      "1": {
        cameraIntrinsics,
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        exifData: {},
        timestamp: 1
      },
      "2": {
        cameraIntrinsics,
        cameraResolution: { height: 480, width: 640 },
        cameraTransform: [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        exifData: {},
        timestamp: 2
      }
    };

    const arData = new ArData({ data });
    const sphere = computeSphericalCoverage(arData);
    expect(sphere).not.toBeNull();
  });

  it("builds a coverage sphere and aggregates results", () => {
    const arData = buildArData(cameraIntrinsics);
    const sphere = computeSphericalCoverage(arData);

    expect(sphere).not.toBeNull();
    if (sphere !== null) {
      expect(sphere.rows).toBe(72);
      expect(sphere.cols).toBe(144);
      expect(sphere.frameCount).toBe(2);
      expect(sphere.sampleCountPerFrame).toBe(192);
      expect(sphere.sampledSeconds).toBeCloseTo(2, 5);

      const gridTotal = sphere.grid.reduce((total, row) => {
        return total + row.reduce((rowSum, value) => rowSum + value, 0);
      }, 0);
      expect(gridTotal).toBeGreaterThan(sphere.sampledSeconds);

      const maxBin = Math.max(...sphere.grid.flat());
      const nonZeroBinCount = sphere.grid.flat().filter((value) => value > 0).length;
      expect(maxBin).toBeGreaterThanOrEqual(sphere.sampledSeconds / 2);
      expect(maxBin).toBeLessThanOrEqual(sphere.sampledSeconds);

      const aggregated = typedAggregate([sphere, sphere]);
      expect(aggregated).not.toBeNull();
      if (aggregated !== null) {
        expect(aggregated.cols).toBe(sphere.cols);
        expect(aggregated.rows).toBe(sphere.rows);
        expect(aggregated.contributingArtifacts).toBe(2);
        expect(aggregated.maxBinSeconds).toBeCloseTo(maxBin, 5);
        expect(aggregated.totalSeconds).toBeCloseTo(gridTotal, 5);
        expect(aggregated.nonZeroBins).toBe(nonZeroBinCount);
      }
    }
  });

  it("returns a sphere even when sampling yields no rays", () => {
    const arData = buildArData(cameraIntrinsics);
    const sphere = computeSphericalCoverage(arData, { rayBuilder: () => [] });

    expect(sphere).not.toBeNull();
    if (sphere !== null) {
      expect(sphere.grid.flat().every((value) => value === 0)).toBe(true);
    }
  });

  it("unwraps seam-spanning footprints so coverage wraps correctly at the 0/360 boundary", () => {
    const wideFovIntrinsics = [50, 0, 0, 0, 50, 0, 160, 120, 1];
    const seamTransform = [
      -1,
      0,
      0,
      0, //
      0,
      1,
      0,
      0, //
      0,
      0,
      -1,
      0, //
      0,
      0,
      0,
      1
    ];

    const data: Record<string, unknown> = {
      "0": {
        cameraIntrinsics: wideFovIntrinsics,
        cameraResolution: { height: 240, width: 320 },
        cameraTransform: seamTransform,
        exifData: {},
        timestamp: 0
      },
      "1": {
        cameraIntrinsics: wideFovIntrinsics,
        cameraResolution: { height: 240, width: 320 },
        cameraTransform: seamTransform,
        exifData: {},
        timestamp: 1
      }
    };

    const arData = new ArData({ data });
    const sphere = computeSphericalCoverage(arData);
    expect(sphere).not.toBeNull();
    if (sphere === null) {
      return;
    }

    let minCol = sphere.cols;
    let maxCol = -1;
    sphere.grid.forEach((row) => {
      row.forEach((value, colIndex) => {
        if (value > 0) {
          minCol = Math.min(minCol, colIndex);
          maxCol = Math.max(maxCol, colIndex);
        }
      });
    });

    const span = maxCol - minCol;
    expect(span).toBeGreaterThan(30);
  });

  it("unwraps seam-spanning footprints even when only two points are sampled", () => {
    const seamRays = [
      { x: -0.001, y: 0, z: -1 },
      { x: 0.001, y: 0, z: -1 }
    ];
    const arData = buildArData(cameraIntrinsics);
    const sphere = computeSphericalCoverage(arData, { rayBuilder: () => seamRays });
    expect(sphere).not.toBeNull();
    if (sphere === null) {
      return;
    }

    const midRow = Math.floor(sphere.rows / 2);
    const row = sphere.grid[midRow];
    expect(row).toBeDefined();
    if (row === undefined) {
      return;
    }
    expect(row[0]).toBeGreaterThan(0);
    expect(row[sphere.cols - 1]).toBeGreaterThan(0);
  });

  it("ignores mismatched coverage spheres when aggregating", () => {
    const arData = buildArData(cameraIntrinsics);
    const sphere = computeSphericalCoverage(arData);
    expect(sphere).not.toBeNull();
    if (sphere === null) {
      return;
    }

    const totalFirstGrid = sphere.grid.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell, 0), 0);
    const mismatchedSphere = {
      cols: 10,
      frameCount: 1,
      grid: Array.from({ length: 10 }, () => new Array<number>(10).fill(0)),
      rows: 10,
      sampleCountPerFrame: 1,
      sampledSeconds: 1
    };

    const aggregated = typedAggregate([sphere, mismatchedSphere]);
    expect(aggregated).not.toBeNull();
    if (aggregated === null) {
      return;
    }

    expect(aggregated.contributingArtifacts).toBe(1);
    const aggregatedTotal = aggregated.grid.reduce(
      (sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell, 0),
      0
    );
    expect(aggregatedTotal).toBeCloseTo(totalFirstGrid, 6);
  });

  it("returns null when no valid spheres are found during aggregation", () => {
    const emptySphere: CoverageSphere = {
      cols: 0,
      frameCount: 0,
      grid: [],
      rows: 0,
      sampleCountPerFrame: 0,
      sampledSeconds: 0
    };

    const spheres: CoverageSphere[] = [emptySphere];
    expect(typedAggregate(spheres)).toBeNull();
  });

  it("skips malformed rows when aggregating coverage spheres", () => {
    const validSphere: CoverageSphere = {
      cols: 2,
      frameCount: 1,
      grid: [
        [1, 2],
        [3, 4]
      ],
      rows: 2,
      sampleCountPerFrame: 1,
      sampledSeconds: 1
    };

    const malformedSphere: CoverageSphere = {
      cols: 2,
      frameCount: 1,
      grid: [
        [10], // short row
        undefined as unknown as number[] // undefined row to hit guards
      ],
      rows: 2,
      sampleCountPerFrame: 1,
      sampledSeconds: 1
    };

    const spheres: CoverageSphere[] = [validSphere, malformedSphere];
    const aggregated = typedAggregate(spheres);
    expect(aggregated).not.toBeNull();
    if (aggregated === null) {
      return;
    }

    expect(aggregated.contributingArtifacts).toBe(2);
    expect(aggregated.maxBinSeconds).toBeGreaterThan(0);
  });

  it("treats non-numeric cell values as zero when aggregating", () => {
    const cleanSphere: CoverageSphere = {
      cols: 2,
      frameCount: 1,
      grid: [
        [1, 2],
        [3, 4]
      ],
      rows: 2,
      sampleCountPerFrame: 1,
      sampledSeconds: 1
    };

    const noisySphere: CoverageSphere = {
      cols: 2,
      frameCount: 1,
      grid: [
        [1, "oops" as unknown as number],
        [1, 1]
      ],
      rows: 2,
      sampleCountPerFrame: 1,
      sampledSeconds: 1
    };

    const aggregated = typedAggregate([cleanSphere, noisySphere]);
    expect(aggregated).not.toBeNull();
    if (aggregated === null) {
      return;
    }

    expect(aggregated.grid[0]?.[1]).toBe(2); // ignores the non-number cell
    expect(aggregated.grid[1]?.[0]).toBe(2); // averages 3 and 1
  });

  it("returns null when no spheres are provided for aggregation", () => {
    expect(typedAggregate([])).toBeNull();
  });

  it("sorts multiple time deltas when sampling three frames", () => {
    const arData = buildArData(cameraIntrinsics, true);
    const sphere = computeSphericalCoverage(arData);

    expect(sphere).not.toBeNull();
    if (sphere !== null) {
      expect(sphere.frameCount).toBe(3);
      expect(sphere.sampledSeconds).toBeCloseTo(3, 5);
    }
  });
});
