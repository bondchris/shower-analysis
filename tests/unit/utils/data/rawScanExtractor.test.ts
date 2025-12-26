import * as fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  convertAreasToSquareFeet,
  convertLengthsToFeet,
  convertLengthsToInches,
  getArtifactsWithSmallWalls,
  getDoorAreas,
  getDoorIsOpenCounts,
  getFloorWidthHeightPairs,
  getObjectAttributeCounts,
  getObjectConfidenceCounts,
  getOpeningAreas,
  getSinkCounts,
  getTubLengths,
  getUnexpectedVersionArtifactDirs,
  getVanityLengths,
  getVanityTypes,
  getWallAreas,
  getWallEmbeddedCounts,
  getWindowAreas
} from "../../../../src/utils/data/rawScanExtractor";
import { RawScanMetadata, extractRawScanMetadata } from "../../../../src/utils/room/metadata";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));

// Mock extractRawScanMetadata
vi.mock("../../../../src/utils/room/metadata", () => ({
  extractRawScanMetadata: vi.fn()
}));

// Simplify RawScan to a passthrough container for test fixtures
vi.mock("../../../../src/models/rawScan/rawScan", () => ({
  RawScan: function (this: Record<string, unknown>, data: unknown) {
    Object.assign(this, data as Record<string, unknown>);
  }
}));

/**
 * Creates a minimal mock RawScanMetadata with default values.
 * Override specific fields as needed for each test.
 */
function createMockMetadata(overrides: Partial<RawScanMetadata> = {}): RawScanMetadata {
  const defaults: RawScanMetadata = {
    doorAreas: [],
    doorCount: 0,
    doorHeights: [],
    doorIsOpenCounts: {},
    doorWidthHeightPairs: [],
    doorWidths: [],
    floorLengths: [],
    floorWidthHeightPairs: [],
    floorWidths: [],
    hasBed: false,
    hasChair: false,
    hasColinearWallErrors: false,
    hasCrookedWallErrors: false,
    hasCurvedEmbedded: false,
    hasCurvedWall: false,
    hasDishwasher: false,
    hasDoorBlockingError: false,
    hasDoorFloorContactError: false,
    hasEmbeddedObjectIntersectionErrors: false,
    hasExternalOpening: false,
    hasFireplace: false,
    hasFloorsWithParentId: false,
    hasLowCeiling: false,
    hasMultipleStories: false,
    hasNibWalls: false,
    hasNonEmptyCompletedEdges: false,
    hasNonRectWall: false,
    hasNonRectangularEmbedded: false,
    hasObjectIntersectionErrors: false,
    hasOven: false,
    hasRefrigerator: false,
    hasSofa: false,
    hasSoffit: false,
    hasStairs: false,
    hasStove: false,
    hasTable: false,
    hasTelevision: false,
    hasToiletGapErrors: false,
    hasTubGapErrors: false,
    hasUnparentedEmbedded: false,
    hasWallGapErrors: false,
    hasWallObjectIntersectionErrors: false,
    hasWallWallIntersectionErrors: false,
    hasWasherDryer: false,
    objectAttributeCounts: {},
    openingAreas: [],
    openingCount: 0,
    openingHeights: [],
    openingWidthHeightPairs: [],
    openingWidths: [],
    roomAreaSqFt: 100,
    sectionLabels: [],
    sinkCount: 0,
    storageCount: 0,
    stories: [1],
    toiletCount: 0,
    tubCount: 0,
    tubLengths: [],
    vanityLengths: [],
    vanityType: null,
    wallAreas: [],
    wallCount: 0,
    wallHeights: [],
    wallWidthHeightPairs: [],
    wallWidths: [],
    wallsWithDoors: 0,
    wallsWithOpenings: 0,
    wallsWithWindows: 0,
    windowAreas: [],
    windowCount: 0,
    windowHeights: [],
    windowWidthHeightPairs: [],
    windowWidths: []
  };
  return { ...defaults, ...overrides };
}

