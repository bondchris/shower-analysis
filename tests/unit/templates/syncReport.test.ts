import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSyncReport } from "../../../src/templates/syncReport";
import { SyncStats } from "../../../src/models/syncStats";
import { SyncFailureDatabase } from "../../../src/utils/data/syncFailures";
import { LineChartConfig } from "../../../src/models/chart/lineChartConfig";
import { MixedChartConfig } from "../../../src/models/chart/mixedChartConfig";
import * as dateRangeModule from "../../../src/utils/chart/dateRange";

vi.mock("../../../src/utils/chart/dateRange", () => ({
  generateDateRange: vi.fn(),
  getGlobalDateRange: vi.fn()
}));

const createStats = (overrides: Partial<SyncStats> = {}): SyncStats => ({
  arDataHistory: overrides.arDataHistory ?? {},
  arDataSize: overrides.arDataSize ?? 0,
  dateMismatches: overrides.dateMismatches ?? [],
  duplicateCount: overrides.duplicateCount ?? 0,
  duplicates: overrides.duplicates ?? [],
  env: overrides.env ?? "Production",
  errors: overrides.errors ?? [],
  failed: overrides.failed ?? 0,
  found: overrides.found ?? 0,
  initialLayoutHistory: overrides.initialLayoutHistory ?? {},
  initialLayoutSize: overrides.initialLayoutSize ?? 0,
  knownFailures: overrides.knownFailures ?? 0,
  new: overrides.new ?? 0,
  newArDataSize: overrides.newArDataSize ?? 0,
  newDuplicateCount: overrides.newDuplicateCount ?? 0,
  newFailures: overrides.newFailures ?? 0,
  newInitialLayoutSize: overrides.newInitialLayoutSize ?? 0,
  newPointCloudSize: overrides.newPointCloudSize ?? 0,
  newRawScanSize: overrides.newRawScanSize ?? 0,
  newVideoSize: overrides.newVideoSize ?? 0,
  pointCloudHistory: overrides.pointCloudHistory ?? {},
  pointCloudSize: overrides.pointCloudSize ?? 0,
  processedIds: overrides.processedIds ?? new Set<string>(),
  rawScanHistory: overrides.rawScanHistory ?? {},
  rawScanSize: overrides.rawScanSize ?? 0,
  skipped: overrides.skipped ?? 0,
  videoHistory: overrides.videoHistory ?? {},
  videoSize: overrides.videoSize ?? 0
});

