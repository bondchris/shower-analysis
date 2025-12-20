import { describe, expect, it, vi } from "vitest";
import { EnvStats } from "../../../src/models/envStats";
import { buildValidationReport } from "../../../src/templates/validationReport";

// Mock ChartUtils
vi.mock("../../../src/utils/chartUtils", async () => {
  const actual = await vi.importActual("../../../src/utils/chartUtils");
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
});
