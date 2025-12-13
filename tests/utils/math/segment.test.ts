import { distToSegment, segmentsIntersect } from "../../../src/utils/math/segment";

describe("segment utils", () => {
  describe("segmentsIntersect (Strict)", () => {
    it("should return true for crossing segments", () => {
      expect(segmentsIntersect({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 })).toBe(true);
    });

    it("should return false for non-crossing segments", () => {
      expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false);
    });
  });

  describe("distToSegment", () => {
    // 1. Perpendicular projection falls on the segment (interior)
    it("should return perpendicular distance when projection falls on segment", () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 0 };
      const p = { x: 5, y: 5 };
      expect(distToSegment(p, a, b)).toBeCloseTo(5);
    });

    // 2. Projection falls before endpoint A (clamps to A)
    it("should clamp to start point (A) when projection falls before segment", () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 0 };
      const p = { x: -5, y: 5 };
      // Dist to A(0,0) is sqrt((-5)^2 + 5^2) = sqrt(50)
      expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(50));
    });

    // 3. Projection falls after endpoint B (clamps to B)
    it("should clamp to end point (B) when projection falls after segment", () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 0 };
      const p = { x: 15, y: 5 };
      // Dist to B(10,0) is sqrt((15-10)^2 + 5^2) = sqrt(25 + 25) = sqrt(50)
      expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(50));
    });

    // 4. Zero-Distance / Exact-Hit Cases
    describe("4. Zero-Distance / Exact-Hit Cases", () => {
      it("should return 0 when point is directly on the segment (interior)", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: 4 };
        const p = { x: 2, y: 2 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should return 0 when point is exactly at endpoint A", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: 4 };
        const p = { x: 0, y: 0 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should return 0 when point is exactly at endpoint B", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: 4 };
        const p = { x: 4, y: 4 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should return 0 for degenerate segment (all points identical)", () => {
        const a = { x: 3, y: 3 };
        const b = { x: 3, y: 3 };
        const p = { x: 3, y: 3 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });
    });

    // 5. Degenerate Segment Cases
    describe("5. Degenerate Segment Cases", () => {
      it("should treat degenerate segment (A==B) as a single point distance check", () => {
        const a = { x: 2, y: 2 };
        const b = { x: 2, y: 2 };
        const p = { x: 1, y: 1 };
        // Distance from (1,1) to (2,2) is sqrt(2)
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.SQRT2);
      });

      it("should return 0 when point coincides with degenerate segment (A==B==P)", () => {
        const a = { x: 2, y: 2 };
        const b = { x: 2, y: 2 };
        const p = { x: 2, y: 2 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });
    });

    // 6. Collinear & Extension Cases
    describe("6. Collinear & Extension Cases", () => {
      it("should return 0 for collinear point between endpoints", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: 3, y: 0 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should clamp to A for collinear point before start", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: -2, y: 0 };
        // Distance to A(0,0) is 2
        expect(distToSegment(p, a, b)).toBeCloseTo(2);
      });

      it("should clamp to B for collinear point after end", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: 12, y: 0 };
        // Distance to B(10,0) is 2
        expect(distToSegment(p, a, b)).toBeCloseTo(2);
      });
    });

    // 7. Special Line Orientations
    describe("7. Special Line Orientations", () => {
      it("should handle horizontal segment correctly", () => {
        const a = { x: 0, y: 5 };
        const b = { x: 10, y: 5 };
        const p = { x: 3, y: 8 };
        // Perpendicular dist to y=5 is |8-5|=3
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should handle vertical segment correctly", () => {
        const a = { x: 5, y: 0 };
        const b = { x: 5, y: 10 };
        const p = { x: 8, y: 3 };
        // Perpendicular dist to x=5 is |8-5|=3
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should handle 45-degree diagonal segment (positive slope)", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: 4 };
        const p = { x: 1, y: 3 };
        // Distance to line y=x from (1,3) is sqrt(2)
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.SQRT2);
      });

      it("should handle negative slope segment", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: -4 };
        const p = { x: 2, y: 0 };
        // Distance to line y=-x from (2,0) is sqrt(2)
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.SQRT2);
      });
    });

    // 8. Boundary / "Same Coordinate" Cases
    describe("8. Boundary / Coordinate Mix Cases", () => {
      it("should return 0 for point exactly at segment midpoint", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: 0 };
        const p = { x: 2, y: 0 };
        expect(distToSegment(p, a, b)).toBeCloseTo(0);
      });

      it("should handle point with same x as endpoint A but different y", () => {
        const a = { x: 1, y: 1 };
        const b = { x: 5, y: 3 };
        const p = { x: 1, y: 10 };
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(64.8));
      });

      it("should handle point with same y as endpoint A but different x", () => {
        const a = { x: 1, y: 1 };
        const b = { x: 5, y: 3 };
        const p = { x: 10, y: 1 };
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(29));
      });

      it("should handle point with same x as A and same y as B", () => {
        const a = { x: 1, y: 1 };
        const b = { x: 5, y: 3 };
        const p = { x: 1, y: 3 };
        expect(distToSegment(p, a, b)).toBeCloseTo(4 / Math.sqrt(5));
      });
    });

    // 9. Quadrants & Coordinate System Coverage
    describe("9. Quadrants & Coordinate System Coverage", () => {
      it("should handle all negative coordinates", () => {
        const a = { x: -4, y: -1 };
        const b = { x: -1, y: -3 };
        const p = { x: -2, y: 1 };
        expect(distToSegment(p, a, b)).toBeCloseTo(10 / Math.sqrt(13));
      });

      it("should handle mixed quadrants", () => {
        const a = { x: -2, y: -1 };
        const b = { x: 2, y: 1 };
        const p = { x: 0, y: -3 };
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(7.2));
      });

      it("should handle points in all quadrants relative to segment on X-axis", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 4, y: 0 };

        // Q1 relative (above right): Clamps to B
        expect(distToSegment({ x: 5, y: 1 }, a, b)).toBeCloseTo(Math.sqrt(2));

        // Q2 relative (above left): Clamps to A
        expect(distToSegment({ x: -1, y: 1 }, a, b)).toBeCloseTo(Math.sqrt(2));

        // Q3 relative (below left): Clamps to A
        expect(distToSegment({ x: -1, y: -1 }, a, b)).toBeCloseTo(Math.sqrt(2));

        // Q4 relative (below right): Clamps to B
        expect(distToSegment({ x: 5, y: -1 }, a, b)).toBeCloseTo(Math.sqrt(2));
      });
    });

    // 10. Numerical / Floating-Point Edge Cases
    describe("10. Numerical / Floating-Point Edge Cases", () => {
      it("should handle very short (near-zero) segment", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 1e-9, y: 0 };
        const p = { x: 1, y: 0 };
        expect(distToSegment(p, a, b)).toBeCloseTo(1);
      });

      it("should handle point very close to the line (precision check)", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 2, y: 0 };
        const p = { x: 1, y: 1e-7 };
        expect(distToSegment(p, a, b)).toBeCloseTo(1e-7, 6); // Check 6 decimal places
      });

      it("should handle very large coordinates", () => {
        const a = { x: 1e7, y: 1e7 };
        const b = { x: 2e7, y: 2e7 };
        const p = { x: 1e7, y: 2e7 };
        expect(distToSegment(p, a, b)).toBeCloseTo(7071067.811865, 2);
      });

      it("should handle segment with very small coordinates", () => {
        const a = { x: 1e-10, y: 0 };
        const b = { x: 2e-10, y: 0 };
        const p = { x: 1.5e-10, y: 1e-10 };
        expect(distToSegment(p, a, b)).toBeCloseTo(1e-10, 10);
      });

      it("should handle point extremely far from segment (overflow check)", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 1, y: 0 };
        const p = { x: 0, y: 1e9 };
        expect(distToSegment(p, a, b)).toBeCloseTo(1e9);
      });
    });

    // 11. Perpendicular at Various Positions (Boundary Precision)
    describe("11. Perpendicular at Various Positions (Boundary Precision)", () => {
      it("should clamp to A when Perpendicular is just before A", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: -1e-9, y: 3 };
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should clamp to B when Perpendicular is just past B", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: 10 + 1e-9, y: 3 };
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });
    });
  });
});
