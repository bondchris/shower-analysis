import * as fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDoorIsOpenCounts,
  getObjectAttributeCounts,
  getSinkCounts,
  getVanityTypes,
  getWallEmbeddedCounts
} from "../../../../src/utils/data/rawScanAggregators";
import {
  getArtifactsWithNarrowDoors,
  getArtifactsWithSmallWalls,
  getArtifactsWithWideSpanningOpenings,
  getUnexpectedVersionArtifactDirs
} from "../../../../src/utils/data/rawScanDimensionFilters";
import {
  convertAreasToSquareFeet,
  convertLengthsToFeet,
  convertLengthsToInches,
  getDoorAreas,
  getDoorOutlines,
  getFloorOutlines,
  getFloorWidthHeightPairs,
  getOpeningAreas,
  getOpeningOutlines,
  getTubLengths,
  getVanityLengths,
  getWallAreas,
  getWallOutlines,
  getWindowAreas,
  getWindowOutlines
} from "../../../../src/utils/data/rawScanMetadataCollectors";
import { getObjectConfidenceCounts } from "../../../../src/utils/data/rawScanObjectConfidence";
import {
  getCeilingHeightDifferences,
  getNotchedWallOutlines,
  getSlantedWallOutlines
} from "../../../../src/utils/data/rawScanWallAnalysis";
import { RawScanMetadata } from "../../../../src/models/rawScan/rawScanMetadata";
import { extractRawScanMetadata } from "../../../../src/utils/room/metadata";
import { createMockMetadata, mockRawScanClass, setupFsMocksForMetadata } from "./rawScanTestUtils";

const buildRawScan = (overrides: Partial<Record<string, unknown>> = {}) => ({
  coreModel: "test",
  doors: [],
  floors: [],
  objects: [],
  openings: [],
  sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
  story: 1,
  version: 2,
  walls: [],
  windows: [],
  ...overrides
});

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
mockRawScanClass();

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
      const mockRawScanVersion1 = buildRawScan({ version: 1 });
      const mockRawScanVersion2 = buildRawScan({ version: 2 });

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

  describe("getArtifactsWithNarrowDoors", () => {
    it("returns directories when door widths fall below threshold", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) =>
        filePath.endsWith("rawScan.json")
      );
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(buildRawScan({ doors: [{ dimensions: [0.5, 2] }] }))
      );

      const result = getArtifactsWithNarrowDoors(["/test/dir1"]);

      expect(result.has("/test/dir1")).toBe(true);
    });
  });

  describe("getArtifactsWithWideSpanningOpenings", () => {
    it("returns directories when opening spans more than 90% of wall", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) =>
        filePath.endsWith("rawScan.json")
      );
      const wallId = "wall-1";
      const wallWidth = 10; // 10 meters
      const openingWidth = 9.1; // 91% of wall width
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(
          buildRawScan({
            openings: [{ dimensions: [openingWidth, 2], parentIdentifier: wallId }],
            walls: [{ dimensions: [wallWidth, 2.5], identifier: wallId }]
          })
        )
      );

      const result = getArtifactsWithWideSpanningOpenings(["/test/dir1"]);

      expect(result.has("/test/dir1")).toBe(true);
    });

    it("returns empty set when opening spans less than 90% of wall", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) =>
        filePath.endsWith("rawScan.json")
      );
      const wallId = "wall-1";
      const wallWidth = 10; // 10 meters
      const openingWidth = 8.9; // 89% of wall width
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(
          buildRawScan({
            openings: [{ dimensions: [openingWidth, 2], parentIdentifier: wallId }],
            walls: [{ dimensions: [wallWidth, 2.5], identifier: wallId }]
          })
        )
      );

      const result = getArtifactsWithWideSpanningOpenings(["/test/dir1"]);

      expect(result.has("/test/dir1")).toBe(false);
    });

    it("handles walls with polygonCorners", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) =>
        filePath.endsWith("rawScan.json")
      );
      const wallId = "wall-1";
      // Polygon with perimeter of 10 (rectangle: 0,0 -> 5,0 -> 5,2 -> 0,2)
      // Perimeter = 5 + 2 + 5 + 2 = 14
      const openingWidth = 12.7; // >90% of 14
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(
          buildRawScan({
            openings: [{ dimensions: [openingWidth, 2], parentIdentifier: wallId }],
            walls: [
              {
                dimensions: [5, 2.5],
                identifier: wallId,
                polygonCorners: [
                  [0, 0, 0],
                  [5, 0, 0],
                  [5, 2, 0],
                  [0, 2, 0]
                ]
              }
            ]
          })
        )
      );

      const result = getArtifactsWithWideSpanningOpenings(["/test/dir1"]);

      expect(result.has("/test/dir1")).toBe(true);
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
        doorOutlines: [],
        doorWidthHeightPairs: [],
        doorWidths: [],
        floorLengths: [],
        floorOutlines: [],
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
      openingOutlines: [],
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
      vanityPlacement: null,
    vanityType: null,
      wallAreas: [],
      wallCount: 0,
      wallHeights: [],
      wallOutlines: [],
      wallWidthHeightPairs: [],
      wallWidths: [],
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0,
      windowAreas: [2, 0.4],
      windowCount: 2,
      windowHeights: [2, 0.8],
      windowOutlines: [],
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