describe("buildSyncReport", () => {
  beforeEach(() => {
    // Default mock returns dates that include common test dates
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue([
      "2023-01-15",
      "2023-01-16",
      "2023-02-15",
      "2023-03-15"
    ]);
  });

  it("should generate summary table and handle no failures", () => {
    // This test has no video history, so return empty array to skip chart generation
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue([]);

    const stats: SyncStats[] = [
      {
        arDataHistory: {},
        arDataSize: 1024 * 50, // 50 KB
        dateMismatches: [],
        duplicateCount: 0,
        duplicates: [],
        env: "Production",
        errors: [],
        failed: 0,
        found: 10,
        initialLayoutHistory: {},
        initialLayoutSize: 0,
        knownFailures: 0,
        new: 0,
        newArDataSize: 0,
        newDuplicateCount: 0,
        newFailures: 0,
        newInitialLayoutSize: 0,
        newPointCloudSize: 0,
        newRawScanSize: 0,
        newVideoSize: 0,
        pointCloudHistory: {},
        pointCloudSize: 0,
        processedIds: new Set(),
        rawScanHistory: {},
        rawScanSize: 1024 * 1024 * 10, // 10 MB
        skipped: 0,
        videoHistory: {},
        videoSize: 1024 * 1024 * 100 // 100 MB
      }
    ];
    const failures: SyncFailureDatabase = {};

    const report = buildSyncReport(stats, failures);
    expect(report.title).toBe("Data Sync Report");
    expect(report.sections[0]?.title).toBe("Sync Summary");
    expect(report.sections[1]?.title).toBe("Disk Usage Summary");
    expect(report.sections[2]?.data).toBe("No failures occurred during sync.");

    // Verify formatBytes output in Disk Usage Summary
    const usageData = report.sections[1]?.data as string[][];

    // All artifact totals
    expect(usageData[0]?.[1]).toBe("110.05 MB");
    expect(usageData[0]?.[2]).toContain("110.05");

    // Video Total
    expect(usageData[1]?.[1]).toBe("100 MB");
    // Video Avg
    expect(usageData[2]?.[1]).toBe("10 MB");
    // Video New
    expect(usageData[3]?.[1]).toBe("0 B");

    // ArData Total
    expect(usageData[4]?.[1]).toBe("50 KB");
    // ArData Avg
    expect(usageData[5]?.[1]).toBe("5 KB");
    // ArData New
    expect(usageData[6]?.[1]).toBe("0 B");

    // RawScan Total
    expect(usageData[7]?.[1]).toBe("10 MB");
    // RawScan Avg
    expect(usageData[8]?.[1]).toBe("1 MB");
    // RawScan New
    expect(usageData[9]?.[1]).toBe("0 B");
  });
  it("should report failures categorized as new or known", () => {
    const stats: SyncStats[] = [
      {
        arDataHistory: {},
        arDataSize: 0,
        dateMismatches: [],
        duplicateCount: 0,
        duplicates: [],
        env: "Production",
        errors: [{ id: "scan1", reason: "Access Denied" }],
        failed: 1,
        found: 10,
        initialLayoutHistory: {},
        initialLayoutSize: 0,
        knownFailures: 0,
        new: 5,
        newArDataSize: 0,
        newDuplicateCount: 0,
        newFailures: 0,
        newInitialLayoutSize: 0,
        newPointCloudSize: 0,
        newRawScanSize: 0,
        newVideoSize: 0,
        pointCloudHistory: {},
        pointCloudSize: 0,
        processedIds: new Set(),
        rawScanHistory: {},
        rawScanSize: 0,
        skipped: 0,
        videoHistory: {},
        videoSize: 0
      }
    ];
    const failures: SyncFailureDatabase = {};

    const report = buildSyncReport(stats, failures);
    // Section 0: Summary
    // Section 1: Inaccessible Artifacts Header
    // Section 2: Environment Header
    // Section 3: List of New Inaccessible

    const titles = report.sections.map((s) => s.title);
    expect(titles).toContain("Inaccessible Artifacts");
    expect(titles).toContain("Environment: Production");
    expect(titles).toContain("New Inaccessible");

    // Find the list section
    const listSection = report.sections.find((s) => s.title === "New Inaccessible");
    expect(listSection).toBeDefined();
    if (listSection?.type === "list") {
      const data = listSection.data as string[];
      // Check if data contains the error
      // The format is complex span HTML, but we check basic strings
      const content = data.join(" ");
      expect(content).toContain("scan1");
      expect(content).toContain("Access Denied");
    }
  });

  it("should group errors by type and status", () => {
    const stats: SyncStats[] = [
      {
        arDataHistory: {},
        arDataSize: 0,
        dateMismatches: [],
        duplicateCount: 0,
        duplicates: [],
        env: "Production",
        errors: [
          { id: "scan1", reason: "Video download failed (404)" },
          { id: "scan1", reason: "RawScan download failed (404)" },
          { id: "scan2", reason: "ArData download failed (500)" },
          { id: "scan2", reason: "Video download failed (500)" },
          { id: "scan3", reason: "Generic Error" }
        ],
        failed: 1,
        found: 10,
        initialLayoutHistory: {},
        initialLayoutSize: 0,
        knownFailures: 0,
        new: 5,
        newArDataSize: 0,
        newDuplicateCount: 0,
        newFailures: 0,
        newInitialLayoutSize: 0,
        newPointCloudSize: 0,
        newRawScanSize: 0,
        newVideoSize: 0,
        pointCloudHistory: {},
        pointCloudSize: 0,
        processedIds: new Set(),
        rawScanHistory: {},
        rawScanSize: 0,
        skipped: 0,
        videoHistory: {},
        videoSize: 0
      }
    ];
    const failures: SyncFailureDatabase = {};

    const report = buildSyncReport(stats, failures);
    // Check for grouping
    // scan1 should say "Download failed (404) for RawScan and Video" (sorted)
    const errorGroup =
      (report.sections.find((s) => s.title === "New Inaccessible")?.data as string[] | undefined) ?? [];
    const content = errorGroup.join(" ");

    expect(content).toContain("Download failed (404) for RawScan and Video");
    expect(content).toContain("Download failed (500) for ArData and Video");
    expect(content).toContain("Generic Error");
  });
  describe("Coverage Improvements", () => {
    it("should classify errors as Known Inaccessible if ID matches", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [{ id: "known1", reason: "Access Denied" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 1, // Stats are computed independently, report logic uses this
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];
      // Define a known failure
      const failures: SyncFailureDatabase = {
        known1: { date: "2023-01-01", environment: "Production", reasons: ["Access Denied"] }
      };

      const report = buildSyncReport(stats, failures);
      const listSection = report.sections.find((s) => s.title === "Known Inaccessible");
      expect(listSection).toBeDefined();

      const data = (listSection?.data as string[]).join(" ");
      expect(data).toContain("known1");
      expect(data).toContain("Access Denied");
    });

    it("should exclude initialLayout failures from Known Inaccessible section", () => {
      const stats: SyncStats[] = [
        createStats({
          errors: [
            { id: "known1", reason: "initialLayout download failed (404)" },
            { id: "known2", reason: "Video download failed (500)" }
          ],
          failed: 2,
          found: 2,
          knownFailures: 2
        })
      ];
      const failures: SyncFailureDatabase = {
        known1: {
          date: "2023-01-01",
          environment: "Production",
          reasons: ["initialLayout download failed (404)"]
        },
        known2: { date: "2023-01-02", environment: "Production", reasons: ["Video download failed (500)"] }
      };

      const report = buildSyncReport(stats, failures);
      const listSection = report.sections.find((s) => s.title === "Known Inaccessible");
      expect(listSection).toBeDefined();

      const data = (listSection?.data as string[]).join(" ");
      // Should contain known2 (Video failure) but NOT known1 (initialLayout failure)
      expect(data).toContain("known2");
      expect(data).toContain("Video");
      expect(data).not.toContain("known1");
      expect(data).not.toContain("initialLayout");
    });

    it("should format list of 3+ failure types with Oxford comma", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [
            { id: "scan1", reason: "RawScan download failed (404)" },
            { id: "scan1", reason: "Video download failed (404)" },
            { id: "scan1", reason: "ArData download failed (404)" }
          ],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];
      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = (listSection?.data as string[]).join(" ");

      // Types sorted: ArData, RawScan, Video
      // Expected: "ArData, RawScan, and Video"
      expect(data).toContain("Download failed (404) for ArData, RawScan, and Video");
    });

    it("should format single failure type correctly", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [{ id: "scan1", reason: "RawScan download failed (404)" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];
      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = (listSection?.data as string[]).join(" ");

      expect(data).toContain("Download failed (404) for RawScan");
      expect(data).not.toContain("and");
    });

    it("should render multiple errors as a bulleted list", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [
            { id: "scan1", reason: "Error A" },
            { id: "scan1", reason: "Error B" }
          ],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];
      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = listSection?.data as string[];

      // Data should preserve order: ID line, then bullet lines
      // "scan1"
      // "  - Error A"
      // "  - Error B"
      expect(data[0]).toContain("scan1");
      expect(data[1]).toContain("- Error A");
      expect(data[2]).toContain("- Error B");
    });
  });

  it("should generate video size chart config", () => {
    // Mock returns date range that includes test data
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue(["2023-01-15"]);

    const stats: SyncStats[] = [
      createStats({
        found: 2,
        videoHistory: { "2023-01-15": { count: 2, totalSize: 20 * 1024 * 1024 } },
        videoSize: 20 * 1024 * 1024
      })
    ];
    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Average Video Size Over Time");
    expect(chartSection).toBeDefined();
    expect(chartSection?.type).toBe("react-component");

    // Check config
    const config = chartSection?.data as MixedChartConfig;
    expect(config).toBeDefined();
    expect(config.labels).toEqual(["2023-01-15"]);
    expect(config.datasets.length).toBe(3);
    expect(config.datasets[0]?.label).toBe("Cumulative Size");
    expect(config.datasets[1]?.label).toBe("Daily Average");
    expect(config.datasets[2]?.label).toBe("All Time Average");
    expect(config.datasets[1]?.data).toEqual([10]); // 20MB / 2 = 10MB
  });

  it("should generate aggregated video size chart with cumulative line", () => {
    const stats: SyncStats[] = [
      createStats({
        env: "Small (Found 10)",
        found: 10,
        videoHistory: { "2023-01-15": { count: 1, totalSize: 0 } }
      }),
      createStats({
        env: "Large (Found 100)",
        found: 100,
        videoHistory: { "2023-01-15": { count: 1, totalSize: 0 } }
      })
    ];
    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Average Video Size Over Time");
    const config = chartSection?.data as LineChartConfig;

    // Should have cumulative size, daily average, and all time average datasets
    expect(config.datasets.length).toBe(3);
    expect(config.datasets[0]?.label).toBe("Cumulative Size");
    expect(config.datasets[1]?.label).toBe("Daily Average");
    expect(config.datasets[2]?.label).toBe("All Time Average");
  });

  it("should handle zero artifacts found correctly (division by zero protection)", () => {
    const stats: SyncStats[] = [createStats({ found: 0 })];
    const report = buildSyncReport(stats, {});
    const diskUsageSection = report.sections.find((s) => s.title === "Disk Usage Summary");
    const tableData = diskUsageSection?.data as string[][];

    // Video Avg Row (Index 2)
    // Should be "0 B" or similar, not NaN or Infinity
    expect(tableData[2]?.[1]).toBe("0 B");
  });

  it("should generate Inaccessible Artifacts Over Time chart", () => {
    const stats: SyncStats[] = [
      createStats({
        errors: [
          { date: "2023-01-15", id: "1", reason: "Fail" },
          { date: "2023-01-20", id: "2", reason: "Fail" },
          { date: "2023-02-10", id: "3", reason: "Fail" }
        ],
        failed: 1,
        found: 10,
        videoHistory: {
          "2023-01": { count: 1, totalSize: 0 },
          "2023-02": { count: 1, totalSize: 0 },
          "2023-03": { count: 1, totalSize: 0 }
        }
      })
    ];
    const report = buildSyncReport(stats, {});
    // Find the chart
    const chartSection = report.sections.find((s) => s.title === "Inaccessible Artifacts Over Time");
    expect(chartSection).toBeDefined();
    expect(chartSection?.type).toBe("react-component");

    const config = chartSection?.data as LineChartConfig;
    // Should include Jan, Feb (errors) AND Mar (success only)
    expect(config.labels).toEqual(["2023-01", "2023-02", "2023-03"]);
    expect(config.datasets[0]?.label).toBe("Production");
    // Values: Jan=1, Feb=0 (err dates were 15th and 20th of Jan, 10th of Feb), Mar=0
    // Wait, my test data had Jan 15, Jan 20, Feb 10.
    // So Jan=2 errors, Feb=1 error. Mar=0.
    expect(config.datasets[0]?.data).toEqual([2, 1, 0]);
  });

  it("should generate Date Mismatch Summary table", () => {
    const stats: SyncStats[] = [
      createStats({
        dateMismatches: [
          { diffHours: 25, environment: "Production", id: "1", isNew: true, scanDate: "", videoDate: "" },
          { diffHours: 35, environment: "Production", id: "2", isNew: false, scanDate: "", videoDate: "" },
          { diffHours: 45, environment: "Production", id: "3", isNew: true, scanDate: "", videoDate: "" }
        ],
        found: 10
      })
    ];
    const report = buildSyncReport(stats, {});
    const tableSection = report.sections.find((s) => s.title === "Date Mismatch Summary");
    expect(tableSection).toBeDefined();
    expect(tableSection?.type).toBe("table");

    const data = tableSection?.data as string[][];
    // Row 0: Total Mismatches -> 3
    // Row 1: New Mismatches -> 2
    // Columns: [Label, Production, Total]
    expect(data[0]?.[1]).toBe("3");
    expect(data[0]?.[2]).toContain("3"); // Total column (HTML)

    expect(data[1]?.[1]).toBe("2");
    expect(data[1]?.[2]).toContain("2");
  });

  it("should generate Date Mismatches Over Time chart", () => {
    // Mock returns date range with exact dates needed
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue(["2023-01-15", "2023-02-10", "2023-03-01"]);

    const stats: SyncStats[] = [
      createStats({
        dateMismatches: [
          {
            diffHours: 25,
            environment: "Production",
            id: "1",
            isNew: true,
            scanDate: "2023-01-15T00:00:00Z",
            videoDate: ""
          },
          {
            diffHours: 35,
            environment: "Production",
            id: "2",
            isNew: false,
            scanDate: "2023-02-10T00:00:00Z",
            videoDate: ""
          }
        ],
        found: 10,
        videoHistory: {
          "2023-01-15": { count: 1, totalSize: 0 },
          "2023-02-10": { count: 1, totalSize: 0 },
          "2023-03-01": { count: 1, totalSize: 0 }
        }
      })
    ];
    const report = buildSyncReport(stats, {});
    // Should pass the Total Mismatches > 0 check to generate chart
    const chartSection = report.sections.find((s) => s.title === "Date Mismatches Over Time");
    expect(chartSection).toBeDefined();

    const config = chartSection?.data as LineChartConfig;
    // Now uses daily dates instead of monthly
    expect(config.labels).toEqual(["2023-01-15", "2023-02-10", "2023-03-01"]);
    // Jan 15: 1 mismatch. Feb 10: 1 mismatch. Mar 1: 0 mismatches.
    expect(config.datasets[0]?.data).toEqual([1, 1, 0]);
  });

  it("should handle zero count in video history for size chart", () => {
    // Mock returns the exact dates used in test data
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue(["2023-01-15", "2023-01-16"]);

    const stats: SyncStats[] = [
      createStats({
        found: 0,
        videoHistory: {
          "2023-01-15": { count: 0, totalSize: 0 },
          "2023-01-16": { count: 1, totalSize: 100 }
        }
      })
    ];
    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Average Video Size Over Time");
    const config = chartSection?.data as MixedChartConfig;

    // Verify cumulative size first data point is null when no data
    expect(config.datasets[0]?.data[0]).toBeNull();
    // Verify daily average first data point is null (zero count)
    expect(config.datasets[1]?.data[0]).toBeNull();
    expect(config.datasets[1]?.data[1]).toBe(100 / 1 / (1024 * 1024));
  });

  it("should render MismatchChartComponent", () => {
    const stats: SyncStats[] = [
      createStats({
        dateMismatches: [
          {
            diffHours: 26,
            environment: "Production",
            id: "1",
            isNew: true,
            scanDate: "2023-01-01T00:00:00Z",
            videoDate: ""
          }
        ],
        found: 0,
        videoHistory: { "2023-01-01": { count: 1, totalSize: 0 } }
      })
    ];
    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Date Mismatches Over Time");
    // Executing the component function to cover line 408
    const Component = chartSection?.component as React.FC;
    expect(Component).toBeDefined();
    const element = Component({});
    expect(element).toBeDefined();
  });

  it("pads mismatch difference only for single-digit day deltas", () => {
    const stats: SyncStats[] = [
      createStats({
        dateMismatches: [
          {
            diffHours: 240, // 10 days
            environment: "Production",
            id: "late",
            isNew: true,
            scanDate: "2023-04-01T00:00:00Z",
            videoDate: "2023-03-22T00:00:00Z"
          }
        ],
        found: 1,
        videoHistory: { "2023-04-01": { count: 1, totalSize: 0 } }
      })
    ];
    const report = buildSyncReport(stats, {});
    const mismatchSection = report.sections.find((s) => s.title === "Mismatches");
    const mismatchData = (mismatchSection?.data as string[]).join(" ");

    expect(mismatchData).toContain("10.0 days");
    expect(mismatchData).not.toContain("&nbsp;");
  });

  describe("Error formatting branch coverage", () => {
    it("should format single error per artifact (line 570)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [{ id: "scan1", reason: "Single Error" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = listSection?.data as string[];

      // Single error should be formatted as "id - error" (line 570)
      expect(data[0]).toContain("scan1");
      expect(data[0]).toContain("Single Error");
      expect(data[0]).toContain("-");
    });

    it("should format multiple errors per artifact (lines 572-575)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [
            { id: "scan1", reason: "Error A" },
            { id: "scan1", reason: "Error B" },
            { id: "scan1", reason: "Error C" }
          ],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = listSection?.data as string[];

      // Multiple errors should be formatted as "id" followed by bulleted list (lines 572-575)
      expect(data[0]).toContain("scan1");
      expect(data[0]).not.toContain("- Error");
      expect(data[1]).toContain("- Error A");
      expect(data[2]).toContain("- Error B");
      expect(data[3]).toContain("- Error C");
    });

    it("should format two error types with 'and' (line 552)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [
            { id: "scan1", reason: "RawScan download failed (404)" },
            { id: "scan1", reason: "Video download failed (404)" }
          ],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = (listSection?.data as string[]).join(" ");

      // Two types should use "and" (line 552)
      expect(data).toContain("and");
      expect(data).not.toContain(",");
    });

    it("should format single error type without 'and' (line 550)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [{ id: "scan1", reason: "RawScan download failed (404)" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = (listSection?.data as string[]).join(" ");

      // Single type should not use "and" (line 550)
      expect(data).toContain("Download failed (404) for RawScan");
      expect(data).not.toContain("and");
    });

    it("should handle case where newErrors or knownErrors are empty (line 587)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [],
          failed: 0,
          found: 10,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});

      // Should not have error sections when no errors
      const errorSection = report.sections.find((s) => s.title === "Inaccessible Artifacts");
      expect(errorSection).toBeUndefined();
    });
  });

  describe("Duplicate Videos", () => {
    it("should generate Duplicate Videos Summary table", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 3,
          duplicates: [
            {
              artifactId: "artifact1",
              duplicateIds: ["duplicate1", "duplicate2"],
              environment: "Production",
              hash: "hash123"
            },
            {
              artifactId: "artifact2",
              duplicateIds: ["duplicate3"],
              environment: "Production",
              hash: "hash456"
            }
          ],
          env: "Production",
          errors: [],
          failed: 0,
          found: 10,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const tableSection = report.sections.find((s) => s.title === "Duplicate Videos Summary");
      expect(tableSection).toBeDefined();
      expect(tableSection?.type).toBe("table");

      const data = tableSection?.data as string[][];
      expect(data[0]?.[1]).toBe("3");
      expect(data[0]?.[2]).toContain("3"); // Total column (HTML)
    });

    it("should include dates without duplicates in the trend chart", () => {
      // Mock returns the exact dates used in test data
      vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue(["2023-01-15", "2023-02-15"]);

      const stats: SyncStats[] = [
        createStats({
          duplicateCount: 1,
          duplicates: [
            {
              artifactId: "artifact1",
              duplicateIds: ["artifact2"],
              environment: "Production",
              hash: "hash123",
              scanDate: "2023-01-15"
            }
          ],
          found: 2,
          videoHistory: {
            "2023-01-15": { count: 1, totalSize: 0 },
            "2023-02-15": { count: 1, totalSize: 0 }
          }
        })
      ];

      const report = buildSyncReport(stats, {});
      const chartSection = report.sections.find((s) => s.title === "Duplicate Videos Over Time");
      expect(chartSection).toBeDefined();
      const config = chartSection?.data as LineChartConfig;

      expect(config.labels).toEqual(["2023-01-15", "2023-02-15"]);
      expect(config.datasets[0]?.data).toEqual([1, 0]);
    });

    it("should generate detailed Duplicate Videos list", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 2,
          duplicates: [
            {
              artifactId: "artifact1",
              duplicateIds: ["duplicate1", "duplicate2"],
              environment: "Production",
              hash: "hash123"
            },
            {
              artifactId: "artifact2",
              duplicateIds: ["duplicate3"],
              environment: "Production",
              hash: "hash456"
            }
          ],
          env: "Production",
          errors: [],
          failed: 0,
          found: 10,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const headerSection = report.sections.find((s) => s.title === "Duplicate Videos");
      expect(headerSection).toBeDefined();

      const listSection = report.sections.find((s) => s.title === "Duplicates" && s.level === 4);
      expect(listSection).toBeDefined();
      expect(listSection?.type).toBe("list");

      const data = listSection?.data as string[];
      expect(data.length).toBeGreaterThan(0);
      // With nested HTML lists, artifacts are inside <ul><li> tags within the hash lines
      // So we need to check the combined HTML content
      const allContent = data.join(" ");

      // Check that both hashes appear
      expect(allContent).toContain("hash123");
      expect(allContent).toContain("hash456");
      // Check that all artifacts appear (they're now in <li> tags)
      expect(allContent).toContain("artifact1");
      expect(allContent).toContain("artifact2");
      expect(allContent).toContain("duplicate1");
      expect(allContent).toContain("duplicate2");
      expect(allContent).toContain("duplicate3");
      // Check that environments are shown
      expect(allContent).toContain("Production");
      // Check that nested list structure is present
      expect(allContent).toContain("<ul");
      expect(allContent).toContain("<li");
    });

    it("resolves duplicate environments across environments and sorts IDs", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 1,
          duplicates: [
            {
              artifactId: "prod1",
              duplicateIds: ["stage1"],
              environment: "Production",
              hash: "shared-hash",
              scanDate: "2024-01-02"
            }
          ],
          env: "Production",
          errors: [],
          failed: 0,
          found: 2,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        },
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 2,
          duplicates: [
            {
              artifactId: "stage1",
              duplicateIds: ["prod1"],
              environment: "Staging",
              hash: "shared-hash",
              scanDate: "2024-01-03"
            },
            {
              artifactId: "stage2",
              duplicateIds: [],
              environment: "Staging",
              hash: "unique-hash",
              scanDate: "2024-01-04"
            }
          ],
          env: "Staging",
          errors: [],
          failed: 0,
          found: 2,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "Duplicates" && s.level === 4);
      expect(listSection).toBeDefined();
      if (listSection?.type !== "list") {
        throw new Error("Expected Duplicate Videos list section");
      }

      const content = (listSection.data as string[]).join(" ");
      expect(content).toContain("shared-hash");
      expect(content).toContain("prod1");
      expect(content).toContain("stage1");
      expect(content).toContain("(Production)");
      expect(content).toContain("(Staging)");
      // Environment sort should place Production before Staging in the nested list
      expect(content.indexOf("Production")).toBeLessThan(content.indexOf("Staging"));
    });

    it("should not include New Duplicates row in Sync Summary table (duplicates are shown in separate table)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 5,
          duplicates: [],
          env: "Production",
          errors: [],
          failed: 0,
          found: 10,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const summarySection = report.sections.find((s) => s.title === "Sync Summary");
      expect(summarySection).toBeDefined();

      const data = summarySection?.data as string[][];
      const newDuplicatesRow = data.find((row) => row[0] === "New Duplicates");
      expect(newDuplicatesRow).toBeUndefined();
    });

    it("should not show Duplicate Videos section when there are no duplicates", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          dateMismatches: [],
          duplicateCount: 0,
          duplicates: [],
          env: "Production",
          errors: [],
          failed: 0,
          found: 10,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 0,
          newArDataSize: 0,
          newDuplicateCount: 0,
          newFailures: 0,
          newInitialLayoutSize: 0,
          newPointCloudSize: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          pointCloudHistory: {},
          pointCloudSize: 0,
          processedIds: new Set(),
          rawScanHistory: {},
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];

      const report = buildSyncReport(stats, {});
      const duplicateSection = report.sections.find((s) => s.title === "Duplicate Videos Summary");
      expect(duplicateSection).toBeUndefined();

      const duplicateHeader = report.sections.find((s) => s.title === "Duplicate Videos");
      expect(duplicateHeader).toBeUndefined();
    });
  });
});
