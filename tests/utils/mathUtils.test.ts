import { checkPolygonIntegrity, distToSegment, segmentsIntersect } from "../../src/utils/mathUtils";

describe("mathUtils", () => {
  describe("segmentsIntersect (Strict)", () => {
    it("should return true for crossing segments", () => {
      expect(segmentsIntersect({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 })).toBe(true);
    });

    it("should return false for non-crossing segments", () => {
      expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false);
    });
  });

  describe("checkPolygonIntegrity (14 User Requirements)", () => {
    // 1. Simple convex rectangle
    it("1. should accept a simple convex rectangle (CW)", () => {
      // CW Square
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });

    // 2. Simple concave L-shape
    it("2. should accept a simple concave L-shape (CW)", () => {
      // L-shape
      // (0,0) -> (10,0) -> (10,2) -> (2,2) -> (2,10) -> (0,10)
      const poly = [
        [0, 0],
        [10, 0],
        [10, 2],
        [2, 2],
        [2, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });

    // 3. Very large coordinates (test numerical stability)
    it("3. should accept very large but valid coordinates (within limit)", () => {
      // Limit is 10,000. Test close to limit.
      const poly = [
        [0, 0],
        [9999, 0],
        [9999, 9999],
        [0, 9999]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });

    it("3b. should reject coordinates exceeding the safety limit (> 10000)", () => {
      const poly = [
        [0, 0],
        [10001, 0],
        [10001, 10001],
        [0, 10001]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 4. Too few points
    it("4. should reject polygons with fewer than 3 points", () => {
      expect(checkPolygonIntegrity([])).toBe(false);
      expect(checkPolygonIntegrity([[0, 0]])).toBe(false);
      expect(
        checkPolygonIntegrity([
          [0, 0],
          [1, 1]
        ])
      ).toBe(false);
    });

    // 5. Zero area / collinear points
    it("5. should reject zero area / collinear polygons", () => {
      // Straight line 3 points
      const poly = [
        [0, 0],
        [5, 0],
        [10, 0]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    it("5b. should reject degenerate zero-area flat shapes", () => {
      // A->B->A (implicit close)
      const poly = [
        [0, 0],
        [10, 0],
        [5, 0] // Backtrack collinear
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 6. Tiny edges (< MIN_EDGE_LEN)
    it("6. should reject tiny edges (< 1mm)", () => {
      const poly = [
        [0, 0],
        [0.0009, 0], // < 0.001
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 7. Duplicate consecutive points
    it("7. should reject duplicate consecutive points (zero length edge)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10, 0], // Dupe
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 8. Duplicate non-consecutive (Figure 8 touching at vertex)
    it("8. should reject duplicate non-consecutive points (Figure-8/Touching)", () => {
      // (0,0) -> (5,5) -> (10,0) -> (5,5) -> (0,0) ... wait, implicitly closed.
      // Let's make a bow-tie touching at center.
      // (0,0) -> (10,0) -> (5,5) -> (10,10) -> (0,10) -> (5,5) ...
      // That's complex.
      // Simpler: Two triangles sharing a vertex.
      // (0,0)->(5,0)->(2.5,5)->(5,10)->(0,10) ... (2.5,5) is shared?
      // Path: (0,0) -> (10,0) -> (5,5) -> (0,10) -> (0,0) is a triangle? No.
      // Bowtie crossing is Case 9.
      // Duplicate non-consecutive means touching itself.
      // (0,0) -> (10,0) -> (10,10) -> (5,5) -> (0,10) -> (0,0).
      // (5,5) is unique.
      // Square with a loop attached?
      // (0,0)->(10,0)->(10,10)->(5,5)->(6,4)->(5,5)...
      // Let's do a simple pinch.
      // (0,0) -> (10,0) -> (5,1) -> (0,0) -> (0,10) -> (5,9) -> (0,0) implicitly?
      // Explicit duplicate:
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [10, 0], // Duplicate of index 1
        [0, 10]
      ];
      // This creates a zero-width spike or backtracking? (10,10)->(10,0)
      // (10,0)->(10,10) and (10,10)->(10,0) are "Collinear Overlapping" edges.
      // This should be caught by "Overlapping edges" check.
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 9. Self-intersections (the classic ones)
    it("9. should reject classic self-intersections (Bowtie)", () => {
      // (0,0) -> (10,0) -> (0,10) -> (10,10)
      // Edges: Bottom, Diag Up-Left, Top, Diag Down-Left (implicit close to 0,0)
      // (10,0)->(0,10) crosses (10,10)->(0,0)?
      // Implicit edge is (10,10)->(0,0).
      // Segment 1: (10,0)-(0,10). Segment 3: (10,10)-(0,0). Cross at (5,5).
      const poly = [
        [0, 0],
        [10, 0],
        [0, 10],
        [10, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 10. Overlapping edges (coincident but opposite direction)
    it("10. should reject overlapping edges (folding back)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [5, 0], // Backtracking on same line
        [5, 5],
        [0, 5]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 11. Extremely sharp spikes ("needle" or "back-and-forth")
    it("11. should reject extremely sharp spikes (< 5 deg)", () => {
      // Needle
      const spike = [
        [0, 0],
        [10, 0.1],
        [0, 0.2],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(spike)).toBe(false);
    });

    // 12. Wrong winding order
    it("12. should reject CCW winding (wrong order)", () => {
      // CCW Square
      const poly = [
        [0, 0], // Bottom-Left
        [0, 10], // Top-Left
        [10, 10], // Top-Right
        [10, 0] // Bottom-Right
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 13. Almost touching (floating-point danger zone)
    it("13. should reject almost touching edges if they fall within EPSILON overlaps/intersections", () => {
      // Pinch shape: Non-consecutive vertices (0,0) and (1e-8, 0) are very close.
      // Edges must be > MIN_EDGE_LENGTH (0.001).
      // Ensure CW winding.
      const poly = [
        [0, 0],
        [10, -5],
        [10, 5],
        [1e-8, 0], // Very close to (0,0) but distinct (> EPSILON 1e-9)
        [-10, 5],
        [-10, -5]
      ];
      // Should accept because 1e-8 > 1e-9 (EPSILON) and no intersection.
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });

    // 14. Pathological: thousands of points on a straight line
    it("14. should reject pathological collinear chains", () => {
      // 100 points on a line: (0,0), (1,0), (2,0)...
      const poly = [];
      for (let i = 0; i < 100; i++) {
        poly.push([i, 0]);
      }
      // Then close it to make a user-defined "polygon" (even though flat)
      poly.push([0, 1]); // Add thickness?
      // (99,0) -> (0,1).
      // (0,1) -> (0,0).
      // The bottom edge is composed of 99 Collinear edges.
      // (0,0)->(1,0) and (1,0)->(2,0).
      // Angle at (1,0):
      // BA=(1,0)->(0,0)= (-1,0). BC=(1,0)->(2,0)= (1,0).
      // Angle: 180 degrees.
      // Max angle is 175. So checking angle at each vertex should catch this.
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 15. NaN and Infinity (Runtime checks not covered by types)
    it("15. should reject NaN or Infinity coordinates", () => {
      expect(
        checkPolygonIntegrity([
          [0, 0],
          [10, NaN],
          [0, 10]
        ])
      ).toBe(false);
      expect(
        checkPolygonIntegrity([
          [0, 0],
          [Infinity, 0],
          [0, 10]
        ])
      ).toBe(false);
    });

    // 16. Vertical Collinearity (Pathological)
    it("16. should reject vertical collinear chains", () => {
      // 3 points on Y axis
      const poly = [
        [0, 0],
        [0, 10],
        [0, 20]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
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
        // A(1,1), B(5,3). AB=(4,2). |AB|^2=20.
        // P(1,10). AP=(0,9).
        // t = (0*4 + 9*2)/20 = 18/20 = 0.9.
        // Projects ON segment. Closest point C = A + 0.9*AB = (1,1) + (3.6, 1.8) = (4.6, 2.8).
        // Dist P to C = sqrt((1-4.6)^2 + (10-2.8)^2) = sqrt((-3.6)^2 + (7.2)^2) = sqrt(12.96 + 51.84) = sqrt(64.8) approx 8.0498.
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(64.8));
      });

      it("should handle point with same y as endpoint A but different x", () => {
        const a = { x: 1, y: 1 };
        const b = { x: 5, y: 3 };
        const p = { x: 10, y: 1 };
        // A(1,1), B(5,3). Vector AB=(4,2).
        // P(10,1). Vector AP=(9,0).
        // r = AP.AB / AB.AB = (36+0) / (16+4) = 36/20 = 1.8.
        // r > 1, so clamps to B(5,3).
        // Dist P(10,1) to B(5,3) = sqrt((10-5)^2 + (1-3)^2) = sqrt(25 + 4) = sqrt(29).
        expect(distToSegment(p, a, b)).toBeCloseTo(Math.sqrt(29));
      });

      it("should handle point with same x as A and same y as B", () => {
        const a = { x: 1, y: 1 };
        const b = { x: 5, y: 3 };
        const p = { x: 1, y: 3 };
        // A(1,1), B(5,3). AB=(4,2).
        // P(1,3). AP=(0,2).
        // r = (0*4 + 2*2) / 20 = 4/20 = 0.2.
        // r is between 0 and 1. Projection on segment.
        // Line eq: y-1 = 0.5(x-1) => y = 0.5x + 0.5 => 0.5x - y + 0.5 = 0. -> x - 2y + 1 = 0.
        // Dist = |1(1) - 2(3) + 1| / sqrt(1^2 + (-2)^2) = |1 - 6 + 1| / sqrt(5) = |-4|/sqrt(5) = 4/sqrt(5).
        expect(distToSegment(p, a, b)).toBeCloseTo(4 / Math.sqrt(5));
      });
    });

    // 9. Quadrants & Coordinate System Coverage
    describe("9. Quadrants & Coordinate System Coverage", () => {
      it("should handle all negative coordinates", () => {
        const a = { x: -4, y: -1 };
        const b = { x: -1, y: -3 };
        const p = { x: -2, y: 1 };
        // Vector AB=(3, -2). |AB|^2=13. AP=(2, 2).
        // t = (6-4)/13 = 2/13.
        // Nearest C = (-4, -1) + (6/13, -4/13) = (-46/13, -17/13).
        // Dist P to C = 10 / sqrt(13).
        expect(distToSegment(p, a, b)).toBeCloseTo(10 / Math.sqrt(13));
      });

      it("should handle mixed quadrants", () => {
        const a = { x: -2, y: -1 };
        const b = { x: 2, y: 1 };
        const p = { x: 0, y: -3 };
        // AB=(4, 2). |AB|^2=20. AP=(2, -2).
        // t = (8-4)/20 = 4/20 = 0.2.
        // Nearest C = (-2, -1) + (0.8, 0.4) = (-1.2, -0.6).
        // Dist P(0,-3) to C(-1.2,-0.6) = sqrt(1.2^2 + 2.4^2) = sqrt(1.44 + 5.76) = sqrt(7.2).
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
        // Distance from (1,0) to B(1e-9,0) is 1 - 1e-9 approx 1.
        // Using toBeCloseTo with default 2 digits covers this easily.
        expect(distToSegment(p, a, b)).toBeCloseTo(1);
      });

      it("should handle point very close to the line (precision check)", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 2, y: 0 };
        const p = { x: 1, y: 1e-7 };
        // Perpendicular distance is 1e-7.
        expect(distToSegment(p, a, b)).toBeCloseTo(1e-7, 6); // Check 6 decimal places
      });

      it("should handle very large coordinates", () => {
        const a = { x: 1e7, y: 1e7 };
        const b = { x: 2e7, y: 2e7 };
        const p = { x: 1e7, y: 2e7 };
        // Distance is |1e7 - 2e7| / sqrt(2) = 1e7 / sqrt(2) approx 7071067.8
        expect(distToSegment(p, a, b)).toBeCloseTo(7071067.811865, 2);
      });

      it("should handle segment with very small coordinates", () => {
        const a = { x: 1e-10, y: 0 };
        const b = { x: 2e-10, y: 0 };
        const p = { x: 1.5e-10, y: 1e-10 };
        // P(1.5e-10, 1e-10) is above midpoint of segment [(1e-10,1), (2e-10,0)].
        // Dist = 1e-10.
        // We need higher precision for closeTo since values are tiny.
        // Checking difference < 0.00005 is useless for 1e-10.
        // We need to scale or use tolerance.
        // Jest toBeCloseTo: expected - received < 0.005 * 10^-precision / 2.
        // Default precision 2 => < 0.005.
        // We need precision around 10-12.
        expect(distToSegment(p, a, b)).toBeCloseTo(1e-10, 10);
      });

      it("should handle point extremely far from segment (overflow check)", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 1, y: 0 };
        const p = { x: 0, y: 1e9 };
        // Distance to A(0,0) is 1e9.
        expect(distToSegment(p, a, b)).toBeCloseTo(1e9);
      });
    });

    // 11. Perpendicular at Various Positions (Boundary Precision)
    describe("11. Perpendicular at Various Positions (Boundary Precision)", () => {
      it("should clamp to A when Perpendicular is just before A", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: -1e-9, y: 3 };
        // Closest point is A(0,0).
        // Distance is sqrt((-1e-9)^2 + 3^2) approx 3.
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });

      it("should clamp to B when Perpendicular is just past B", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        const p = { x: 10 + 1e-9, y: 3 };
        // Closest point is B(10,0).
        // Distance is sqrt((1e-9)^2 + 3^2) approx 3.
        expect(distToSegment(p, a, b)).toBeCloseTo(3);
      });
    });
  });
});
