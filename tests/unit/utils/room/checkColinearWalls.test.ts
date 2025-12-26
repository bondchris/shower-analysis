import convert from "convert-units";

import { checkColinearWalls, expectDefined } from "../../../../src/utils/room/analysis/checkColinearWalls";
import { createExternalWall, createMockScan } from "./testHelpers";

describe("checkColinearWalls", () => {
  const INCH = convert(1).from("in").to("m");

  describe("expectDefined Helper", () => {
    it("should return value if defined", () => {
      expect(expectDefined(123, "error")).toBe(123);
    });

    it("should throw specific error if value is undefined", () => {
      expect(() => expectDefined(undefined as unknown, "Custom Error")).toThrow("Custom Error");
    });
  });

  describe("Core 'should detect' cases", () => {
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

  describe("Gap threshold boundaries", () => {
    it("should return false for gap exactly 3.00 inch", () => {
      // Threshold is < 0.0762 (3 inches). Exactly 3 should fail (be False).
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

  describe("False-positive guards", () => {
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

  describe("Directionality (Anti-parallel)", () => {
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

  describe("Story handling", () => {
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

  describe("Degenerate/Data robustness", () => {
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
  describe("Coverage Improvements", () => {
    it("should ignore walls with invalid transforms", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        // Invalid transform length (should be 16)
        transform: [1, 0, 0, 0]
      });
      // w2 is skipped, so only w1 remains -> no pairs -> false
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });

    it("should use dimensions fallback when polygonCorners are empty", () => {
      // Logic: If polygonCorners is empty, it uses dimensions[0] as length centering around origin (0,0)
      // Then transforms it.
      // Let's create two walls that WOULD be colinear if fallback works.
      // Wall 1: Standard
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [-5, 0],
          [5, 0]
        ]
      });
      // Wall 2: Dimensions fallback. Length 10. Origin at 0,0 (identity transform).
      // Should result in corners [-5, 0] and [5, 0].
      const w2 = createExternalWall("w2", {
        dimensions: [10, 0, 0],
        polygonCorners: []
      });

      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
    });

    it("should ignore walls with fewer than 2 corners after processing", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ]
      });
      const w2 = createExternalWall("w2", {
        // Only 1 corner provided
        polygonCorners: [[0, 0]]
      });
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });

    it("should handle undefined dimensions in fallback by defaulting to 0", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0, 0] // Effective point
        ]
      });
      const w2 = createExternalWall("w2", {
        dimensions: [], // Should default length to 0 -> corners [-0,0], [0,0]
        polygonCorners: []
      });
      // Both are effectively zero-length walls at origin?
      // Wait, min wall corners is 2. Fallback creates 2 corners.
      // If length is 0, corners are [0,0] and [0,0].
      // Logic checkColinearWalls L87 checks `wA.corners.length < MIN_PTS`. (2).
      // But loop L91 iterates corners. P1=0,0. P2=0,0.
      // Vector v = 0,0. Length = 0.
      // maxLenA stays 0. vAx, vAy stay 0.
      // Then checking against wB.
      // Parallel check: dot product of (0,0) and (1,0) -> 0. Not parallel.
      // So expects False.
      expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
    });
  });
});
