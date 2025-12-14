import { Point } from "../../../../src/models/point";
import {
  add,
  angleBetween,
  crossProduct,
  distanceSquared,
  dotProduct,
  equals,
  magnitude,
  magnitudeSquared,
  normalize,
  scale,
  subtract
} from "../../../../src/utils/math/vector";

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

  describe("add", () => {
    it("should add two vectors", () => {
      expect(add(new Point(1, 2), new Point(3, 4))).toEqual(new Point(4, 6));
    });

    it("should handle negative coordinates", () => {
      expect(add(new Point(1, -2), new Point(-3, 4))).toEqual(new Point(-2, 2));
    });
  });

  describe("scale", () => {
    it("should scale vector by scalar", () => {
      expect(scale(new Point(2, 3), 2)).toEqual(new Point(4, 6));
    });

    it("should scale by negative scalar", () => {
      expect(scale(new Point(1, 1), -1)).toEqual(new Point(-1, -1));
    });
  });

  describe("distanceSquared", () => {
    it("should calculate squared distance between points", () => {
      // (1,1) to (4,5) -> dx=3, dy=4 -> 9+16=25
      expect(distanceSquared(new Point(1, 1), new Point(4, 5))).toBe(25);
    });

    it("should be 0 for same point", () => {
      expect(distanceSquared(new Point(1, 2), new Point(1, 2))).toBe(0);
    });
  });

  describe("magnitude", () => {
    it("should calculate magnitude", () => {
      expect(magnitude(new Point(3, 4))).toBe(5);
    });

    it("should be 0 for zero vector", () => {
      expect(magnitude(new Point(0, 0))).toBe(0);
    });
  });

  describe("normalize", () => {
    it("should return unit vector", () => {
      const v = normalize(new Point(3, 0));
      expect(v).toEqual(new Point(1, 0));
      expect(magnitude(v)).toBe(1);
    });

    it("should handle zero vector by returning zero vector", () => {
      expect(normalize(new Point(0, 0))).toEqual(new Point(0, 0));
    });

    it("should normalize (3,4) to (0.6, 0.8)", () => {
      const v = normalize(new Point(3, 4));
      expect(v.x).toBeCloseTo(0.6);
      expect(v.y).toBeCloseTo(0.8);
      expect(magnitude(v)).toBeCloseTo(1);
    });
  });

  describe("equals", () => {
    it("should return true for exact equality (default)", () => {
      expect(equals(new Point(1, 2), new Point(1, 2))).toBe(true);
    });

    it("should return false for different vectors (default)", () => {
      expect(equals(new Point(1, 2), new Point(1, 3))).toBe(false);
    });

    it("should check equality with epsilon", () => {
      expect(equals(new Point(1, 2), new Point(1.001, 2.001), 0.01)).toBe(true);
      expect(equals(new Point(1, 2), new Point(1.1, 2.1), 0.01)).toBe(false);
    });
  });

  describe("angleBetween", () => {
    it("should return 0 for same vector", () => {
      expect(angleBetween(new Point(1, 0), new Point(1, 0))).toBe(0);
    });

    it("should return PI/2 for orthogonal vectors", () => {
      expect(angleBetween(new Point(1, 0), new Point(0, 1))).toBeCloseTo(Math.PI / 2);
    });

    it("should return PI for opposite vectors", () => {
      expect(angleBetween(new Point(1, 0), new Point(-1, 0))).toBeCloseTo(Math.PI);
    });

    it("should return 0 if one vector is zero", () => {
      expect(angleBetween(new Point(1, 0), new Point(0, 0))).toBe(0);
    });
  });
});
