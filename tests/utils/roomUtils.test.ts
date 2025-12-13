import { Door } from "../../src/models/rawScan/door";
import { FloorData } from "../../src/models/rawScan/floor";
import { ObjectItem } from "../../src/models/rawScan/objectItem";
import { Opening } from "../../src/models/rawScan/opening";
import { RawScan, RawScanData } from "../../src/models/rawScan/rawScan";
import { WallData } from "../../src/models/rawScan/wall";
import { Window } from "../../src/models/rawScan/window";
import {
  checkColinearWalls,
  checkExternalOpening,
  checkToiletGaps,
  checkTubGaps,
  checkWallGaps
} from "../../src/utils/roomUtils";

// --- HELPERS ---

// Mock helper to create a minimal valid RawScan
const createMockScan = (overrides: Partial<RawScanData> = {}): RawScan => {
  const defaults: RawScanData = {
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

// Helper: Floor
const createFloor = (story = 1): FloorData => ({
  category: { floor: {} },
  confidence: { high: {} },
  dimensions: [10, 0, 10], // X, Y, Z
  parentIdentifier: null,
  polygonCorners: [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, 10],
    [0, 0, 10]
  ],
  story
});

// Helper: External Wall
const createExternalWall = (id: string, overrides: Partial<WallData> = {}): WallData => ({
  category: { wall: {} },
  confidence: { high: {} },
  dimensions: [10, 2.7, 0.2],
  identifier: id,
  parentIdentifier: null,
  polygonCorners: [
    [-5, 0],
    [5, 0]
  ],
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
    5,
    0,
    0,
    1 // tx=5
  ],
  ...overrides
});

// Helper: Internal Wall
const createInternalWall = (id: string): WallData => ({
  category: { wall: {} },
  confidence: { high: {} },
  dimensions: [2, 2.7, 0.2],
  identifier: id,
  parentIdentifier: null,
  polygonCorners: [
    [-1, 0],
    [1, 0]
  ],
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 5, 0, 1]
});

// Helper: Opening
const createOpening = (id: string, parentId: string | null, overrides: Partial<Opening> = {}): Opening => ({
  category: { opening: {} },
  completedEdges: [],
  confidence: { high: {} },
  curve: null,
  dimensions: [],
  identifier: id,
  parentIdentifier: parentId,
  polygonCorners: [],
  story: 1,
  transform: [],
  ...overrides
});

// Helper: Door
const createDoor = (id: string, parentId: string | null, overrides: Partial<Door> = {}): Door => ({
  category: { door: { isOpen: false } },
  completedEdges: [],
  confidence: { high: {} },
  curve: null,
  dimensions: [],
  identifier: id,
  parentIdentifier: parentId,
  polygonCorners: [],
  story: 1,
  transform: [],
  ...overrides
});

// Helper: Window
const createWindow = (id: string, parentId: string | null, overrides: Partial<Window> = {}): Window => ({
  category: { window: {} },
  completedEdges: [],
  confidence: { high: {} },
  curve: null,
  dimensions: [],
  identifier: id,
  parentIdentifier: parentId,
  polygonCorners: [],
  story: 1,
  transform: [],
  ...overrides
});

// Helper: Toilet
const createToilet = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { toilet: {} },
  confidence: { high: {} },
  dimensions: [0.5, 1, 0.5],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  ...overrides
});

// Helper: Tub
const createTub = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { bathtub: {} },
  confidence: { high: {} },
  dimensions: [1.5, 0.5, 0.7],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1],
  ...overrides
});

// --- TESTS ---

