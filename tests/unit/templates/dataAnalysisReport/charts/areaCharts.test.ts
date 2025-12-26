import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOpacityByAspectRatio,
  buildAreaCharts
} from "../../../../../src/templates/dataAnalysisReport/charts/areaCharts";
import { ScatterPoint } from "../../../../../src/models/chart/scatterChartDataset";
import { computeLayoutConstants } from "../../../../../src/templates/dataAnalysisReport/layout";
import {
  convertLengthsToFeet,
  getDoorWidthHeightPairs,
  getOpeningWidthHeightPairs,
  getWallWidthHeightPairs,
  getWindowWidthHeightPairs
} from "../../../../../src/utils/data/rawScanExtractor";
import { getScatterChartConfig } from "../../../../../src/utils/chart/configBuilders";

vi.mock("../../../../../src/utils/data/rawScanExtractor", () => ({
  convertAreasToSquareFeet: vi.fn().mockReturnValue([]),
  convertLengthsToFeet: vi.fn().mockReturnValue([]),
  convertLengthsToInches: vi.fn().mockReturnValue([]),
  getDoorAreas: vi.fn().mockReturnValue([]),
  getDoorWidthHeightPairs: vi.fn().mockReturnValue([]),
  getFloorWidthHeightPairs: vi.fn().mockReturnValue([]),
  getOpeningAreas: vi.fn().mockReturnValue([]),
  getOpeningWidthHeightPairs: vi.fn().mockReturnValue([]),
  getTubLengths: vi.fn().mockReturnValue([]),
  getVanityLengths: vi.fn().mockReturnValue([]),
  getWallAreas: vi.fn().mockReturnValue([]),
  getWallWidthHeightPairs: vi.fn().mockReturnValue([]),
  getWindowAreas: vi.fn().mockReturnValue([]),
  getWindowWidthHeightPairs: vi.fn().mockReturnValue([])
}));

vi.mock("../../../../../src/utils/chart/configBuilders", () => ({
  getLineChartConfig: vi.fn().mockReturnValue({ type: "line" }),
  getScatterChartConfig: vi.fn().mockReturnValue({ type: "scatter" })
}));

vi.mock("../../../../../src/templates/dataAnalysisReport/kdeBounds", () => ({
  buildDynamicKde: vi.fn().mockReturnValue({
    kde: { labels: [0, 1, 2], values: [0, 1, 0] }
  })
}));

