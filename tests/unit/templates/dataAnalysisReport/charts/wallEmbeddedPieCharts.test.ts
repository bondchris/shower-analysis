import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildWallEmbeddedPieCharts } from "../../../../../src/templates/dataAnalysisReport/charts/wallEmbeddedPieCharts";
import { getPieChartConfig } from "../../../../../src/utils/chart/configBuilders";
import { getWallEmbeddedCounts } from "../../../../../src/utils/data/rawScanExtractor";
import { LayoutConstants, computeLayoutConstants } from "../../../../../src/templates/dataAnalysisReport/layout";

vi.mock("../../../../../src/utils/chart/configBuilders", () => ({
  getPieChartConfig: vi.fn().mockReturnValue({ type: "pie" })
}));

vi.mock("../../../../../src/utils/data/rawScanExtractor", () => ({
  getWallEmbeddedCounts: vi.fn()
}));

describe("buildWallEmbeddedPieCharts", () => {
  let layout: LayoutConstants;

  beforeEach(() => {
    vi.clearAllMocks();
    layout = computeLayoutConstants();
  });

  it("should build all three wall embedded charts", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 10,
      wallsWithDoors: 2,
      wallsWithOpenings: 4,
      wallsWithWindows: 3
    });

    const result = buildWallEmbeddedPieCharts(artifactDirs, layout);

    expect(result.wallsWithWindows).toBeDefined();
    expect(result.wallsWithDoors).toBeDefined();
    expect(result.wallsWithOpenings).toBeDefined();
    expect(getPieChartConfig).toHaveBeenCalledTimes(3);
  });

  it("should calculate walls without windows/doors/openings correctly", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 10,
      wallsWithDoors: 2,
      wallsWithOpenings: 4,
      wallsWithWindows: 3
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Windows") && labels.includes("Without Windows");
    });
    expect(windowsCall).toBeDefined();
    if (windowsCall !== undefined) {
      const data = windowsCall[1] as number[];
      expect(data[0]).toBe(3); // wallsWithWindows
      expect(data[1]).toBe(7); // wallsWithoutWindows (10 - 3)
    }
  });

  it("should use default values when totalWalls is 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Windows");
    });
    expect(windowsCall).toBeDefined();
    if (windowsCall !== undefined) {
      const data = windowsCall[1] as number[];
      expect(data[0]).toBe(0);
      expect(data[1]).toBe(0);
    }
  });

  it("should use correct colors for each chart type", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 10,
      wallsWithDoors: 2,
      wallsWithOpenings: 4,
      wallsWithWindows: 3
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const options = call[2] as { colors?: string[] };
      return Boolean(options.colors?.includes("#4E79A7")); // Blue for windows
    });
    expect(windowsCall).toBeDefined();

    const doorsCall = calls.find((call) => {
      const options = call[2] as { colors?: string[] };
      return Boolean(options.colors?.includes("#F28E2B")); // Orange for doors
    });
    expect(doorsCall).toBeDefined();

    const openingsCall = calls.find((call) => {
      const options = call[2] as { colors?: string[] };
      return Boolean(options.colors?.includes("#E15759")); // Red for openings
    });
    expect(openingsCall).toBeDefined();
  });

  it("should use layout constants for chart dimensions", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 10,
      wallsWithDoors: 2,
      wallsWithOpenings: 4,
      wallsWithWindows: 3
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const firstCall = calls[0];
    if (firstCall !== undefined) {
      const options = firstCall[2] as { height?: number; width?: number };
      expect(options.height).toBe(layout.HALF_CHART_HEIGHT);
      expect(options.width).toBe(layout.THIRD_CHART_WIDTH);
    }
  });

  it("should handle empty artifactDirs array", () => {
    const artifactDirs: string[] = [];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    const result = buildWallEmbeddedPieCharts(artifactDirs, layout);

    expect(result.wallsWithWindows).toBeDefined();
    expect(result.wallsWithDoors).toBeDefined();
    expect(result.wallsWithOpenings).toBeDefined();
  });

  it("should handle all walls having windows/doors/openings", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 10,
      wallsWithDoors: 10,
      wallsWithOpenings: 10,
      wallsWithWindows: 10
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Windows");
    });
    expect(windowsCall).toBeDefined();
    if (windowsCall !== undefined) {
      const data = windowsCall[1] as number[];
      expect(data[0]).toBe(10); // All walls have windows
      expect(data[1]).toBe(0); // No walls without windows
    }
  });

  it("should use default colors when distinctColors array values are undefined", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 10,
      wallsWithDoors: 2,
      wallsWithOpenings: 4,
      wallsWithWindows: 3
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    // Verify all three charts were created with colors
    expect(calls.length).toBe(3);
    for (const call of calls) {
      const options = call[2] as { colors?: string[] };
      expect(options.colors).toBeDefined();
      if (options.colors !== undefined) {
        expect(options.colors.length).toBe(2);
        // Colors should be defined (either from array or defaults)
        expect(options.colors[0]).toBeDefined();
        expect(options.colors[1]).toBeDefined();
      }
    }
  });

  it("should handle negative totalWalls edge case", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: -1,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Windows");
    });
    expect(windowsCall).toBeDefined();
    if (windowsCall !== undefined) {
      const data = windowsCall[1] as number[];
      // Should use default values when totalWalls <= 0
      expect(data[0]).toBe(0);
      expect(data[1]).toBe(0);
    }
  });

  it("should verify all three charts use the false branch when totalWalls is 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(3);
    // All three charts should use default values [0, 0] (false branch of ternary)
    for (const call of calls) {
      const data = call[1] as number[];
      expect(data).toEqual([0, 0]);
    }
  });

  it("should verify doors chart uses false branch when totalWalls is 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const doorsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Doors");
    });
    expect(doorsCall).toBeDefined();
    if (doorsCall !== undefined) {
      const data = doorsCall[1] as number[];
      // Should use false branch: [defaultWallsCount, defaultWallsCount]
      expect(data).toEqual([0, 0]);
    }
  });

  it("should verify openings chart uses false branch when totalWalls is 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 0,
      wallsWithDoors: 0,
      wallsWithOpenings: 0,
      wallsWithWindows: 0
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const openingsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Openings");
    });
    expect(openingsCall).toBeDefined();
    if (openingsCall !== undefined) {
      const data = openingsCall[1] as number[];
      // Should use false branch: [defaultWallsCount, defaultWallsCount]
      expect(data).toEqual([0, 0]);
    }
  });

  it("should use true branch when totalWalls is exactly 1", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 1,
      wallsWithDoors: 1,
      wallsWithOpenings: 0,
      wallsWithWindows: 1
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Windows");
    });
    expect(windowsCall).toBeDefined();
    if (windowsCall !== undefined) {
      const data = windowsCall[1] as number[];
      // Should use true branch: [wallsWithWindows, wallsWithoutWindows]
      expect(data[0]).toBe(1);
      expect(data[1]).toBe(0); // 1 - 1 = 0
    }
  });

  it("should verify windows chart uses true branch when totalWalls is greater than 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 5,
      wallsWithDoors: 2,
      wallsWithOpenings: 3,
      wallsWithWindows: 1
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const windowsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Windows");
    });
    expect(windowsCall).toBeDefined();
    if (windowsCall !== undefined) {
      const data = windowsCall[1] as number[];
      // Should use true branch: [wallsWithWindows, wallsWithoutWindows]
      expect(data[0]).toBe(1);
      expect(data[1]).toBe(4); // 5 - 1 = 4
    }
  });

  it("should verify doors chart uses true branch when totalWalls is greater than 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 5,
      wallsWithDoors: 2,
      wallsWithOpenings: 3,
      wallsWithWindows: 1
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const doorsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Doors");
    });
    expect(doorsCall).toBeDefined();
    if (doorsCall !== undefined) {
      const data = doorsCall[1] as number[];
      // Should use true branch: [wallsWithDoors, wallsWithoutDoors]
      expect(data[0]).toBe(2);
      expect(data[1]).toBe(3); // 5 - 2 = 3
    }
  });

  it("should verify openings chart uses true branch when totalWalls is greater than 0", () => {
    const artifactDirs = ["/test/dir1"];
    (getWallEmbeddedCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      totalWalls: 5,
      wallsWithDoors: 2,
      wallsWithOpenings: 3,
      wallsWithWindows: 1
    });

    buildWallEmbeddedPieCharts(artifactDirs, layout);

    const calls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const openingsCall = calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("With Openings");
    });
    expect(openingsCall).toBeDefined();
    if (openingsCall !== undefined) {
      const data = openingsCall[1] as number[];
      // Should use true branch: [wallsWithOpenings, wallsWithoutOpenings]
      expect(data[0]).toBe(3);
      expect(data[1]).toBe(2); // 5 - 3 = 2
    }
  });
});