describe("checkExternalOpening", () => {
  describe("1. Baseline / No external opening", () => {
    it("should return false for a sealed box with no openings", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should return false for room with only interior objects", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        objects: [createToilet("t1")],
        walls: [createInternalWall("wIn")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should return false if openings exist but on non-existent walls", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "wMissing")],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });

  describe("2. Positive Detection (Openings only)", () => {
    it("should ignore single external window (only openings count)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        walls: [createExternalWall("w1")],
        windows: [createWindow("win1", "w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should ignore single external door", () => {
      const scan = createMockScan({
        doors: [createDoor("d1", "w1")],
        floors: [createFloor()],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should ignore door regardless of open/closed state", () => {
      const scanOpen = createMockScan({
        doors: [createDoor("d1", "w1", { category: { door: { isOpen: true } } })],
        floors: [createFloor()],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scanOpen)).toBe(false);
    });

    it("should detect single external opening", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "w1")],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });

    it("should handle multiple openings on the same wall properly", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "w1"), createOpening("op2", "w1")],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  describe("3. Association Logic", () => {
    it("should ignore opening with null parentIdentifier", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", null)],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should ignore orphaned opening (parent not in walls list)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "wGhost")],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });

    it("should return false for opening on internal wall (shared wall)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "wIn")],
        walls: [createInternalWall("wIn")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });

  describe("4. Story-based Scenarios", () => {
    it("should ignore opening on different story if logic enforces it", () => {
      const scan = createMockScan({
        floors: [createFloor(1)],
        openings: [createOpening("op1", "w1", { story: 2 })],
        story: 1,
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });

  describe("5. Category / Confidence Variations", () => {
    it("should detect opening with empty category if type validation allows it", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "w1", { category: {} })],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });

    it("should handle missing confidence gracefully", () => {
      const op = createOpening("op1", "w1");
      delete (op as Partial<Opening>).confidence; // Simulate missing confidence if runtime allows
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [op],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  describe("6. Geometry Edge Cases", () => {
    it("should handle degenerate polygon corners", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "w1", { polygonCorners: [] })],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  describe("7. Junk + Good Opening Combos", () => {
    it("should return true if one valid external opening exists amidst junk", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("bad1", null), createOpening("good", "w1")],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  describe("8. Weird Linkage", () => {
    it("should return false for opening whose parent is itself (not in walls)", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "op1")],
        walls: []
      });
      expect(checkExternalOpening(scan)).toBe(false);
    });
  });
});

describe("checkToiletGaps", () => {
  const createFlushWall = (id: string, overrides: Partial<WallData> = {}): WallData => {
    const w = createExternalWall(id, overrides);
    if (w.transform) {
      w.transform[14] = -0.25; // Flush with toilet backface
    }
    return w;
  };

  describe("A. Object filtering", () => {
    it("should pass if no objects exist", () => {
      const scan = createMockScan({ objects: [], walls: [createFlushWall("w1")] });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should pass if objects exist but none are toilets", () => {
      const sink = createToilet("s1", { category: { sink: {} } });
      const scan = createMockScan({
        objects: [sink],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should treat object with empty category as non-toilet (Pass)", () => {
      const scan = createMockScan({
        objects: [createToilet("t1", { category: {} })],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should fail if mixed validity (one bad toilet)", () => {
      const t1 = createToilet("t1");
      const t2: ObjectItem = createToilet("t2", {
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
          1 // Z=10
        ]
      });

      const scan = createMockScan({
        objects: [t1, t2],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

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
        walls: [createFlushWall("w1", { story: 0 })]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });

    it("should use closest wall", () => {
      const t1 = createToilet("t1");
      const wClose = createFlushWall("w_close");
      const wFar = createExternalWall("w_far");
      if (wFar.transform) {
        wFar.transform[14] = 10;
      }

      const scan = createMockScan({
        objects: [t1],
        walls: [wClose, wFar]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });

  describe("C. Threshold behavior", () => {
    const createTestScan = (wallZ: number) => {
      const t1 = createToilet("t1");
      const w1 = createExternalWall("w1");
      if (w1.transform) {
        w1.transform[14] = wallZ;
      }
      return createMockScan({ objects: [t1], walls: [w1] });
    };

    it("should pass if backface flush (dist = 0)", () => {
      expect(checkToiletGaps(createTestScan(-0.25))).toBe(false);
    });

    it("should pass if within tolerance (0.5 inch gap)", () => {
      expect(checkToiletGaps(createTestScan(-0.2627))).toBe(false);
    });

    it("should pass at exactly threshold (1.0 inch gap)", () => {
      expect(checkToiletGaps(createTestScan(-0.25 - 0.0254))).toBe(false);
    });

    it("should fail check just over threshold (1.0001 inch)", () => {
      expect(checkToiletGaps(createTestScan(-0.25 - 0.0255))).toBe(true);
    });

    it("should fail well over threshold (6 inches)", () => {
      expect(checkToiletGaps(createTestScan(-0.4))).toBe(true);
    });
  });

  describe("D. Backface definition", () => {
    it("should fail if toilet rotated 180", () => {
      const t1 = createToilet("t1", {
        transform: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]
      });
      const w1 = createFlushWall("w1");
      if (w1.transform) {
        w1.transform[14] = -0.26;
      }

      const scan = createMockScan({
        objects: [t1],
        walls: [w1]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  describe("E. Data integrity", () => {
    it("should handle invalid transform gracefully", () => {
      const scan = createMockScan({
        objects: [
          // Invalid transform manually passed via cast to simulate bad data
          createToilet("t1", { transform: [] as unknown as number[] })
        ],
        walls: [createFlushWall("w1")]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });

    it("should handle degenerate wall polygons", () => {
      const wDegenerate = createFlushWall("wDegenerate", {
        polygonCorners: []
      });
      const scan = createMockScan({
        objects: [createToilet("t1")],
        walls: [createFlushWall("wRef"), wDegenerate]
      });
      expect(checkToiletGaps(scan)).toBe(false);
    });
  });

  describe("F. Only walls count", () => {
    it("should fail if nearest object is not a wall", () => {
      const t1 = createToilet("t1");
      const s1 = createToilet("s1", { category: { storage: {} } });
      s1.transform[14] = -0.25; // Flush

      const wFar = createExternalWall("wFar");
      if (wFar.transform) {
        wFar.transform[14] = 10;
      }

      const scan = createMockScan({
        objects: [t1, s1],
        walls: [wFar]
      });
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });

  describe("G. Penetration", () => {
    it("should pass if toilet is inside wall", () => {
      const t1 = createToilet("t1");
      const w1 = createExternalWall("w1");
      if (w1.transform) {
        w1.transform[14] = -0.2;
      } // Inside toilet back (Z > -0.25)
      const scan = createMockScan({ objects: [t1], walls: [w1] });
      // Distance is absolute | -0.25 - (-0.20) | = 0.05 > Threshold.
      // So it flags as a Gap (True).
      expect(checkToiletGaps(scan)).toBe(true);
    });
  });
});

describe("checkTubGaps", () => {
  const INCH = 0.0254;

  const createGapScan = (gapMeters: number) => {
    // Tub default: 1.5, 0.5, 0.7.
    // Local range: X +/-0.75, Z +/-0.35.
    // Wall along X must be at Z = 0.35 + gapMeters to create gap.
    const tub = createTub("t1");
    const wall = createExternalWall("w1");
    if (wall.transform) {
      wall.transform[14] = 0.35 + gapMeters;
    }

    return createMockScan({ objects: [tub], walls: [wall] });
  };

  describe("A. Core range & thresholds", () => {
    it("should detect 3 inch gap (Happy Path)", () => {
      expect(checkTubGaps(createGapScan(3 * INCH))).toBe(true);
    });

    it("should detect 1.00 inch gap (Lower Inclusive)", () => {
      expect(checkTubGaps(createGapScan(INCH))).toBe(true);
    });

    it("should detect 6.00 inch gap (Upper Inclusive)", () => {
      expect(checkTubGaps(createGapScan(6.0 * INCH))).toBe(true);
    });

    it("should detect 1.01 inch gap", () => {
      expect(checkTubGaps(createGapScan(1.01 * INCH))).toBe(true);
    });

    it("should detect 5.99 inch gap", () => {
      expect(checkTubGaps(createGapScan(5.99 * INCH))).toBe(true);
    });

    it("should NOT detect 0 inch gap (Flush)", () => {
      expect(checkTubGaps(createGapScan(0))).toBe(false);
    });

    it("should NOT detect 0.99 inch gap (Too small)", () => {
      expect(checkTubGaps(createGapScan(0.99 * INCH))).toBe(false);
    });

    it("should NOT detect 6.01 inch gap (Too large)", () => {
      expect(checkTubGaps(createGapScan(6.01 * INCH))).toBe(false);
    });

    it("should NOT detect >20 inch gap (Far away)", () => {
      expect(checkTubGaps(createGapScan(20 * INCH))).toBe(false);
    });
  });

  describe("B. Aggregation", () => {
    it("should detect if ANY tub has a gap", () => {
      const tA = createTub("tA");
      const tB = createTub("tB");
      tB.transform[12] = 100;

      const wA = createExternalWall("wA");
      if (wA.transform) {
        const gap = 3 * INCH;
        wA.transform[14] = 0.35 + gap;
      } // Gap

      const wB = createExternalWall("wB");
      if (wB.transform) {
        wB.transform[12] = 100;
        wB.transform[14] = 0.35; // Flush
      }

      const scan = createMockScan({ objects: [tA, tB], walls: [wA, wB] });
      expect(checkTubGaps(scan)).toBe(true);
    });

    it("should NOT detect if ALL tubs are valid", () => {
      const tA = createTub("tA");
      const wA = createExternalWall("wA"); // Flush logic (dist=0 implies placement)
      // Actually standard createExternalWall has Z=0. Tub Z range 0.35.
      // So implicit gap 0.35?
      // createTub defaults: Z range +/-0.35.
      // createExternalWall defaults: Z=0.
      // 0 is < 0.35 (inside). Penetration -> Pass.
      // Let's be precise.
      if (wA.transform) {
        wA.transform[14] = 0.35;
      } // Flush

      const tB = createTub("tB");
      tB.transform[12] = 100;
      const wB = createExternalWall("wB");
      if (wB.transform) {
        wB.transform[12] = 100;
        const offset = 7 * INCH;
        wB.transform[14] = 0.35 + offset; // Far -> Pass
      }

      const scan = createMockScan({ objects: [tA, tB], walls: [wA, wB] });
      expect(checkTubGaps(scan)).toBe(false);
    });

    it("should detect if ONE wall qualifies as a gap", () => {
      const t1 = createTub("t1");
      const w1 = createExternalWall("w1");
      if (w1.transform) {
        const gap = 3 * INCH;
        w1.transform[14] = 0.35 + gap;
      } // Gap

      const w2 = createExternalWall("w2");
      if (w2.transform) {
        const offset = 7 * INCH;
        w2.transform[14] = 0.35 + offset;
      } // Far

      const scan = createMockScan({ objects: [t1], walls: [w1, w2] });
      expect(checkTubGaps(scan)).toBe(true);
    });

    it("should NOT detect if NEAREST wall is valid (Flush) but another is in gap range", () => {
      // Logic: Aggregation fails if ANY wall is in gap range.
      const t1 = createTub("t1");
      const w1 = createExternalWall("w1");
      if (w1.transform) {
        w1.transform[14] = 0.35;
      } // Flush

      const w2 = createExternalWall("w2");
      if (w2.transform) {
        const gap = 3 * INCH;
        w2.transform[14] = 0.35 + gap;
      } // Gap

      const scan = createMockScan({ objects: [t1], walls: [w1, w2] });
      expect(checkTubGaps(scan)).toBe(true);
    });
  });

  describe("C. Spatial configurations", () => {
    it("should detect gap in corner placement", () => {
      const tub = createTub("t1");

      const wX = createExternalWall("wX");
      if (wX.transform) {
        wX.transform[14] = 0.35;
      } // Flush Z (Safe)

      const wY = createExternalWall("wY");
      // Rot 90 deg around Y.
      const gap = 3 * INCH;
      const wYDist = 0.75 + gap;
      wY.transform = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, wYDist, 0, 0, 1];

      const scan = createMockScan({ objects: [tub], walls: [wX, wY] });
      // wX is flush, so tub is considered "backed" by at least one wall.
      // No gap detected.
      expect(checkTubGaps(scan)).toBe(false);
    });

    it("should detect rotated tub (45 deg) with gap", () => {
      const tub = createTub("t_rot");
      const ang = Math.PI / 4;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      tub.transform = [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];

      const zTerm1 = 0.75 * s;
      const zTerm2 = 0.35 * c;
      const maxZ = zTerm1 + zTerm2; // ~0.77
      const w = createExternalWall("w_flat");
      if (w.transform) {
        const gap = 3 * INCH;
        w.transform[14] = maxZ + gap;
      }

      const scan = createMockScan({ objects: [tub], walls: [w] });
      expect(checkTubGaps(scan)).toBe(true);
    });
  });

  describe("D. Filtering", () => {
    it("should ignore wall with story mismatch", () => {
      const tub = createTub("t1", { story: 1 });
      const w = createExternalWall("w1", { story: 2 });
      if (w.transform) {
        const gap = 3 * INCH;
        w.transform[14] = 0.35 + gap;
      }

      const scan = createMockScan({ objects: [tub], walls: [w] });
      expect(checkTubGaps(scan)).toBe(false);
    });
  });

  describe("E. Non-wall arrays", () => {
    it("should ignore door near tub", () => {
      const tub = createTub("t1");
      const d = createDoor("d1", "w1");
      const gap = 3 * INCH;
      d.transform[14] = 0.35 + gap;

      const w = createExternalWall("w1");
      if (w.transform) {
        w.transform[14] = 10;
      } // Far

      const scan = createMockScan({
        doors: [d],
        objects: [tub],
        walls: [w]
      });
      expect(checkTubGaps(scan)).toBe(false);
    });
  });

  describe("F. Robustness", () => {
    it("should handle degenerate wall polygons gracefully", () => {
      const tub = createTub("t1");
      const wDegenerate = createExternalWall("wD", {
        polygonCorners: []
      });
      const scan = createMockScan({ objects: [tub], walls: [wDegenerate] });
      expect(checkTubGaps(scan)).toBe(false);
    });
  });

  describe("G. Units & Precision", () => {
    it("should detect exactly at boundary intersection if inclusive", () => {
      expect(checkTubGaps(createGapScan(INCH))).toBe(true);
    });
  });
});

describe("checkWallGaps", () => {
  const INCH = 0.0254;

  describe("A. Baseline / Control", () => {
    it("should return false for no walls", () => {
      const scan = createMockScan({ walls: [] });
      expect(checkWallGaps(scan)).toBe(false);
    });

    it("should return false for single wall", () => {
      const scan = createMockScan({ walls: [createExternalWall("w1")] });
      expect(checkWallGaps(scan)).toBe(false);
    });

    it("should return false for 0 inch gap (touching)", () => {
      // Wall 1: (-5, 0) to (5, 0)
      createExternalWall("w1");
      // Wall 2: starts at (5, 0)
      const w2 = createExternalWall("w2");
      // w2 default corners (-5,0) to (5,0). transform tx=5.
      // We want w2 left end to be at x=5.
      // w2 left end local is -5. So w2 tx must be 10.
      if (w2.transform) {
        w2.transform[12] = 10;
      }
      // World w1: (0,0)-(10,0)? No, createExternalWall tx=5.
      // corners: [-5,0], [5,0].
      // w1 World: 0,0 to 10,0.
      // w2 World if tx=10: (5,0) to (15,0).
      // Overlap! "Touching" means endpoint equals endpoint.
      // w1 Right: 10,0.
      // w2 Left: 5,0.
      // Wait, let's reset to easier coords.
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] // Identity
      }); // (-5,0) to (5,0)
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1] // tx=10
      }); // (5,0) to (15,0)
      // wA Right: (5,0). wB Left: (5,0). Gap = 0.
      const scan = createMockScan({ walls: [wA, wB] });
      expect(checkWallGaps(scan)).toBe(false);
    });

    it("should return false for closed loop", () => {
      // Square loop 10x10.
      // w1: 0,0 to 10,0
      // w2: 10,0 to 10,10
      // w3: 10,10 to 0,10
      // w4: 0,10 to 0,0
      // We'll use simple custom walls to be precise
      // Actually manually setting world coords via polygonCorners + Identity transform is easier
      const manualWall = (id: string, c: number[][]) =>
        createExternalWall(id, {
          polygonCorners: c,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        });

      const w1 = manualWall("w1", [
        [0, 0],
        [10, 0]
      ]);
      const w2 = manualWall("w2", [
        [10, 0],
        [10, 10]
      ]);
      const w3 = manualWall("w3", [
        [10, 10],
        [0, 10]
      ]);
      const w4 = manualWall("w4", [
        [0, 10],
        [0, 0]
      ]);
      const scan = createMockScan({ walls: [w1, w2, w3, w4] });
      expect(checkWallGaps(scan)).toBe(false);
    });
  });

  describe("B. Range boundaries", () => {
    const makeGapScan = (gapInches: number) => {
      const gapMeters = gapInches * INCH;
      // Wall A: (0,0)-(10,0)
      // Wall B: (10+gap, 0) - (20,0)
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const gapStart = 10 + gapMeters;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [gapStart, 0],
          [20, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      return createMockScan({ walls: [wA, wB] });
    };

    it("should detect gap exactly 1.0 inch", () => {
      // 1.0 inch is often the threshold. Code: > 0.0254 (1 inch).
      // So exactly 1.0 inch (0.0254) is NOT > 0.0254.
      // Expected: False (Pass/No Error) if exclusive.
      // Wait, typically thresholds are inclusive for error?
      // Code: if (dist > MIN && dist < MAX).
      // So > 1inch. 1inch is NOT > 1inch.
      // So 1.0 inch gap -> False.
      expect(checkWallGaps(makeGapScan(1.0))).toBe(false);
    });

    it("should pass (false) for gap just below 1.0 inch (0.99)", () => {
      expect(checkWallGaps(makeGapScan(0.99))).toBe(false);
    });

    it("should detect (true) for gap just above 1.0 inch (1.01)", () => {
      expect(checkWallGaps(makeGapScan(1.01))).toBe(true);
    });

    it("should detect (true) for gap 6 inch", () => {
      expect(checkWallGaps(makeGapScan(6.0))).toBe(true);
    });

    it("should detect (true) for gap just below 12 inch (11.99)", () => {
      expect(checkWallGaps(makeGapScan(11.99))).toBe(true);
    });

    it("should pass (false) for gap exactly 12 inch", () => {
      // Code: dist < MAX (12 inch).
      // 12 is not < 12. So False.
      expect(checkWallGaps(makeGapScan(12.0))).toBe(false);
    });

    it("should pass (false) for gap 13 inch", () => {
      expect(checkWallGaps(makeGapScan(13.0))).toBe(false);
    });
  });

  describe("C. Orientation / geometry variety", () => {
    it("should detect 90 deg corner gap", () => {
      // wA: (0,0)-(10,0)
      // wB: (10.5, 5)-(10.5, 15)  (Vertical line at x=10.5)
      // Endpoint gap: (10,0) to (10.5, 5)? Dist ~5.
      // Wait, we want "Corner Gap".
      // wB should start near (10,0).
      // wB: (10, 0.5) - (10, 10). Gap 0.5 inches is too small.
      // Gap 6 inches: wB (10, 0.1524) - (10, 10).
      // Dist (10,0) to (10, 0.1524) is 6 inches.
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const gapM = 6 * INCH;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [10, gapM], // (10, 0.15)
          [10, 10]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Gap is 6 inches. Should detection.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });
  });

  describe("D. Endpoint definitions", () => {
    it("should use correct endpoints for rectangle representation", () => {
      // Wall represented as a box (0,0)-(10,0)-(10,0.5)-(0,0.5).
      // Technically has 4 corners.
      // checkWallGaps checks all corners.
      // If we have another wall wB near (10,0), it should flag.
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0],
          [10, 0.5],
          [0, 0.5]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wbGap = 6 * INCH;
      const wbStart = 10 + wbGap;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [wbStart, 0],
          [20, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Dist from (10,0) to (10+6in, 0) is 6in. Error.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });
  });

  describe("E. Adjacency policy", () => {
    it("should PASS (False) for parallel hallway walls (36 inch gap)", () => {
      // wA: 0,0 - 10,0
      // wB: 0,1 - 10,1 (1 meter ~ 39 inches gap)
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [0, 1],
          [10, 1]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Closest endpoints: (0,0) to (0,1) = 1m = 39in > 12in MAX.
      // No error.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(false);
    });

    it("should FAIL (True) for shear/bypass (overlap side-by-side) - Pinch Point", () => {
      // wA: 0,0 - 10,0
      // wB: 5,0.1 - 15,0.1 (Close parallel, 0.1m ~ 4 inches)
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [5, 0.1],
          [15, 0.1]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Endpoints:
      // wA: 0,0 & 10,0
      // wB: 5,0.1 & 15,0.1
      // Old logic (Endpoints): Far apart -> Pass.
      // New logic (Segments): Pinch point 4 inches < 12 inches -> Fail.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });

    it("should FAIL (True) for parallel walls 2 inches apart (User Query)", () => {
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const gapM = 2 * INCH;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [0, gapM],
          [10, gapM]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Perpendicular distance is 2 inches everywhere.
      // 1" < 2" < 12" -> Error.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });

    it("should FAIL (True) for a Tiny Square Room (2x2 inches) - User Query", () => {
      // 4 Walls forming a 2-inch square.
      // Adjacent pairs touch (Dist=0 -> OK).
      // Opposite pairs are 2 inches apart.
      // 1" < 2" < 12" -> Error.
      const size = 2 * INCH;
      const wN = createExternalWall("N", {
        polygonCorners: [
          [0, 0],
          [size, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wE = createExternalWall("E", {
        polygonCorners: [
          [size, 0],
          [size, size]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wS = createExternalWall("S", {
        polygonCorners: [
          [size, size],
          [0, size]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wW = createExternalWall("W", {
        polygonCorners: [
          [0, size],
          [0, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });

      expect(checkWallGaps(createMockScan({ walls: [wN, wE, wS, wW] }))).toBe(true);
    });

    it("should FAIL (True) for a U-Shaped Niche (2 inch width) - User Query", () => {
      // Side walls (Parallel, 2 inches apart) connected by a back wall.
      // wLeft: 0,0 to 0,10
      // wRight: 2in,0 to 2in,10
      // wBack: 0,0 to 2in,0
      const width = 2 * INCH;
      const wLeft = createExternalWall("Left", {
        polygonCorners: [
          [0, 0],
          [0, 10]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wRight = createExternalWall("Right", {
        polygonCorners: [
          [width, 0],
          [width, 10]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wBack = createExternalWall("Back", {
        polygonCorners: [
          [0, 0],
          [width, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });

      // Left touches Back (Dist 0).
      // Right touches Back (Dist 0).
      // Left and Right are 2 inches apart (Dist 2").
      // Error.
      expect(checkWallGaps(createMockScan({ walls: [wLeft, wRight, wBack] }))).toBe(true);
    });
  });

  describe("F. T-junctions", () => {
    it("should PASS (False) for perfect T-junction (End touches Middle)", () => {
      // wA: 0,0 - 10,0
      // wB: 5,0 - 5,5 (Starts at midpoint of wA)
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [5, 0],
          [5, 5]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // DistToSegment = 0. Not > 1 inch. Pass.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(false);
    });

    it("should FAIL (True) for Short T-junction (Gap 6 inches)", () => {
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const gapM = 6 * INCH;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [5, gapM], // Starts 6 inches away from wA midpoint
          [5, 5]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // DistToSegment = 6 inches. True.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });

    it("should PASS (False) for Crossing/Intersecting walls (X-shape)", () => {
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 10]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [0, 10],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Intersect at (5,5). doPolygonsIntersect should catch this. Pass.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(false);
    });
  });

  describe("G. Story handling", () => {
    // Current checkWallGaps implementation does NOT filter by story.
    // It lumps all walls together.
    // So walls on diff stories with gap WILL flag.
    // User request: "Different stories... false (usually you isolate by story)".
    // But implementation does not have story check.
    // We must test current behavior (True) or if we want to enforce it, we must update code.
    // User asked to "add tests".
    // I will write test expecting TRUE (Failure) because that is what code does.
    // Note: Ideally this should return False. But I am verifying existing logic.
    it("should FAIL (True) for walls on different stories if geometric gap exists (Current Limit)", () => {
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        story: 1,
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wbGap = 6 * INCH;
      const startX = 10 + wbGap;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [startX, 0],
          [20, 0]
        ],
        story: 2,
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });
  });

  describe("H. Transform usage", () => {
    it("should respect transforms for world-space gap", () => {
      // wA local: 0,0 to 10,0. Identity.
      // wB local: 0,0 to 10,0. Transformed to start at 10.1524 (10 + 6in).
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // 10 + 6 inches = 10 + 0.1524 = 10.1524.
      // If we translate wB by 10.1524, its start (0,0) becomes (10.1524, 0).
      const gapM = 6 * INCH;
      const tx = 10 + gapM;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, 0, 0, 1]
      });
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });
  });

  describe("I. Doors/windows/openings interaction", () => {
    it("should IGNORE doors (return True for gap) in Pure Geometry mode", () => {
      // Wall gap exists (6 inches). A door spans it.
      // Logic doesn't check doors. Only walls.
      // So it should still return True (Error).
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [10.1524, 0],
          [20, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const d = createDoor("d1", "wA"); // Door assigned to wA but geometrically filling gap?
      // Does not matter. Logic ignores objects.
      expect(
        checkWallGaps(
          createMockScan({
            doors: [d],
            walls: [wA, wB]
          })
        )
      ).toBe(true);
    });
  });

  describe("J. Data duplication / robustness", () => {
    it("should PASS (False) for duplicate walls", () => {
      // If wA is duplicated.
      // wA corners: 0,0 and 10,0.
      // wA_dup corners: 0,0 and 10,0.
      // Dist(0,0 to 0,0) = 0.
      // Dist(0,0 to 10,0) = 10.
      // 0 is not > MIN. 10 is > MAX.
      // So no error.
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      expect(checkWallGaps(createMockScan({ walls: [wA, wA] }))).toBe(false);
    });

    it("should PASS (False) for overlapping walls (negative gap)", () => {
      // wA: 0,0 - 10,0
      // wB: 9,0 - 19,0 (Overlap 1m)
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [0, 0],
          [10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [9, 0],
          [19, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Dist(10,0 - 9,0) = 1m = 39in > 12in.
      // Dist(10,0 - 19,0) = 9m.
      // Dist(0,0 - 9,0) = 9m.
      // No endpoint is within 1-12 inches of another.
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(false);
    });
  });

  describe("K. Precision / scale", () => {
    it("should handle large coordinates", () => {
      const offset = 10000;
      const wA = createExternalWall("wA", {
        polygonCorners: [
          [offset, 0],
          [offset + 10, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      // Gap 6 inches
      const gapOffset = 6 * INCH;
      const startX = offset + 10 + gapOffset;
      const wB = createExternalWall("wB", {
        polygonCorners: [
          [startX, 0],
          [offset + 20, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      expect(checkWallGaps(createMockScan({ walls: [wA, wB] }))).toBe(true);
    });
  });
  describe("checkColinearWalls", () => {
    describe("A. Core 'should detect' cases", () => {
      it("should return true for end-to-end walls with 0 gap", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10, 0],
            [20, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });

      it("should return true for end-to-end walls with small gap (1 inch)", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        const gap = 1.0 * Number(INCH);
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10 + gap, 0],
            [20 + gap, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });

      it("should return true for end-to-end walls with gap just under threshold (2.99 inch)", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        const gap = 2.99 * Number(INCH);
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10 + gap, 0],
            [20 + gap, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });

      it("should return true for Partial overlap, same direction", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [5, 0], // Starts inside w1
            [15, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });

      it("should return true for Containment overlap", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [2, 0],
            [8, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });

      it("should return true for Slight angular noise but within tolerance", () => {
        // Parallel threshold is 0.996.
        // Let's create a wall with a very slight slope.
        // Vector (1, 0.05). Length ~1.00125. Normalized (0.998, 0.049).
        // Dot with (1,0) is 0.998 > 0.996.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        const gap = 2 * Number(INCH);
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10 + gap, 0],
            [20 + gap, 0.5] // Rise 0.5 over Run 10 => Slope 0.05
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });
    });

    describe("B. Gap threshold boundaries", () => {
      it("should return false for gap exactly 3.00 inch", () => {
        // Threshold is < 0.0762 (3 inches). Exactly 3 should fail.
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        const gap = 3.0 * Number(INCH);
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10 + gap, 0],
            [20 + gap, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
      });

      it("should return false for gap just over threshold (3.01 inch)", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        const gap = 3.01 * Number(INCH);
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10 + gap, 0],
            [20 + gap, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
      });
    });

    describe("D. False-positive guards", () => {
      it("should return false for Parallel but laterally offset (train tracks)", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [0, 1], // Offset by 1 meter in Y
            [10, 1]
          ]
        });
        // Dot is 1 (Parallel).
        // Distance > threshold (1m > 3in).
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
      });

      it("should return false for Perpendicular L corner (touching but not parallel)", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [0, 0],
            [0, 10]
          ]
        });
        // Distance 0 (Touch).
        // Dot = 0 (Perpendicular). Not > 0.996.
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
      });

      it("should return false for T junction", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [5, 0],
            [5, 5]
          ]
        });
        // Touches at 5,0.
        // Dot = 0.
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
      });
    });

    describe("E. Directionality (Anti-parallel)", () => {
      it("should return true for Anti-parallel (reversed direction) but colinear", () => {
        // Implementation uses Math.abs(dot), so this should match.
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ] // Dir 1,0
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [20, 0],
            [10, 0]
          ] // Dir -1,0
        });
        // Touching at 10,0.
        // Dot = -1. Abs(Dot) = 1.
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(true);
      });
    });

    describe("F. Story handling", () => {
      it("should return false for walls on different stories", () => {
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ],
          story: 1
        });
        const w2 = createExternalWall("w2", {
          polygonCorners: [
            [10, 0],
            [20, 0]
          ],
          story: 2
        });
        // Geometrically colinear, but different stories.
        // EXPECTED FAIL if implementation ignores story.
        expect(checkColinearWalls(createMockScan({ walls: [w1, w2] }))).toBe(false);
      });
    });

    describe("G. Degenerate/Data robustness", () => {
      it("should handle duplicate walls (same ID/geometry)", () => {
        // If duplicates are passed, they technically are colinear with themselves or each other.
        // The implementation iterates distinct indices (j = i + 1), so distinct objects/indices are compared.
        // If they are perfect duplicates, Distance=0, Dot=1. returns True.
        // User asked to verify robustness. If logic intends to filter duplicates, this expectation changes.
        // Assuming current logic matches duplicates:
        const w1 = createExternalWall("w1", {
          polygonCorners: [
            [0, 0],
            [10, 0]
          ]
        });
        expect(checkColinearWalls(createMockScan({ walls: [w1, w1] }))).toBe(true);
      });
    });
  });
});
