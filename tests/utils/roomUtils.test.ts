import { RawScan } from "../../src/models/rawScan/rawScan";
import { checkExternalOpening } from "../../src/utils/roomUtils";

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
const createExternalWall = (id: string) => ({
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
  ]
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
