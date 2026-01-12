import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { buildScanAnalysisReport } from "../../../src/templates/scanAnalysisReport";

const mocks = vi.hoisted(() => ({
  buildAreaCharts: vi.fn(),
  buildAttributePieCharts: vi.fn(),
  buildDimensionCharts: vi.fn(),
  buildDynamicKde: vi.fn(),
  buildErrorFeatureObjectCharts: vi.fn(),
  buildSurfaceShapeCharts: vi.fn(),
  buildVanityAttributesCharts: vi.fn(),
  buildWallEmbeddedPieCharts: vi.fn(),
  computeLayoutConstants: vi.fn(),
  getLineChartConfig: vi.fn()
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/areaCharts", () => ({
  buildAreaCharts: mocks.buildAreaCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/attributePieCharts", () => ({
  buildAttributePieCharts: mocks.buildAttributePieCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/dimensionCharts", () => ({
  buildDimensionCharts: mocks.buildDimensionCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/prevalenceCharts", () => ({
  buildErrorFeatureObjectCharts: mocks.buildErrorFeatureObjectCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/vanityAttributesCharts", () => ({
  buildVanityAttributesCharts: mocks.buildVanityAttributesCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/wallEmbeddedPieCharts", () => ({
  buildWallEmbeddedPieCharts: mocks.buildWallEmbeddedPieCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/charts/shapeOverlayCharts", () => ({
  buildSurfaceShapeCharts: mocks.buildSurfaceShapeCharts
}));

vi.mock("../../../src/templates/dataAnalysisReport/kdeBounds", () => ({
  buildDynamicKde: mocks.buildDynamicKde
}));

vi.mock("../../../src/templates/dataAnalysisReport/layout", () => ({
  computeLayoutConstants: mocks.computeLayoutConstants
}));

vi.mock("../../../src/utils/chart/configBuilders", () => ({
  getLineChartConfig: mocks.getLineChartConfig
}));

/**
 * Tests for the Scan Data Analysis Report template.
 * - Verifies report structure with and without artifact directory context.
 * - Ensures conditional sections (Wall, Window, etc.) are correctly included.
 * - Tests aggregation of attributes from mocked chart builders.
 */
