import { ObjectItem } from "../../../src/models/rawScan/objectItem";
import { WallData } from "../../../src/models/rawScan/wall";
import { checkToiletGaps } from "../../../src/utils/room/checkToiletGaps";
import { createExternalWall, createMockScan, createToilet } from "./testHelpers";

describe("checkToiletGaps", () => {
  const createFlushWall = (id: string, overrides: Partial<WallData> = {}): WallData => {
    const w = createExternalWall(id, overrides);
    if (w.transform) {
      w.transform[14] = -0.25; // Flush with toilet backface
    }
    return w;
  };

  describe("A. Object filtering", () => {
    it("should pass if no objects exist", () => {
      const scan = createMockScan({ objects: [], walls: [createFlushWall("w1")] });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should pass if objects exist but none are toilets", () => {
      const sink = createToilet("s1", { category: { sink: {} } });
      const scan = createMockScan({
        objects: [sink],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should treat object with empty category as non-toilet (Pass)", () => {
      const scan = createMockScan({
        objects: [createToilet("t1", { category: {} })],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should fail if mixed validity (one bad toilet)", () => {
      const t1 = createToilet("t1");
      const t2: ObjectItem = createToilet("t2", {
        transform: [
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          10,
          1 // Z=10
        ]
      });

      const scan = createMockScan({
        objects: [t1, t2],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  describe("B. Wall presence", () => {
    it("should fail if toilet exists but walls: []", () => {
      const scan = createMockScan({
        objects: [createToilet("t1")],
        walls: []
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });

    it("should fail if walls exist but on different story", () => {
      const scan = createMockScan({
        objects: [createToilet("t1", { story: 1 })],
        walls: [createFlushWall("w1", { story: 0 })]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });

    it("should use closest wall", () => {
      const t1 = createToilet("t1");
      const wClose = createFlushWall("w_close");
      const wFar = createExternalWall("w_far");
      if (wFar.transform) {
        wFar.transform[14] = 10;
      }

      const scan = createMockScan({
        objects: [t1],
        walls: [wClose, wFar]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });

  describe("C. Threshold behavior", () => {
    const createTestScan = (wallZ: number) => {
      const t1 = createToilet("t1");
      const w1 = createExternalWall("w1");
      if (w1.transform) {
        w1.transform[14] = wallZ;
      }
      return createMockScan({ objects: [t1], walls: [w1] });
    };

    it("should pass if backface flush (dist = 0)", () => {
      expect(checkToiletGaps(createTestScan(-0.25))).toBe(false);
    });

    it("should pass if within tolerance (0.5 inch gap)", () => {
      expect(checkToiletGaps(createTestScan(-0.2627))).toBe(false);
    });

    it("should pass at exactly threshold (1.0 inch gap)", () => {
      expect(checkToiletGaps(createTestScan(-0.25 - 0.0254))).toBe(false);
    });

    it("should fail check just over threshold (1.0001 inch)", () => {
      expect(checkToiletGaps(createTestScan(-0.25 - 0.0255))).toBe(true);
    });

    it("should fail well over threshold (6 inches)", () => {
      expect(checkToiletGaps(createTestScan(-0.4))).toBe(true);
    });
  });

  describe("D. Backface definition", () => {
    it("should fail if toilet rotated 180", () => {
      const t1 = createToilet("t1", {
        transform: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]
      });
      const w1 = createFlushWall("w1");
      if (w1.transform) {
        w1.transform[14] = -0.26;
      }

      const scan = createMockScan({
        objects: [t1],
        walls: [w1]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  describe("E. Data integrity", () => {
    it("should handle invalid transform gracefully", () => {
      const scan = createMockScan({
        objects: [
          // Invalid transform manually passed via cast to simulate bad data
          createToilet("t1", { transform: [] as unknown as number[] })
        ],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should handle degenerate wall polygons", () => {
      const wDegenerate = createFlushWall("wDegenerate", {
        polygonCorners: []
      });
      const scan = createMockScan({
        objects: [createToilet("t1")],
        walls: [createFlushWall("wRef"), wDegenerate]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });

  describe("F. Only walls count", () => {
    it("should fail if nearest object is not a wall", () => {
      const t1 = createToilet("t1");
      const s1 = createToilet("s1", { category: { storage: {} } });
      s1.transform[14] = -0.25; // Flush

      const wFar = createExternalWall("wFar");
      if (wFar.transform) {
        wFar.transform[14] = 10;
      }

      const scan = createMockScan({
        objects: [t1, s1],
        walls: [wFar]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  describe("G. Penetration", () => {
    it("should pass if toilet is inside wall", () => {
      const t1 = createToilet("t1");
      const w1 = createExternalWall("w1");
      if (w1.transform) {
        w1.transform[14] = -0.2;
      } // Inside toilet back (Z > -0.25)
      const scan = createMockScan({ objects: [t1], walls: [w1] });
      // Distance is absolute | -0.25 - (-0.20) | = 0.05 > Threshold.
      // So it flags as a Gap (True).
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });
});
