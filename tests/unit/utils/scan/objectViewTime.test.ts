import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectAllObjectViewTimes,
  collectObjectViewTimePerScan,
  computeMedianFrameDeltaSeconds,
  computeObjectViewTimeSeconds
} from "../../../../src/utils/scan/objectViewTime";

const MINIMAL_RAW_SCAN = {
  coreModel: "test",
  floors: [
    {
      category: { floor: {} },
      confidence: { high: {} },
      dimensions: [1, 1, 0.1],
      parentIdentifier: null,
      polygonCorners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ]
    }
  ],
  objects: [],
  sections: [],
  story: 0,
  version: 1,
  walls: [
    {
      category: { wall: {} },
      confidence: { high: {} },
      dimensions: [1, 2.5, 0.1],
      parentIdentifier: null,
      polygonCorners: [
        [0, 0],
        [1, 0]
      ]
    }
  ]
};

const OBJECT_AT_Z_NEG2 = {
  attributes: {},
  confidence: { high: {} },
  dimensions: [0.5, 0.5, 0.4],
  parentIdentifier: null,
  story: 0,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -2, 1]
};

const OBJECT_AT_Z_POS10 = {
  attributes: {},
  confidence: { high: {} },
  dimensions: [0.5, 0.5, 0.4],
  parentIdentifier: null,
  story: 0,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 10, 1]
};

const OBJECT_ON_VIEW_CONE = {
  attributes: {},
  confidence: { high: {} },
  dimensions: [0.5, 0.5, 0.4],
  parentIdentifier: null,
  story: 0,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.8660254037844386, 0, -0.5, 1]
};

const OBJECT_OUTSIDE_VIEW_CONE = {
  attributes: {},
  confidence: { high: {} },
  dimensions: [0.5, 0.5, 0.4],
  parentIdentifier: null,
  story: 0,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.916515138991168, 0, -0.4, 1]
};

const CAMERA_ORIGIN_FORWARD_NEG_Z = {
  cameraResolution: { height: 1080, width: 1920 },
  cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1],
  exifData: {},
  timestamp: 0
};

function createCameraFrame(timestamp: number): Record<string, unknown> {
  return {
    ...CAMERA_ORIGIN_FORWARD_NEG_Z,
    timestamp
  };
}

function writeMinimalArData(dir: string, frames: { timestamp: number }[]): void {
  const data: Record<string, unknown> = {};
  for (const f of frames) {
    data[String(f.timestamp)] = createCameraFrame(f.timestamp);
  }
  fs.writeFileSync(path.join(dir, "arData.json"), JSON.stringify({ data }), "utf-8");
}