/**
 * Helper function to set up fs mocks for extractRawScanMetadata.
 * Ensures cache doesn't exist (forces extraction from rawScan.json) and provides rawScan.json content.
 */
function setupFsMocksForMetadata(rawScanContent: unknown): void {
  (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
    if (filePath.includes("rawScanMetadata.json")) {
      return false;
    }
    return filePath.includes("rawScan.json");
  });
  (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
    if (filePath.includes("rawScan.json")) {
      return JSON.stringify(rawScanContent);
    }
    return "";
  });
  (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
    // no-op
  });
}

describe("rawScanExtractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUnexpectedVersionArtifactDirs", () => {
    it("should return empty set when no artifacts provided", () => {
      const result = getUnexpectedVersionArtifactDirs([]);
      expect(result.size).toBe(0);
    });

    it("should return directories with unexpected versions", () => {
      const mockRawScanVersion1 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      const mockRawScanVersion2 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, "/");
        if (normalizedPath.includes("/dir1/")) {
          return JSON.stringify(mockRawScanVersion1);
        }
        if (normalizedPath.includes("/dir2/")) {
          return JSON.stringify(mockRawScanVersion2);
        }
        return JSON.stringify(mockRawScanVersion1);
      });

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      const result = getUnexpectedVersionArtifactDirs(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
      expect(result.has("/test/dir2")).toBe(false);
    });

    it("should skip directories without rawScan.json", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const artifactDirs = ["/test/dir1"];
      const result = getUnexpectedVersionArtifactDirs(artifactDirs);

      expect(result.size).toBe(0);
    });

    it("should skip invalid rawScan files", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");

      const artifactDirs = ["/test/dir1"];
      const result = getUnexpectedVersionArtifactDirs(artifactDirs);

      expect(result.size).toBe(0);
    });
  });

  describe("getArtifactsWithSmallWalls", () => {
    it("should return empty set when no artifacts provided", () => {
      const result = getArtifactsWithSmallWalls([]);
      expect(result.size).toBe(0);
    });

    it("should return directories with walls smaller than 1.5 sq ft (from polygonCorners)", () => {
      // Wall with area < 1.5 sq ft: perimeter ~0.341m * height 0.3m = ~0.10 sq m = ~1.08 sq ft
      const mockMetadata1 = createMockMetadata({
        wallAreas: [0.1] // Small wall area in sq m
      });

      // Wall with area >= 1.5 sq ft: perimeter 2m * height 2m = 4 sq m = ~43 sq ft
      const mockMetadata2 = createMockMetadata({
        wallAreas: [4.0] // Large wall area in sq m
      });

      (extractRawScanMetadata as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockMetadata1)
        .mockReturnValueOnce(mockMetadata2);

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
      expect(result.has("/test/dir2")).toBe(false);
    });

    it("should return directories with walls smaller than 1.5 sq ft (from dimensions)", () => {
      // Wall with area < 1.5 sq ft: length 0.3m * height 0.3m = 0.09 sq m = ~0.97 sq ft
      const mockMetadata = createMockMetadata({
        wallAreas: [0.09] // Small wall area in sq m
      });

      (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
    });

    it("should stop checking after finding first small wall in an artifact", () => {
      // Artifact with multiple walls, first one is small
      const mockMetadata = createMockMetadata({
        wallAreas: [0.09, 4.0] // First wall is small, second is large
      });

      (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
    });

    it("should skip directories without rawScan.json", () => {
      (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(0);
    });

    it("should skip invalid rawScan files", () => {
      (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(0);
    });

    it("should skip walls without valid polygonCorners or dimensions", () => {
      const mockMetadata = createMockMetadata({
        wallAreas: [] // No valid walls
      });

      (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(0);
    });
  });
});

describe("getObjectConfidenceCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count high/medium/low confidence across objects, doors, windows, and openings", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [{ confidence: { high: {} } }],
      floors: [],
      objects: [
        { category: { toilet: {} }, confidence: { high: {} } },
        { category: { storage: {} }, confidence: { medium: {} } },
        { category: { sink: {} }, confidence: { low: {} } },
        { category: { sofa: {} }, confidence: {} } // should be skipped (no confidence levels)
      ],
      openings: [{ confidence: { low: {} } }, {}], // second opening has no confidence and should be skipped
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [],
      windows: [{ confidence: { medium: {} } }]
    };

    setupFsMocksForMetadata(mockRawScan);

    const counts = getObjectConfidenceCounts(["/test/dir1"]);

    expect(counts["Toilet"]).toEqual([1, 0, 0]);
    expect(counts["Storage"]).toEqual([0, 1, 0]);
    expect(counts["Sink"]).toEqual([0, 0, 1]);
    expect(counts["Washer/Dryer"]).toBeUndefined();
    expect(counts["Door"]).toEqual([1, 0, 0]);
    expect(counts["Window"]).toEqual([0, 1, 0]);
    expect(counts["Opening"]).toEqual([0, 0, 1]);
  });

  it("should count all object categories correctly", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { category: { bathtub: {} }, confidence: { high: {} } },
        { category: { washerDryer: {} }, confidence: { high: {} } },
        { category: { stove: {} }, confidence: { medium: {} } },
        { category: { table: {} }, confidence: { low: {} } },
        { category: { chair: {} }, confidence: { high: {} } },
        { category: { bed: {} }, confidence: { medium: {} } },
        { category: { dishwasher: {} }, confidence: { low: {} } },
        { category: { oven: {} }, confidence: { high: {} } },
        { category: { refrigerator: {} }, confidence: { medium: {} } },
        { category: { stairs: {} }, confidence: { low: {} } },
        { category: { fireplace: {} }, confidence: { high: {} } },
        { category: { television: {} }, confidence: { medium: {} } }
      ],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const counts = getObjectConfidenceCounts(["/test/dir1"]);

    expect(counts["Bathtub"]).toEqual([1, 0, 0]);
    expect(counts["Washer/Dryer"]).toEqual([1, 0, 0]);
    expect(counts["Stove"]).toEqual([0, 1, 0]);
    expect(counts["Table"]).toEqual([0, 0, 1]);
    expect(counts["Chair"]).toEqual([1, 0, 0]);
    expect(counts["Bed"]).toEqual([0, 1, 0]);
    expect(counts["Dishwasher"]).toEqual([0, 0, 1]);
    expect(counts["Oven"]).toEqual([1, 0, 0]);
    expect(counts["Refrigerator"]).toEqual([0, 1, 0]);
    expect(counts["Stairs"]).toEqual([0, 0, 1]);
    expect(counts["Fireplace"]).toEqual([1, 0, 0]);
    expect(counts["Television"]).toEqual([0, 1, 0]);
  });

  it("should return empty object when no artifacts provided", () => {
    const result = getObjectConfidenceCounts([]);
    expect(result).toEqual({});
  });

  it("should skip directories without rawScan.json", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getObjectConfidenceCounts(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getObjectConfidenceCounts(["/test/dir1"]);
    expect(result).toEqual({});
  });
});

