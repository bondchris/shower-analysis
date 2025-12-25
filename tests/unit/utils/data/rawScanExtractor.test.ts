import * as fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  convertAreasToSquareFeet,
  convertLengthsToFeet,
  convertLengthsToInches,
  getArtifactsWithSmallWalls,
  getDoorAreas,
  getDoorIsOpenCounts,
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

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

// Simplify RawScan to a passthrough container for test fixtures
vi.mock("../../../../src/models/rawScan/rawScan", () => ({
  RawScan: function (this: Record<string, unknown>, data: unknown) {
    Object.assign(this, data as Record<string, unknown>);
  }
}));

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
        sections: [],
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
        sections: [],
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
      const mockRawScanWithSmallWall = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0.3, 0.3, 0.2], // length, height, width - height is 0.3m
            identifier: "w1",
            parentIdentifier: null,
            polygonCorners: [
              [0, 0, 0],
              [0.1, 0, 0],
              [0, 0.1, 0]
            ],
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      // Wall with area >= 1.5 sq ft: perimeter 2m * height 2m = 4 sq m = ~43 sq ft
      const mockRawScanWithLargeWall = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [2, 2, 0.2],
            identifier: "w1",
            parentIdentifier: null,
            polygonCorners: [
              [0, 0],
              [2, 0] // perimeter = 2m
            ],
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, "/");
        if (normalizedPath.includes("/dir1/")) {
          return JSON.stringify(mockRawScanWithSmallWall);
        }
        if (normalizedPath.includes("/dir2/")) {
          return JSON.stringify(mockRawScanWithLargeWall);
        }
        return JSON.stringify(mockRawScanWithSmallWall);
      });

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
      expect(result.has("/test/dir2")).toBe(false);
    });

    it("should return directories with walls smaller than 1.5 sq ft (from dimensions)", () => {
      // Wall with area < 1.5 sq ft: length 0.3m * height 0.3m = 0.09 sq m = ~0.97 sq ft
      const mockRawScanWithSmallWall = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0.3, 0.3, 0.2], // length, height, width
            identifier: "w1",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanWithSmallWall));

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
    });

    it("should stop checking after finding first small wall in an artifact", () => {
      // Artifact with multiple walls, first one is small
      const mockRawScanWithMultipleWalls = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0.3, 0.3, 0.2], // Small wall
            identifier: "w1",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          },
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [2, 2, 0.2], // Large wall (should not be checked)
            identifier: "w2",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanWithMultipleWalls));

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(1);
      expect(result.has("/test/dir1")).toBe(true);
    });

    it("should skip directories without rawScan.json", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(0);
    });

    it("should skip invalid rawScan files", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");

      const artifactDirs = ["/test/dir1"];
      const result = getArtifactsWithSmallWalls(artifactDirs);

      expect(result.size).toBe(0);
    });

    it("should skip walls without valid polygonCorners or dimensions", () => {
      const mockRawScanWithInvalidWalls = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            identifier: "w1",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
            // No polygonCorners or dimensions
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanWithInvalidWalls));

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
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: [{ confidence: { medium: {} } }]
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    const triangleWall = {
      dimensions: [1, 1], // height = 1
      polygonCorners: [
        [0, 0, 0],
        [0.1, 0, 0],
        [0, 0.1, 0]
      ],
      story: 1
    };

    const dimensionWall = {
      dimensions: [2, 3], // length * height = 6
      story: 1
    };

    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [triangleWall, dimensionWall],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const areas = getWallAreas(["/test/dir1"]);

    // Triangle perimeter ~0.341; area = perimeter * height(1) ≈ 0.341
    expect(areas.length).toBe(2);
    expect(areas[0]).toBeCloseTo(0.341, 3);
    expect(areas[1]).toBe(6);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getWallAreas([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getWallAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getWallAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip walls with invalid dimensions", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [
        { dimensions: [0, 0], story: 1 }, // zero dimensions
        { dimensions: [1], story: 1 }, // only one dimension
        { dimensions: [], story: 1 } // empty dimensions
      ],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const areas = getWallAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });
});