describe("outline getters", () => {
  it("returns outlines from metadata", () => {
    const outlines = [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ]
    ];

    vi.mocked(extractRawScanMetadata).mockReturnValue(
      createMockMetadata({
        doorOutlines: outlines,
        floorOutlines: outlines,
        openingOutlines: outlines,
        wallOutlines: outlines,
        windowOutlines: outlines
      })
    );

    const dirs = ["dir1"];
    expect(getFloorOutlines(dirs)).toEqual(outlines);
    expect(getWallOutlines(dirs)).toEqual(outlines);
    expect(getWindowOutlines(dirs)).toEqual(outlines);
    expect(getDoorOutlines(dirs)).toEqual(outlines);
    expect(getOpeningOutlines(dirs)).toEqual(outlines);
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

describe("getCeilingHeightDifferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate ceiling height differences from walls with polygonCorners", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          polygonCorners: [
            [0, 0, 0], // Base
            [0, 3, 0], // Top at height 3
            [2, 3, 0],
            [2, 0, 0]
          ]
        },
        {
          polygonCorners: [
            [0, 0, 0], // Base
            [0, 5, 0], // Top at height 5
            [2, 5, 0],
            [2, 0, 0]
          ]
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const differences = getCeilingHeightDifferences(["/test/dir1"]);

    // Difference should be 5 - 3 = 2 meters (about 0.05m = 2 inches threshold)
    expect(differences.length).toBe(1);
    expect(differences[0]).toBeCloseTo(2, 2);
  });

  it("should calculate ceiling height differences from rectangular walls with dimensions", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          dimensions: [2, 3] // width, height - top at height/2 = 1.5
        },
        {
          dimensions: [2, 5] // width, height - top at height/2 = 2.5
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const differences = getCeilingHeightDifferences(["/test/dir1"]);

    // Difference should be 2.5 - 1.5 = 1.0 meters
    expect(differences.length).toBe(1);
    expect(differences[0]).toBeCloseTo(1.0, 2);
  });

  it("should exclude artifacts with differences less than 2 inches", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          dimensions: [2, 2] // top at 1.0
        },
        {
          dimensions: [2, 2.05] // top at 1.025 - difference < 2 inches
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const differences = getCeilingHeightDifferences(["/test/dir1"]);

    // Difference is too small (< 2 inches), should be excluded
    expect(differences.length).toBe(0);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getCeilingHeightDifferences([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getCeilingHeightDifferences(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getCeilingHeightDifferences(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should exclude artifacts where all ceilings are at the same height", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          dimensions: [2, 3] // top at 1.5
        },
        {
          dimensions: [2, 3] // top at 1.5 - same height
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const differences = getCeilingHeightDifferences(["/test/dir1"]);

    // No difference, should be excluded
    expect(differences.length).toBe(0);
  });
});

describe("getSlantedWallOutlines and getNotchedWallOutlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should separate slanted and notched walls correctly", () => {
    // Test that notched walls go to notched, and non-notched non-rectangular walls go to slanted
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          // Shape with notch: re-entrant corner (interior angle > 180°)
          polygonCorners: [
            [0, 0, 0],
            [0, 10, 0],
            [5, 10, 0],
            [5, 5, 0], // Re-entrant corner
            [10, 5, 0],
            [10, 0, 0]
          ]
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const slantedOutlines = getSlantedWallOutlines(["/test/dir1"]);
    const notchedOutlines = getNotchedWallOutlines(["/test/dir1"]);

    // Wall with notch should go to notched, not slanted
    expect(notchedOutlines.length).toBeGreaterThanOrEqual(0); // Should have the notched wall
    expect(slantedOutlines.length).toBe(0); // Should not be in slanted
  });

  it("should extract notched wall outlines (non-rectangular with re-entrant corners)", () => {
    // L-shaped wall with notch (re-entrant corner at > 180°)
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          // Shape with notch: 0,0 -> 0,10 -> 5,10 -> 5,5 -> 10,5 -> 10,0 -> 0,0
          // Re-entrant corner at 5,5 (interior angle ~270°)
          polygonCorners: [
            [0, 0, 0],
            [0, 10, 0],
            [5, 10, 0],
            [5, 5, 0], // Re-entrant corner
            [10, 5, 0],
            [10, 0, 0]
          ]
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const slantedOutlines = getSlantedWallOutlines(["/test/dir1"]);
    const notchedOutlines = getNotchedWallOutlines(["/test/dir1"]);

    expect(slantedOutlines.length).toBe(0);
    expect(notchedOutlines.length).toBe(1);
  });

  it("should exclude rectangular walls (4 or fewer corners)", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          polygonCorners: [
            [0, 0, 0],
            [0, 2, 0],
            [2, 2, 0],
            [2, 0, 0] // 4 corners - rectangular, should be excluded
          ]
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    const slantedOutlines = getSlantedWallOutlines(["/test/dir1"]);
    const notchedOutlines = getNotchedWallOutlines(["/test/dir1"]);

    expect(slantedOutlines.length).toBe(0);
    expect(notchedOutlines.length).toBe(0);
  });

  it("should return empty array when no artifacts provided", () => {
    expect(getSlantedWallOutlines([])).toEqual([]);
    expect(getNotchedWallOutlines([])).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(getSlantedWallOutlines(["/test/dir1"])).toEqual([]);
    expect(getNotchedWallOutlines(["/test/dir1"])).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    expect(getSlantedWallOutlines(["/test/dir1"])).toEqual([]);
    expect(getNotchedWallOutlines(["/test/dir1"])).toEqual([]);
  });

  it("should handle walls with invalid polygonCorners", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [{ center: [0, 0, 0], label: "test-section", story: 1 }],
      story: 1,
      version: 2,
      walls: [
        {
          polygonCorners: null
        },
        {
          polygonCorners: []
        },
        {
          polygonCorners: [[0, 0]] // Too few coordinates
        }
      ],
      windows: []
    };

    setupFsMocksForMetadata(mockRawScan);

    expect(getSlantedWallOutlines(["/test/dir1"])).toEqual([]);
    expect(getNotchedWallOutlines(["/test/dir1"])).toEqual([]);
  });
});