describe("scanAnalysisReport", () => {
  const mockMetadata: ArtifactAnalysis[] = [
    {
      doorCount: 1,
      hasArData: true,
      hasRawScan: true,
      openingCount: 0,
      roomAreaSqFt: 100,
      sectionLabels: ["Bathroom"],
      sinkCount: 1,
      toiletCount: 1,
      tubCount: 1,
      wallCount: 4,
      windowCount: 1
    } as unknown as ArtifactAnalysis
  ];
  const chartStub = { type: "chart-stub" } as unknown as ChartConfiguration;

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.computeLayoutConstants.mockReturnValue({
      FULL_CHART_WIDTH: 240,
      HALF_CHART_HEIGHT: 120,
      HALF_CHART_WIDTH: 120
    });

    mocks.buildDynamicKde.mockReturnValue({
      kde: { labels: [0, 1], values: [0.25, 0.75] }
    });

    mocks.getLineChartConfig.mockImplementation(
      (labels: string[], datasets: unknown[], options: Record<string, unknown>) => {
        return { datasets, labels, options } as unknown as ChartConfiguration;
      }
    );

    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});
  });

  it("should generate a report with all expected sections without artifactDirs", () => {
    const report = buildScanAnalysisReport(mockMetadata, 1);

    expect(report.title).toBe("Scan Data Analysis");
    expect(report.subtitle).toBe("Artifacts: 1");

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Summary Analysis");
    expect(sectionTitles).toContain("Object Analysis");
    expect(sectionTitles).toContain("Floor Analysis");
    expect(sectionTitles).toContain("Floor Area");

    // Without artifactDirs, many sections should be missing
    expect(sectionTitles).not.toContain("Wall Analysis");
    expect(sectionTitles).not.toContain("Window Analysis");
    expect(sectionTitles).not.toContain("Door Analysis");
    expect(sectionTitles).not.toContain("Opening Analysis");
  });

  it("should include attribute charts when artifactDirs provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({
      errors: chartStub,
      features: chartStub,
      objects: chartStub,
      sections: chartStub
    });
    mocks.buildDimensionCharts.mockReturnValue({
      doorArea: chartStub,
      doorAspectRatio: chartStub,
      doorHeight: chartStub,
      doorWidth: chartStub,
      floorAspectRatio: chartStub,
      floorLength: chartStub,
      floorWidth: chartStub,
      openingArea: chartStub,
      openingAspectRatio: chartStub,
      openingHeight: chartStub,
      openingWidth: chartStub,
      tubLength: chartStub,
      vanityLength: chartStub,
      wallArea: chartStub,
      wallAspectRatio: chartStub,
      wallHeight: chartStub,
      wallWidth: chartStub,
      windowArea: chartStub,
      windowAspectRatio: chartStub,
      windowHeight: chartStub,
      windowWidth: chartStub
    });
    mocks.buildAreaCharts.mockReturnValue({
      floorAspectRatio: chartStub,
      floorLength: chartStub,
      floorWidth: chartStub
    });
    mocks.buildAttributePieCharts.mockReturnValue({
      chairArmType: chartStub,
      chairBackType: chartStub,
      chairLegType: chartStub,
      doorIsOpen: chartStub
    });
    mocks.buildVanityAttributesCharts.mockReturnValue({
      sinkCount: chartStub,
      vanityType: chartStub
    });
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({
      wallsWithDoors: chartStub,
      wallsWithOpenings: chartStub,
      wallsWithWindows: chartStub
    });
    mocks.buildSurfaceShapeCharts.mockReturnValue({
      doorShapes: chartStub,
      floorShapes: chartStub,
      openingShapes: chartStub,
      wallShapes: chartStub,
      windowShapes: chartStub
    });

    const report = buildScanAnalysisReport(mockMetadata, 1, artifactDirs);

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Wall Analysis");
    expect(sectionTitles).toContain("Window Analysis");
    expect(sectionTitles).toContain("Door Analysis");
    expect(sectionTitles).toContain("Opening Analysis");
    expect(sectionTitles).toContain("Section Types");
    expect(sectionTitles).toContain("Feature Prevalence");
    expect(sectionTitles).toContain("Capture Errors");
    expect(sectionTitles).toContain("Object Distribution");
    expect(sectionTitles).toContain("Tub Length Distribution");
    expect(sectionTitles).toContain("Vanity Length Distribution");

    const chartRows = report.sections.filter((section) => section.type === "chart-row");
    const rowTitles = chartRows.flatMap((row) => {
      if (!Array.isArray(row.data)) {
        return [];
      }
      return row.data.map((chart) => (chart as { title?: string }).title);
    });

    expect(rowTitles).toEqual(
      expect.arrayContaining([
        "Door Open/Closed",
        "Chair Arm Type",
        "Number of Sinks",
        "Walls with Windows",
        "Floor Aspect Ratio",
        "Floor Shapes",
        "Wall Aspect Ratio",
        "Wall Shapes",
        "Window Aspect Ratio",
        "Window Shapes",
        "Door Aspect Ratio",
        "Door Shapes",
        "Opening Aspect Ratio",
        "Opening Shapes"
      ])
    );
  });

  it("should handle cases where some charts are undefined", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildAttributePieCharts.mockReturnValue({
      doorIsOpen: undefined as unknown as ChartConfiguration
    });
    mocks.buildVanityAttributesCharts.mockReturnValue({
      sinkCount: undefined as unknown as ChartConfiguration,
      vanityType: undefined as unknown as ChartConfiguration
    });
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});

    const report = buildScanAnalysisReport(mockMetadata, 1, artifactDirs);
    const chartRows = report.sections.filter((section) => section.type === "chart-row");
    expect(chartRows.length).toBe(0);

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).not.toContain("Tub Length Distribution");
    expect(sectionTitles).not.toContain("Vanity Length Distribution");
    expect(sectionTitles).toContain("Summary Analysis");
  });

  it("filters out non-positive room areas before building KDE charts", () => {
    const metadataWithZeros: ArtifactAnalysis[] = [
      { roomAreaSqFt: 100 } as unknown as ArtifactAnalysis,
      { roomAreaSqFt: 0 } as unknown as ArtifactAnalysis,
      { roomAreaSqFt: -5 } as unknown as ArtifactAnalysis,
      { roomAreaSqFt: 40 } as unknown as ArtifactAnalysis
    ];

    buildScanAnalysisReport(metadataWithZeros, 2);

    expect(mocks.buildDynamicKde).toHaveBeenCalledWith([100, 40], 0, 150, 200);
  });

  it("falls back to single aspect ratio charts when shape overlays are missing", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({
      floorAspectRatio: chartStub,
      wallAspectRatio: chartStub
    });
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildScanAnalysisReport(mockMetadata, 1, artifactDirs);

    const floorAspectSection = report.sections.find((s) => s.title === "Floor Aspect Ratio");
    const wallAspectSection = report.sections.find((s) => s.title === "Wall Aspect Ratio");

    expect(floorAspectSection?.type).toBe("chart");
    expect(wallAspectSection?.type).toBe("chart");
  });

  it("renders standalone shape charts when aspect ratio charts are missing", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({
      floorShapes: chartStub,
      wallShapes: chartStub
    });

    const report = buildScanAnalysisReport(mockMetadata, 1, artifactDirs);

    const floorShapeSection = report.sections.find((s) => s.title === "Floor Shapes");
    const wallShapeSection = report.sections.find((s) => s.title === "Wall Shapes");

    expect(floorShapeSection?.type).toBe("chart");
    expect(wallShapeSection?.type).toBe("chart");
  });

  it("chunks attribute charts into rows of three", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({
      chairArmType: chartStub,
      chairBackType: chartStub,
      chairLegType: chartStub,
      chairType: chartStub,
      doorIsOpen: chartStub,
      sofaType: chartStub
    });
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildScanAnalysisReport(mockMetadata, 1, artifactDirs);
    const attributeRows = report.sections.filter(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        section.data.every((item) => (item as { data: ChartConfiguration }).data === chartStub)
    );

    // 6 charts with rows of 3 each should produce exactly 2 rows
    expect(attributeRows.length).toBe(2);
  });
});
