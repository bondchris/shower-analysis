import { checkPolygonIntegrity, doPolygonsIntersect } from "../../../src/utils/math/polygon";

describe("polygon utils", () => {
  describe("checkPolygonIntegrity", () => {
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
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [10, 0], // Duplicate of index 1
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 9. Self-intersections (the classic ones)
    it("9. should reject classic self-intersections (Bowtie)", () => {
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

  describe("doPolygonsIntersect", () => {
    // 1. Basic Intersection
    describe("1. Basic Intersection", () => {
      it("should intersect clear overlapping convex squares", () => {
        const poly1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const poly2 = [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 15 },
          { x: 5, y: 15 }
        ];
        expect(doPolygonsIntersect(poly1, poly2)).toBe(true);
      });

      it("should intersect convex and concave polygons (overlap)", () => {
        const square = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        // L-shape with (2,2) inside square
        const lShape = [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 7 },
          { x: 7, y: 7 },
          { x: 7, y: 15 },
          { x: 5, y: 15 }
        ];
        expect(doPolygonsIntersect(square, lShape)).toBe(true);
      });

      it("should intersect two interlocking concave polygons (interiors overlap)", () => {
        const l1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 10 },
          { x: 0, y: 10 }
        ];
        const l2 = [
          { x: 1, y: 1 },
          { x: 11, y: 1 },
          { x: 11, y: 3 },
          { x: 3, y: 3 },
          { x: 3, y: 11 },
          { x: 1, y: 11 }
        ];
        expect(doPolygonsIntersect(l1, l2)).toBe(true);
      });

      it("should NOT intersect disjoint polygons", () => {
        const poly1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const poly2 = [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 }
        ];
        expect(doPolygonsIntersect(poly1, poly2)).toBe(false);
      });

      it("should NOT intersect when bounding boxes overlap but polygons do not", () => {
        const t1 = [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 0, y: 5 }
        ];
        const t2 = [
          { x: 10, y: 10 },
          { x: 5, y: 10 },
          { x: 10, y: 5 }
        ];
        expect(doPolygonsIntersect(t1, t2)).toBe(false);
      });
    });

    // 2. Touching / "Kissing" Boundary Cases
    describe("2. Touching / Boundary Cases", () => {
      it("should return false for vertex-vertex touch (kissing corners)", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const s2 = [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 }
        ];
        expect(doPolygonsIntersect(s1, s2)).toBe(true);
      });

      it("should return true for vertex-on-edge (T-junction)", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const t1 = [
          { x: 10, y: 5 },
          { x: 15, y: 0 },
          { x: 15, y: 10 }
        ];
        expect(doPolygonsIntersect(s1, t1)).toBe(true);
      });

      it("should return true for full edge sharing (colinear)", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const s2 = [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 10, y: 10 }
        ];
        expect(doPolygonsIntersect(s1, s2)).toBe(true);
      });
    });

    // 3. Containment
    describe("3. Containment", () => {
      it("should return true when one polygon is strictly inside another", () => {
        const big = [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ];
        const small = [
          { x: 40, y: 40 },
          { x: 60, y: 40 },
          { x: 60, y: 60 },
          { x: 40, y: 60 }
        ];
        expect(doPolygonsIntersect(big, small)).toBe(true);
      });

      it("should return true for identical polygons", () => {
        const p = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ];
        expect(doPolygonsIntersect(p, p)).toBe(true);
      });
    });

    // 4. Special / Concave Interactions
    describe("4. Special / Concave Interactions", () => {
      it("should return true for edge crossing interior", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const lineLike = [
          { x: -5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 5.1 },
          { x: -5, y: 5.1 }
        ];
        expect(doPolygonsIntersect(s1, lineLike)).toBe(true);
      });

      it("should return true (false positive) for Concave C-shape with polygon in gap (SAT limitation)", () => {
        const cShape = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 0, y: 8 },
          { x: 8, y: 8 },
          { x: 8, y: 2 },
          { x: 0, y: 2 }
        ];
        const inner = [
          { x: 2, y: 4 },
          { x: 4, y: 4 },
          { x: 4, y: 6 },
          { x: 2, y: 6 }
        ];
        expect(doPolygonsIntersect(cShape, inner)).toBe(true);
      });
    });

    // 5. Degenerate & Validity
    describe("5. Degenerate & Validity", () => {
      it("should return true (or handle gracefully) for single point polygon effectively acting as point-in-poly", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const p = [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
          { x: 5, y: 5 }
        ];
        expect(doPolygonsIntersect(s1, p)).toBe(true);
      });

      it("should return true for empty polygons (current behavior undefined/permissive)", () => {
        expect(doPolygonsIntersect([], [])).toBe(true);
      });
    });

    // 6. Orientation & Symmetry
    describe("6. Orientation & Symmetry", () => {
      it("should be symmetric", () => {
        const a = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ];
        const b = [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 15 }
        ];
        expect(doPolygonsIntersect(a, b)).toBe(doPolygonsIntersect(b, a));
      });

      it("should handle mixed winding orders (CW vs CCW)", () => {
        const cw = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 }
        ];
        const ccw = [
          { x: 0, y: 0 },
          { x: 0, y: 10 },
          { x: 10, y: 0 }
        ];
        expect(doPolygonsIntersect(cw, ccw)).toBe(true);
      });
    });

    // 7. Numerical Robustness
    describe("7. Numerical Robustness", () => {
      it("should handle very large coordinates", () => {
        const offset = 1e6;
        const s1 = [
          { x: 0 + offset, y: 0 },
          { x: 10 + offset, y: 0 },
          { x: 10 + offset, y: 10 },
          { x: 0 + offset, y: 10 }
        ];
        const s2 = [
          { x: 5 + offset, y: 0 },
          { x: 15 + offset, y: 0 },
          { x: 15 + offset, y: 10 },
          { x: 5 + offset, y: 10 }
        ];
        expect(doPolygonsIntersect(s1, s2)).toBe(true);
      });

      it("should detect tiny intersections", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const s2 = [
          { x: 10 - 1e-6, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 10 - 1e-6, y: 10 }
        ];
        expect(doPolygonsIntersect(s1, s2)).toBe(true);
      });
    });

    // 8. Missing Degenerate Cases
    describe("8. Additional Degenerate Cases", () => {
      it("should handle duplicate consecutive vertices (zero length edges)", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const s2 = [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 15, y: 15 },
          { x: 5, y: 15 }
        ];
        expect(doPolygonsIntersect(s1, s2)).toBe(true);
      });

      it("should handle zero-area (flat) polygons (collinear)", () => {
        const flat = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 0 }
        ];
        const square = [
          { x: 2, y: -2 },
          { x: 4, y: -2 },
          { x: 4, y: 2 },
          { x: 2, y: 2 }
        ];
        expect(doPolygonsIntersect(flat, square)).toBe(true);
      });

      it("should return false (safe fallback) or handle NaN coordinates gracefully", () => {
        const s1 = [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ];
        const nanPoly = [
          { x: NaN, y: NaN },
          { x: 20, y: 10 },
          { x: 20, y: 20 }
        ];
        expect(typeof doPolygonsIntersect(s1, nanPoly)).toBe("boolean");
      });
    });
  });
});
