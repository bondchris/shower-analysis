import { Door } from "../../src/models/rawScan/door";
import { FloorData } from "../../src/models/rawScan/floor";
import { ObjectItem } from "../../src/models/rawScan/objectItem";
import { Opening } from "../../src/models/rawScan/opening";
import { RawScan, RawScanData } from "../../src/models/rawScan/rawScan";
import { WallData } from "../../src/models/rawScan/wall";
import { Window } from "../../src/models/rawScan/window";
import { checkExternalOpening, checkToiletGaps, checkTubGaps } from "../../src/utils/roomUtils";

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