describe("getWindowAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract window areas from raw scan files", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: [
        { dimensions: [1, 2], parentIdentifier: "w1" }, // area = 2
        { dimensions: [0.5, 0.8], parentIdentifier: "w2" } // area = 0.4
      ]
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getWindowAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip windows with invalid dimensions", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: [
        { dimensions: [0, 1] }, // zero width
        { dimensions: [1, 0] }, // zero height
        { dimensions: [1] }, // only one dimension
        { dimensions: [] } // empty dimensions
      ]
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const areas = getWindowAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getWindowAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });
});

describe("getDoorAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract door areas from raw scan files", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [
        { confidence: { high: {} }, dimensions: [0.8, 2] }, // area = 1.6
        { confidence: { medium: {} }, dimensions: [1, 2.2] } // area = 2.2
      ],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getDoorAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip doors with invalid dimensions", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [
        { dimensions: [0, 2] }, // zero width
        { dimensions: [1, 0] }, // zero height
        { dimensions: [1] }, // only one dimension
        { dimensions: [] } // empty dimensions
      ],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const areas = getDoorAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getDoorAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });
});

describe("getOpeningAreas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract opening areas from raw scan files", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [
        { confidence: { high: {} }, dimensions: [1.2, 2.1] }, // area = 2.52
        { confidence: { low: {} }, dimensions: [0.9, 2.4] } // area = 2.16
      ],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getOpeningAreas(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip openings with invalid dimensions", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [],
      openings: [
        { dimensions: [0, 2] }, // zero width
        { dimensions: [1, 0] }, // zero height
        { dimensions: [1] }, // only one dimension
        { dimensions: [] } // empty dimensions
      ],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const areas = getOpeningAreas(["/test/dir1"]);
    expect(areas).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
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
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { category: { bathtub: {} }, dimensions: [1.5, 0.5, 0.8] }, // length = 1.5
        { category: { bathtub: {} }, dimensions: [1.8, 0.6, 0.9] }, // length = 1.8
        { category: { toilet: {} }, dimensions: [0.7, 0.4, 0.5] } // not a bathtub
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getTubLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip bathtubs with invalid dimensions", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { category: { bathtub: {} }, dimensions: [0] }, // zero length
        { category: { bathtub: {} }, dimensions: [] } // empty dimensions
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const lengths = getTubLengths(["/test/dir1"]);
    expect(lengths).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getTubLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });
});

describe("getDoorIsOpenCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count door isOpen values", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [
        { category: { door: { isOpen: true } }, confidence: { high: {} } },
        { category: { door: { isOpen: false } }, confidence: { high: {} } },
        { category: { door: { isOpen: true } }, confidence: { high: {} } },
        { category: { door: {} }, confidence: { high: {} } } // undefined isOpen
      ],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getDoorIsOpenCounts(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getDoorIsOpenCounts(["/test/dir1"]);
    expect(result).toEqual({});
  });
});

describe("getObjectAttributeCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count object attributes by type", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { attributes: { color: "red", style: "modern" }, category: { chair: {} } },
        { attributes: { color: "blue", style: "classic" }, category: { chair: {} } },
        { attributes: { style: "modern" }, category: { table: {} } },
        { attributes: {}, category: { sofa: {} } } // no matching attribute
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const styleCounts = getObjectAttributeCounts(["/test/dir1"], "style");
    expect(styleCounts["modern"]).toBe(2);
    expect(styleCounts["classic"]).toBe(1);

    const colorCounts = getObjectAttributeCounts(["/test/dir1"], "color");
    expect(colorCounts["red"]).toBe(1);
    expect(colorCounts["blue"]).toBe(1);
  });

  it("should skip non-string attribute values", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { attributes: { numericAttr: 42 }, category: { chair: {} } },
        { attributes: { boolAttr: true }, category: { chair: {} } },
        { attributes: { stringAttr: "value" }, category: { chair: {} } }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getObjectAttributeCounts(["/test/dir1"], "style");
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getObjectAttributeCounts(["/test/dir1"], "style");
    expect(result).toEqual({});
  });
});

