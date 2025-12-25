import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAttributePieCharts } from "../../../../../src/templates/dataAnalysisReport/charts/attributePieCharts";
import { getPieChartConfig } from "../../../../../src/utils/chart/configBuilders";
import { getDoorIsOpenCounts, getObjectAttributeCounts } from "../../../../../src/utils/data/rawScanExtractor";
import { LayoutConstants, computeLayoutConstants } from "../../../../../src/templates/dataAnalysisReport/layout";

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
});
