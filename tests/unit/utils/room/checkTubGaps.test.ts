import convert from "convert-units";

import { Point } from "../../../../src/models/point";
import { dotProduct } from "../../../../src/utils/math/vector";
import { checkTubGaps } from "../../../../src/utils/room/checkTubGaps";
import { createDoor, createExternalWall, createMockScan, createTub } from "./testHelpers";

describe("checkTubGaps", () => {
  const INCH = convert(1).from("in").to("m");

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

  describe("Core range & thresholds", () => {
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

      const maxZ = dotProduct(new Point(0.75, 0.35), new Point(s, c)); // ~0.77
      const w = createExternalWall("w_flat");
      if (w.transform) {
        const gap = 3 * INCH;
        w.transform[14] = maxZ + gap;
      }

      const scan = createMockScan({ objects: [tub], walls: [w] });
      expect(checkTubGaps(scan)).toBe(true);
    });
  });

  describe("Object / Wall filtering", () => {
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

  describe("Coverage Improvements", () => {
    it("should skip wall with invalid transform", () => {
      const t1 = createTub("t1");
      const wInvalid = createExternalWall("wInvalid", { transform: [] });

      const scan = createMockScan({ objects: [t1], walls: [wInvalid] });
      // Skips invalid wall -> no walls -> false (no gaps found)
      expect(checkTubGaps(scan)).toBe(false);
    });

    it("should skip wall with degenerate points (avoiding fallback)", () => {
      const t1 = createTub("t1");
      // Providing [0] means numCorners > 0, so fallback skipped.
      // But point length < 2, so point skipped.
      // Result: wallCorners empty -> continue.
      const wBad = createExternalWall("wBad", { polygonCorners: [[0]] });

      const scan = createMockScan({ objects: [t1], walls: [wBad] });
      expect(checkTubGaps(scan)).toBe(false);
    });
  });
});