describe("getWallEmbeddedCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should count walls with windows, doors, and openings", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [
        { confidence: { high: {} }, parentIdentifier: "wall1" },
        { confidence: { high: {} }, parentIdentifier: "wall2" },
        { confidence: { high: {} }, parentIdentifier: null } // null parentIdentifier
      ],
      floors: [],
      objects: [],
      openings: [
        { confidence: { high: {} }, parentIdentifier: "wall1" },
        { confidence: { high: {} }, parentIdentifier: undefined }, // undefined parentIdentifier
        { confidence: { high: {} }, parentIdentifier: null } // null parentIdentifier
      ],
      sections: [],
      story: 1,
      version: 2,
      walls: [
        { identifier: "wall1" },
        { identifier: "wall2" },
        { identifier: "wall3" },
        { identifier: "wall4" }
      ],
      windows: [
        { parentIdentifier: "wall1" },
        { parentIdentifier: "wall3" },
        { parentIdentifier: null } // null parentIdentifier
      ]
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

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
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getWallEmbeddedCounts(["/test/dir1"]);
    expect(result).toEqual({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getWallEmbeddedCounts(["/test/dir1"]);
    expect(result).toEqual({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });
  });

  it("should count unique walls only once even with multiple doors/windows", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [
        { confidence: { high: {} }, parentIdentifier: "wall1" },
        { confidence: { high: {} }, parentIdentifier: "wall1" } // same wall
      ],
      floors: [],
      objects: [],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [{ identifier: "wall1" }],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const counts = getWallEmbeddedCounts(["/test/dir1"]);
    expect(counts.totalWalls).toBe(1);
    expect(counts.wallsWithDoors).toBe(1); // only counted once
  });
});

// Mock extractRawScanMetadata for getSinkCounts tests
vi.mock("../../../../src/utils/room/metadata", () => ({
  extractRawScanMetadata: vi.fn()
}));

import { extractRawScanMetadata } from "../../../../src/utils/room/metadata";

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

  // Identity transform (no rotation, no translation)
  const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it("should return length of storage intersecting with sink", () => {
    // Storage and sink overlapping at origin
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [1.2, 0.5, 0.6], // length = 1.2
          story: 1,
          transform: identityTransform
        },
        {
          category: { sink: {} },
          dimensions: [0.4, 0.3, 0.4],
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(1.2);
  });

  it("should return sink length when no storage intersects sink", () => {
    // Sink at origin, storage far away (non-intersecting)
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [1.0, 0.5, 0.6],
          story: 1,
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 10, 1] // far away
        },
        {
          category: { sink: {} },
          dimensions: [0.5, 0.3, 0.4], // length = 0.5
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(0.5);
  });

  it("should return largest storage length when no sink exists", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [0.8, 0.5, 0.6],
          story: 1,
          transform: identityTransform
        },
        {
          category: { storage: {} },
          dimensions: [1.5, 0.5, 0.6], // largest = 1.5
          story: 1,
          transform: identityTransform
        },
        {
          category: { storage: {} },
          dimensions: [1.0, 0.5, 0.6],
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(1.5);
  });

  it("should return empty array when no vanity (no sink, no storage)", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { category: { toilet: {} }, dimensions: [0.7, 0.4, 0.5], story: 1, transform: identityTransform }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths).toEqual([]);
  });

  it("should return empty array when no artifacts provided", () => {
    const result = getVanityLengths([]);
    expect(result).toEqual([]);
  });

  it("should skip directories without rawScan.json", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getVanityLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getVanityLengths(["/test/dir1"]);
    expect(result).toEqual([]);
  });

  it("should skip objects with invalid dimensions or transforms", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [0, 0, 0], // all zero dimensions
          story: 1,
          transform: identityTransform
        },
        {
          category: { sink: {} },
          dimensions: [0.5, 0.3, 0.4],
          story: 1,
          transform: [1, 0, 0, 0] // invalid transform (not 16 elements)
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    // Should still find the sink if it has valid dimensions
    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(0.5);
  });

  it("should not intersect storage and sink on different stories", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [1.2, 0.5, 0.6],
          story: 1,
          transform: identityTransform
        },
        {
          category: { sink: {} },
          dimensions: [0.5, 0.3, 0.4],
          story: 2, // different story
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    // Should use sink (first sink found) since storage and sink don't intersect (different stories)
    const lengths = getVanityLengths(["/test/dir1"]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBe(0.5);
  });
});

