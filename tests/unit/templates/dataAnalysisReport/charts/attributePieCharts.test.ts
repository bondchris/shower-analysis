import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAttributePieCharts } from "../../../../../src/templates/dataAnalysisReport/charts/attributePieCharts";
import { getPieChartConfig } from "../../../../../src/utils/chart/configBuilders";
import { getDoorIsOpenCounts, getObjectAttributeCounts } from "../../../../../src/utils/data/rawScanExtractor";
import { LayoutConstants, computeLayoutConstants } from "../../../../../src/templates/dataAnalysisReport/layout";

let startCaseMock: ((label: string) => string) | null = null;

vi.mock("lodash", async () => {
  const actual = await vi.importActual<typeof import("lodash")>("lodash");

  return {
    ...actual,
    startCase: (label: string) => {
      if (startCaseMock !== null) {
        return startCaseMock(label);
      }
      return actual.startCase(label);
    }
  };
});

vi.mock("../../../../../src/utils/chart/configBuilders", () => ({
  getPieChartConfig: vi.fn().mockReturnValue({ type: "pie" })
}));

vi.mock("../../../../../src/utils/data/rawScanExtractor", () => ({
  getDoorIsOpenCounts: vi.fn(),
  getObjectAttributeCounts: vi.fn()
}));

describe("buildAttributePieCharts", () => {
  let layout: LayoutConstants;

  beforeEach(() => {
    vi.clearAllMocks();
    startCaseMock = null;
    layout = computeLayoutConstants();
  });

  it("should build doorIsOpen chart when data exists", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Closed: 3,
      Open: 5
    });
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildAttributePieCharts(artifactDirs, layout);

    expect(result.doorIsOpen).toBeDefined();
    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should not build doorIsOpen chart when no data", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildAttributePieCharts(artifactDirs, layout);

    expect(result.doorIsOpen).toBeUndefined();
  });

  it("should build attribute charts for all attribute types", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      existing: 3,
      missing: 2
    });

    const result = buildAttributePieCharts(artifactDirs, layout);

    expect(result.chairArmType).toBeDefined();
    expect(result.chairBackType).toBeDefined();
    expect(result.chairLegType).toBeDefined();
    expect(result.chairType).toBeDefined();
    expect(result.sofaType).toBeDefined();
    expect(result.storageType).toBeDefined();
    expect(result.tableShapeType).toBeDefined();
    expect(result.tableType).toBeDefined();
  });

  it("should handle shared labels across multiple charts", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      existing: 5
    });
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      existing: 3
    });

    const result = buildAttributePieCharts(artifactDirs, layout);

    expect(result.doorIsOpen).toBeDefined();
    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should add legend icons for tableShapeType with circularElliptic", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      circularElliptic: 5,
      rectangular: 3
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const tableShapeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: unknown };
      return options.legendIconComponents !== undefined;
    });
    expect(tableShapeCall).toBeDefined();
  });

  it("should add legend icons for chairType with stool and dining", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairType") {
        return { dining: 3, stool: 2 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should handle empty artifactDirs array", () => {
    const artifactDirs: string[] = [];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = buildAttributePieCharts(artifactDirs, layout);

    expect(result.doorIsOpen).toBeUndefined();
  });

  it("should add legend icons for chairType with swivel", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairType") {
        return { swivel: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const chairTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return options.legendIconComponents !== undefined && "Swivel" in (options.legendIconComponents ?? {});
    });
    expect(chairTypeCall).toBeDefined();
  });

  it("should add legend icons for chairLegType with four and star", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairLegType") {
        return { four: 3, star: 2 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const chairLegTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return (
        options.legendIconComponents !== undefined &&
        ("Four" in (options.legendIconComponents ?? {}) || "Star" in (options.legendIconComponents ?? {}))
      );
    });
    expect(chairLegTypeCall).toBeDefined();
  });

  it("should add legend icons for chairArmType with missing and existing", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairArmType") {
        return { existing: 2, missing: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const chairArmTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return (
        options.legendIconComponents !== undefined &&
        ("Missing" in (options.legendIconComponents ?? {}) || "Existing" in (options.legendIconComponents ?? {}))
      );
    });
    expect(chairArmTypeCall).toBeDefined();
  });

  it("should add legend icons for chairBackType with missing and existing", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairBackType") {
        return { existing: 2, missing: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const chairBackTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return (
        options.legendIconComponents !== undefined &&
        ("Missing" in (options.legendIconComponents ?? {}) || "Existing" in (options.legendIconComponents ?? {}))
      );
    });
    expect(chairBackTypeCall).toBeDefined();
  });

  it("should add legend icons for storageType with shelf and cabinet", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "StorageType") {
        return { cabinet: 2, shelf: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const storageTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return (
        options.legendIconComponents !== undefined &&
        ("Shelf" in (options.legendIconComponents ?? {}) || "Cabinet" in (options.legendIconComponents ?? {}))
      );
    });
    expect(storageTypeCall).toBeDefined();
  });

  it("should add legend icons for sofaType with singleSeat", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "SofaType") {
        return { singleSeat: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const sofaTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return options.legendIconComponents !== undefined && "Single Seat" in (options.legendIconComponents ?? {});
    });
    expect(sofaTypeCall).toBeDefined();
  });

  it("should add legend icons for tableShapeType with rectangular", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "TableShapeType") {
        return { rectangular: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const tableShapeTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return options.legendIconComponents !== undefined && "Rectangular" in (options.legendIconComponents ?? {});
    });
    expect(tableShapeTypeCall).toBeDefined();
  });

  it("should add legend icons for unidentified in any chart", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairType") {
        return { dining: 2, unidentified: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const unidentifiedCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: Record<string, unknown> };
      return options.legendIconComponents !== undefined && "Unidentified" in (options.legendIconComponents ?? {});
    });
    expect(unidentifiedCall).toBeDefined();
  });

  it("should not add legendIconComponents when none are applicable", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "TableType") {
        return { other: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const tableTypeCall = pieChartCalls.find((call) => {
      const options = call[2] as { legendIconComponents?: unknown };
      return options.legendIconComponents === undefined;
    });
    expect(tableTypeCall).toBeDefined();
  });

  it("should handle labels without circularElliptic", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "TableShapeType") {
        return { other: 2, rectangular: 3 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout);

    expect(getPieChartConfig).toHaveBeenCalled();
  });

  it("should use fallback color when palette is exhausted", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      A: 1,
      B: 1,
      C: 1,
      D: 1
    });
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({});

    buildAttributePieCharts(artifactDirs, layout, []);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const doorCall = pieChartCalls[0];
    expect(doorCall).toBeDefined();
    if (doorCall !== undefined) {
      const options = doorCall[2] as { colors?: string[] };
      expect(options.colors).toBeDefined();
      expect(options.colors?.every((color) => color === "#4E79A7")).toBe(true);
    }
  });

  it("falls back to default color when distinctColors has gaps", () => {
    const artifactDirs = ["/test/dir1"];
    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      A: 2,
      B: 3,
      C: 4
    });
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({});

    const paletteWithGap = ["#111111", undefined as unknown as string];

    buildAttributePieCharts(artifactDirs, layout, paletteWithGap);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const doorCall = pieChartCalls[0];
    expect(doorCall).toBeDefined();
    if (doorCall !== undefined) {
      const options = doorCall[2] as { colors?: string[] };
      expect(options.colors).toBeDefined();
      expect(options.colors?.every((color) => color === paletteWithGap[0])).toBe(true);
    }
  });

  it("reuses palette colors when shared labels exceed provided palette", () => {
    const artifactDirs = ["/test/dir1"];
    const shortPalette = ["#123456"];

    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      alpha: 1,
      beta: 1
    });
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "ChairType") {
        return { alpha: 2, beta: 1 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout, shortPalette);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const doorCall = pieChartCalls.find(
      ([labels]) => Array.isArray(labels) && labels.includes("alpha") && labels.includes("beta")
    );
    expect(doorCall).toBeDefined();
    if (doorCall !== undefined) {
      const options = doorCall[2] as { colors?: string[] };
      expect(options.colors).toEqual([shortPalette[0], shortPalette[0]]);
    }

    const chairTypeCall = pieChartCalls.find(
      ([labels]) => Array.isArray(labels) && labels.includes("Alpha") && labels.includes("Beta")
    );
    expect(chairTypeCall).toBeDefined();
    if (chairTypeCall !== undefined) {
      const options = chairTypeCall[2] as { colors?: string[] };
      expect(options.colors).toEqual([shortPalette[0], shortPalette[0]]);
    }
  });

  it("falls back to default color when shared labels have undefined palette entries", () => {
    const artifactDirs = ["/test/dir1"];
    const undefinedPalette = [undefined as unknown as string];
    const defaultColor = "#4E79A7";

    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      shared: 1
    });
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockImplementation((_dirs, type) => {
      if (type === "SofaType") {
        return { shared: 2 };
      }
      return {};
    });

    buildAttributePieCharts(artifactDirs, layout, undefinedPalette);

    const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;

    const doorCall = pieChartCalls.find(([labels]) => Array.isArray(labels) && labels.includes("shared"));
    expect(doorCall).toBeDefined();
    if (doorCall !== undefined) {
      const options = doorCall[2] as { colors?: string[] };
      expect(options.colors).toEqual([defaultColor]);
    }

    const sofaTypeCall = pieChartCalls.find(([labels]) => Array.isArray(labels) && labels.includes("Shared"));
    expect(sofaTypeCall).toBeDefined();
    if (sofaTypeCall !== undefined) {
      const options = sofaTypeCall[2] as { colors?: string[] };
      expect(options.colors).toEqual([defaultColor]);
    }
  });

  it("omits legend icons when display labels cannot be resolved", () => {
    const artifactDirs = ["/test/dir1"];
    const mockStartCase = vi.fn(() => undefined as unknown as string);
    startCaseMock = mockStartCase;

    (getDoorIsOpenCounts as ReturnType<typeof vi.fn>).mockReturnValue({});
    (getObjectAttributeCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      cabinet: 1,
      circularElliptic: 1,
      dining: 1,
      existing: 1,
      four: 1,
      missing: 1,
      rectangular: 1,
      shelf: 1,
      singleSeat: 1,
      star: 1,
      stool: 1,
      swivel: 1,
      unidentified: 1
    });

    const originalMapGet = Map.prototype.get;
    const mapPrototype = Map.prototype as { get: (key: unknown) => unknown };
    mapPrototype.get = function mapGetMock(key: unknown) {
      if (typeof key === "string") {
        return undefined;
      }
      return originalMapGet.call(this, key as never);
    };

    try {
      buildAttributePieCharts(artifactDirs, layout);
      expect(mockStartCase).toHaveBeenCalled();

      const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const tableShapeCall = pieChartCalls.find(([labels]) => Array.isArray(labels) && labels.includes("Circular"));
      expect(tableShapeCall).toBeDefined();
      if (tableShapeCall !== undefined) {
        const options = tableShapeCall[2] as { legendIconComponents?: unknown };
        expect(options.legendIconComponents).toBeUndefined();
      }
    } finally {
      mapPrototype.get = originalMapGet as (key: unknown) => unknown;
      startCaseMock = null;
    }
  });
});
