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
    const cachedData: Partial<RawScanMetadata> = {
      doorCount: 0,
      hasCurvedEmbedded: false,
      hasLowCeiling: false,
      hasMultipleStories: false,
      hasNonRectangularEmbedded: false,
      hasUnparentedEmbedded: false,
      openingCount: 0,
      roomAreaSqFt: 500,
      sectionLabels: [],
      stories: [],
      toiletCount: 1,
      wallCount: 4,
      windowCount: 0
    };

    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(cachedData));

    const result = extractRawScanMetadata(mockDir);

    expect(fs.existsSync).toHaveBeenCalledWith(mockCachePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, "utf-8");
    expect(result).toEqual(cachedData);
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
});