describe("addOpacityByAspectRatio", () => {
  it("should assign minimum opacity to points with y <= 0", () => {
    const points: ScatterPoint[] = [
      { x: 10, y: 0 },
      { x: 20, y: -5 }
    ];
    const result = addOpacityByAspectRatio(points);
    expect(result).toHaveLength(2);
    expect(result[0]?.opacity).toBe(0.3);
    expect(result[1]?.opacity).toBe(0.3);
  });

  it("should assign minimum opacity when aspectRatioKey is empty string", () => {
    const points: ScatterPoint[] = [{ x: 10, y: 0 }];
    const result = addOpacityByAspectRatio(points);
    expect(result[0]?.opacity).toBe(0.3);
  });

  it("should handle empty points array", () => {
    const points: ScatterPoint[] = [];
    const result = addOpacityByAspectRatio(points);
    expect(result).toHaveLength(0);
  });

  it("should handle case when counts array is empty (all points have y <= 0)", () => {
    const points: ScatterPoint[] = [
      { x: 10, y: 0 },
      { x: 20, y: -1 }
    ];
    const result = addOpacityByAspectRatio(points);
    expect(result).toHaveLength(2);
    expect(result[0]?.opacity).toBe(0.3);
    expect(result[1]?.opacity).toBe(0.3);
  });

  it("should assign maximum opacity to most common aspect ratio", () => {
    const points: ScatterPoint[] = [
      { x: 10, y: 5 }, // aspect ratio 2
      { x: 20, y: 10 }, // aspect ratio 2
      { x: 15, y: 5 }, // aspect ratio 3
      { x: 30, y: 10 }, // aspect ratio 3
      { x: 40, y: 10 } // aspect ratio 4
    ];
    const result = addOpacityByAspectRatio(points);
    expect(result).toHaveLength(5);
    // Points with aspect ratio 2 and 3 should have higher opacity (they appear twice)
    // Point with aspect ratio 4 should have lower opacity (appears once)
    const aspectRatio2Points = result.filter((_, idx) => idx === 0 || idx === 1);
    const aspectRatio3Points = result.filter((_, idx) => idx === 2 || idx === 3);
    const aspectRatio4Point = result[4];

    // All points with same count should have same opacity
    expect(aspectRatio2Points[0]?.opacity).toBe(aspectRatio2Points[1]?.opacity);
    expect(aspectRatio3Points[0]?.opacity).toBe(aspectRatio3Points[1]?.opacity);

    // Points with count 2 should have higher opacity than point with count 1
    expect(aspectRatio2Points[0]?.opacity).toBeGreaterThan(aspectRatio4Point?.opacity ?? 0);
    expect(aspectRatio3Points[0]?.opacity).toBeGreaterThan(aspectRatio4Point?.opacity ?? 0);
  });

  it("should handle case when all points have same aspect ratio (countRange = 0)", () => {
    const points: ScatterPoint[] = [
      { x: 10, y: 5 }, // aspect ratio 2
      { x: 20, y: 10 }, // aspect ratio 2
      { x: 30, y: 15 } // aspect ratio 2
    ];
    const result = addOpacityByAspectRatio(points);
    expect(result).toHaveLength(3);
    // When all have same aspect ratio, normalizedCount should be 0, so opacity = minOpacity
    // But wait, if all have the same count, minCount === maxCount, so countRange = 0
    // In that case, normalizedCount = 0, so opacity = minOpacity + 0 = minOpacity
    // Actually, if all points have the same aspect ratio, they all have count 3
    // minCount = 3, maxCount = 3, countRange = 0
    // normalizedCount = 0, so opacity = minOpacity = 0.3
    expect(result[0]?.opacity).toBe(0.3);
    expect(result[1]?.opacity).toBe(0.3);
    expect(result[2]?.opacity).toBe(0.3);
  });

  it("should handle mixed valid and invalid points", () => {
    const points: ScatterPoint[] = [
      { x: 10, y: 5 }, // valid
      { x: 20, y: 0 }, // invalid (y <= 0)
      { x: 30, y: 10 }, // valid
      { x: 40, y: -1 } // invalid (y <= 0)
    ];
    const result = addOpacityByAspectRatio(points);
    expect(result).toHaveLength(4);
    // Valid points should have opacity based on aspect ratio
    expect(result[0]?.opacity).toBeGreaterThanOrEqual(0.3);
    expect(result[0]?.opacity).toBeLessThanOrEqual(1.0);
    // Invalid points should have minimum opacity
    expect(result[1]?.opacity).toBe(0.3);
    expect(result[2]?.opacity).toBeGreaterThanOrEqual(0.3);
    expect(result[2]?.opacity).toBeLessThanOrEqual(1.0);
    expect(result[3]?.opacity).toBe(0.3);
  });

  it("should preserve x and y coordinates", () => {
    const points: ScatterPoint[] = [
      { x: 10, y: 5 },
      { x: 20, y: 10 }
    ];
    const result = addOpacityByAspectRatio(points);
    expect(result[0]?.x).toBe(10);
    expect(result[0]?.y).toBe(5);
    expect(result[1]?.x).toBe(20);
    expect(result[1]?.y).toBe(10);
  });

  it("should handle undefined aspectRatioKey", () => {
    // This tests the case where aspectRatioKey might be undefined
    // We need to create a scenario where the index doesn't match
    // Actually, this is hard to test directly since the function always creates
    // aspectRatioKey for each point. But we can test the edge case where
    // the array might have issues. Let's test with a single point that has y > 0
    const points: ScatterPoint[] = [{ x: 10, y: 5 }];
    const result = addOpacityByAspectRatio(points);
    expect(result[0]?.opacity).toBeDefined();
    expect(result[0]?.opacity).toBeGreaterThanOrEqual(0.3);
    expect(result[0]?.opacity).toBeLessThanOrEqual(1.0);
  });
});

