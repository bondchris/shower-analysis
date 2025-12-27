import { describe, expect, it, vi } from "vitest";
import { Door } from "../../../../../src/models/rawScan/door";
import { Floor } from "../../../../../src/models/rawScan/floor";
import { ObjectItem } from "../../../../../src/models/rawScan/objectItem";
import { Opening } from "../../../../../src/models/rawScan/opening";
import { RawScan } from "../../../../../src/models/rawScan/rawScan";
import { Wall } from "../../../../../src/models/rawScan/wall";
import { Window } from "../../../../../src/models/rawScan/window";
import { extractDimensionAreaData } from "../../../../../src/utils/room/metadata/extractDimensionAreaData";

/**
 * Mock vanity analysis to isolate dimension area data extraction tests
 */
vi.mock("../../../../../src/utils/room/vanity/vanityAnalysis", () => ({
  getVanityLengths: vi.fn().mockReturnValue([])
}));

describe("extractDimensionAreaData", () => {
  /**
   * Helper to create a minimal RawScan object for testing
   */
  const createBaseRawScan = (): RawScan =>
    ({
      coreModel: "test-model",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      referenceOriginTransform: [],
      sections: [],
      story: 1,
      version: 1,
      walls: [],
      windows: []
    }) as unknown as RawScan;

  describe("walls", () => {
    /**
     * Test width calculation from polygon corners (perimeter)
     */
    it("should extract dimensions from polygonCorners", () => {
      const rawScan = createBaseRawScan();
      rawScan.walls.push({
        dimensions: [5, 2, 0.2],
        polygonCorners: [
          [0, 0, 0],
          [5, 0, 0],
          [5, 2, 0],
          [0, 2, 0]
        ]
      } as unknown as Wall);

      const result = extractDimensionAreaData(rawScan);
      // Perimeter of (0,0)-(5,0)-(5,2)-(0,2) in index 0,1 plane:
      // (0,0) to (5,0) = 5
      // (5,0) to (5,2) = 2
      // (5,2) to (0,2) = 5
      // (0,2) to (0,0) = 2
      // total = 14
      expect(result.wallWidths).toEqual([14]);
      expect(result.wallHeights).toEqual([2]);
      expect(result.wallAreas).toEqual([14 * 2]);
      expect(result.wallWidthHeightPairs).toEqual([{ height: 2, width: 14 }]);
    });

    it("should fallback to dimensions array if polygonCorners is missing or too short", () => {
      const rawScan = createBaseRawScan();
      rawScan.walls.push({
        dimensions: [10, 3, 0.2]
      } as unknown as Wall);

      const result = extractDimensionAreaData(rawScan);
      expect(result.wallWidths).toEqual([10]);
      expect(result.wallHeights).toEqual([3]);
      expect(result.wallAreas).toEqual([30]);
    });

    it("should skip walls with invalid dimensions or widths", () => {
      const rawScan = createBaseRawScan();
      rawScan.walls.push({
        dimensions: [0, 3, 0.2] // width 0
      } as unknown as Wall);
      rawScan.walls.push({
        dimensions: [10, 0, 0.2] // height 0
      } as unknown as Wall);
      rawScan.walls.push({
        dimensions: [10] // too short
      } as unknown as Wall);

      const result = extractDimensionAreaData(rawScan);
      // First wall: width 0 (skipped), height 3 (added)
      // Second wall: width 10 (added), height 0 (skipped)
      // Third wall: too short (skipped)
      expect(result.wallWidths).toEqual([10]);
      expect(result.wallHeights).toEqual([3]);
      expect(result.wallAreas).toEqual([]);
    });

    it("should handle wall polygonCorners with undefined coordinates", () => {
      const rawScan = createBaseRawScan();
      rawScan.walls.push({
        dimensions: [5, 2, 0.2],
        polygonCorners: [
          [undefined as unknown as number, 0, 0],
          [5, undefined as unknown as number, 0],
          [5, 2, 0]
        ]
      } as unknown as Wall);

      const result = extractDimensionAreaData(rawScan);
      expect(result.wallWidths.length).toBeGreaterThan(0);
    });

    it("should handle walls with polygonCorners but missing height in dimensions", () => {
      const rawScan = createBaseRawScan();
      rawScan.walls.push({
        dimensions: [1], // no height at index 1
        polygonCorners: [
          [0, 0, 0],
          [1, 0, 0],
          [1, 0, 1]
        ]
      } as unknown as Wall);

      const result = extractDimensionAreaData(rawScan);
      expect(result.wallWidths).toEqual([expect.any(Number)]);
      expect(result.wallHeights).toEqual([]);
      expect(result.wallAreas).toEqual([]);
    });

    it("should handle wall polygonCorners with undefined corners", () => {
      const rawScan = createBaseRawScan();
      rawScan.walls.push({
        dimensions: [5, 2, 0.2],
        polygonCorners: [[0, 0, 0], undefined as unknown as number[], [5, 2, 0]]
      } as unknown as Wall);

      const result = extractDimensionAreaData(rawScan);
      // Perimeter will skip segments with undefined corners
      expect(result.wallWidths.length).toBeGreaterThan(0);
    });
  });

  describe("windows, doors, and openings", () => {
    it("should handle doors with invalid dimensions", () => {
      const rawScan = createBaseRawScan();
      rawScan.doors.push({
        dimensions: [0.9] // length < 2
      } as unknown as Door);
      rawScan.doors.push({
        dimensions: [0.9, 0] // height <= 0
      } as unknown as Door);

      const result = extractDimensionAreaData(rawScan);
      expect(result.doorWidths).toEqual([]);
      expect(result.doorHeights).toEqual([]);
    });

    it("should extract dimensions for windows", () => {
      const rawScan = createBaseRawScan();
      rawScan.windows.push({
        dimensions: [1.5, 1.2, 0.1]
      } as unknown as Window);

      const result = extractDimensionAreaData(rawScan);
      expect(result.windowWidths).toEqual([1.5]);
      expect(result.windowHeights).toEqual([1.2]);
      expect(result.windowAreas).toEqual([1.5 * 1.2]);
      expect(result.windowWidthHeightPairs).toEqual([{ height: 1.2, width: 1.5 }]);
    });

    it("should handle windows with invalid dimensions", () => {
      const rawScan = createBaseRawScan();
      rawScan.windows.push({
        dimensions: [1.2] // length < 2
      } as unknown as Window);
      rawScan.windows.push({
        dimensions: [0, 1.2] // width <= 0
      } as unknown as Window);

      const result = extractDimensionAreaData(rawScan);
      expect(result.windowWidths).toEqual([]);
      expect(result.windowHeights).toEqual([]);
    });

    it("should extract dimensions for doors", () => {
      const rawScan = createBaseRawScan();
      rawScan.doors.push({
        dimensions: [0.9, 2.1, 0.1]
      } as unknown as Door);

      const result = extractDimensionAreaData(rawScan);
      expect(result.doorWidths).toEqual([0.9]);
      expect(result.doorHeights).toEqual([2.1]);
      expect(result.doorAreas).toEqual([0.9 * 2.1]);
      expect(result.doorWidthHeightPairs).toEqual([{ height: 2.1, width: 0.9 }]);
    });

    it("should extract dimensions for openings", () => {
      const rawScan = createBaseRawScan();
      rawScan.openings.push({
        dimensions: [2.0, 2.5, 0.1]
      } as unknown as Opening);

      const result = extractDimensionAreaData(rawScan);
      expect(result.openingWidths).toEqual([2.0]);
      expect(result.openingHeights).toEqual([2.5]);
      expect(result.openingAreas).toEqual([2.0 * 2.5]);
    });

    it("should handle openings with invalid dimensions", () => {
      const rawScan = createBaseRawScan();
      rawScan.openings.push({
        dimensions: [1.0] // length < 2
      } as unknown as Opening);
      rawScan.openings.push({
        dimensions: [1.0, 0] // height <= 0
      } as unknown as Opening);
      rawScan.openings.push({
        dimensions: undefined
      } as unknown as Opening);

      const result = extractDimensionAreaData(rawScan);
      expect(result.openingWidths).toEqual([]);
      expect(result.openingHeights).toEqual([]);
    });
  });

  describe("floors", () => {
    it("should extract dimensions from polygonCorners using X and Y values", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        polygonCorners: [
          [0, 0, 0],
          [10, 5, 0],
          [5, 10, 0],
          [-2, 3, 0]
        ]
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      // X values: 0, 10, 5, -2 -> min -2, max 10 -> length 12
      // Y values: 0, 5, 10, 3 -> min 0, max 10 -> width 10
      expect(result.floorLengths).toEqual([12]);
      expect(result.floorWidths).toEqual([10]);
      expect(result.floorWidthHeightPairs).toEqual([{ height: 12, width: 10 }]);
    });

    it("should handle floors with polygonCorners but some undefined X or Y values", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        polygonCorners: [
          [0, 0, 0],
          [10, undefined as unknown as number, 0], // Y is undefined
          [undefined as unknown as number, 10, 0], // X is undefined
          [5, 5, 0]
        ]
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      // X values: 0, 10, 5 -> min 0, max 10 -> length 10
      // Y values: 0, 10, 5 -> min 0, max 10 -> width 10
      expect(result.floorLengths).toEqual([10]);
      expect(result.floorWidths).toEqual([10]);
    });

    it("should handle floors with no dimensions and no polygon corners", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        dimensions: undefined,
        polygonCorners: undefined
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      expect(result.floorLengths).toEqual([]);
      expect(result.floorWidths).toEqual([]);
    });

    it("should handle floors where only length or width is > 0", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        dimensions: [10, 0, 0.1]
      } as unknown as Floor);
      rawScan.floors.push({
        dimensions: [0, 5, 0.1]
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      expect(result.floorLengths).toEqual([10]);
      expect(result.floorWidths).toEqual([5]);
      expect(result.floorWidthHeightPairs).toEqual([]);
    });

    it("should handle floors with polygonCorners but no valid coordinates", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        polygonCorners: [
          [0, undefined as unknown as number, 0], // Y is undefined
          [0], // length < 3
          undefined as unknown as number[]
        ]
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      expect(result.floorLengths).toEqual([]);
      expect(result.floorWidths).toEqual([]);
    });

    it("should handle floors with polygonCorners but only valid Y coordinates (no X)", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        polygonCorners: [
          [undefined as unknown as number, 0, 0],
          [undefined as unknown as number, 10, 0],
          [undefined as unknown as number, 5, 0]
        ]
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      expect(result.floorLengths).toEqual([]);
      expect(result.floorWidths).toEqual([10]);
    });

    it("should handle floors with polygonCorners but only valid X coordinates (no Y)", () => {
      const rawScan = createBaseRawScan();
      rawScan.floors.push({
        polygonCorners: [
          [0, undefined as unknown as number, 0],
          [10, undefined as unknown as number, 0],
          [5, undefined as unknown as number, 0]
        ]
      } as unknown as Floor);

      const result = extractDimensionAreaData(rawScan);
      expect(result.floorLengths).toEqual([10]);
      expect(result.floorWidths).toEqual([]);
    });
  });

  describe("objects and vanity", () => {
    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    it("should extract bathtub lengths", () => {
      const rawScan = createBaseRawScan();
      rawScan.objects.push({
        category: { bathtub: {} },
        dimensions: [1.7, 0.7, 0.6],
        identifier: "tub1",
        transform: identityTransform
      } as unknown as ObjectItem);
      rawScan.objects.push({
        category: { toilet: {} }, // not a bathtub
        dimensions: [0.7, 0.5, 0.4],
        identifier: "toilet1",
        transform: identityTransform
      } as unknown as ObjectItem);

      const result = extractDimensionAreaData(rawScan);
      expect(result.tubLengths).toEqual([1.7]);
    });

    it("should handle bathtub with length <= 0", () => {
      const rawScan = createBaseRawScan();
      rawScan.objects.push({
        category: { bathtub: {} },
        dimensions: [0, 0.7, 0.6],
        identifier: "tub1",
        transform: identityTransform
      } as unknown as ObjectItem);

      const result = extractDimensionAreaData(rawScan);
      expect(result.tubLengths).toEqual([]);
    });

    it("should handle bathtub with non-array dimensions", () => {
      const rawScan = createBaseRawScan();
      rawScan.objects.push({
        category: { bathtub: {} },
        dimensions: "not-an-array" as unknown as number[],
        identifier: "tub1",
        transform: identityTransform
      } as unknown as ObjectItem);

      const result = extractDimensionAreaData(rawScan);
      expect(result.tubLengths).toEqual([]);
    });
  });
});
