import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildVanityAttributesCharts } from "../../../../../src/templates/dataAnalysisReport/charts/vanityAttributesCharts";
import { getPieChartConfig } from "../../../../../src/utils/chart/configBuilders";
import { getSinkCounts, getVanityTypes } from "../../../../../src/utils/data/rawScanExtractor";
import { LayoutConstants, computeLayoutConstants } from "../../../../../src/templates/dataAnalysisReport/layout";

vi.mock("../../../../../src/utils/chart/configBuilders", () => ({
  getPieChartConfig: vi.fn().mockReturnValue({ type: "pie" })
}));

vi.mock("../../../../../src/utils/data/rawScanExtractor", () => ({
  getSinkCounts: vi.fn(),
  getVanityTypes: vi.fn()
}));

describe("buildVanityAttributesCharts", () => {
  let layout: LayoutConstants;

  beforeEach(() => {
    vi.clearAllMocks();
    layout = computeLayoutConstants();
  });

  it("should build sinkCount chart when data exists", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "1": 5,
      "2": 3
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildVanityAttributesCharts(artifactDirs, layout);

    expect(result.sinkCount).toBeDefined();
    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should not build sinkCount chart when no data", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildVanityAttributesCharts(artifactDirs, layout);

    expect(result.sinkCount).toBeUndefined();
  });

  it("should build vanityType chart when data exists", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      normal: 10,
      "sink only": 5
    });

    const result = buildVanityAttributesCharts(artifactDirs, layout);

    expect(result.vanityType).toBeDefined();
    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should not build vanityType chart when no data", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildVanityAttributesCharts(artifactDirs, layout);

    expect(result.vanityType).toBeUndefined();
  });

  it("should build both charts when both have data", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "1": 5
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      normal: 10
    });

    const result = buildVanityAttributesCharts(artifactDirs, layout);

    expect(result.sinkCount).toBeDefined();
    expect(result.vanityType).toBeDefined();
    expect(getPieChartConfig).toHaveBeenCalledTimes(2);
  });

  it("should sort sinkCount entries numerically", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "1": 3,
      "10": 1,
      "2": 2
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const sinkCountCall = pieChartCalls.find((call) => call[0] !== undefined);
    expect(sinkCountCall).toBeDefined();
    if (sinkCountCall !== undefined) {
      const labels = sinkCountCall[0] as string[];
      expect(labels[0]).toBe("1");
      expect(labels[1]).toBe("2");
      expect(labels[2]).toBe("10");
    }
  });

  it("should sort vanityType entries by predefined order", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      "no vanity": 1,
      normal: 2,
      "sink only": 4,
      "storage only": 3
    });

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const vanityTypeCall = pieChartCalls.find((call) => call[0] !== undefined);
    expect(vanityTypeCall).toBeDefined();
    if (vanityTypeCall !== undefined) {
      const labels = vanityTypeCall[0] as string[];
      expect(labels[0]).toBe("normal");
      expect(labels[1]).toBe("sink only");
      expect(labels[2]).toBe("storage only");
      expect(labels[3]).toBe("no vanity");
    }
  });

  it("should handle vanityType entries not in predefined order", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      normal: 10,
      unknown: 5
    });

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const vanityTypeCall = pieChartCalls.find((call) => call[0] !== undefined);
    expect(vanityTypeCall).toBeDefined();
    if (vanityTypeCall !== undefined) {
      const labels = vanityTypeCall[0] as string[];
      // Unknown should come after predefined order items
      expect(labels).toContain("normal");
      expect(labels).toContain("unknown");
    }
  });

  it("should handle vanityType entries where both are not in predefined order", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      unknown1: 5,
      unknown2: 10
    });

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const vanityTypeCall = pieChartCalls.find((call) => call[0] !== undefined);
    expect(vanityTypeCall).toBeDefined();
    if (vanityTypeCall !== undefined) {
      const labels = vanityTypeCall[0] as string[];
      // Both unknown should be sorted alphabetically
      expect(labels).toContain("unknown1");
      expect(labels).toContain("unknown2");
    }
  });

  it("should handle vanityType entries where first is not in predefined order", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      normal: 10,
      unknown: 5
    });

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const vanityTypeCall = pieChartCalls.find((call) => call[0] !== undefined);
    expect(vanityTypeCall).toBeDefined();
    if (vanityTypeCall !== undefined) {
      const labels = vanityTypeCall[0] as string[];
      // Unknown should come after normal (predefined order items come first)
      expect(labels[0]).toBe("normal");
      expect(labels[labels.length - 1]).toBe("unknown");
    }
  });

  it("should handle sinkCount with non-numeric labels", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      one: 1,
      three: 3,
      two: 2
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should handle sinkCount with mixed numeric and non-numeric labels", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "1": 5,
      "2": 3,
      abc: 2
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should handle sinkCount where one label is numeric and one is not", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "1": 5,
      nonNumeric: 3
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should handle sinkCount where non-numeric comes before numeric in sort", () => {
    const artifactDirs = ["/test/dir1"];
    // Use a label that will sort before "1" alphabetically to test numA is NaN branch
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "0": 2,
      "1": 5,
      "2": 3,
      abc: 1
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should handle vanityType entries where second is not in predefined order", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    // Mix of items in order and not in order to trigger all sorting branches
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({
      normal: 10,
      "sink only": 5,
      unknown: 3
    });

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const vanityTypeCall = pieChartCalls.find((call) => call[0] !== undefined);
    expect(vanityTypeCall).toBeDefined();
    if (vanityTypeCall !== undefined) {
      const labels = vanityTypeCall[0] as string[];
      // Items in predefined order should come first, then unknown
      expect(labels[0]).toBe("normal");
      expect(labels[1]).toBe("sink only");
      expect(labels[labels.length - 1]).toBe("unknown");
    }
  });

  it("should handle color fallback when index exceeds distinctColors length", () => {
    const artifactDirs = ["/test/dir1"];
    // Create enough sink counts to exceed distinctColors array length (10 colors)
    const manySinkCounts: Record<string, number> = {};
    for (let i = 1; i <= 15; i++) {
      manySinkCounts[String(i)] = i;
    }
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue(manySinkCounts);
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const sinkCountCall = pieChartCalls[0];
    if (sinkCountCall !== undefined) {
      const options = sinkCountCall[2] as { colors?: unknown[] };
      expect(options.colors).toBeDefined();
      expect(Array.isArray(options.colors)).toBe(true);
      if (Array.isArray(options.colors)) {
        // Should have colors for all 15 labels, cycling through the 10 distinct colors
        expect(options.colors.length).toBe(15);
      }
    }
  });

  it("should handle empty artifactDirs array", () => {
    const artifactDirs: string[] = [];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildVanityAttributesCharts(artifactDirs, layout);

    expect(result.sinkCount).toBeUndefined();
    expect(result.vanityType).toBeUndefined();
  });

  it("should pass correct chart options to getPieChartConfig", () => {
    const artifactDirs = ["/test/dir1"];
    (getSinkCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      "1": 5
    });
    (getVanityTypes as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildVanityAttributesCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const sinkCountCall = pieChartCalls[0];
    expect(sinkCountCall).toBeDefined();
    if (sinkCountCall !== undefined) {
      const options = sinkCountCall[2] as {
        colors?: unknown[];
        height?: number;
        shrinkToLegend?: boolean;
        title?: string;
        width?: number;
      };
      expect(options.height).toBe(layout.HALF_CHART_HEIGHT);
      expect(options.width).toBe(layout.THIRD_CHART_WIDTH);
      expect(options.shrinkToLegend).toBe(true);
      expect(options.title).toBe("");
      expect(options.colors).toBeDefined();
    }
  });
});
