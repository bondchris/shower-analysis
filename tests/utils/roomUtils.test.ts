import { RawScan } from "../../src/models/rawScan/rawScan";
import { checkExternalOpening, checkToiletGaps } from "../../src/utils/roomUtils";

// Mock helper to create a minimal valid RawScan
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockScan = (overrides: Partial<any> = {}): RawScan => {
  const defaults = {
    coreModel: "test-model",
    doors: [],
    floors: [],
    objects: [],
    openings: [],
    sections: [],
    story: 1,
    version: 1,
    walls: [],
    windows: []
  };
  return new RawScan({ ...defaults, ...overrides });
};

// Helper to create a Floor at (0,0) with a 10x10 square
const createFloor = (story = 1) => ({
  polygonCorners: [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, 10], // Note: raw scan floors are X, Z, Y usually, or X, Y, Z.  roomUtils uses index 0, 1.
    // roomUtils: const X_IDX = 0; const Y_IDX = 1;
    // So [x, y, z].
    [0, 0, 10]
  ],
  story
});

// Helper to create a Wall near the floor perimeter (e.g. at 5,0 - on the edge)
// distToSegment logic:
// Floor segment: (0,0) to (10,0).
// Wall at (5, 0). Dist = 0.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createExternalWall = (id: string, overrides: Partial<any> = {}) => ({
  dimensions: [10, 2.7, 0.2], // 10m long, 2.7m high, 0.2m thick
  identifier: id,
  transform: [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    5,
    0,
    0,
    1 // tx=5, ty=0 (index 12 and 13)
  ],
  ...overrides
});

// Helper for an Internal Wall (far from 0-10 box, e.g. at 100, 100)
const createInternalWall = (id: string) => ({
  identifier: id,
  transform: [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    5,
    5,
    0,
    1 // tx=5, ty=5 (Middle of 10x10 box) -> Dist to perimeter (min dist to edges) is 5.
    // Edge (0,0)-(10,0) dist is 5. Edge (10,0)-(10,10) dist is 5.
    // Threshold is 0.5. So 5 > 0.5 -> Internal.
  ]
});

