import { checkColinearWalls } from "../../../src/utils/room/checkColinearWalls";
import { createExternalWall, createMockScan } from "./testHelpers";

describe("checkColinearWalls", () => {
  const INCH = 0.0254;

  describe("A. Core 'should detect' cases", () => {
    it("should return true for end-to-end walls with 0 gap", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10, 0],
          [20, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });

    it("should return true for end-to-end walls with small gap (1 inch)", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const gap = INCH;
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10 + gap, 0],
          [20 + gap, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });

    it("should return true for end-to-end walls with gap just under threshold (2.99 inch)", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const gap = 2.99 * INCH;
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10 + gap, 0],
          [20 + gap, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });

    it("should return true for Partial overlap, same direction", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [5, 0], // Starts inside w1
          [15, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });

    it("should return true for Containment overlap", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [2, 0],
          [8, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });

    it("should return true for Slight angular noise but within tolerance", () => {
      // Parallel threshold is 0.996.
      // Let's create a wall with a very slight slope.
      // Vector (1, 0.05). Length ~1.00125. Normalized (0.998, 0.049).
      // Dot with (1,0) is 0.998 > 0.996.
      const gap = 2 * INCH;
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10 + gap, 0],
          [20 + gap, 0.5] // Rise 0.5 over Run 10 => Slope 0.05
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });
  });

  describe("B. Gap threshold boundaries", () => {
    it("should return false for gap exactly 3.00 inch", () => {
      // Threshold is < 0.0762 (3 inches). Exactly 3 should fail.
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const gap = 3.0 * INCH;
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10 + gap, 0],
          [20 + gap, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });

    it("should return false for gap just over threshold (3.01 inch)", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const gap = 3.01 * INCH;
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10 + gap, 0],
          [20 + gap, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });
  });

  describe("D. False-positive guards", () => {
    it("should return false for Parallel but laterally offset (train tracks)", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [0, 1], // Offset by 1 meter in Y
          [10, 1]
        ]
      });
      // Dot is 1 (Parallel).
      // Distance > threshold (1m > 3in).
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });

    it("should return false for Perpendicular L corner (touching but not parallel)", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [0, 0],
          [0, 10]
        ]
      });
      // Distance 0 (Touch).
      // Dot = 0 (Perpendicular). Not > 0.996.
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });

    it("should return false for T junction", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [5, 0],
          [5, 5]
        ]
      });
      // Touches at 5,0.
      // Dot = 0.
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });
  });

  describe("E. Directionality (Anti-parallel)", () => {
    it("should return true for Anti-parallel (reversed direction) but colinear", () => {
      // Implementation uses Math.abs(dot), so this should match.
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ] // Dir 1,0
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [20, 0],
          [10, 0]
        ] // Dir -1,0
      });
      // Touching at 10,0.
      // Dot = -1. Abs(Dot) = 1.
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });
  });

  describe("F. Story handling", () => {
    it("should return false for walls on different stories", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        story: 1
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [10, 0],
          [20, 0]
        ],
        story: 2
      });
      // Geometrically colinear, but different stories.
      // EXPECTED FAIL if implementation ignores story.
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });
  });

  describe("G. Degenerate/Data robustness", () => {
    it("should handle duplicate walls (same ID/geometry)", () => {
      // If duplicates are passed, they technically are colinear with themselves or each other.
      // The implementation iterates distinct indices (j = i + 1), so distinct objects/indices are compared.
      // If they are perfect duplicates, Distance=0, Dot=1. returns True.
      // User asked to verify robustness. If logic intends to filter duplicates, this expectation changes.
      // Assuming current logic matches duplicates:
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w1] }))).toBe(true);
    });
  });
});