describe("getVanityTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it("should classify as 'normal' when storage and sink intersect", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [1.2, 0.5, 0.6],
          story: 1,
          transform: identityTransform
        },
        {
          category: { sink: {} },
          dimensions: [0.4, 0.3, 0.4],
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["normal"]).toBe(1);
  });

  it("should classify as 'sink only' when sink exists but no storage intersection", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { sink: {} },
          dimensions: [0.5, 0.3, 0.4],
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["sink only"]).toBe(1);
  });

  it("should classify as 'storage only' when storage exists but no sink", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [1.0, 0.5, 0.6],
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["storage only"]).toBe(1);
  });

  it("should classify as 'no vanity' when neither sink nor storage exists", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { category: { toilet: {} }, dimensions: [0.7, 0.4, 0.5], story: 1, transform: identityTransform }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["no vanity"]).toBe(1);
  });

  it("should return empty object when no artifacts provided", () => {
    const result = getVanityTypes([]);
    expect(result).toEqual({});
  });

  it("should skip directories without rawScan.json", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = getVanityTypes(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should skip invalid rawScan files", () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("INVALID JSON");
    const result = getVanityTypes(["/test/dir1"]);
    expect(result).toEqual({});
  });

  it("should classify as 'sink only' when storage and sink are on different stories", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [1.2, 0.5, 0.6],
          story: 1,
          transform: identityTransform
        },
        {
          category: { sink: {} },
          dimensions: [0.4, 0.3, 0.4],
          story: 2, // different story
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["sink only"]).toBe(1);
  });

  it("should skip objects with invalid dimensions or transforms when building bounding boxes", () => {
    const mockRawScan = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        {
          category: { storage: {} },
          dimensions: [0, 0, 0], // all zero dimensions - skipped for bounding box
          story: 1,
          transform: identityTransform
        },
        {
          category: { sink: {} },
          dimensions: [0.4, 0.3, 0.4],
          story: 1,
          transform: [1, 0, 0, 0] // invalid transform (not 16 elements) - skipped for bounding box
        },
        {
          category: { storage: {} },
          dimensions: [1.2, 0.5], // only 2 dimensions - skipped for bounding box
          story: 1,
          transform: identityTransform
        }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScan));

    // Objects with invalid dimensions/transforms won't have bounding boxes built
    // But we still have a sink in the list, so result should be "sink only"
    const counts = getVanityTypes(["/test/dir1"]);
    expect(counts["sink only"]).toBe(1);
  });

  it("should count multiple artifacts with different vanity types", () => {
    const normalVanity = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [
        { category: { storage: {} }, dimensions: [1.2, 0.5, 0.6], story: 1, transform: identityTransform },
        { category: { sink: {} }, dimensions: [0.4, 0.3, 0.4], story: 1, transform: identityTransform }
      ],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    const sinkOnly = {
      coreModel: "test",
      doors: [],
      floors: [],
      objects: [{ category: { sink: {} }, dimensions: [0.5, 0.3, 0.4], story: 1, transform: identityTransform }],
      openings: [],
      sections: [],
      story: 1,
      version: 2,
      walls: [],
      windows: []
    };

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(JSON.stringify(normalVanity))
      .mockReturnValueOnce(JSON.stringify(sinkOnly));

    const counts = getVanityTypes(["/test/dir1", "/test/dir2"]);
    expect(counts["normal"]).toBe(1);
    expect(counts["sink only"]).toBe(1);
  });
});

