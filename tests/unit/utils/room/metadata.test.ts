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
      hasMultipleStories: false,
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
});