describe("checkExternalOpening", () => {
  // 1. Baseline / No External Opening
  describe("1. Baseline / No external opening", () => {
    it("should return false for a sealed box with no openings", () => {
      const scan = createMockScan({
        doors: [],
        floors: [createFloor()],
        openings: [],
        walls: [createExternalWall("w1")],
        windows: []
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should return false for room with only interior objects", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        objects: [{ category: { toilet: {} }, dimensions: [1, 1, 1], transform: new Array(16).fill(0) }],
        openings: [],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should return false if openings exist but on non-existent walls", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            dimensions: [],
            identifier: "o1",
            parentIdentifier: "fake-wall", // Not w1
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")] // wall is external
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });

  // 2. Positive Detection (Openings only)
  describe("2. Positive Detection (Openings only)", () => {
    it("should ignore single external window (only openings count)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        walls: [createExternalWall("w1")],
        windows: [
          {
            category: { window: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "win-1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ]
      });
      // UPDATED: Windows are now ignored.
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should ignore single external door", () => {
      const scan = createMockScan({
        doors: [
          {
            category: { door: { isOpen: false } },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "door-1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        floors: [createFloor()],
        walls: [createExternalWall("w1")]
      });
      // UPDATED: Doors are now ignored.
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should ignore door regardless of open/closed state", () => {
      const scanOpen = createMockScan({
        doors: [
          {
            category: { door: { isOpen: true } },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "d1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        floors: [createFloor()],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scanOpen)).toBe(false);

      const scanClosed = createMockScan({
        doors: [
          {
            category: { door: { isOpen: false } },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "d1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        floors: [createFloor()],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scanClosed)).toBe(false);
    });

    it("should detect single external opening", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "op1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      // Openings check should still be TRUE
      expect(checkExternalOpening(scan)).toBe(true);
    });

    it("should handle multiple openings on the same wall properly", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "op1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          },
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "op2",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  // 3. Parent / Wall / Room Association
  describe("3. Association Logic", () => {
    it("should ignore opening with null parentIdentifier", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "w1",
            parentIdentifier: null,
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should ignore orphaned opening (parent not in walls list)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "w1",
            parentIdentifier: "other-wall",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should return false for opening on internal wall (shared wall)", () => {
      // Wall at (5,5) in a (0,0)-(10,10) room is internal (dist 5 > 0.5)
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "d1",
            parentIdentifier: "w_int",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createInternalWall("w_int")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });

  // 4. Story-based Scenarios
  // NOTE: The current function implementation DOES NOT CHECK STORY explicitly.
  // It only checks if the wall is in `rawScan.walls`.
  // If `rawScan.walls` contains walls from other stories, it might be a bug or intended.
  // Assuming `rawScan.walls` passed to this function *should* be for the relevant room/story.
  // The user prompt asks: "Multi-room scan... Have a different story... Expect: false".
  // Tests should reflect user expectation.
  // If `checkExternalOpening` relies on `rawScan` being pre-filtered, then maybe it doesn't need to check story.
  // But let's assume rawScan might have mixed data if the user constructs it that way.
  // However, `roomUtils` generally operates on a single room's context.
  // Let's implement the test. If it detects "wrong story" wall because it's in the list,
  // then the filtering responsibility lies elsewhere.
  // "Window with story: 2... Expect: false." (Assumes rawScan.story = 1).
  describe("4. Story-based Scenarios", () => {
    it("should ignore opening on different story if logic enforces it", () => {
      const scan = createMockScan({
        floors: [createFloor(1)],
        openings: [
          // On external wall, but story 2
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "w1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 2,
            transform: []
          }
        ],
        story: 1,
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });

  // 5. Category / Confidence Variations
  describe("5. Category / Confidence Variations", () => {
    it("should detect opening with empty category if type validation allows it", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: {},
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "w1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });

    it("should handle missing confidence gracefully", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            category: { opening: {} },
            completedEdges: [],
            curve: null,
            dimensions: [],
            identifier: "o1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
            // Explicitly missing confidence
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  // 6. Geometry Edge Cases
  describe("6. Geometry Edge Cases", () => {
    it("should handle degenerate polygon corners (implementation ignores opening geometry anyway)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "o1",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  // 7. Junk + Good Opening Combos
  describe("7. Junk + Good Opening Combos", () => {
    it("should return true if one valid external opening exists amidst junk", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "good",
            parentIdentifier: "w1",
            polygonCorners: [],
            story: 1,
            transform: []
          },
          // Junk items
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "bad1",
            parentIdentifier: null,
            polygonCorners: [],
            story: 1,
            transform: []
          },
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "bad2",
            parentIdentifier: "missing",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  // 8. Weird Linkage
  describe("8. Weird Linkage", () => {
    it("should return false for opening whose parent is itself (not in walls)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [
          {
            category: { opening: {} },
            completedEdges: [],
            confidence: 1,
            curve: null,
            dimensions: [],
            identifier: "o1",
            parentIdentifier: "o1",
            polygonCorners: [],
            story: 1,
            transform: []
          }
        ],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });
});

// Helper for checkToiletGaps tests
// Default: 1x1x1 meter toilet at (0,0,0) with identity rotation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createToilet = (id: string, overrides: Partial<any> = {}) => ({
  attributes: {},
  category: { toilet: {} },
  confidence: { confidence: 1 },
  // 0.5m width (X), 1m height (Y), 0.5m depth (Z)
  dimensions: [0.5, 1, 0.5],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  ...overrides
});

describe("checkToiletGaps", () => {
  // Helper to create a wall flush with the toilet backface (Z = -0.25)
  // Toilet Depth=0.5. Backface at -0.25.
  // We place wall at Z = -0.25 so distance is 0.
  // Wall is X-aligned (length along X).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createFlushWall = (id: string, overrides: Partial<any> = {}) => {
    const w = createExternalWall(id);
    // Move to Z = -0.25 (index 14)
    w.transform[14] = -0.25;
    return { ...w, ...overrides };
  };

  // A. Object filtering and "vacuous pass" behavior
  describe("A. Object filtering", () => {
    it("should pass if no objects exist", () => {
      const scan = createMockScan({ objects: [], walls: [createFlushWall("w1")] });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should pass if objects exist but none are toilets", () => {
      const scan = createMockScan({
        objects: [
          // Sink
          {
            attributes: {},
            category: { sink: {} },
            confidence: { confidence: 1 },
            dimensions: [1, 1, 1],
            identifier: "s1",
            parentIdentifier: null,
            story: 1,
            transform: new Array(16).fill(0)
          }
        ],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should treat object with empty category as non-toilet (Pass)", () => {
      const scan = createMockScan({
        objects: [
          createToilet("t1", { category: {} }) // Malformed category
        ],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should fail if mixed validity (one bad toilet)", () => {
      // Wall (Flush) is at Z=-0.25. Valid for Toilet 1 (at 0,0).
      // Toilet 2 at Z=10 (Far).
      const t1 = createToilet("t1"); // At 0,0,0. Back at -0.25. Dist to Wall(-0.25) = 0. OK.
      const t2 = createToilet("t2", {
        transform: [
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          10,
          1 // z=10. Back at 9.75. Dist to Wall(-0.25) = ~10. Fail.
        ]
      });

      const scan = createMockScan({
        objects: [t1, t2],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  // B. Wall presence / selection
  describe("B. Wall presence", () => {
    it("should fail if toilet exists but walls: []", () => {
      const scan = createMockScan({
        objects: [createToilet("t1")],
        walls: []
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });

    it("should fail if walls exist but on different story", () => {
      const scan = createMockScan({
        objects: [createToilet("t1", { story: 1 })],
        walls: [
          createFlushWall("w1", { story: 0 }) // Different story
        ]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });

    it("should use closest wall (pass if one is close enough)", () => {
      const t1 = createToilet("t1");
      const wClose = createFlushWall("w_close"); // At -0.25. Dist 0.
      const wFar = createExternalWall("w_far");
      wFar.transform[14] = 10; // At Z=10.

      const scan = createMockScan({
        objects: [t1],
        walls: [wClose, wFar]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });

  // C. Threshold behavior (1 inch rule)
  describe("C. Threshold behavior", () => {
    // Toilet Backface at Z = -0.25.
    // Threshold = 1 inch = 0.0254m.
    // Wall Z position determines Gap.
    // Gap = |WallZ - (-0.25)| = |WallZ + 0.25|.

    const createTestScan = (wallZ: number) => {
      const t1 = createToilet("t1"); // Back at -0.25
      const w1 = createExternalWall("w1");
      w1.transform[14] = wallZ; // Set Wall Z
      return createMockScan({ objects: [t1], walls: [w1] });
    };

    it("should pass if backface flush (dist = 0)", () => {
      // Wall at -0.25. Gap 0. Pass.
      expect(checkToiletGaps(createTestScan(-0.25))).toBe(false);
    });

    it("should pass if within tolerance (0.5 inch gap)", () => {
      // Gap 0.5 inch = 0.0127.
      // Wall at -0.25 - 0.0127 = -0.2627.
      expect(checkToiletGaps(createTestScan(-0.2627))).toBe(false);
    });

    it("should pass at exactly threshold (1.0 inch gap)", () => {
      // Wall at -0.25 - 0.0254.
      expect(checkToiletGaps(createTestScan(-0.25 - 0.0254))).toBe(false);
    });

    it("should fail check just over threshold (1.0001 inch)", () => {
      // Wall at -0.25 - 0.0255.
      expect(checkToiletGaps(createTestScan(-0.25 - 0.0255))).toBe(true);
    });

    it("should fail well over threshold (6 inches)", () => {
      // Wall at -0.25 - 0.15.
      expect(checkToiletGaps(createTestScan(-0.4))).toBe(true);
    });
  });

  // D. Backface definition via transform
  describe("D. Backface definition", () => {
    it("should fail if toilet rotated 180 (front to wall)", () => {
      // Wall at Z = -0.26 (Gap 0.01 inch from -0.25).
      // Toilet Rotated 180.
      // New Backface at Z = +0.25.
      // Distance to Wall (-0.26) is | -0.26 - 0.25 | = 0.51.
      // 0.51 > 1 inch -> Fail.

      const t1 = createToilet("t1", {
        transform: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]
      });
      const w1 = createFlushWall("w1");
      w1.transform[14] = -0.26; // 1cm behind normal backface location

      const scan = createMockScan({
        objects: [t1],
        walls: [w1]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  // E. Data integrity
  describe("E. Data integrity", () => {
    it("should handle invalid transform gracefully (skip)", () => {
      const scan = createMockScan({
        objects: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          createToilet("t1", { transform: [] as any })
        ],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should handle degenerate wall polygons", () => {
      const scan = createMockScan({
        objects: [createToilet("t1")],
        walls: [
          createFlushWall("wRef"), // Valid Wall at -0.25
          {
            category: { wall: {} },
            confidence: { confidence: 1 },
            identifier: "wDegenerate",
            polygonCorners: [],
            story: 1,
            transform: new Array(16).fill(0)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        ]
      });
      // Should pass because wRef logic is handled and degenerate skipped
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });

  // F. Only walls count
  describe("F. Only walls count", () => {
    it("should fail if nearest object is not a wall", () => {
      const t1 = createToilet("t1");
      const s1 = {
        attributes: {},
        category: { storage: {} },
        confidence: { confidence: 1 },
        dimensions: [1, 1, 1],
        identifier: "s1",
        parentIdentifier: null,
        story: 1,
        transform: [
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          -0.25,
          1 // Storage at Z=-0.25 (Flush)
        ]
      };

      const wFar = createExternalWall("wFar");
      wFar.transform[14] = 10; // Wall Far

      const scan = createMockScan({
        objects: [t1, s1],
        walls: [wFar]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  // G. Penetration
  describe("G. Penetration", () => {
    it("should pass if toilet is inside wall (Distance < threshold)", () => {
      // Shallow Penetration Test.
      const t1 = createToilet("t1");
      const wInside = createFlushWall("wInside");
      wInside.transform[14] = -0.24; // 1cm inside from backface (-0.25)
      // Dist = |-0.24 - (-0.25)| = 0.01. < Threshold. Pass.
      const scan = createMockScan({
        objects: [t1],
        walls: [wInside]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });
});
