import { Point } from "../../../src/models/point";
import { crossProduct, dotProduct, magnitudeSquared, subtract } from "../../../src/utils/math/vector";

describe("vector utils", () => {
  describe("dotProduct", () => {
    it("should calculate dot product of two orthogonal vectors (0)", () => {
      expect(dotProduct(new Point(1, 0), new Point(0, 1))).toBe(0);
    });

    it("should calculate dot product of parallel vectors", () => {
      expect(dotProduct(new Point(1, 0), new Point(2, 0))).toBe(2);
    });

    it("should calculate dot product of opposite vectors", () => {
      expect(dotProduct(new Point(1, 1), new Point(-1, -1))).toBe(-2);
    });
  });

  describe("magnitudeSquared", () => {
    it("should calculate squared magnitude of a vector", () => {
      expect(magnitudeSquared(new Point(3, 4))).toBe(25);
    });

    it("should return 0 for zero vector", () => {
      expect(magnitudeSquared(new Point(0, 0))).toBe(0);
    });

    it("should handle negative coordinates", () => {
      // (-3)^2 + (-4)^2 = 9 + 16 = 25
      expect(magnitudeSquared(new Point(-3, -4))).toBe(25);
    });
  });

  describe("crossProduct", () => {
    it("should calculate 2D cross product (k-component)", () => {
      // (1,0) x (0,1) = 1*1 - 0*0 = 1 (Right hand rule: +Z)
      expect(crossProduct(new Point(1, 0), new Point(0, 1))).toBe(1);
    });

    it("should be negative for clockwise rotation order", () => {
      // (0,1) x (1,0) = 0*0 - 1*1 = -1
      expect(crossProduct(new Point(0, 1), new Point(1, 0))).toBe(-1);
    });

    it("should be 0 for parallel vectors", () => {
      expect(crossProduct(new Point(1, 1), new Point(2, 2))).toBe(0);
    });
  });

  describe("subtract", () => {
    it("should subtract vector b from vector a", () => {
      expect(subtract(new Point(5, 5), new Point(2, 3))).toEqual(new Point(3, 2));
    });

    it("should handle resulting negative coordinates", () => {
      expect(subtract(new Point(1, 1), new Point(2, 2))).toEqual(new Point(-1, -1));
    });
  });
});
