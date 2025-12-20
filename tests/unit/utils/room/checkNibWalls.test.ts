import convert from "convert-units";

import { checkNibWalls } from "../../../../src/utils/room/checkNibWalls";
import { createExternalWall, createMockScan } from "./testHelpers";

describe("checkNibWalls", () => {
  const ONE_FOOT = 1;
  const THRESHOLD = convert(ONE_FOOT).from("ft").to("m");

  describe("Baseline", () => {
    it("should return false for no walls", () => {
      expect(checkNibWalls(createMockScan({ walls: [] }))).toBe(false);
    });

    it("should return false for single normal wall (> 1 ft)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [1, 0] // 1 meter > 0.3048m
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return true for single nib wall (< 1 ft)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0] // 0.2 meter < threshold
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

  describe("Thresholds / precision", () => {
    it("should return true for just under threshold (threshold - epsilon)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [THRESHOLD - 0.0001, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(true);
    });

    it("should return false for exactly threshold", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [THRESHOLD, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return false for just over threshold (threshold + epsilon)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [THRESHOLD + 0.0001, 0]
        ]
      });
      expect(checkNibWalls(createMockScan({ walls: [w] }))).toBe(false);
    });

    it("should return true for floating point artifact (threshold - tiny epsilon)", () => {
      const w = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [THRESHOLD - 1e-15, 0]
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
  describe("Coverage Improvements", () => {
    it("should ignore walls with invalid transforms", () => {
      // Wall is short enough to be a nib (< 0.3m), but transform is invalid
      const w1 = createExternalWall("w1", {
        polygonCorners: [
          [0, 0],
          [0.2, 0]
        ],
        transform: [1, 0, 0, 0] // Invalid length
      });
      expect(checkNibWalls(createMockScan({ walls: [w1] }))).toBe(false);
    });

    it("should use dimension fallback for empty polygonCorners", () => {
      // Dimension provides length 0.2m (Nib).
      const w1 = createExternalWall("w1", {
        dimensions: [0.2, 0, 0],
        polygonCorners: []
      });
      // Should calculate corners around origin: [-0.1, 0] to [0.1, 0]. Length 0.2.
      expect(checkNibWalls(createMockScan({ walls: [w1] }))).toBe(true);
    });

    it("should ignore points with insufficient data (length < 2)", () => {
      // Wall has corners but they are malformed arrays (e.g. [0])
      const w1 = createExternalWall("w1", {
        polygonCorners: [[0]] // invalid point, length 1
      });
      // Logic skips this point. Resulting valid corners = 0.
      // Wall is skipped. Returns false.
      expect(checkNibWalls(createMockScan({ walls: [w1] }))).toBe(false);
    });
  });
});
