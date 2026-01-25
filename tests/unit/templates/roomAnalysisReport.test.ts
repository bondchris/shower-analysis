import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { buildRoomAnalysisReport } from "../../../src/templates/roomAnalysisReport";

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
  filterValidOutlines: vi.fn(),
  getLineChartConfig: vi.fn(),
  getNotchedWallOutlines: vi.fn(),
  getShapeOverlayChartConfig: vi.fn(),
  getSlantedWallOutlines: vi.fn(),
  sampleOutlines: vi.fn()
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
  getLineChartConfig: mocks.getLineChartConfig,
  getShapeOverlayChartConfig: mocks.getShapeOverlayChartConfig
}));

vi.mock("../../../src/utils/chart/shapeOverlay", () => ({
  filterValidOutlines: mocks.filterValidOutlines,
  sampleOutlines: mocks.sampleOutlines
}));

vi.mock("../../../src/utils/data/rawScanMetadataCollectors", () => ({
  convertLengthsToFeet: vi.fn((arr: number[]) => arr.map((v: number) => v * 3.28084))
}));

vi.mock("../../../src/utils/data/rawScanWallAnalysis", () => ({
  getCeilingHeightDifferences: vi.fn((): number[] => []),
  getNotchedWallOutlines: mocks.getNotchedWallOutlines,
  getSlantedWallOutlines: mocks.getSlantedWallOutlines
}));

/**
 * Tests for the Room Data Analysis Report template.
 * - Verifies report structure with and without artifact directory context.
 * - Ensures conditional sections (Wall, Window, etc.) are correctly included.
 * - Tests aggregation of attributes from mocked chart builders.
 */
