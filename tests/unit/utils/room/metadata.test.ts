import fs from "fs";
import path from "path";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RawScanData } from "../../../../src/models/rawScan/rawScan";
import { FloorData } from "../../../../src/models/rawScan/floor";
import { ObjectItem } from "../../../../src/models/rawScan/objectItem";
import { WallData } from "../../../../src/models/rawScan/wall";
import { RawScanMetadata, extractRawScanMetadata } from "../../../../src/utils/room/metadata";
import { createWindow } from "./testHelpers";

// Mock modules
vi.mock("fs");

describe("extractRawScanMetadata", () => {
  const mockDir = "/mock/dir";
  const mockCachePath = path.join(mockDir, "rawScanMetadata.json");
  const mockRawScanPath = path.join(mockDir, "rawScan.json");

  // Minimal valid structure compatible with RawScan constructor
  const validRawScanData: RawScanData = {
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
  };

  // Add a floor (required for area calc)
  // FloorData structure
  validRawScanData.floors.push({
    category: { floor: {} },
    confidence: { high: {} },
    dimensions: [10, 10, 0.1], // changed to 10x10x0.1 so dimX*dimY = 100
    identifier: "floor1",
    modelPosition: [0, 0, 0],
    parentIdentifier: null,
    // Corners on XY plane (Z=0) for Surface.area calculation or just X,Y values used
    polygonCorners: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 10, 0],
      [0, 10, 0]
    ],
    segments: [],
    story: 1,
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] // Identity
  } as FloorData);

  // Add walls
  validRawScanData.walls.push({
    category: { wall: {} },
    confidence: { high: {} },
    dimensions: [5, 2, 0.2],
    identifier: "wall1",
    modelPosition: [0, 0, 0],
    parentIdentifier: null,
    polygonCorners: [
      [0, 0],
      [5, 0],
      [5, 2],
      [0, 2]
    ],
    segments: [],
    story: 1,
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  } as WallData);

  // Add objects
  validRawScanData.objects.push({
    attributes: {},
    category: { toilet: {} },
    confidence: { high: {} },
    dimensions: [1, 1, 1],
    identifier: "toilet1",
    modelPosition: [0, 0, 0],
    parentIdentifier: null,
    segments: [],
    story: 1,
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  } as ObjectItem);

  validRawScanData.objects.push({
    attributes: {},
    category: { bathtub: {} },
    confidence: { high: {} },
    dimensions: [1, 1, 1],
    identifier: "tub1",
    modelPosition: [0, 0, 0],
    parentIdentifier: null,
    segments: [],
    story: 1,
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  } as ObjectItem);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return cached metadata if it exists and is valid", () => {
    const cachedData: RawScanMetadata = {
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
      roomAreaSqFt: 500,
      sectionLabels: [],
      sinkCount: 0,
      storageCount: 0,
      stories: [],
      toiletCount: 1,
      tubCount: 0,
      tubLengths: [],
      vanityLengths: [],
      vanityType: null,
      wallAreas: [],
      wallCount: 4,
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

    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(cachedData));

    const result = extractRawScanMetadata(mockDir);

    expect(fs.existsSync).toHaveBeenCalledWith(mockCachePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, "utf-8");
    expect(result).toEqual(cachedData);
  });

  it("should regenerate metadata if cache is missing required fields", () => {
    const incompleteCache: Partial<RawScanMetadata> = {
      doorCount: 0,
      hasFloorsWithParentId: false,
      hasLowCeiling: false,
      hasNonEmptyCompletedEdges: false,
      hasNonRectangularEmbedded: false,
      openingCount: 0,
      stories: [],
      windowCount: 0
    };

    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return true;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    (fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return JSON.stringify(incompleteCache);
      }
      return JSON.stringify(validRawScanData);
    });

    const result = extractRawScanMetadata(mockDir);

    expect(result).not.toBeNull();
    expect(result?.wallCount).toBe(1);
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.any(String));
  });

  it("should detect hasUnparentedEmbedded if a window has null parent", () => {
    // Force cache miss, but allow rawScan to exist
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    // Create rawScan with unparented window
    const rawScanUnparented = {
      ...validRawScanData,
      windows: [createWindow("w1", null)]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanUnparented));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasUnparentedEmbedded).toBe(true);
  });

  it("should extract metadata from rawScan.json if cache is missing", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validRawScanData));

    const result = extractRawScanMetadata(mockDir);

    expect(result).not.toBeNull();
    // Verify some calculated properties
    if (result) {
      expect(result.wallCount).toBe(1);
      expect(result.toiletCount).toBe(1);
      expect(result.tubCount).toBe(1);
      // Floor is 100m2 -> ~1076 sq ft
      expect(result.roomAreaSqFt).toBeCloseTo(1076, 0);
    }

    // Verify cache write
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.any(String));
  });

  it("should return null if rawScan.json does not exist", () => {
    (fs.existsSync as Mock).mockReturnValue(false); // No cache, no rawScan

    const result = extractRawScanMetadata(mockDir);

    expect(result).toBeNull();
  });

  it("should return null if parsing rawScan.json fails", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    (fs.readFileSync as Mock).mockReturnValue("INVALID JSON");

    const result = extractRawScanMetadata(mockDir);

    expect(result).toBeNull();
  });

  it("should proceed to extraction if cache is corrupt", () => {
    // Cache exists but read fails
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return true;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    (fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p.includes("rawScanMetadata.json")) {
        throw new Error("Corrupt");
      }
      return JSON.stringify(validRawScanData);
    });

    const result = extractRawScanMetadata(mockDir);
    expect(result).not.toBeNull();
    expect(result?.wallCount).toBe(1);
  });

  it("should fail gracefully if writing cache fails", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validRawScanData));

    (fs.writeFileSync as Mock).mockImplementation(() => {
      throw new Error("Write failed");
    });

    const result = extractRawScanMetadata(mockDir);
    expect(result).not.toBeNull(); // Should still return computed data
  });

  it("should detect hasCurvedEmbedded if a door has curve value and parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithCurvedDoor = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: false } },
          completedEdges: [],
          confidence: { high: {} },
          curve: { radius: 1.5 } as unknown as null, // Type says null but runtime can have curve
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithCurvedDoor));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedEmbedded).toBe(true);
  });

  it("should detect hasCurvedEmbedded if a window has curve value and parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithCurvedWindow = {
      ...validRawScanData,
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      windows: [
        {
          category: { window: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: { radius: 2.0 } as unknown as null,
          dimensions: [1.2, 1.5, 0.1],
          identifier: "window1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.2, 0],
            [1.2, 1.5],
            [0, 1.5]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithCurvedWindow));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedEmbedded).toBe(true);
  });

  it("should detect hasCurvedEmbedded if an opening has curve value and parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithCurvedOpening = {
      ...validRawScanData,
      openings: [
        {
          category: { opening: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: { radius: 1.8 },
          dimensions: [1.0, 2.0, 0.1],
          identifier: "opening1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 2.0],
            [0, 2.0]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithCurvedOpening));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedEmbedded).toBe(true);
  });

  it("should not detect hasCurvedEmbedded if embedded items have null curve", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithoutCurved = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: false } },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithoutCurved));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedEmbedded).toBe(false);
  });

  it("should detect hasNonRectangularEmbedded if a door has non-4 corners and parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithNonRectDoor = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: false } },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1],
            [0.1, 1.0] // 5 corners - non-rectangular
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithNonRectDoor));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonRectangularEmbedded).toBe(true);
  });

  it("should detect hasNonRectangularEmbedded if a window has non-4 corners and parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithNonRectWindow = {
      ...validRawScanData,
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      windows: [
        {
          category: { window: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.2, 1.5, 0.1],
          identifier: "window1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.2, 0],
            [1.2, 1.5] // 3 corners - non-rectangular
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithNonRectWindow));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonRectangularEmbedded).toBe(true);
  });

  it("should detect hasNonRectangularEmbedded if an opening has non-4 corners and parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithNonRectOpening = {
      ...validRawScanData,
      openings: [
        {
          category: { opening: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 2.0, 0.1],
          identifier: "opening1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 2.0],
            [0, 2.0],
            [0.2, 1.0],
            [0.1, 0.5] // 6 corners - non-rectangular
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithNonRectOpening));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonRectangularEmbedded).toBe(true);
  });

  it("should not detect hasNonRectangularEmbedded if embedded items have 4 corners", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithRectangular = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: false } },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1] // 4 corners - rectangular
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [5, 0],
            [5, 2],
            [0, 2]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithRectangular));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonRectangularEmbedded).toBe(false);
  });

  it("should not detect hasCurvedEmbedded or hasNonRectangularEmbedded if items have null parent", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithUnparented = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: false } },
          completedEdges: [],
          confidence: { high: {} },
          curve: { radius: 1.5 } as unknown as null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: null, // No parent
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1],
            [0.1, 1.0] // 5 corners
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithUnparented));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedEmbedded).toBe(false);
    expect(result?.hasNonRectangularEmbedded).toBe(false);
  });

  it("should detect hasNonEmptyCompletedEdges for doors, floors, openings, walls, and windows", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithCompletedEdges = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: false } },
          completedEdges: ["edge1"],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithCompletedEdges));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonEmptyCompletedEdges).toBe(true);
  });

  it("should detect hasNonEmptyCompletedEdges for floors with completedEdges", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithFloorCompletedEdges = {
      ...validRawScanData,
      floors: [
        {
          ...validRawScanData.floors[0],
          completedEdges: ["edge1"]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithFloorCompletedEdges));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonEmptyCompletedEdges).toBe(true);
  });

  it("should detect hasNonEmptyCompletedEdges for openings with completedEdges", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithOpeningCompletedEdges = {
      ...validRawScanData,
      openings: [
        {
          category: { opening: {} },
          completedEdges: ["edge1"],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 2.0, 0.1],
          identifier: "opening1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 2.0],
            [0, 2.0]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithOpeningCompletedEdges));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonEmptyCompletedEdges).toBe(true);
  });

  it("should detect hasNonEmptyCompletedEdges for walls with completedEdges", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithWallCompletedEdges = {
      ...validRawScanData,
      walls: [
        {
          ...validRawScanData.walls[0],
          completedEdges: ["edge1"]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithWallCompletedEdges));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonEmptyCompletedEdges).toBe(true);
  });

  it("should detect hasNonEmptyCompletedEdges for windows with completedEdges", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithWindowCompletedEdges = {
      ...validRawScanData,
      windows: [
        {
          category: { window: {} },
          completedEdges: ["edge1"],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 1.5, 0.1],
          identifier: "window1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 1.5],
            [0, 1.5]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithWindowCompletedEdges));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasNonEmptyCompletedEdges).toBe(true);
  });

  it("should detect various object types in metadata", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithObjects = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { washerDryer: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { stove: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj2",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { table: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj3",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { chair: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj4",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { bed: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj5",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { sofa: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj6",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { dishwasher: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj7",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { oven: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj8",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { refrigerator: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj9",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { stairs: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj10",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { fireplace: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj11",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: {},
          category: { television: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj12",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithObjects));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasWasherDryer).toBe(true);
    expect(result?.hasStove).toBe(true);
    expect(result?.hasTable).toBe(true);
    expect(result?.hasChair).toBe(true);
    expect(result?.hasBed).toBe(true);
    expect(result?.hasSofa).toBe(true);
    expect(result?.hasDishwasher).toBe(true);
    expect(result?.hasOven).toBe(true);
    expect(result?.hasRefrigerator).toBe(true);
    expect(result?.hasStairs).toBe(true);
    expect(result?.hasFireplace).toBe(true);
    expect(result?.hasTelevision).toBe(true);
  });

  it("should detect hasFloorsWithParentId when floor has parentIdentifier", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithFloorParent = {
      ...validRawScanData,
      floors: [
        {
          ...validRawScanData.floors[0],
          parentIdentifier: "room1"
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithFloorParent));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasFloorsWithParentId).toBe(true);
  });

  it("should detect hasMultipleStories when walls have different story values", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanMultiStory = {
      ...validRawScanData,
      walls: [
        { ...validRawScanData.walls[0], story: 1 },
        { ...validRawScanData.walls[0], identifier: "wall2", story: 2 }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanMultiStory));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasMultipleStories).toBe(true);
    expect(result?.stories).toEqual([1, 2]);
  });

  it("should extract doorIsOpenCounts for Open, Closed, and Unknown doors", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithDoors = {
      ...validRawScanData,
      doors: [
        {
          category: { door: { isOpen: true } },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          category: { door: { isOpen: false } },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door2",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          category: { door: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door3",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithDoors));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.doorIsOpenCounts).toEqual({ Closed: 1, Open: 1, Unknown: 1 });
  });

  it("should extract objectAttributeCounts for various attribute types", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithAttributes = {
      ...validRawScanData,
      objects: [
        {
          attributes: { ChairType: "office", TableShapeType: "rectangular" },
          category: { chair: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: { ChairType: "office" },
          category: { chair: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj2",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          attributes: { ChairType: "dining" },
          category: { chair: {} },
          confidence: { high: {} },
          dimensions: [1, 1, 1],
          identifier: "obj3",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithAttributes));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.objectAttributeCounts).toEqual({
      ChairType: { dining: 1, office: 2 },
      TableShapeType: { rectangular: 1 }
    });
  });

  it("should extract wallsWithWindows, wallsWithDoors, wallsWithOpenings", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithEmbedded = {
      ...validRawScanData,
      doors: [
        {
          category: { door: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          category: { door: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door2",
          parentIdentifier: null,
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      openings: [
        {
          category: { opening: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 2.0, 0.1],
          identifier: "opening1",
          parentIdentifier: "wall2",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 2.0],
            [0, 2.0]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      windows: [
        {
          category: { window: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 1.5, 0.1],
          identifier: "window1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 1.5],
            [0, 1.5]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        {
          category: { window: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 1.5, 0.1],
          identifier: "window2",
          parentIdentifier: "wall3",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 1.5],
            [0, 1.5]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithEmbedded));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.wallsWithDoors).toBe(1);
    expect(result?.wallsWithWindows).toBe(2);
    expect(result?.wallsWithOpenings).toBe(1);
  });

  it("should extract vanityType as 'normal' when storage and sink intersect", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanWithVanity = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.2, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { sink: {} },
          confidence: { high: {} },
          dimensions: [0.4, 0.3, 0.4],
          identifier: "sink1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithVanity));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("normal");
    expect(result?.vanityLengths.length).toBe(1);
    expect(result?.vanityLengths[0]).toBeCloseTo(1.2, 1);
  });

  it("should extract vanityType as 'sink only' when sink exists but no storage intersects", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const farTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 10, 1];

    const rawScanSinkOnly = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.2, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: farTransform
        },
        {
          attributes: {},
          category: { sink: {} },
          confidence: { high: {} },
          dimensions: [0.5, 0.3, 0.4],
          identifier: "sink1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanSinkOnly));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("sink only");
  });

  it("should extract vanityType as 'storage only' when storage exists but no sink", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanStorageOnly = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.5, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanStorageOnly));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("storage only");
  });

  it("should extract vanityType as 'no vanity' when neither sink nor storage exists", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanNoVanity = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { toilet: {} },
          confidence: { high: {} },
          dimensions: [0.7, 0.4, 0.5],
          identifier: "toilet1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanNoVanity));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("no vanity");
  });

  it("should extract dimension data for walls with polygon corners", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithPolygonWalls = {
      ...validRawScanData,
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2.5, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [
            [0, 0, 0],
            [5, 0, 0],
            [5, 0, 2.5],
            [0, 0, 2.5]
          ],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithPolygonWalls));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.wallWidths.length).toBeGreaterThan(0);
    expect(result?.wallHeights.length).toBeGreaterThan(0);
    expect(result?.wallAreas.length).toBeGreaterThan(0);
    expect(result?.wallWidthHeightPairs.length).toBeGreaterThan(0);
  });

  it("should extract dimension data for windows and doors", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithWindowsDoors = {
      ...validRawScanData,
      doors: [
        {
          category: { door: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [0.9, 2.1, 0.1],
          identifier: "door1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [0.9, 0],
            [0.9, 2.1],
            [0, 2.1]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ],
      windows: [
        {
          category: { window: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.2, 1.5, 0.1],
          identifier: "window1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.2, 0],
            [1.2, 1.5],
            [0, 1.5]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithWindowsDoors));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.doorWidths).toEqual([0.9]);
    expect(result?.doorHeights).toEqual([2.1]);
    expect(result?.doorAreas[0]).toBeCloseTo(0.9 * 2.1, 2);
    expect(result?.windowWidths).toEqual([1.2]);
    expect(result?.windowHeights).toEqual([1.5]);
    expect(result?.windowAreas[0]).toBeCloseTo(1.2 * 1.5, 2);
  });

  it("should extract dimension data for openings", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithOpenings = {
      ...validRawScanData,
      openings: [
        {
          category: { opening: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: null,
          dimensions: [1.0, 2.0, 0.1],
          identifier: "opening1",
          parentIdentifier: "wall1",
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 2.0],
            [0, 2.0]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithOpenings));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.openingWidths).toEqual([1.0]);
    expect(result?.openingHeights).toEqual([2.0]);
    expect(result?.openingAreas[0]).toBeCloseTo(1.0 * 2.0, 2);
  });

  it("should extract floor dimensions from dimensions array", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithFloorDimensions = {
      ...validRawScanData,
      floors: [
        {
          category: { floor: {} },
          confidence: { high: {} },
          dimensions: [5, 3, 0.1],
          identifier: "floor1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: [],
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithFloorDimensions));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.floorLengths).toEqual([5]);
    expect(result?.floorWidths).toEqual([3]);
    expect(result?.floorWidthHeightPairs.length).toBe(1);
  });

  it("should extract tubLengths from bathtub objects", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithTub = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { bathtub: {} },
          confidence: { high: {} },
          dimensions: [1.5, 0.5, 0.7],
          identifier: "tub1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithTub));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.tubLengths).toEqual([1.5]);
  });

  it("should extract section labels from sections", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithSections = {
      ...validRawScanData,
      sections: [
        { center: [0, 0, 0], label: "bathroom", story: 1 },
        { center: [5, 5, 0], label: "bedroom", story: 1 }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithSections));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.sectionLabels).toEqual(["bathroom", "bedroom"]);
  });

  it("should skip objects with all-zero dimensions in vanity calculations", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanWithZeroDimensions = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [0, 0, 0],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { sink: {} },
          confidence: { high: {} },
          dimensions: [0.5, 0.3, 0.4],
          identifier: "sink1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithZeroDimensions));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("sink only");
  });

  it("should skip objects with invalid transform length in vanity calculations", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const shortTransform = [1, 0, 0, 0];

    const rawScanWithBadTransform = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.2, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: shortTransform
        },
        {
          attributes: {},
          category: { sink: {} },
          confidence: { high: {} },
          dimensions: [0.5, 0.3, 0.4],
          identifier: "sink1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithBadTransform));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("sink only");
  });

  it("should not intersect storage and sink on different stories", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanDifferentStories = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.2, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { sink: {} },
          confidence: { high: {} },
          dimensions: [0.5, 0.3, 0.4],
          identifier: "sink1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 2,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanDifferentStories));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("sink only");
  });

  it("should use largest storage when no sink exists", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanMultipleStorages = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [0.8, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.5, 0.5, 0.6],
          identifier: "storage2",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.0, 0.5, 0.6],
          identifier: "storage3",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanMultipleStorages));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("storage only");
    expect(result?.vanityLengths[0]).toBeCloseTo(1.5, 1);
  });

  it("should extract wall dimensions from dimensions array when no polygon corners", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithDimensionsOnly = {
      ...validRawScanData,
      walls: [
        {
          category: { wall: {} },
          confidence: { high: {} },
          dimensions: [5, 2.5, 0.2],
          identifier: "wall1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          polygonCorners: undefined,
          segments: [],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithDimensionsOnly));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.wallWidths).toEqual([5]);
    expect(result?.wallHeights).toEqual([2.5]);
    expect(result?.wallAreas[0]).toBeCloseTo(5 * 2.5, 2);
  });

  it("should not detect hasCurvedEmbedded if opening has undefined parentIdentifier", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithUndefinedParentOpening = {
      ...validRawScanData,
      openings: [
        {
          category: { opening: {} },
          completedEdges: [],
          confidence: { high: {} },
          curve: { radius: 1.8 },
          dimensions: [1.0, 2.0, 0.1],
          identifier: "opening1",
          parentIdentifier: undefined,
          polygonCorners: [
            [0, 0],
            [1.0, 0],
            [1.0, 2.0],
            [0, 2.0]
          ],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithUndefinedParentOpening));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedEmbedded).toBe(false);
  });

  it("should detect hasCurvedWall when wall has curve property", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithCurvedWall = {
      ...validRawScanData,
      walls: [
        {
          ...validRawScanData.walls[0],
          curve: { radius: 2.0 }
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithCurvedWall));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasCurvedWall).toBe(true);
  });

  it("should handle walls with undefined story by using default story index", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithUndefinedStory = {
      ...validRawScanData,
      walls: [
        {
          ...validRawScanData.walls[0],
          story: undefined
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithUndefinedStory));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.stories).toEqual([0]);
    expect(result?.hasMultipleStories).toBe(false);
  });

  it("should handle objects with invalid dimensions length in vanity extraction", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanWithBadDimensions = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.2, 0.5],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { sink: {} },
          confidence: { high: {} },
          dimensions: [0.5, 0.3, 0.4],
          identifier: "sink1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithBadDimensions));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("sink only");
  });

  it("should handle storage with zero or undefined first dimension in vanity length extraction", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanWithZeroLength = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [0, 0.5, 0.6],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithZeroLength));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityLengths.length).toBe(0);
    expect(result?.vanityType).toBe("storage only");
  });

  it("should handle nullish dimensions in storage reduce for largest storage", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const rawScanWithNullishDimensions = {
      ...validRawScanData,
      objects: [
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [null, 0.5, null] as unknown as number[],
          identifier: "storage1",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        },
        {
          attributes: {},
          category: { storage: {} },
          confidence: { high: {} },
          dimensions: [1.5, 0.5, 0.6],
          identifier: "storage2",
          modelPosition: [0, 0, 0],
          parentIdentifier: null,
          segments: [],
          story: 1,
          transform: identityTransform
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithNullishDimensions));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.vanityType).toBe("storage only");
    expect(result?.vanityLengths[0]).toBeCloseTo(1.5, 1);
  });

  it("should handle hasSoffit when wall has soffit", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockRawScanPath) {
        return true;
      }
      return false;
    });

    const rawScanWithSoffit = {
      ...validRawScanData,
      walls: [
        {
          ...validRawScanData.walls[0],
          hasSoffit: true
        }
      ]
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(rawScanWithSoffit));

    const result = extractRawScanMetadata(mockDir);
    expect(result?.hasSoffit).toBe(true);
  });
});
