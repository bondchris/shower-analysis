import { checkNibWalls } from "../../../src/utils/room/checkNibWalls";
import { createExternalWall, createMockScan } from "./testHelpers";

describe("checkNibWalls", () => {
  describe("A. Baseline", () => {
    it("should return false for no walls", () => {
      expect(checkNibWalls(createMockScan({ walls: [] }))).toBe(false);
    });

    it("should return false for single normal wall (> 0.3048m)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [1, 0] // 1 meter > 0.3048m
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return true for single nib wall (< 0.3048m)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0] // 0.2 meter < 0.3048m
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });

    it("should return true for many walls, nib in middle/last", () => {
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [1, 0]
        ]
      });
      const wNib = createExternalWall("wNib", {
        polygonCorners: [
          [0, 0],
          [0.2, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w1, wNib] }))).toBe(true);
    });
  });

  describe("B. Thresholds / precision", () => {
    it("should return true for just under threshold (0.3048 - epsilon)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.3047, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });

    it("should return false for exactly threshold (0.3048)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.3048, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return false for just over threshold (0.3048 + epsilon)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.3049, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return true for floating point artifact (0.30479999999997)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.30479999999997, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });
  });

  describe("C. Geometry correctness", () => {
    it("should detect Axis-aligned short wall rectangle", () => {
      // Rectangle 0.2 x 0.1
      // Max dist is diagonal = sqrt(0.04 + 0.01) = sqrt(0.05) ~ 0.22 < 0.3048
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0],
          [0.2, 0.1],
          [0, 0.1]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });

    it("should detect Rotated short wall", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0]
        ],
        // Rotate 90 degrees around Y axis (XZ plane logic)
        transform: [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });

    it("should detect Diagonal short wall (Euclidean)", () => {
      // Length 0.2 at 45 degrees
      // dx = 0.2 * cos(45) ~ 0.141
      // dy = 0.2 * sin(45) ~ 0.141
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.141, 0.141]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });
  });

  describe("D. Thickness vs Length (Footprint logic)", () => {
    it("should return false for Long footprint, thin thickness", () => {
      // 2m long, 0.1m thick
      // Max dist is diagonal ~ sqrt(4 + 0.01) > 2 > 0.3048
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [2, 0],
          [2, 0.1],
          [0, 0.1]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return true for Short footprint, 'thick' dimensions", () => {
      // 0.2m long, 0.2m thick (Square nib)
      // Max dist = sqrt(0.04 + 0.04) = sqrt(0.08) ~ 0.28 < 0.3048
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0],
          [0.2, 0.2],
          [0, 0.2]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });
  });

  describe("E. Precedence (Dimensions vs Polygon)", () => {
    it("should use polygonCorners (short) over dimensions (long)", () => {
      const w = createExternalWall("w1", {
        dimensions: [2.0, 0.1, 2.0], // Dimension says 2m long
        polygonCorners: [
          [0, 0],
          [0.2, 0]
        ]
      });
      // Logic should prefer polygon corners (0.2m) => True
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });
  });

  describe("F. Degenerate / dirty-but-typed data", () => {
    it("should handle Zero-length footprint (corners collapse)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0, 0]
        ]
      });
      // Length 0 < 0.3048 => True.
      // Or if logic checks > MIN_LENGTH (0), it might be False.
      // Implementation check: if (maxDist < NIB_WALL_THRESHOLD && maxDist > MIN_LENGTH)
      // MIN_LENGTH is 0. So if maxDist is 0, it is NOT > 0. So False.
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });
  });

  describe("G. Optional scoping", () => {
    it("should ignore Nib wall on different story", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0]
        ],
        story: 1
      });
      // Wall is story 1 (default). Scan needs to be different (e.g. 2).
      expect(checkNibWalls(createMockScan({ story: 2, walls: [w] }))).toBe(false);
    });
  });
});