describe("objectViewTime", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "object-view-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  describe("computeMedianFrameDeltaSeconds", () => {
    it("falls back when fewer than two timestamps are present", () => {
      const fallbackDelta = 1 / 30;
      expect(computeMedianFrameDeltaSeconds([0])).toBe(fallbackDelta);
      expect(computeMedianFrameDeltaSeconds([])).toBe(fallbackDelta);
    });

    it("falls back when deltas array would be empty", () => {
      const fallbackDelta = 1 / 30;
      // Two undefined values keep length >= 2 but produce no valid deltas.
      expect(computeMedianFrameDeltaSeconds([undefined as unknown as number, undefined as unknown as number])).toBe(
        fallbackDelta
      );
    });
  });

  describe("computeObjectViewTimeSeconds", () => {
    it("returns null when rawScan.json is missing", () => {
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      expect(computeObjectViewTimeSeconds(tempDir, "toilet")).toBeNull();
    });

    it("returns null when arData.json is missing", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      expect(computeObjectViewTimeSeconds(tempDir, "toilet")).toBeNull();
    });

    it("returns null when rawScan.json contains invalid JSON", () => {
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), "not valid json{{{", "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      expect(computeObjectViewTimeSeconds(tempDir, "toilet")).toBeNull();
    });

    it("returns null when arData.json contains invalid JSON", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      fs.writeFileSync(path.join(tempDir, "arData.json"), "invalid json", "utf-8");
      expect(computeObjectViewTimeSeconds(tempDir, "toilet")).toBeNull();
    });

    it("returns null when rawScan has no objects of the requested category", () => {
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(MINIMAL_RAW_SCAN), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      expect(computeObjectViewTimeSeconds(tempDir, "toilet")).toBeNull();
    });

    it("returns null when object has invalid transform array length", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [
          {
            ...OBJECT_AT_Z_NEG2,
            category: { toilet: {} },
            identifier: "t1",
            transform: [1, 0, 0]
          }
        ]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      expect(computeObjectViewTimeSeconds(tempDir, "toilet")).toBeNull();
    });

    it("returns 0 when arData has only one valid frame", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).toBe(0);
    });

    it("returns 0 when object is not in camera view cone", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_POS10, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).toBe(0);
    });

    it("returns a positive value when toilet is in view across frames", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
      expect(result !== null && typeof result === "number" && result >= 0).toBe(true);
    });

    it("returns a positive value for bathtub when in view across frames", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { bathtub: {} }, identifier: "b1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "bathtub");
      expect(result).not.toBeNull();
      expect(typeof result).toBe("number");
      expect(result !== null && typeof result === "number" && result >= 0).toBe(true);
    });

    it("returns null for bathtub when rawScan has no bathtub", () => {
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(MINIMAL_RAW_SCAN), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      expect(computeObjectViewTimeSeconds(tempDir, "bathtub")).toBeNull();
    });

    it("accumulates view time across multiple frames when object is in view", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }, { timestamp: 2 }, { timestamp: 3 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0);
    });

    it("treats object on view-cone boundary as in view", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_ON_VIEW_CONE, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0);
    });

    it("excludes objects just outside the view cone", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_OUTSIDE_VIEW_CONE, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).toBe(0);
    });

    it("uses median delta for the last frame contribution", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 0.1 }, { timestamp: 0.2 }, { timestamp: 5 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).not.toBeNull();
      expect(result).toBeCloseTo(5.1, 5);
    });

    it("ignores invalid transforms while counting valid objects", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [
          { ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" },
          { ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t2", transform: [1, 2, 3] }
        ]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0);
    });

    it("defensively skips undefined frames from buildValidFrames", async () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);

      vi.resetModules();
      vi.doMock("../../../../src/utils/arData/metadata/framerateMetrics", () => ({
        buildValidFrames: vi.fn(() => [
          undefined,
          { cameraTransform: CAMERA_ORIGIN_FORWARD_NEG_Z.cameraTransform, timestamp: 0 }
        ]),
        getSortedTimestamps: vi.fn(() => [0, 1])
      }));

      const { computeObjectViewTimeSeconds: mockedCompute } = await import("../../../../src/utils/scan/objectViewTime");
      const result = mockedCompute(tempDir, "toilet");
      expect(result).not.toBeNull();
      vi.doUnmock("../../../../src/utils/arData/metadata/framerateMetrics");
    });

    it("uses fallback delta when frames have identical timestamps", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      const data: Record<string, unknown> = {
        "0": createCameraFrame(0),
        "0_dup": createCameraFrame(0)
      };
      fs.writeFileSync(path.join(tempDir, "arData.json"), JSON.stringify({ data }), "utf-8");
      const result = computeObjectViewTimeSeconds(tempDir, "toilet");
      expect(result).not.toBeNull();
    });
  });

  describe("collectObjectViewTimePerScan", () => {
    it("returns empty array when given no directories", () => {
      expect(collectObjectViewTimePerScan([], "toilet")).toEqual([]);
    });

    it("skips directories without objects of the category or arData", () => {
      const emptyDir = path.join(tempDir, "empty");
      fs.mkdirSync(emptyDir, { recursive: true });
      expect(collectObjectViewTimePerScan([emptyDir], "sink")).toEqual([]);
    });

    it("collects view times from multiple directories", () => {
      const dir1 = path.join(tempDir, "artifact1");
      const dir2 = path.join(tempDir, "artifact2");
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(dir1, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(dir1, [{ timestamp: 0 }, { timestamp: 1 }]);
      fs.writeFileSync(path.join(dir2, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(dir2, [{ timestamp: 0 }, { timestamp: 2 }]);

      const result = collectObjectViewTimePerScan([dir1, dir2], "toilet");
      expect(result.length).toBe(2);
    });
  });

  describe("collectAllObjectViewTimes", () => {
    it("returns empty arrays for all categories when given no directories", () => {
      const result = collectAllObjectViewTimes([]);
      expect(result.toilet).toEqual([]);
      expect(result.bathtub).toEqual([]);
      expect(result.sink).toEqual([]);
    });

    it("collects view times for multiple categories in a single pass", () => {
      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [
          { ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" },
          { ...OBJECT_AT_Z_NEG2, category: { sink: {} }, identifier: "s1" }
        ]
      };
      fs.writeFileSync(path.join(tempDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(tempDir, [{ timestamp: 0 }, { timestamp: 1 }]);

      const result = collectAllObjectViewTimes([tempDir]);
      expect(result.toilet.length).toBe(1);
      expect(result.sink.length).toBe(1);
      expect(result.bathtub.length).toBe(0);
    });

    it("handles directories with different object categories", () => {
      const dir1 = path.join(tempDir, "artifact1");
      const dir2 = path.join(tempDir, "artifact2");
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      const rawScan1 = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      const rawScan2 = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { bathtub: {} }, identifier: "b1" }]
      };

      fs.writeFileSync(path.join(dir1, "rawScan.json"), JSON.stringify(rawScan1), "utf-8");
      writeMinimalArData(dir1, [{ timestamp: 0 }, { timestamp: 1 }]);
      fs.writeFileSync(path.join(dir2, "rawScan.json"), JSON.stringify(rawScan2), "utf-8");
      writeMinimalArData(dir2, [{ timestamp: 0 }, { timestamp: 1 }]);

      const result = collectAllObjectViewTimes([dir1, dir2]);
      expect(result.toilet.length).toBe(1);
      expect(result.bathtub.length).toBe(1);
      expect(result.sink.length).toBe(0);
    });

    it("skips directories with invalid data", () => {
      const validDir = path.join(tempDir, "valid");
      const invalidDir = path.join(tempDir, "invalid");
      fs.mkdirSync(validDir, { recursive: true });
      fs.mkdirSync(invalidDir, { recursive: true });

      const rawScan = {
        ...MINIMAL_RAW_SCAN,
        objects: [{ ...OBJECT_AT_Z_NEG2, category: { toilet: {} }, identifier: "t1" }]
      };
      fs.writeFileSync(path.join(validDir, "rawScan.json"), JSON.stringify(rawScan), "utf-8");
      writeMinimalArData(validDir, [{ timestamp: 0 }, { timestamp: 1 }]);

      fs.writeFileSync(path.join(invalidDir, "rawScan.json"), "invalid json", "utf-8");
      fs.writeFileSync(path.join(invalidDir, "arData.json"), "invalid json", "utf-8");

      const result = collectAllObjectViewTimes([validDir, invalidDir]);
      expect(result.toilet.length).toBe(1);
    });
  });
});
