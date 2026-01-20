import * as fs from "fs";
import { vi } from "vitest";

import { RawScanMetadata } from "../../../../src/models/rawScan/rawScanMetadata";

/**
 * Creates a minimal mock RawScanMetadata with default values.
 * Override specific fields as needed for each test.
 */
export function createMockMetadata(overrides: Partial<RawScanMetadata> = {}): RawScanMetadata {
  const defaults: RawScanMetadata = {
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
    windowAreas: [],
    windowCount: 0,
    windowHeights: [],
    windowOutlines: [],
    windowWidthHeightPairs: [],
    windowWidths: []
  };
  return { ...defaults, ...overrides };
}

/**
 * Helper to set up fs mocks for extractRawScanMetadata.
 * Ensures cache doesn't exist (forces extraction from rawScan.json) and provides rawScan.json content.
 */
export function setupFsMocksForMetadata(rawScanContent: unknown): void {
  (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
    if (filePath.includes("rawScanMetadata.json")) {
      return false;
    }
    return filePath.includes("rawScan.json");
  });
  (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
    if (!filePath.includes("rawScan.json")) {
      return "";
    }
    return JSON.stringify(rawScanContent);
  });
  (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
    return undefined;
  });
}

export function mockRawScanClass(): void {
  vi.mock("../../../../src/models/rawScan/rawScan", () => ({
    RawScan: function (this: Record<string, unknown>, data: unknown) {
      Object.assign(this, data as Record<string, unknown>);
    }
  }));
}
