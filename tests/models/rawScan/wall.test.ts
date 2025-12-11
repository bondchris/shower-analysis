import { Wall, WallData } from "../../../src/models/rawScan/wall";

describe("Wall", () => {
  describe("hasSoffit", () => {
    it("should return false for null corners", () => {
      // @ts-ignore - simulating invalid data
      const wall = new Wall({ category: {} } as WallData);
      // @ts-ignore - access private/protected if necessary, or assume property is exposed
      wall.polygonCorners = null;
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return false for empty corners", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      wall.polygonCorners = [];
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return false for less than 3 corners", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      wall.polygonCorners = [
        [0, 0, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return false for a simple rectangle (no re-entrant corners)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // Simple 10x10 square
      wall.polygonCorners = [
        [0, 0, 0], // Bottom-Left
        [0, 10, 0], // Top-Left
        [10, 10, 0], // Top-Right
        [10, 0, 0] // Bottom-Right
      ];
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return true for a U-shape or notch simulating a soffit (approx 270 deg interior angle)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // Shape with a "notch" top-right corner
      // 0,10 ----- 5,10
      // |           |
      // |          5,5 ----- 10,5
      // |                      |
      // 0,0 ------------------ 10,0

      // Let's manually verify winding. Standard assumption for "interior" is typically CCW.
      // 0,0 -> 10,0 -> 10,5 -> 5,5 -> 5,10 -> 0,10 -> 0,0
      // Vector at 10,5 (prev: 10,0; cur: 10,5; next: 5,5)
      // v1 (10,0 -> 10,5) = (0, 5) -> angle pi/2 (90)
      // v2 (10,5 -> 5,5) = (-5, 0) -> angle pi (180)
      // diff = 90 deg -> convex corner

      // Vector at 5,5 (prev: 10,5; cur: 5,5; next: 5,10)
      // v1 (10,5 -> 5,5) = (-5, 0) -> angle 180
      // v2 (5,5 -> 5,10) = (0, 5) -> angle 90
      // diff = 90 - 180 = -90 -> 270 deg normalized.
      // This matches the SOFFIT_MIN_ANGLE (260) and SOFFIT_MAX_ANGLE (280) criteria.

      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [5, 10, 0],
        [5, 5, 0], // The "re-entrant" corner is here
        [10, 5, 0],
        [10, 0, 0]
      ];

      expect(wall.hasSoffit).toBe(true);
    });

    it("should return true for a soffit in TOP-LEFT (L-shape missing top-left quadrant)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 0,0 -> 0,5 -> 5,5 -> 5,10 -> 10,10 -> 10,0 -> 0,0
      wall.polygonCorners = [
        [0, 0, 0],
        [0, 5, 0], // Up half
        [5, 5, 0], // In (notch corner)
        [5, 10, 0], // Up rest
        [10, 10, 0], // Right
        [10, 0, 0] // Down
      ];
      expect(wall.hasSoffit).toBe(true);
    });

    it("should return true for a soffit in BOTTOM-LEFT (L-shape missing bottom-left quadrant)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // Start 5,0 -> 5,5 -> 0,5 -> 0,10 -> 10,10 -> 10,0 -> 5,0
      // Or from 10,0
      wall.polygonCorners = [
        [10, 0, 0],
        [5, 0, 0],
        [5, 5, 0], // Notch corner
        [0, 5, 0],
        [0, 10, 0],
        [10, 10, 0]
      ];
      expect(wall.hasSoffit).toBe(true);
    });

    it("should return true for a soffit in BOTTOM-RIGHT (L-shape missing bottom-right quadrant)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 0,0 -> 0,10 -> 10,10 -> 10,5 -> 5,5 -> 5,0 -> 0,0
      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [10, 10, 0],
        [10, 5, 0],
        [5, 5, 0], // Notch corner
        [5, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(true);
    });

    it("should return true for MULTIPLE soffits (Top-Right AND Bottom-Left notches)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 10x10 base, notches at Top-Right and Bottom-Left
      // Start Bottom-Left area (with notch)
      // 2,0 -> 2,2 -> 0,2 -> 0,10 -> 8,10 -> 8,8 -> 10,8 -> 10,0 -> 2,0

      // Bottom-Left Notch: 2,0 -> 2,2 -> 0,2
      // Corner 2,2: Prev 2,0 (0,-2 Up? No 2,0->2,2 is Up).
      // Vector 1 (2,0->2,2): (0, 2) -> 90.
      // Wait, previous calc: v1x = pPrev.x - pCurr.x.
      // Corner 2,2. Prev 2,0. Next 0,2.
      // v1 (to 2,0): (0, -2) -> -90 (270).
      // v2 (to 0,2): (-2, 0) -> 180.
      // 180 - 270 = -90 -> 270. Yes.

      // Top-Right Notch: 8,10 -> 8,8 -> 10,8
      // Corner 8,8. Prev 8,10. Next 10,8.
      // v1 (to 8,10): (0, 2) -> 90.
      // v2 (to 10,8): (2, 0) -> 0.
      // 0 - 90 = -90 -> 270. Yes.

      wall.polygonCorners = [
        [2, 0, 0],
        [2, 2, 0], // Soffit 1
        [0, 2, 0],
        [0, 10, 0],
        [8, 10, 0],
        [8, 8, 0], // Soffit 2
        [10, 8, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(true);
    });

    it("should return true for a Soffit with SLANTED segments (tolerance check)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // Standard soffit at Top-Right, but the incoming wall is slanted.
      // Standard: (0,10) -> (5,10) -> (5,5) -> (10,5) -> (10,0) -> (0,0)
      // Let's slant the top edge down slightly: (0,10) -> (5, 9.5)
      // And slant the vertical edge out slightly: (5, 9.5) -> (5.5, 5)

      // Check angle at (5, 9.5):
      // Prev (0,10). Next (5.5, 5).
      // v1 (5, 9.5) - (0, 10) = (5, -0.5). atan2(-0.5, 5) = -5.7 deg.
      // v2 (5.5, 5) - (5, 9.5) = (0.5, -4.5). atan2(-4.5, 0.5) = -83.6 deg.
      // diff = -83.6 - (-5.7) = -77.9 deg.
      // Normalized: -77.9 + 360 = 282.1 deg.
      // Wait, 282 is > 280 (SOFFIT_MAX_ANGLE). This might FAIL if tolerance is strict.
      // Tolerance is 260-280.
      // Ideally we want it to be closer to 270.

      // Let's try a smaller slant.
      // (0,10) -> (5, 9.8) -> (5.2, 5)
      // v1 (5, 9.8) - (0,10) = (5, -0.2). atan2(-0.2, 5) = -2.29 deg.
      // v2 (5.2, 5) - (5, 9.8) = (0.2, -4.8). atan2(-4.8, 0.2) = -87.6 deg.
      // diff = -87.6 - (-2.29) = -85.31 deg.
      // Normalized: 274.69 deg.
      // This is nicely within 260-280.

      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [5, 9.8, 0], // Slanted down
        [5.2, 5, 0], // Slanted out
        [10, 5, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(true);
    });

    it("should return false for a Chamfered corner (45 degree cut, convex)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 10x10 square with Top-Right corner chamfered by 2 units.
      // (0,0) -> (0,10) -> (8,10) -> (10,8) -> (10,0) -> (0,0)
      // Angles:
      // (0,10): 90
      // (8,10): 135
      // (10,8): 135
      // (10,0): 90
      // (0,0): 90
      // No angle is reflex (approx 270).
      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [8, 10, 0],
        [10, 8, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return false for a Slanted Top (Shed/Monopitch roof, trapezoid)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 10 wide, 10 high on left, 8 high on right.
      // (0,0) -> (0,10) -> (10,8) -> (10,0) -> (0,0)
      // All angles are convex (< 180).
      // (0,10): 90? No, tangent changes. (0,-10) vs (10, -2).
      // Angle is < 90 (Acute).
      // (10,8): (-10, 2) vs (0, -8).
      // Angle is > 90 (Obtuse).
      // Neither is Reflex (> 180).
      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [10, 8, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return true for Double Recess on same side (Two notches on top edge)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 10x10. Top edge has two notches.
      // (0,10) -> (2,10) -> (2,8) -> (3,8) -> (3,10) -> (7,10) -> (7,8) -> (8,8) -> (8,10) -> (10,10) -> (10,0) -> (0,0)
      // Notches at x=2-3 and x=7-8. Depth 2 (y=8).
      // Both inner corners are (2,8) and (7,8) (wait, see manual trace).

      // Trace:
      // 0,10 -> 2,10 (Right)
      // 2,10 -> 2,8 (Down)
      // 2,8 -> 3,8 (Right)  <-- Corner (2,8). Down-then-Right. Valid Soffit.
      // 3,8 -> 3,10 (Up)
      // 3,10 -> 7,10 (Right)
      // 7,10 -> 7,8 (Down)
      // 7,8 -> 8,8 (Right) <-- Corner (7,8). Down-then-Right. Valid Soffit.
      // 8,8 -> 8,10 (Up)

      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [2, 10, 0],
        [2, 8, 0], // Notch 1 down
        [3, 8, 0], // Notch 1 right
        [3, 10, 0], // Notch 1 up
        [7, 10, 0],
        [7, 8, 0], // Notch 2 down
        [8, 8, 0], // Notch 2 right
        [8, 10, 0], // Notch 2 up
        [10, 10, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(true);
    });

    it("should return false for Collinear points on top edge (redundant vertices)", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // 10x10 square but with extra points on the top edge.
      // (0,10) -> (5,10) -> (10,10).
      // Angle at (5,10) is 180 degrees.
      // This should NOT count as a soffit (270) or a corner (90).
      wall.polygonCorners = [
        [0, 0, 0],
        [0, 10, 0],
        [5, 10, 0], // Collinear point
        [10, 10, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(false);
    });

    it("should return false for a convex polygon", () => {
      // @ts-ignore
      const wall = new Wall({ category: {} } as WallData);
      // Triangle CW
      wall.polygonCorners = [
        [0, 0, 0],
        [5, 10, 0],
        [10, 0, 0]
      ];
      expect(wall.hasSoffit).toBe(false);
    });
  });
});