describe("roomAnalysisReport", () => {
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

    mocks.getShapeOverlayChartConfig.mockImplementation((outlines: unknown[], options: Record<string, unknown>) => {
      return { options, outlines } as unknown as ChartConfiguration;
    });

    mocks.filterValidOutlines.mockImplementation((outlines: unknown[]) => outlines);
    mocks.sampleOutlines.mockImplementation((outlines: unknown[]) => outlines);
    mocks.getSlantedWallOutlines.mockReturnValue([]);
    mocks.getNotchedWallOutlines.mockReturnValue([]);

    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});
  });

  it("should generate a report with all expected sections without artifactDirs", () => {
    const report = buildRoomAnalysisReport(mockMetadata, 1);

    expect(report.title).toBe("Room Data Analysis");
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

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

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

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);
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

    buildRoomAnalysisReport(metadataWithZeros, 2);

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

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

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

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

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

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);
    const attributeRows = report.sections.filter(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        section.data.every((item) => (item as { data: ChartConfiguration }).data === chartStub)
    );

    // 6 charts with rows of 3 each should produce exactly 2 rows
    expect(attributeRows.length).toBe(2);
  });

  it("includes ceiling height difference chart when artifactDirs provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const ceilingSection = report.sections.find((s) => s.title === "Maximum Difference in Ceiling Height");
    expect(ceilingSection).toBeDefined();
    expect(ceilingSection?.type).toBe("chart");
  });

  it("includes slanted and notched wall shapes in chart-row when both exist", () => {
    const artifactDirs = ["/test/dir1"];
    const slantedOutlines = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    const notchedOutlines = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ];

    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});
    mocks.getSlantedWallOutlines.mockReturnValue(slantedOutlines);
    mocks.getNotchedWallOutlines.mockReturnValue(notchedOutlines);
    mocks.filterValidOutlines.mockImplementation((outlines: unknown[]) => outlines);

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const ceilingAnalysisSection = report.sections.find((s) => s.title === "Ceiling Analysis");
    expect(ceilingAnalysisSection).toBeDefined();

    const wallShapesRow = report.sections.find(
      (s) =>
        s.type === "chart-row" &&
        Array.isArray(s.data) &&
        s.data.some((item) => (item as { title?: string }).title === "Slanted Wall Shapes") &&
        s.data.some((item) => (item as { title?: string }).title === "Notched Wall Shapes")
    );
    expect(wallShapesRow).toBeDefined();
  });

  it("includes slanted wall shapes chart when only slanted exists", () => {
    const artifactDirs = ["/test/dir1"];
    const slantedOutlines = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];

    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});
    mocks.getSlantedWallOutlines.mockReturnValue(slantedOutlines);
    mocks.getNotchedWallOutlines.mockReturnValue([]);
    mocks.filterValidOutlines.mockImplementation((outlines: unknown[]) => outlines);

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const slantedSection = report.sections.find((s) => s.title === "Slanted Wall Shapes");
    expect(slantedSection).toBeDefined();
    expect(slantedSection?.type).toBe("chart");
  });

  it("includes notched wall shapes chart when only notched exists", () => {
    const artifactDirs = ["/test/dir1"];
    const notchedOutlines = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ];

    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});
    mocks.getSlantedWallOutlines.mockReturnValue([]);
    mocks.getNotchedWallOutlines.mockReturnValue(notchedOutlines);
    mocks.filterValidOutlines.mockImplementation((outlines: unknown[]) => outlines);

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const notchedSection = report.sections.find((s) => s.title === "Notched Wall Shapes");
    expect(notchedSection).toBeDefined();
    expect(notchedSection?.type).toBe("chart");
  });

  it("includes vanity placement chart when provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({
      vanityPlacement: chartStub
    });
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const vanityRow = report.sections.find(
      (s) =>
        s.type === "chart-row" &&
        Array.isArray(s.data) &&
        s.data.some((item) => (item as { title?: string }).title === "Vanity Placement")
    );
    expect(vanityRow).toBeDefined();
  });

  it("includes individual dimension charts when provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({
      doorArea: chartStub,
      doorHeight: chartStub,
      doorWidth: chartStub,
      floorLength: chartStub,
      floorWidth: chartStub,
      openingArea: chartStub,
      openingHeight: chartStub,
      openingWidth: chartStub,
      wallArea: chartStub,
      wallHeight: chartStub,
      wallWidth: chartStub,
      windowArea: chartStub,
      windowHeight: chartStub,
      windowWidth: chartStub
    });
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Floor Lengths");
    expect(sectionTitles).toContain("Floor Widths");
    expect(sectionTitles).toContain("Wall Heights");
    expect(sectionTitles).toContain("Wall Widths");
    expect(sectionTitles).toContain("Wall Areas");
    expect(sectionTitles).toContain("Window Heights");
    expect(sectionTitles).toContain("Window Widths");
    expect(sectionTitles).toContain("Window Areas");
    expect(sectionTitles).toContain("Door Heights");
    expect(sectionTitles).toContain("Door Widths");
    expect(sectionTitles).toContain("Door Areas");
    expect(sectionTitles).toContain("Opening Heights");
    expect(sectionTitles).toContain("Opening Widths");
    expect(sectionTitles).toContain("Opening Areas");
  });

  it("includes all attribute chart types when provided", () => {
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
      sofaType: chartStub,
      storageType: chartStub,
      tableShapeType: chartStub,
      tableType: chartStub
    });
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const chartRows = report.sections.filter((section) => section.type === "chart-row");
    const rowTitles = chartRows.flatMap((row) => {
      if (!Array.isArray(row.data)) {
        return [];
      }
      return row.data.map((chart) => (chart as { title?: string }).title);
    });

    expect(rowTitles).toContain("Door Open/Closed");
    expect(rowTitles).toContain("Chair Arm Type");
    expect(rowTitles).toContain("Chair Back Type");
    expect(rowTitles).toContain("Chair Base Type");
    expect(rowTitles).toContain("Chair Type");
    expect(rowTitles).toContain("Sofa Type");
    expect(rowTitles).toContain("Storage Type");
    expect(rowTitles).toContain("Table Shape Type");
    expect(rowTitles).toContain("Table Type");
  });

  it("excludes vanity attribute charts row when no vanity charts are provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const vanityRow = report.sections.find(
      (s) =>
        s.type === "chart-row" &&
        Array.isArray(s.data) &&
        s.data.some((item) => (item as { title?: string }).title === "Number of Sinks")
    );
    expect(vanityRow).toBeUndefined();
  });

  it("excludes embedded charts row when no embedded charts are provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const embeddedRow = report.sections.find(
      (s) =>
        s.type === "chart-row" &&
        Array.isArray(s.data) &&
        s.data.some((item) => (item as { title?: string }).title === "Walls with Windows")
    );
    expect(embeddedRow).toBeUndefined();
  });

  it("excludes attribute charts rows when no attribute charts are provided", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const attributeRows = report.sections.filter(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        (section.data as unknown[]).some((item) => {
          const title = (item as { title?: string }).title;
          return title === "Door Open/Closed" || title === "Chair Arm Type" || title === "Sofa Type";
        })
    );
    expect(attributeRows.length).toBe(0);
  });

  it("handles vanity charts with only sinkCount", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({
      sinkCount: chartStub
    });
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({});
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const vanityRow = report.sections.find(
      (s) =>
        s.type === "chart-row" &&
        Array.isArray(s.data) &&
        s.data.some((item) => (item as { title?: string }).title === "Number of Sinks")
    );
    expect(vanityRow).toBeDefined();
  });

  it("handles embedded charts with only wallsWithWindows", () => {
    const artifactDirs = ["/test/dir1"];
    mocks.buildErrorFeatureObjectCharts.mockReturnValue({});
    mocks.buildDimensionCharts.mockReturnValue({});
    mocks.buildAreaCharts.mockReturnValue({});
    mocks.buildAttributePieCharts.mockReturnValue({});
    mocks.buildVanityAttributesCharts.mockReturnValue({});
    mocks.buildWallEmbeddedPieCharts.mockReturnValue({
      wallsWithWindows: chartStub
    });
    mocks.buildSurfaceShapeCharts.mockReturnValue({});

    const report = buildRoomAnalysisReport(mockMetadata, 1, artifactDirs);

    const embeddedRow = report.sections.find(
      (s) =>
        s.type === "chart-row" &&
        Array.isArray(s.data) &&
        s.data.some((item) => (item as { title?: string }).title === "Walls with Windows")
    );
    expect(embeddedRow).toBeDefined();
  });
});