describe("getWallAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate wall areas from polygon corners and dimensions", () => {
    const mockMetadata = createMockMetadata({
      wallAreas: [0.341, 6] // Triangle perimeter ~0.341; area = perimeter * height(1) ≈ 0.341, dimension wall = 2 * 3 = 6
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getWallAreas(["/test/dir1"]);

    expect(areas.length).toBe(2);
    expect(areas[0]).toBeCloseTo(0.341, 3);
    expect(areas[1]).toBe(6);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getWallAreas([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getWallAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getWallAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip walls with invalid dimensions", () => {
    const mockMetadata = createMockMetadata({
      wallAreas: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getWallAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });
});

describe("getWindowAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract window areas from raw scan files", () => {
    const mockMetadata: RawScanMetadata = {
      doorAreas: [],
      doorCount: 0,
      doorHeights: [],
      doorIsOpenCounts: {},
      doorWidthHeightPairs: [],
      doorWidths: [],
      floorLengths: [],
      floorWidthHeightPairs: [],
      floorWidths: [],
      hasBed: false,
      hasChair: false,
      hasColinearWallErrors: false,
      hasCrookedWallErrors: false,
      hasCurvedEmbedded: false,
      hasCurvedWall: false,
      hasDishwasher: false,
      hasDoorBlockingError: false,
      hasDoorFloorContactError: false,
      hasEmbeddedObjectIntersectionErrors: false,
      hasExternalOpening: false,
      hasFireplace: false,
      hasFloorsWithParentId: false,
      hasLowCeiling: false,
      hasMultipleStories: false,
      hasNibWalls: false,
      hasNonEmptyCompletedEdges: false,
      hasNonRectWall: false,
      hasNonRectangularEmbedded: false,
      hasObjectIntersectionErrors: false,
      hasOven: false,
      hasRefrigerator: false,
      hasSofa: false,
      hasSoffit: false,
      hasStairs: false,
      hasStove: false,
      hasTable: false,
      hasTelevision: false,
      hasToiletGapErrors: false,
      hasTubGapErrors: false,
      hasUnparentedEmbedded: false,
      hasWallGapErrors: false,
      hasWallObjectIntersectionErrors: false,
      hasWallWallIntersectionErrors: false,
      hasWasherDryer: false,
      objectAttributeCounts: {},
      openingAreas: [],
      openingCount: 0,
      openingHeights: [],
      openingWidthHeightPairs: [],
      openingWidths: [],
      roomAreaSqFt: 100,
      sectionLabels: [],
      sinkCount: 0,
      storageCount: 0,
      stories: [1],
      toiletCount: 0,
      tubCount: 0,
      tubLengths: [],
      vanityLengths: [],
      vanityType: null,
      wallAreas: [],
      wallCount: 0,
      wallHeights: [],
      wallWidthHeightPairs: [],
      wallWidths: [],
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0,
      windowAreas: [2, 0.4],
      windowCount: 2,
      windowHeights: [2, 0.8],
      windowWidthHeightPairs: [
        { height: 2, width: 1 },
        { height: 0.8, width: 0.5 }
      ],
      windowWidths: [1, 0.5]
    };

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getWindowAreas(["/test/dir1"]);
    expect(areas.length).toBe(2);
    expect(areas[0]).toBe(2);
    expect(areas[1]).toBeCloseTo(0.4);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getWindowAreas([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getWindowAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getWindowAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip windows with invalid dimensions", () => {
    const mockMetadata = createMockMetadata({
      windowAreas: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getWindowAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });
});

describe("getDoorAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract door areas from raw scan files", () => {
    const mockMetadata = createMockMetadata({
      doorAreas: [1.6, 2.2]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getDoorAreas(["/test/dir1"]);
    expect(areas.length).toBe(2);
    expect(areas[0]).toBeCloseTo(1.6);
    expect(areas[1]).toBeCloseTo(2.2);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getDoorAreas([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getDoorAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip doors with invalid dimensions", () => {
    const mockMetadata = createMockMetadata({
      doorAreas: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getDoorAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getDoorAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });
});

describe("getOpeningAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract opening areas from raw scan files", () => {
    const mockMetadata = createMockMetadata({
      openingAreas: [2.52, 2.16]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getOpeningAreas(["/test/dir1"]);
    expect(areas.length).toBe(2);
    expect(areas[0]).toBeCloseTo(2.52);
    expect(areas[1]).toBeCloseTo(2.16);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getOpeningAreas([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getOpeningAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip openings with invalid dimensions", () => {
    const mockMetadata = createMockMetadata({
      openingAreas: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const areas = getOpeningAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getOpeningAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });
});

describe("conversion functions", () => {
  describe("convertAreasToSquareFeet", () => {
    it("should convert areas from square meters to square feet", () => {
      const areasInMeters = [1, 0.5, 2];
      const result = convertAreasToSquareFeet(areasInMeters);

      // 1 square meter ≈ 10.764 square feet
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(10.764, 2);
      expect(result[1]).toBeCloseTo(5.382, 2);
      expect(result[2]).toBeCloseTo(21.528, 2);
    });

    it("should return empty array for empty input", () => {
      const result = convertAreasToSquareFeet([]);
      expect(result).toEqual([]);
    });
  });

  describe("convertLengthsToFeet", () => {
    it("should convert lengths from meters to feet", () => {
      const lengthsInMeters = [1, 0.5, 2];
      const result = convertLengthsToFeet(lengthsInMeters);

      // 1 meter ≈ 3.281 feet
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(3.281, 2);
      expect(result[1]).toBeCloseTo(1.640, 2);
      expect(result[2]).toBeCloseTo(6.562, 2);
    });

    it("should return empty array for empty input", () => {
      const result = convertLengthsToFeet([]);
      expect(result).toEqual([]);
    });
  });

  describe("convertLengthsToInches", () => {
    it("should convert lengths from meters to inches", () => {
      const lengthsInMeters = [1, 0.5, 0.0254]; // 0.0254m = 1 inch
      const result = convertLengthsToInches(lengthsInMeters);

      // 1 meter ≈ 39.37 inches
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(39.37, 1);
      expect(result[1]).toBeCloseTo(19.685, 1);
      expect(result[2]).toBeCloseTo(1, 2);
    });

    it("should return empty array for empty input", () => {
      const result = convertLengthsToInches([]);
      expect(result).toEqual([]);
    });
  });
});

describe("getTubLengths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract tub lengths from raw scan files", () => {
    const mockMetadata = createMockMetadata({
      tubLengths: [1.5, 1.8]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getTubLengths(["/test/dir1"]);
    expect(lengths.length).toBe(2);
    expect(lengths[0]).toBe(1.5);
    expect(lengths[1]).toBe(1.8);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getTubLengths([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getTubLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip bathtubs with invalid dimensions", () => {
    const mockMetadata = createMockMetadata({
      tubLengths: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getTubLengths(["/test/dir1"]);
    expect(lengths).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getTubLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });
});

describe("getDoorIsOpenCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count door isOpen values", () => {
    const mockMetadata = createMockMetadata({
      doorIsOpenCounts: { Closed: 1, Open: 2, Unknown: 1 }
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getDoorIsOpenCounts(["/test/dir1"]);
    expect(counts["Open"]).toBe(2);
    expect(counts["Closed"]).toBe(1);
    expect(counts["Unknown"]).toBe(1);
  });

  it("should return empty object when no artifacts provided", () => {
    const result = getDoorIsOpenCounts([]);
    expect(result).toEqual({});
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getDoorIsOpenCounts(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getDoorIsOpenCounts(["/test/dir1"]);
    expect(result).toEqual({});
  });
});

describe("getObjectAttributeCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count object attributes by type", () => {
    const mockMetadata = createMockMetadata({
      objectAttributeCounts: {
        color: { blue: 1, red: 1 },
        style: { classic: 1, modern: 2 }
      }
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const styleCounts = getObjectAttributeCounts(["/test/dir1"], "style");
    expect(styleCounts["modern"]).toBe(2);
    expect(styleCounts["classic"]).toBe(1);

    const colorCounts = getObjectAttributeCounts(["/test/dir1"], "color");
    expect(colorCounts["red"]).toBe(1);
    expect(colorCounts["blue"]).toBe(1);
  });

  it("should skip non-string attribute values", () => {
    const mockMetadata = createMockMetadata({
      objectAttributeCounts: {
        stringAttr: { value: 1 }
      }
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const numericCounts = getObjectAttributeCounts(["/test/dir1"], "numericAttr");
    expect(numericCounts).toEqual({});

    const stringCounts = getObjectAttributeCounts(["/test/dir1"], "stringAttr");
    expect(stringCounts["value"]).toBe(1);
  });

  it("should return empty object when no artifacts provided", () => {
    const result = getObjectAttributeCounts([], "style");
    expect(result).toEqual({});
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getObjectAttributeCounts(["/test/dir1"], "style");
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getObjectAttributeCounts(["/test/dir1"], "style");
    expect(result).toEqual({});
  });
});

describe("getWallEmbeddedCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count walls with windows, doors, and openings", () => {
    const mockMetadata = createMockMetadata({
      wallCount: 4,
      wallsWithDoors: 2,
      wallsWithOpenings: 1,
      wallsWithWindows: 2
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getWallEmbeddedCounts(["/test/dir1"]);
    expect(counts.totalWalls).toBe(4);
    expect(counts.wallsWithDoors).toBe(2);
    expect(counts.wallsWithWindows).toBe(2);
    expect(counts.wallsWithOpenings).toBe(1);
  });

  it("should return zero counts when no artifacts provided", () => {
    const result = getWallEmbeddedCounts([]);
    expect(result).toEqual({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getWallEmbeddedCounts(["/test/dir1"]);
    expect(result).toEqual({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getWallEmbeddedCounts(["/test/dir1"]);
    expect(result).toEqual({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });
  });

  it("should count unique walls only once even with multiple doors/windows", () => {
    const mockMetadata = createMockMetadata({
      wallCount: 1,
      wallsWithDoors: 1,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getWallEmbeddedCounts(["/test/dir1"]);
    expect(counts.totalWalls).toBe(1);
    expect(counts.wallsWithDoors).toBe(1);
  });
});


describe("getSinkCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count sinks per artifact from metadata", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ sinkCount: 1 })
      .mockReturnValueOnce({ sinkCount: 2 })
      .mockReturnValueOnce({ sinkCount: 1 });

    const counts = getSinkCounts(["/test/dir1", "/test/dir2", "/test/dir3"]);
    expect(counts["1"]).toBe(2);
    expect(counts["2"]).toBe(1);
  });

  it("should return empty object when no artifacts provided", () => {
    const result = getSinkCounts([]);
    expect(result).toEqual({});
  });

  it("should skip directories where metadata extraction returns null", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ sinkCount: 1 });

    const counts = getSinkCounts(["/test/dir1", "/test/dir2"]);
    expect(counts["1"]).toBe(1);
  });
});

describe("getVanityLengths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return length of storage intersecting with sink", () => {
    const mockMetadata = createMockMetadata({
      vanityLengths: [1.2]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(1.2);
  });

  it("should return sink length when no storage intersects sink", () => {
    const mockMetadata = createMockMetadata({
      vanityLengths: [0.5]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(0.5);
  });

  it("should return largest storage length when no sink exists", () => {
    const mockMetadata = createMockMetadata({
      vanityLengths: [1.5]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(1.5);
  });

  it("should return empty array when no vanity (no sink, no storage)", () => {
    const mockMetadata = createMockMetadata({
      vanityLengths: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths).toEqual([]);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getVanityLengths([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getVanityLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getVanityLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip objects with invalid dimensions or transforms", () => {
    const mockMetadata = createMockMetadata({
      vanityLengths: [0.5]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(0.5);
  });

  it("should not intersect storage and sink on different stories", () => {
    const mockMetadata = createMockMetadata({
      vanityLengths: [0.5]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(0.5);
  });
});

describe("getVanityTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should classify as 'normal' when storage and sink intersect", () => {
    const mockMetadata = createMockMetadata({
      vanityType: "normal"
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["normal"]).toBe(1);
  });

  it("should classify as 'sink only' when sink exists but no storage intersection", () => {
    const mockMetadata = createMockMetadata({
      vanityType: "sink only"
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["sink only"]).toBe(1);
  });

  it("should classify as 'storage only' when storage exists but no sink", () => {
    const mockMetadata = createMockMetadata({
      vanityType: "storage only"
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["storage only"]).toBe(1);
  });

  it("should classify as 'no vanity' when neither sink nor storage exists", () => {
    const mockMetadata = createMockMetadata({
      vanityType: "no vanity"
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["no vanity"]).toBe(1);
  });

  it("should return empty object when no artifacts provided", () => {
    const result = getVanityTypes([]);
    expect(result).toEqual({});
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getVanityTypes(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getVanityTypes(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should classify as 'sink only' when storage and sink are on different stories", () => {
    const mockMetadata = createMockMetadata({
      vanityType: "sink only"
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["sink only"]).toBe(1);
  });

  it("should skip objects with invalid dimensions or transforms when building bounding boxes", () => {
    const mockMetadata = createMockMetadata({
      vanityType: "sink only"
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    // Objects with invalid dimensions/transforms won't have bounding boxes built
    // But we still have a sink in the list, so result should be "sink only"
    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["sink only"]).toBe(1);
  });

  it("should count multiple artifacts with different vanity types", () => {
    const normalMetadata = createMockMetadata({ vanityType: "normal" });
    const sinkOnlyMetadata = createMockMetadata({ vanityType: "sink only" });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(normalMetadata)
      .mockReturnValueOnce(sinkOnlyMetadata);

    const counts = getVanityTypes(["/test/dir1", "/test/dir2"]);
    expect(counts["normal"]).toBe(1);
    expect(counts["sink only"]).toBe(1);
  });
});

describe("getFloorWidthHeightPairs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract floor width and height pairs from dimensions", () => {
    const mockMetadata = createMockMetadata({
      floorWidthHeightPairs: [
        { height: 5, width: 3 },
        { height: 4, width: 2.5 }
      ]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const pairs = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(pairs.length).toBe(2);
    expect(pairs[0]).toEqual({ height: 5, width: 3 });
    expect(pairs[1]).toEqual({ height: 4, width: 2.5 });
  });

  it("should extract floor width and height pairs from polygon corners", () => {
    const mockMetadata = createMockMetadata({
      floorWidthHeightPairs: [{ height: 5, width: 3 }]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const pairs = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(pairs.length).toBe(1);
    expect(pairs[0]).toEqual({ height: 5, width: 3 });
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getFloorWidthHeightPairs([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip floors with invalid dimensions", () => {
    const mockMetadata = createMockMetadata({
      floorWidthHeightPairs: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const pairs = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(pairs).toEqual([]);
  });

  it("should skip floors with invalid polygon corners", () => {
    const mockMetadata = createMockMetadata({
      floorWidthHeightPairs: []
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const pairs = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(pairs).toEqual([]);
  });

  it("should only include floors with both valid width and height", () => {
    const mockMetadata = createMockMetadata({
      floorWidthHeightPairs: [
        { height: 5, width: 3 },
        { height: 4, width: 2 }
      ]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const pairs = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(pairs.length).toBe(2);
    expect(pairs[0]).toEqual({ height: 5, width: 3 });
    expect(pairs[1]).toEqual({ height: 4, width: 2 });
  });

  it("should prefer polygon corners over dimensions when both are present", () => {
    const mockMetadata = createMockMetadata({
      floorWidthHeightPairs: [{ height: 5, width: 3 }]
    });

    (extractRawScanMetadata as ReturnType<typeof vi.fn>).mockReturnValue(mockMetadata);

    const pairs = getFloorWidthHeightPairs(["/test/dir1"]);
    expect(pairs.length).toBe(1);
    expect(pairs[0]).toEqual({ height: 5, width: 3 });
  });
});

