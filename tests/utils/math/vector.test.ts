import { crossProduct, dotProduct, magnitudeSquared, subtract } from "../../../src/utils/math/vector";

describe("vector utils", () => {
  describe("dotProduct", () => {
    it("should calculate dot product of two orthogonal vectors (0)", () => {
      expect(dotProduct({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    });

    it("should calculate dot product of parallel vectors", () => {
      expect(dotProduct({ x: 1, y: 0 }, { x: 2, y: 0 })).toBe(2);
    });

    it("should calculate dot product of opposite vectors", () => {
      expect(dotProduct({ x: 1, y: 1 }, { x: -1, y: -1 })).toBe(-2);
    });
  });

  describe("magnitudeSquared", () => {
    it("should calculate squared magnitude of a vector", () => {
      expect(magnitudeSquared({ x: 3, y: 4 })).toBe(25);
    });

    it("should return 0 for zero vector", () => {
      expect(magnitudeSquared({ x: 0, y: 0 })).toBe(0);
    });

    it("should handle negative coordinates", () => {
      // (-3)^2 + (-4)^2 = 9 + 16 = 25
      expect(magnitudeSquared({ x: -3, y: -4 })).toBe(25);
    });
  });

  describe("crossProduct", () => {
    it("should calculate 2D cross product (k-component)", () => {
      // (1,0) x (0,1) = 1*1 - 0*0 = 1 (Right hand rule: +Z)
      expect(crossProduct({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
    });

    it("should be negative for clockwise rotation order", () => {
      // (0,1) x (1,0) = 0*0 - 1*1 = -1
      expect(crossProduct({ x: 0, y: 1 }, { x: 1, y: 0 })).toBe(-1);
    });

    it("should be 0 for parallel vectors", () => {
      expect(crossProduct({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0);
    });
  });

  describe("subtract", () => {
    it("should subtract vector b from vector a", () => {
      expect(subtract({ x: 5, y: 5 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 2 });
    });

    it("should handle resulting negative coordinates", () => {
      expect(subtract({ x: 1, y: 1 }, { x: 2, y: 2 })).toEqual({ x: -1, y: -1 });
    });
  });
});
