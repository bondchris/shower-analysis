import { describe, expect, it, vi } from "vitest";
import { EnvStats } from "../../../src/models/envStats";
import { buildValidationReport } from "../../../src/templates/validationReport";
import { getBarChartConfig } from "../../../src/utils/chart/configBuilders";
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

    // Spy and throw
    const errorSpy = vi.spyOn({ getBarChartConfig }, "getBarChartConfig").mockImplementation(() => {
      throw new Error("Chart Error");
    });
    const loggerSpy = vi.spyOn(logger, "error");

    buildValidationReport(stats);

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate property chart"));

    errorSpy.mockRestore();
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
});
