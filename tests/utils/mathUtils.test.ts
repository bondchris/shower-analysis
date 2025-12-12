import { checkPolygonIntegrity, segmentsIntersect } from "../../src/utils/mathUtils";

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
});
