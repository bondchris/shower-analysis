import { describe, expect, it } from "vitest";

import { Point } from "../../../../src/models/point";
import { checkPolygonIntegrity, doPolygonsIntersect } from "../../../../src/utils/math/polygon";

describe("polygon coverage edge cases", () => {
  const p = (x: number, y: number): Point => new Point(x, y);

  // 1. Self-intersection avoiding early checks
  it("should reject a complex self-intersecting polygon (Asymmetric with valid area)", () => {
    const poly = [p(0, 0), p(10, 0), p(5, 5), p(5, -1)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 2. Collinear Overlaps - Horizontal
  it("should reject horizontal collinear overlaps", () => {
    const poly = [p(0, 0), p(10, 0), p(10, 2), p(5, 2), p(5, 0), p(2, 0)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 3. Collinear Overlaps - Vertical
  it("should reject vertical collinear overlaps", () => {
    const poly = [p(0, 0), p(0, 10), p(2, 10), p(2, 5), p(0, 5), p(0, 2)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 4. Duplicate Points - "Kissing" Triangles
  it("should reject polygons checking back to a previous vertex (Touching Figures)", () => {
    const poly = [p(0, 0), p(10, 0), p(5, 5), p(5, 10), p(0, 10), p(5, 5)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 5. Implicit closure check with tiny gap
  it("should reject explicitly closed polygons (last point == first point)", () => {
    const poly = [p(0, 0), p(10, 0), p(10, 10), p(0, 0)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  describe("doPolygonsIntersect edge cases", () => {
    it("should handle holes in polygons array", () => {
      const poly1 = [p(0, 0), null as unknown as Point, p(10, 0), p(10, 10), p(0, 10)];
      const poly2 = [p(5, 5), p(15, 5), p(15, 15), p(5, 15)];
      expect(doPolygonsIntersect(poly1, poly2)).toBe(true);
    });

    it("should return true for identical polygons", () => {
      const poly = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
      expect(doPolygonsIntersect(poly, poly)).toBe(true);
    });
  });
});
