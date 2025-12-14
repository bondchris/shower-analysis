import { Opening } from "../../../../src/models/rawScan/opening";
import { checkExternalOpening } from "../../../../src/utils/room/checkExternalOpening";
import {
  createDoor,
  createExternalWall,
  createFloor,
  createInternalWall,
  createMockScan,
  createOpening,
  createToilet,
  createWindow
} from "./testHelpers";

describe("checkExternalOpening", () => {
  describe("Baseline / No external opening", () => {
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

  describe("Positive Detection (Openings only)", () => {
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

  describe("Association Logic", () => {
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

  describe("Story-based Scenarios", () => {
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

  describe("Category / Confidence Variations", () => {
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

  describe("Geometry Edge Cases", () => {
    it("should handle degenerate polygon corners", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("op1", "w1", { polygonCorners: [] })],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  describe("Junk + Good Opening Combos", () => {
    it("should return true if one valid external opening exists amidst junk", () => {
      const scan = createMockScan({
        floors: [createFloor()],
        openings: [createOpening("bad1", null), createOpening("good", "w1")],
        walls: [createExternalWall("w1")]
      });
      expect(checkExternalOpening(scan)).toBe(true);
    });
  });

  describe("Weird Linkage", () => {
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
