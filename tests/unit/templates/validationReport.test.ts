import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvStats } from "../../../src/models/envStats";
import { buildValidationReport } from "../../../src/templates/validationReport";
import { getBarChartConfig, getLineChartConfig, getMixedChartConfig } from "../../../src/utils/chart/configBuilders";
import { logger } from "../../../src/utils/logger";

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Mock ChartUtils
vi.mock("../../../src/utils/chart/configBuilders", async () => {
  const actual = await vi.importActual("../../../src/utils/chart/configBuilders");
  return {
    ...actual,
    getBarChartConfig: vi.fn().mockReturnValue({ type: "bar" }),
    getLineChartConfig: vi.fn().mockReturnValue({ type: "line" }),
    getMixedChartConfig: vi.fn().mockReturnValue({ type: "mixed" })
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildValidationReport", () => {
  const mockStats: EnvStats[] = [
    {
      artifactsWithIssues: 0,
      artifactsWithWarnings: 0,
      cleanScansByDate: {},
      errorsByDate: {},
      missingCounts: {},
      name: "Test",
      pageErrors: {},
      processed: 10,
      propertyCounts: {},
      propertyCountsByDate: {},
      totalArtifacts: 10,
      totalScansByDate: {},
      warningCounts: {},
      warningsByDate: {}
    }
  ];

  it("should generate a report with summary and charts", () => {
    const report = buildValidationReport(mockStats);

    expect(report.title).toBe("Validation Report");
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it("should handle multiple environments and dates", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2023-01-01": 50, "2023-01-02": 50 },
        errorsByDate: {},
        missingCounts: {},
        name: "Production",
        pageErrors: {},
        processed: 100,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 100,
        totalScansByDate: { "2023-01-01": 50, "2023-01-02": 50 },
        warningCounts: {},
        warningsByDate: {}
      },
      {
        artifactsWithIssues: 5,
        artifactsWithWarnings: 5,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: "Staging",
        pageErrors: {},
        processed: 5,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 5,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const report = buildValidationReport(stats);

    // Should generate charts for errors and warnings due to Staging data
    const chartTitles = report.sections.map((s) => s.title);
    expect(chartTitles).toContain("Upload Failures Over Time");
    expect(chartTitles).toContain("Missing Project IDs Over Time");
  });

  it("should handle empty stats gracefully", () => {
    const report = buildValidationReport([]);
    expect(report.title).toBe("Validation Report");
    expect(report.sections.length).toBeGreaterThan(0);
    expect(report.sections[0]?.data).toBe("No environments / no data.");
  });

  it("should handle environment with zero artifacts", () => {
    const baseStat = mockStats[0];
    if (!baseStat) {
      throw new Error("Test setup error");
    }
    const zeroStats: EnvStats[] = [
      {
        ...baseStat,
        name: "EmptyEnv",
        processed: 0,
        totalArtifacts: 0
      }
    ];

    const report = buildValidationReport(zeroStats);
    const summaryTable = report.sections[0]?.data as string[][];
    // Column 0: Label, Column 1: EmptyEnv, Column 2: Total
    const processedRow = summaryTable.find((r) => r[0] === "Processed Artifacts");
    expect(processedRow?.[1]).toBe("0 (0.0%)");
  });

  it("should include detailed error and warning rows when counts exist", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 3,
        artifactsWithWarnings: 4,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: { floorPlan: 1, rawScan: 2 },
        name: "EnvDetails",
        pageErrors: {},
        processed: 4,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 4,
        totalScansByDate: {},
        warningCounts: { projectId: 1, thumbnail: 3 },
        warningsByDate: {}
      },
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: "EnvMissingCounts",
        pageErrors: {},
        processed: 1,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 1,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const report = buildValidationReport(stats);
    const table = report.sections[0]?.data as string[][];

    const rawScanRow = table.find((row) => row[0] === "rawScan");
    expect(rawScanRow).toEqual(["rawScan", "2", "0", expect.stringContaining("2")]);

    const warningRows = table.filter((row) => row[0] === "Missing projectId" || row[0] === "thumbnail");
    expect(warningRows).toEqual([
      ["Missing projectId", "1", "0", expect.stringContaining("1")],
      ["thumbnail", "3", "0", expect.stringContaining("3")]
    ]);
  });

  it("should log errors when chart generation fails", () => {
    const baseStat = mockStats[0];
    if (!baseStat) {
      throw new Error("Test setup error");
    }
    // Setup stats that would trigger chart generation (e.g. property presence)
    const stats: EnvStats[] = [
      {
        ...baseStat,
        propertyCounts: { prop1: 10 }
      }
    ];

    const propertyChartMock = vi.mocked(getBarChartConfig);
    const originalBarImplementation = propertyChartMock.getMockImplementation();
    if (!originalBarImplementation) {
      throw new Error("Missing bar chart implementation");
    }

    propertyChartMock.mockImplementationOnce(() => {
      throw new Error("Chart Error");
    });
    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(stats);

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate property chart"));

    propertyChartMock.mockImplementation(originalBarImplementation);
  });

  it("should generate property presence over time chart when data is available", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2023-01-01": 50, "2023-01-02": 50 },
        errorsByDate: {},
        missingCounts: {},
        name: "Production",
        pageErrors: {},
        processed: 100,
        propertyCounts: { id: 100, video: 80 },
        propertyCountsByDate: {
          "2023-01-01": { id: 50, video: 40 },
          "2023-01-02": { id: 50, video: 40 }
        },
        totalArtifacts: 100,
        totalScansByDate: { "2023-01-01": 50, "2023-01-02": 50 },
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const report = buildValidationReport(stats);

    const chartTitles = report.sections.map((s) => s.title);
    expect(chartTitles).toContain("Property Presence Over Time");
  });

  it("should handle properties that are missing on certain dates", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2024-05-01": 5, "2024-05-02": 5 },
        errorsByDate: {},
        missingCounts: {},
        name: "SparseProperties",
        pageErrors: {},
        processed: 10,
        propertyCounts: { id: 10, video: 5 },
        propertyCountsByDate: {
          "2024-05-01": { id: 5 },
          "2024-05-02": { video: 5 }
        },
        totalArtifacts: 10,
        totalScansByDate: { "2024-05-01": 5, "2024-05-02": 5 },
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const lineChartMock = vi.mocked(getLineChartConfig);
    lineChartMock.mockClear();

    buildValidationReport(stats);

    const presenceCall = lineChartMock.mock.calls.find(([, , options]) => options?.yLabel === "Presence %");
    expect(presenceCall).toBeDefined();

    const [, datasets] = presenceCall ?? [];
    const dataSeries = Array.isArray(datasets) ? datasets.flatMap((d) => d.data) : [];
    expect(dataSeries).toContain(0);
  });

  it("should generate property presence chart when properties exist", () => {
    const propertyStats: EnvStats[] = [
      {
        artifactsWithIssues: 1,
        artifactsWithWarnings: 0,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: "EnvWithProperties",
        pageErrors: {},
        processed: 15,
        propertyCounts: { id: 15, video: 10 },
        propertyCountsByDate: {},
        totalArtifacts: 15,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const barChartMock = vi.mocked(getBarChartConfig);
    barChartMock.mockClear();

    const report = buildValidationReport(propertyStats);

    expect(barChartMock).toHaveBeenCalledWith(
      ["id", "video"],
      [15, 10],
      expect.objectContaining({ totalForPercentages: 15 })
    );

    const propertySection = report.sections.find((section) => section.title === "Property Presence");
    expect(propertySection?.type).toBe("chart");
  });

  it("should log a warning chart error when chart building fails", () => {
    const warningStats: EnvStats[] = [
      {
        artifactsWithIssues: 1,
        artifactsWithWarnings: 1,
        cleanScansByDate: { "2024-01-01": 1 },
        errorsByDate: {},
        missingCounts: {},
        name: "EnvWithWarnings",
        pageErrors: {},
        processed: 2,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 2,
        totalScansByDate: { "2024-01-01": 1 },
        warningCounts: {},
        warningsByDate: { "2024-01-01": 1 }
      }
    ];

    const lineChartMock = vi.mocked(getLineChartConfig);
    const originalLineImplementation = lineChartMock.getMockImplementation();
    if (!originalLineImplementation) {
      throw new Error("Missing line chart implementation");
    }
    lineChartMock.mockImplementation((labels, datasets, options) => {
      if (options?.yLabel === "Warning Count") {
        throw new Error("Warning chart error");
      }
      return originalLineImplementation(labels, datasets, options);
    });

    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(warningStats);

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate warning chart"));

    lineChartMock.mockImplementation(originalLineImplementation);
  });

  it("should log a scan volume chart error when mixed chart creation fails", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2024-01-01": 1 },
        errorsByDate: {},
        missingCounts: {},
        name: "EnvVolume",
        pageErrors: {},
        processed: 1,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 1,
        totalScansByDate: { "2024-01-01": 1 },
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const mixedChartMock = vi.mocked(getMixedChartConfig);
    const originalMixedImplementation = mixedChartMock.getMockImplementation();
    if (!originalMixedImplementation) {
      throw new Error("Missing mixed chart implementation");
    }
    mixedChartMock.mockImplementationOnce(() => {
      throw new Error("Mixed chart error");
    });
    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(stats);

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate aggregated volume chart"));

    mixedChartMock.mockImplementation(originalMixedImplementation);
  });

  it("should log a success chart error when line chart creation fails", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2024-03-01": 5 },
        errorsByDate: { "2024-03-01": 1 },
        missingCounts: {},
        name: "EnvSuccess",
        pageErrors: {},
        processed: 5,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 5,
        totalScansByDate: { "2024-03-01": 5 },
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const lineChartMock = vi.mocked(getLineChartConfig);
    const originalLineImplementation = lineChartMock.getMockImplementation();
    if (!originalLineImplementation) {
      throw new Error("Missing line chart implementation");
    }
    lineChartMock.mockImplementation((labels, datasets, options) => {
      if (options?.yLabel === "Success %") {
        throw new Error("Success chart error");
      }
      return originalLineImplementation(labels, datasets, options);
    });
    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(stats);

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate success chart"));

    lineChartMock.mockImplementation(originalLineImplementation);
  });

  it("should log an error chart error when line chart creation fails", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 1,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2024-04-01": 4 },
        errorsByDate: { "2024-04-01": 1 },
        missingCounts: {},
        name: "EnvErrorChart",
        pageErrors: {},
        processed: 4,
        propertyCounts: {},
        propertyCountsByDate: {},
        totalArtifacts: 4,
        totalScansByDate: { "2024-04-01": 4 },
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const lineChartMock = vi.mocked(getLineChartConfig);
    const originalLineImplementation = lineChartMock.getMockImplementation();
    if (!originalLineImplementation) {
      throw new Error("Missing line chart implementation");
    }
    lineChartMock.mockImplementation((labels, datasets, options) => {
      if (options?.yLabel === "Error Count") {
        throw new Error("Error chart failure");
      }
      return originalLineImplementation(labels, datasets, options);
    });
    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(stats);

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate code error chart"));

    lineChartMock.mockImplementation(originalLineImplementation);
  });

  it("should allow property presence over time percentages to be null when scans are missing", () => {
    const statsWithMissingScans: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: "EnvMissingTotals",
        pageErrors: {},
        processed: 5,
        propertyCounts: { video: 5 },
        propertyCountsByDate: { "2024-01-01": { video: 5 } },
        totalArtifacts: 5,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: { "2024-01-01": 1 }
      }
    ];

    const lineChartMock = vi.mocked(getLineChartConfig);
    lineChartMock.mockClear();

    buildValidationReport(statsWithMissingScans);

    const propertyPresenceCall = lineChartMock.mock.calls.find(([, , options]) => options?.yLabel === "Presence %");

    expect(propertyPresenceCall).toBeDefined();

    const [, datasets] = propertyPresenceCall ?? [];
    const firstDataset = Array.isArray(datasets) ? datasets[0] : undefined;
    expect(firstDataset?.data).toContain(null);
  });

  it("should log an error if property presence over time chart creation fails", () => {
    const stats: EnvStats[] = [
      {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: { "2024-02-01": 10 },
        errorsByDate: {},
        missingCounts: {},
        name: "EnvProperties",
        pageErrors: {},
        processed: 10,
        propertyCounts: { id: 10, video: 8 },
        propertyCountsByDate: { "2024-02-01": { id: 10, video: 8 } },
        totalArtifacts: 10,
        totalScansByDate: { "2024-02-01": 10 },
        warningCounts: {},
        warningsByDate: {}
      }
    ];

    const lineChartMock = vi.mocked(getLineChartConfig);
    const originalLineImplementation = lineChartMock.getMockImplementation();
    if (!originalLineImplementation) {
      throw new Error("Missing line chart implementation");
    }
    lineChartMock.mockImplementation((labels, datasets, options) => {
      if (options?.yLabel === "Presence %") {
        throw new Error("Presence over time failure");
      }
      return originalLineImplementation(labels, datasets, options);
    });
    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(stats);

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to generate property presence over time chart")
    );

    lineChartMock.mockImplementation(originalLineImplementation);
  });
});
