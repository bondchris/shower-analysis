import { Point } from "../../../src/models/point";
import { distToSegment, doSegmentsIntersect, getSegmentIntersection } from "../../../src/utils/math/segment";

describe("segment utils", () => {
  describe("doSegmentsIntersect (Strict)", () => {
    it("should return true for crossing segments", () => {
      expect(doSegmentsIntersect(new Point(-1, 0), new Point(1, 0), new Point(0, -1), new Point(0, 1))).toBe(true);
    });

    it("should return false for non-crossing segments", () => {
      expect(doSegmentsIntersect(new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1))).toBe(false);
    });
  });

  describe("getSegmentIntersection (Strict)", () => {
    it("should return intersection point for crossing segments", () => {
      // Intersection at (0,0)
      const p = getSegmentIntersection(new Point(-1, 0), new Point(1, 0), new Point(0, -1), new Point(0, 1));
      expect(p).not.toBeNull();
      if (p) {
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(0);
      }
    });

    it("should return null for non-crossing segments", () => {
      const p = getSegmentIntersection(new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1));
      expect(p).toBeNull();
    });

    it("should return intersection point for arbitrary crossing", () => {
      // Intersection of y=x and y=-x + 2 is at (1,1)
      const p = getSegmentIntersection(new Point(0, 0), new Point(2, 2), new Point(0, 2), new Point(2, 0));
      expect(p).not.toBeNull();
      if (p) {
        expect(p.x).toBeCloseTo(1);
        expect(p.y).toBeCloseTo(1);
      }
    });

    it("should return null for parallel segments", () => {
      const p = getSegmentIntersection(new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1));
      expect(p).toBeNull();
    });

    it("should return null for collinear segments", () => {
      const p = getSegmentIntersection(new Point(0, 0), new Point(2, 0), new Point(1, 0), new Point(3, 0));
      expect(p).toBeNull();
    });

    it("should return null for touching endpoints (strict check)", () => {
      // T-junction touching at (1,0)
      const p = getSegmentIntersection(new Point(0, 0), new Point(2, 0), new Point(1, 0), new Point(1, 1));
      expect(p).toBeNull();
    });
  });

  describe("distToSegment", () => {
    it("should throw error for invalid coordinates", () => {
      expect(() => distToSegment(new Point(NaN, 0), new Point(0, 0), new Point(10, 0))).toThrow(
        "Invalid point coordinates"
      );
    });

    // 1. Perpendicular projection falls on the segment (interior)
    it("should return perpendicular distance when projection falls on segment", () => {
      const a = new Point(0, 0);
      const b = new Point(10, 0);
      const p = new Point(5, 5);
      expect(distToSegment(p, a, b)).toBeCloseTo(5);
    });

    // 2. Projection falls before endpoint A (clamps to A)
    it("should clamp to start point (A) when projection falls before segment", () => {
      const a = new Point(0, 0);
      const b = new Point(10, 0);
      const p = new Point(-5, 5);
      // Dist to A(0,0) is sqrt((-5)^2 + 5^2) = sqrt(50)
      expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(50));
    });

    // 3. Projection falls after endpoint B (clamps to B)
    it("should clamp to end point (B) when projection falls after segment", () => {
      const a = new Point(0, 0);
      const b = new Point(10, 0);
      const p = new Point(15, 5);
      // Dist to B(10,0) is sqrt((15-10)^2 + 5^2) = sqrt(25 + 25) = sqrt(50)
      expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(50));
    });

    // 4. Zero-Distance / Exact-Hit Cases
    describe("4. Zero-Distance / Exact-Hit Cases", () => {
      it("should return 0 when point is directly on the segment (interior)", () => {
        const a = new Point(0, 0);
        const b = new Point(4, 4);
        const p = new Point(2, 2);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should return 0 when point is exactly at endpoint A", () => {
        const a = new Point(0, 0);
        const b = new Point(4, 4);
        const p = new Point(0, 0);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should return 0 when point is exactly at endpoint B", () => {
        const a = new Point(0, 0);
        const b = new Point(4, 4);
        const p = new Point(4, 4);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should return 0 for degenerate segment (all points identical)", () => {
        const a = new Point(3, 3);
        const b = new Point(3, 3);
        const p = new Point(3, 3);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });
    });

    // 5. Degenerate Segment Cases
    describe("5. Degenerate Segment Cases", () => {
      it("should treat degenerate segment (A==B) as a single point distance check", () => {
        const a = new Point(2, 2);
        const b = new Point(2, 2);
        const p = new Point(1, 1);
        // Distance from (1,1) to (2,2) is sqrt(2)
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.SQRT2);
      });

      it("should return 0 when point coincides with degenerate segment (A==B==P)", () => {
        const a = new Point(2, 2);
        const b = new Point(2, 2);
        const p = new Point(2, 2);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });
    });

    // 6. Collinear & Extension Cases
    describe("6. Collinear & Extension Cases", () => {
      it("should return 0 for collinear point between endpoints", () => {
        const a = new Point(0, 0);
        const b = new Point(10, 0);
        const p = new Point(3, 0);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should clamp to A for collinear point before start", () => {
        const a = new Point(0, 0);
        const b = new Point(10, 0);
        const p = new Point(-2, 0);
        // Distance to A(0,0) is 2
        expect(distToSegment(p, a, b)).toBeCloseTo(2);
      });

      it("should clamp to B for collinear point after end", () => {
        const a = new Point(0, 0);
        const b = new Point(10, 0);
        const p = new Point(12, 0);
        // Distance to B(10,0) is 2
        expect(distToSegment(p, a, b)).toBeCloseTo(2);
      });
    });

    // 7. Special Line Orientations
    describe("7. Special Line Orientations", () => {
      it("should handle horizontal segment correctly", () => {
        const a = new Point(0, 5);
        const b = new Point(10, 5);
        const p = new Point(3, 8);
        // Perpendicular dist to y=5 is |8-5|=3
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should handle vertical segment correctly", () => {
        const a = new Point(5, 0);
        const b = new Point(5, 10);
        const p = new Point(8, 3);
        // Perpendicular dist to x=5 is |8-5|=3
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should handle 45-degree diagonal segment (positive slope)", () => {
        const a = new Point(0, 0);
        const b = new Point(4, 4);
        const p = new Point(1, 3);
        // Distance to line y=x from (1,3) is sqrt(2)
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.SQRT2);
      });

      it("should handle negative slope segment", () => {
        const a = new Point(0, 0);
        const b = new Point(4, -4);
        const p = new Point(2, 0);
        // Distance to line y=-x from (2,0) is sqrt(2)
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.SQRT2);
      });
    });

    // 8. Boundary / "Same Coordinate" Cases
    describe("8. Boundary / Coordinate Mix Cases", () => {
      it("should return 0 for point exactly at segment midpoint", () => {
        const a = new Point(0, 0);
        const b = new Point(4, 0);
        const p = new Point(2, 0);
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should handle point with same x as endpoint A but different y", () => {
        const a = new Point(1, 1);
        const b = new Point(5, 3);
        const p = new Point(1, 10);
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(64.8));
      });

      it("should handle point with same y as endpoint A but different x", () => {
        const a = new Point(1, 1);
        const b = new Point(5, 3);
        const p = new Point(10, 1);
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(29));
      });

      it("should handle point with same x as A and same y as B", () => {
        const a = new Point(1, 1);
        const b = new Point(5, 3);
        const p = new Point(1, 3);
        expect(distToSegment(p, a, b)).toBeCloseTo(4 / Math.sqrt(5));
      });
    });

    // 9. Quadrants & Coordinate System Coverage
    describe("9. Quadrants & Coordinate System Coverage", () => {
      it("should handle all negative coordinates", () => {
        const a = new Point(-4, -1);
        const b = new Point(-1, -3);
        const p = new Point(-2, 1);
        expect(distToSegment(p, a, b)).toBeCloseTo(10 / Math.sqrt(13));
      });

      it("should handle mixed quadrants", () => {
        const a = new Point(-2, -1);
        const b = new Point(2, 1);
        const p = new Point(0, -3);
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(7.2));
      });

      it("should handle points in all quadrants relative to segment on X-axis", () => {
        const a = new Point(0, 0);
        const b = new Point(4, 0);

        // Q1 relative (above right): Clamps to B
        expect(distToSegment(new Point(5, 1), a, b)).toBeCloseTo(Math.sqrt(2));

        // Q2 relative (above left): Clamps to A
        expect(distToSegment(new Point(-1, 1), a, b)).toBeCloseTo(Math.sqrt(2));

        // Q3 relative (below left): Clamps to A
        expect(distToSegment(new Point(-1, -1), a, b)).toBeCloseTo(Math.sqrt(2));

        // Q4 relative (below right): Clamps to B
        expect(distToSegment(new Point(5, -1), a, b)).toBeCloseTo(Math.sqrt(2));
      });
    });

    // 10. Numerical / Floating-Point Edge Cases
    describe("10. Numerical / Floating-Point Edge Cases", () => {
      it("should handle very short (near-zero) segment", () => {
        const a = new Point(0, 0);
        const b = new Point(1e-9, 0);
        const p = new Point(1, 0);
        expect(distToSegment(p, a, b)).toBeCloseTo(1);
      });

      it("should handle point very close to the line (precision check)", () => {
        const a = new Point(0, 0);
        const b = new Point(2, 0);
        const p = new Point(1, 1e-7);
        expect(distToSegment(p, a, b)).toBeCloseTo(1e-7, 6); // Check 6 decimal places
      });

      it("should handle very large coordinates", () => {
        const a = new Point(1e7, 1e7);
        const b = new Point(2e7, 2e7);
        const p = new Point(1e7, 2e7);
        expect(distToSegment(p, a, b)).toBeCloseTo(7071067.811865, 2);
      });

      it("should handle segment with very small coordinates", () => {
        const a = new Point(1e-10, 0);
        const b = new Point(2e-10, 0);
        const p = new Point(1.5e-10, 1e-10);
        expect(distToSegment(p, a, b)).toBeCloseTo(1e-10, 10);
      });

      it("should handle point extremely far from segment (overflow check)", () => {
        const a = new Point(0, 0);
        const b = new Point(1, 0);
        const p = new Point(0, 1e9);
        expect(distToSegment(p, a, b)).toBeCloseTo(1e9);
      });
    });

    // 11. Perpendicular at Various Positions (Boundary Precision)
    describe("11. Perpendicular at Various Positions (Boundary Precision)", () => {
      it("should clamp to A when Perpendicular is just before A", () => {
        const a = new Point(0, 0);
        const b = new Point(10, 0);
        const p = new Point(-1e-9, 3);
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should clamp to B when Perpendicular is just past B", () => {
        const a = new Point(0, 0);
        const b = new Point(10, 0);
        const p = new Point(10 + 1e-9, 3);
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });
    });
  });
});
