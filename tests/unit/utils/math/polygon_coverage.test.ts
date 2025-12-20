import { describe, expect, it } from "vitest";

import { Point } from "../../../../src/models/point";
import { checkPolygonIntegrity } from "../../../../src/utils/math/polygon";

describe("polygon coverage edge cases", () => {
  const p = (x: number, y: number): Point => new Point(x, y);

  // 1. Self-intersection avoiding early checks
  // A shape that has valid area, valid angles, valid edge lengths, but intersects itself.
  // Standard bowtie triggers self-intersection check effectively.
  // We want to ensure we hit the specific `doSegmentsIntersect` branch inside `hasSelfIntersection`.
  it("should reject a complex self-intersecting polygon (Asymmetric with valid area)", () => {
    // We need a shape where the signed area is NOT zero (so it passes area check)
    // but checks for self-intersection.
    // Shape: A large triangle with a small loop twisted at the end?
    // Let's try: (0,0) -> (10,0) -> (5, 5) -> (5, -1) -> (0,0)
    // (0,0)->(10,0): 0
    // (10,0)->(5,5): -5 * 5 = -25
    // (5,5)->(5,-1): 0 * 4 = 0? No, w=0. NO wait.
    // 5 -> 5 width is 0. So area is 0 for that segment.
    // (5,-1)->(0,0): -5 * -1 = 5.
    // Total Area: -20.
    // Edges:
    // 1. (0,0)-(10,0) (y=0, x=0..10)
    // 2. (10,0)-(5,5)
    // 3. (5,5)-(5,-1) (x=5, y=5..-1) -- INTERSECTS Edge 1 at (5,0)
    // 4. (5,-1)-(0,0)
    const poly = [p(0, 0), p(10, 0), p(5, 5), p(5, -1)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 2. Collinear Overlaps - Horizontal
  // We need to hit `areSegmentsCollinearOverlapping`.
  // A -> B -> C -> D where C->D overlaps A->B partially or fully.
  // 0,0 -> 10,0 -> 10,2 -> 5,2 -> 5,0 -> 2,0 -> ...
  it("should reject horizontal collinear overlaps", () => {
    const poly = [
      p(0, 0),
      p(10, 0), // Edge 1: y=0, x=0..10
      p(10, 2),
      p(5, 2),
      p(5, 0), // Point on Edge 1
      p(2, 0) // Overlaps Edge 1 from 5 to 2
    ];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 3. Collinear Overlaps - Vertical
  it("should reject vertical collinear overlaps", () => {
    const poly = [
      p(0, 0),
      p(0, 10), // Edge 1: x=0, y=0..10
      p(2, 10),
      p(2, 5),
      p(0, 5), // Point on Edge 1
      p(0, 2) // Overlaps Edge 1 from 5 to 2
    ];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 4. Duplicate Points - "Kissing" Triangles
  // A -> B -> A -> C ...
  // Or A -> B -> C -> A (closed) but with a duplicate point in the middle sequence check.
  // hasDuplicatePoints checks for non-consecutive duplicates (circles back to same point).
  // 0,0 -> 5,5 -> 10,0 (Triangle 1) -> 5,5 (Dup!) -> 5,10 -> ...
  it("should reject polygons checking back to a previous vertex (Touching Figures)", () => {
    const poly = [
      p(0, 0),
      p(10, 0),
      p(5, 5), // Pivot
      p(5, 10),
      p(0, 10), // Top box
      p(5, 5) // Touches pivot again
    ];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  // 5. Implicit closure check with tiny gap
  // The function checks `Math.abs(first.x - last.x) < EPSILON`.
  // If we give it a polygon that is "almost" closed, it interprets it as closed if within epsilon?
  // No, the code says: if (Math.abs(first.x - last.x) < EPSILON ...) return false;
  // This means it REJECTS explicitly closed polygons (where last point == first point).
  // So we test that case.
  it("should reject explicitly closed polygons (last point == first point)", () => {
    const poly = [p(0, 0), p(10, 0), p(10, 10), p(0, 0)];
    expect(checkPolygonIntegrity(poly)).toBe(false);
  });
});