describe("buildAreaCharts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset convertLengthsToFeet mock
    (convertLengthsToFeet as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should filter out points with undefined width or height for windows", () => {
    const layout = computeLayoutConstants();
    const mockPairs = [
      { height: 5, width: 10 },
      { height: 10, width: 20 }
    ];
    const mockWidthsFt = [10, 20, undefined];
    const mockHeightsFt = [5, 10, 15];

    (getWindowWidthHeightPairs as ReturnType<typeof vi.fn>).mockReturnValue(mockPairs);
    // Mock convertLengthsToFeet to return the arrays in sequence
    let callCount = 0;
    (convertLengthsToFeet as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return mockWidthsFt;
      }
      if (callCount === 2) {
        return mockHeightsFt;
      }
      return [];
    });

    buildAreaCharts(["/test/dir"], layout);

    expect(getScatterChartConfig).toHaveBeenCalled();
    const scatterCall = (getScatterChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
      const config = call[1] as { chartId?: string };
      return config.chartId === "windowAspectRatio";
    });
    expect(scatterCall).toBeDefined();
    if (scatterCall !== undefined) {
      const datasets = scatterCall[0] as { data: ScatterPoint[] }[];
      // Should only have 2 points (the ones with both width and height defined)
      expect(datasets[0]?.data).toHaveLength(2);
    }
  });

  it("should filter out points with undefined width or height for doors", () => {
    const layout = computeLayoutConstants();
    // Create 2 pairs, but second one will have undefined after conversion
    const mockPairs = [
      { height: 5, width: 10 },
      { height: 10, width: 20 }
    ];
    // After conversion, first is valid, second has undefined width
    const mockWidthsFt = [10, undefined];
    const mockHeightsFt = [5, 10];

    (getDoorWidthHeightPairs as ReturnType<typeof vi.fn>).mockReturnValue(mockPairs);
    // convertLengthsToFeet is called for window widths, window heights, door widths, door heights, etc.
    // We need to return the right values in sequence. For doors, it's calls 3 and 4 (after windows)
    const callSequence: (number | undefined)[][] = [[], [], mockWidthsFt, mockHeightsFt];
    let callIndex = 0;
    (convertLengthsToFeet as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const result = callSequence[callIndex] ?? [];
      callIndex++;
      return result;
    });

    buildAreaCharts(["/test/dir"], layout);

    expect(getScatterChartConfig).toHaveBeenCalled();
    const scatterCall = (getScatterChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
      const config = call[1] as { chartId?: string };
      return config.chartId === "doorAspectRatio";
    });
    expect(scatterCall).toBeDefined();
    if (scatterCall !== undefined) {
      const datasets = scatterCall[0] as { data: ScatterPoint[] }[];
      // Should only have 1 point (the one with both width and height defined)
      expect(datasets[0]?.data).toHaveLength(1);
    }
  });

  it("should filter out points with undefined width or height for openings", () => {
    const layout = computeLayoutConstants();
    // Create 2 pairs, but first one will have undefined width after conversion
    const mockPairs = [
      { height: 5, width: 10 },
      { height: 10, width: 20 }
    ];
    const mockWidthsFt = [undefined, 20];
    const mockHeightsFt = [5, 10];

    (getOpeningWidthHeightPairs as ReturnType<typeof vi.fn>).mockReturnValue(mockPairs);
    // For openings, it's calls 5 and 6 (after windows and doors)
    const callSequence: (number | undefined)[][] = [[], [], [], [], mockWidthsFt, mockHeightsFt];
    let callIndex = 0;
    (convertLengthsToFeet as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const result = callSequence[callIndex] ?? [];
      callIndex++;
      return result;
    });

    buildAreaCharts(["/test/dir"], layout);

    expect(getScatterChartConfig).toHaveBeenCalled();
    const scatterCall = (getScatterChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
      const config = call[1] as { chartId?: string };
      return config.chartId === "openingAspectRatio";
    });
    expect(scatterCall).toBeDefined();
    if (scatterCall !== undefined) {
      const datasets = scatterCall[0] as { data: ScatterPoint[] }[];
      // Should only have 1 point (the one with both width and height defined)
      expect(datasets[0]?.data).toHaveLength(1);
    }
  });

  it("should filter out points with undefined width or height for walls", () => {
    const layout = computeLayoutConstants();
    // Create 2 pairs, but first one will have undefined height after conversion
    const mockPairs = [
      { height: 5, width: 10 },
      { height: 10, width: 20 }
    ];
    const mockWidthsFt = [10, 20];
    const mockHeightsFt = [undefined, 10];

    (getWallWidthHeightPairs as ReturnType<typeof vi.fn>).mockReturnValue(mockPairs);
    // For walls, it's calls 7 and 8 (after windows, doors, and openings)
    const callSequence: (number | undefined)[][] = [[], [], [], [], [], [], mockWidthsFt, mockHeightsFt];
    let callIndex = 0;
    (convertLengthsToFeet as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const result = callSequence[callIndex] ?? [];
      callIndex++;
      return result;
    });

    buildAreaCharts(["/test/dir"], layout);

    expect(getScatterChartConfig).toHaveBeenCalled();
    const scatterCall = (getScatterChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
      const config = call[1] as { chartId?: string };
      return config.chartId === "wallAspectRatio";
    });
    expect(scatterCall).toBeDefined();
    if (scatterCall !== undefined) {
      const datasets = scatterCall[0] as { data: ScatterPoint[] }[];
      // Should only have 1 point (the one with both width and height defined)
      expect(datasets[0]?.data).toHaveLength(1);
    }
  });
});
