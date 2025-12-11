import { checkPolygonIntegrity, segmentsIntersect } from "../../src/utils/mathUtils";

describe("mathUtils", () => {
  describe("segmentsIntersect (Comprehensive)", () => {
    // ==========================================
    // 1. Basic Intersection Cases
    // ==========================================
    describe("1. Basic Intersection", () => {
      it("should return true for regular intersection (X-crossing)", () => {
        expect(segmentsIntersect({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 })).toBe(true);
      });

      it("should return false for T-intersection (endpoint touching interior) [Strict]", () => {
        expect(segmentsIntersect({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(false);
      });

      it("should return false for L-intersection (endpoints meeting) [Strict]", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(false);
      });

      it("should return true for non-perpendicular X-intersection", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
      });
    });

    // ==========================================
    // 2. Non-Intersection Cases
    // ==========================================
    describe("2. Non-Intersection", () => {
      it("should return false for parallel segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBe(false);
      });

      it("should return false for separated segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false);
      });

      it("should return false for 'close miss' segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 0.4, y: 0.4 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(false); // Would cross at 0.5,0.5 if extended
      });
    });

    // ==========================================
    // 3. Edge Cases (Collinear / Points)
    // ==========================================
    describe("3. Edge Cases", () => {
      it("should return false for collinear overlapping segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 })).toBe(false);
      });

      it("should return false for collinear touching segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(false);
      });

      it("should return false for collinear separated segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })).toBe(false);
      });

      it("should return false for zero-length segments (points)", () => {
        expect(
          segmentsIntersect(
            { x: 0, y: 0 },
            { x: 0, y: 0 }, // Point
            { x: -1, y: 1 },
            { x: 1, y: -1 }
          )
        ).toBe(false);
      });

      it("should return false for identical segments", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
      });
    });

    // ==========================================
    // 4. Numerical Edge Cases
    // ==========================================
    describe("4. Numerical Edge Cases", () => {
      it("should handle vertical segments correctly", () => {
        expect(segmentsIntersect({ x: 0, y: -5 }, { x: 0, y: 5 }, { x: -5, y: 0 }, { x: 5, y: 0 })).toBe(true);
      });

      it("should handle horizontal segments correctly", () => {
        expect(segmentsIntersect({ x: -5, y: 0 }, { x: 5, y: 0 }, { x: 0, y: -5 }, { x: 0, y: 5 })).toBe(true);
      });

      it("should handle nearly parallel segments (precision test)", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0.0001 }, { x: 0, y: 0.0001 }, { x: 10, y: 0 })).toBe(
          true
        );
      });

      it("should handle very large segments", () => {
        const LARGE = 1e9;
        expect(
          segmentsIntersect(
            { x: -LARGE, y: -LARGE },
            { x: LARGE, y: LARGE },
            { x: -LARGE, y: LARGE },
            { x: LARGE, y: -LARGE }
          )
        ).toBe(true);
      });

      it("should handle very short segments", () => {
        const SHORT = 1e-9;
        expect(
          segmentsIntersect({ x: -SHORT, y: 0 }, { x: SHORT, y: 0 }, { x: 0, y: -SHORT }, { x: 0, y: SHORT })
        ).toBe(true);
      });
    });

    // ==========================================
    // 5. Special Configurations
    // ==========================================
    describe("5. Special Configurations", () => {
      it("should return false when one segment contains the other (Collinear Containment)", () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 2, y: 0 }, { x: 8, y: 0 })).toBe(false);
      });

      it("should return false for multiple endpoints at same point (Star shape center)", () => {
        // All meeting at center
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(false);
      });
    });

    // ==========================================
    // 6. Input Validation
    // ==========================================
    describe("6. Input Validation", () => {
      it("should return false for NaN coordinates", () => {
        expect(segmentsIntersect({ x: NaN, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 })).toBe(false);
      });

      it("should return false for Infinity coordinates", () => {
        expect(segmentsIntersect({ x: Infinity, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 })).toBe(false);
      });

      it("should return false for missing objects (null/undefined)", () => {
        // @ts-ignore
        expect(segmentsIntersect(null, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
        // @ts-ignore
        expect(segmentsIntersect({ x: 0, y: 0 }, undefined, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
      });
    });

    // ==========================================
    // 7. Order Independence
    // ==========================================
    describe("7. Order Independence", () => {
      it("should be independent of segment order and point order", () => {
        const a = { x: -1, y: 0 };
        const b = { x: 1, y: 0 };
        const c = { x: 0, y: -1 };
        const d = { x: 0, y: 1 };

        // Base case: True
        expect(segmentsIntersect(a, b, c, d)).toBe(true);
        // Swap segment arguments
        expect(segmentsIntersect(c, d, a, b)).toBe(true);
        // Swap start/end of segment 1
        expect(segmentsIntersect(b, a, c, d)).toBe(true);
        // Swap start/end of segment 2
        expect(segmentsIntersect(a, b, d, c)).toBe(true);
      });
    });
  });

  describe("checkPolygonIntegrity", () => {
    // 1. Minimum Vertex Count
    it("should reject polygons with fewer than 3 vertices", () => {
      expect(checkPolygonIntegrity([])).toBe(false);
      expect(checkPolygonIntegrity([[0, 0]])).toBe(false);
      expect(
        checkPolygonIntegrity([
          [0, 0],
          [1, 1]
        ])
      ).toBe(false);
    });

    // 2. Zero-length edges
    it("should reject zero-length edges (duplicate adjacent points)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    it("should reject points that are within EPSILON distance", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10.0000000001, 0],
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 3. 3-point Collinearity
    it("should reject 3-point collinearity (straight lines)", () => {
      const poly = [
        [0, 0],
        [5, 0],
        [10, 0], // Collinear triple
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 4. Implicit Closure (Reject explicit closure)
    it("should reject explicitly closed polygons (first == last)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0] // Explicit closure
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    it("should accept implicitly closed polygons", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });

    // 5. Area Check
    it("should reject degenerate polygons (zero area)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [5, 0] // Flat triangle
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    it("should reject small area polygons (< EPSILON)", () => {
      const poly = [
        [0, 0],
        [1e-10, 0],
        [0, 1e-10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 6. Collinear Overlap
    it("should reject overlapping collinear edges (folding back)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10, 1],
        [5, 1],
        [5, 0],
        [15, 0],
        [15, -1],
        [0, -1]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 7. General Validity (Baseline)
    it("should accept a standard simple rectangle (CCW/Positive Area check)", () => {
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });

    // 8. Part 2: Coordinate Validity
    it("should reject non-finite coordinates (NaN/Infinity)", () => {
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
          [10, Infinity],
          [0, 10]
        ])
      ).toBe(false);
    });

    it("should reject coordinates outside bounds (>10000)", () => {
      expect(
        checkPolygonIntegrity([
          [0, 0],
          [10001, 0],
          [0, 10]
        ])
      ).toBe(false);
      expect(
        checkPolygonIntegrity([
          [0, 0],
          [10, -10001],
          [0, 10]
        ])
      ).toBe(false);
    });

    // 9. Part 2: Min Edge Length
    it("should reject edges smaller than 1mm (0.001)", () => {
      // 0.0009 length edge
      const poly = [
        [0, 0],
        [0.0009, 0],
        [0, 10] // Edge 1 is 0.0009
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    // 10. Part 2: Angle Sanity
    it("should reject sharp spikes (< 5 degrees)", () => {
      const poly = [
        [10, 0.1],
        [0, 0],
        [10, -0.1],
        [10, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    it("should reject flat angles (> 175 degrees)", () => {
      const poly = [
        [0, 4],
        [4, 4],
        [8, 4.01],
        [8, 0],
        [0, 0]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(false);
    });

    it("should accept valid angles (square 90 deg)", () => {
      // Square is 90 deg.
      const poly = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ];
      expect(checkPolygonIntegrity(poly)).toBe(true);
    });
  });
});
