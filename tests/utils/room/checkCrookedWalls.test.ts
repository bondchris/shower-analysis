import { WallData } from "../../../src/models/rawScan/wall";
import { checkCrookedWalls } from "../../../src/utils/room/checkCrookedWalls";
import { createExternalWall, createMockScan } from "./testHelpers";

describe("checkCrookedWalls", () => {
  // Helper to create simple linear walls
  // Helper to create simple linear walls
  const createWall = (id: string, overrides: Partial<WallData> = {}): WallData =>
    createExternalWall(id, {
      dimensions: [10, 3, 0.2], // 10m long
      polygonCorners: [
        [0, 0],
        [10, 0]
      ],
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // X-axis at origin
      ...overrides
    });

  const createRotated = (id: string, angDeg: number, tx: number, tz: number): WallData => {
    const rad = (angDeg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    // Y rotation matrix
    // X' = x*c - z*s + tx
    // Z' = x*s + z*c + tz
    // m0=c, m2=s, m8=-s, m10=c
    return createWall(id, {
      transform: [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, tx, 0, tz, 1]
    });
  };

  it("0) Sanity / Controls", () => {
    // No walls
    expect(checkCrookedWalls(createMockScan({ walls: [] }))).toBe(false);

    // Single wall
    const w1 = createWall("w1");
    expect(checkCrookedWalls(createMockScan({ walls: [w1] }))).toBe(false);

    // Perfect rectangle (4 walls 90 deg)
    // W1: (0,0)->(10,0)
    // W2: (10,0)->(10,10) (90 deg)
    // W3: (10,10)->(0,10) (180 deg)
    // W4: (0,10)->(0,0) (270 deg)
    // Distances match, angles are 90 deg (deviation > 5).
    // Angle diff 90 -> dev from 0 is 90, dev from 180 is 90. min(90,90) = 90 > 5.
    // So False.
    const w2 = createRotated("w2", 90, 10, 0);
    const w3 = createRotated("w3", 180, 10, 10);
    const w4 = createRotated("w4", 270, 0, 10);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2, w3, w4] }))).toBe(false);
  });

  it("1) Distance Threshold", () => {
    // W1 at origin
    const w1 = createWall("w1");

    // W2 collinear (0 deg), varying distance from W1 end (10,0).
    // Gap needs to be checked.
    // 0.5 inches = 0.0127m. tx = 10 + 0.0127.
    // 0.5 inches = 0.0127m. tx = 10 + 0.0127.
    const w2Inside = createWall("w2", { transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10.0127, 0, 0, 1] });
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2Inside] }))).toBe(true);

    // 0.99 inches = 0.025146m
    const w2JustInside = createWall("w2", { transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10.025146, 0, 0, 1] });
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2JustInside] }))).toBe(true);

    // 1.00 inches exactly = 0.0254m
    const w2Exact = createWall("w2", { transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10.0254, 0, 0, 1] });
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2Exact] }))).toBe(true); // Inclusive

    // 1.01 inches = 0.025654m
    const w2Outside = createWall("w2", { transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10.025654, 0, 0, 1] });
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2Outside] }))).toBe(false);
  });

  it("2) Angle Threshold", () => {
    const w1 = createWall("w1");

    // Connected (0 distance gap)
    // 0 deg (Collinear) -> True
    // Connected (0 distance gap)
    // 0 deg (Collinear) -> True
    const w2Zero = createRotated("w2", 0, 10, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2Zero] }))).toBe(true);

    // 4.99 deg -> True
    const w2NearLimit = createRotated("w2", 4.99, 10, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2NearLimit] }))).toBe(true);

    // 5.00 deg -> True
    const w2Limit = createRotated("w2", 5.0, 10, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2Limit] }))).toBe(true);

    // 5.01 deg -> False
    const w2OverLimit = createRotated("w2", 5.01, 10, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2OverLimit] }))).toBe(false);

    // Negative angle symmetry (-4.99)
    const w2Neg = createRotated("w2", -4.99, 10, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2Neg] }))).toBe(true);
  });

  it("3) Directionality (180 deg)", () => {
    // W1 (0->10)
    // W2 starting at 10, going back to 0 (180 deg rot).
    // They touch at 10. Angle diff is 180. Deviation from 180 is 0. Expected True.
    // Note: createRotated(180, 10, 0)
    // W2 goes from (10,0) to (0,0).
    // This is essentially a "fold back" or overlapping wall, but it meets the geometry criteria.
    const w1 = createWall("w1");
    const w2 = createRotated("w2", 180, 10, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
  });

  it("4) Topology (T-Junction vs Endpoint)", () => {
    // W1 (0->10).
    // W2 starts at (5,0) (Midpoint). Rotated 3 deg (Shallow).
    // Distance from W2 start to W1 segment is 0.
    // Should trigger because we implemented "Any part near any part" check implicitly via distToSegment?
    // Wait, my implementation uses distToSegment checking endpoints of S2 against Segment S1 (and vice versa).
    // If W2 starts at (5,0), p2Start is on S1. dist(p2Start, S1) = 0.
    // So minDist = 0.
    // Angle diff = 3 deg.
    // So this T-junction-like case WILL return True (Crooked).
    // User prompt: "Endpoint-to-segment join: same geometry as above -> should be crooked if you consider endpoint near any point on the other wall."
    // My code does this.
    const w1 = createWall("w1");
    const w2 = createRotated("w2", 3, 5, 0);
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
  });

  it("6) Degenerate Inputs", () => {
    // Zero length wall
    const w1 = createWall("w1", { dimensions: [0, 3, 0.2] }); // 0 length
    const w2 = createWall("w2", {
      dimensions: [0, 3, 0.2],
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0.02, 0, 1] // Near w1
    });
    // Should not crash.
    // Angle of 0-len wall? atan2(0,0) = 0.
    // Both 0 angles. Dist is small. Returns True?
    // Logic: pStart=0,0. pEnd=0,0.
    // dx=0, dy=0. atan2(0,0) = 0.
    // distToSegment => point to point. dist is 0.02.
    // minDist <= 0.0254. Connected.
    // Angle 0 vs 0 -> Crooked.
    expect(() => checkCrookedWalls(createMockScan({ walls: [w1, w2] }))).not.toThrow();
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);

    // Missing transform (filtered out)
    const w3 = createExternalWall("w3", { dimensions: [10, 3, 1] });
    // @ts-ignore
    w3.transform = [];
    expect(checkCrookedWalls(createMockScan({ walls: [w1, w3] }))).toBe(false); // w1 is 0 len, w3 invalid.
  });

  it("7) Scoping (Story)", () => {
    const w1 = createWall("w1", { story: 1 });
    // W2 crooked (3 deg) and touching, but Story 2.
    const w2 = createRotated("w2", 3, 10, 0); // Touching w1 end
    w2.story = 2;

    expect(checkCrookedWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
  });
});
