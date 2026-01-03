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

vi.mock("../../../config/config", () => ({
  CHART_DATE_RANGE: {
    startDate: "2023-01-01"
  },
  ENVIRONMENTS: []
}));

const createStats = (overrides: Partial<SyncStats> = {}): SyncStats => ({
  arDataHistory: overrides.arDataHistory ?? {},
  arDataSize: overrides.arDataSize ?? 0,
  env: overrides.env ?? "Production",
  errors: overrides.errors ?? [],
  failed: overrides.failed ?? 0,
  found: overrides.found ?? 0,
  initialLayoutHistory: overrides.initialLayoutHistory ?? {},
  initialLayoutSize: overrides.initialLayoutSize ?? 0,
  knownFailures: overrides.knownFailures ?? 0,
  new: overrides.new ?? 0,
  newArDataSize: overrides.newArDataSize ?? 0,
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
        env: "Production",
        errors: [],
        failed: 0,
        found: 10,
        initialLayoutHistory: {},
        initialLayoutSize: 0,
        knownFailures: 0,
        new: 0,
        newArDataSize: 0,
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
        env: "Production",
        errors: [{ id: "scan1", reason: "Access Denied" }],
        failed: 1,
        found: 10,
        initialLayoutHistory: {},
        initialLayoutSize: 0,
        knownFailures: 0,
        new: 5,
        newArDataSize: 0,
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
          env: "Production",
          errors: [{ id: "known1", reason: "Access Denied" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 1, // Stats are computed independently, report logic uses this
          new: 0,
          newArDataSize: 0,
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
          env: "Production",
          errors: [{ id: "scan1", reason: "RawScan download failed (404)" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
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
          { date: "2023-01-16", id: "2", reason: "Fail" },
          { date: "2023-02-15", id: "3", reason: "Fail" }
        ],
        failed: 3,
        found: 10,
        videoHistory: {
          "2023-01-15": { count: 1, totalSize: 0 },
          "2023-02-15": { count: 1, totalSize: 0 },
          "2023-03-15": { count: 1, totalSize: 0 }
        }
      })
    ];
    const report = buildSyncReport(stats, {});
    // Find the chart
    const chartSection = report.sections.find((s) => s.title === "Inaccessible Artifacts Over Time");
    expect(chartSection).toBeDefined();
    expect(chartSection?.type).toBe("react-component");

    const config = chartSection?.data as LineChartConfig;
    // Uses global date range from getGlobalDateRange() mock
    expect(config.labels).toEqual(["2023-01-15", "2023-01-16", "2023-02-15", "2023-03-15"]);
    expect(config.datasets[0]?.label).toBe("Production");
    // Values per day: 2023-01-15=1, 2023-01-16=1, 2023-02-15=1, 2023-03-15=0
    expect(config.datasets[0]?.data).toEqual([1, 1, 1, 0]);
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

  it("returns null points when artifact counts stay zero for all dates", () => {
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue(["2023-01-15", "2023-01-16"]);

    const stats: SyncStats[] = [
      createStats({
        rawScanHistory: {
          "2023-01-15": { count: 0, totalSize: 0 },
          "2023-01-16": { count: 0, totalSize: 0 }
        }
      })
    ];

    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Average RawScan Size Over Time");
    const config = chartSection?.data as MixedChartConfig;

    const nullDataset = new Array(config.labels.length).fill(null);

    // All datasets should return null when counts and cumulative totals remain zero
    expect(config.datasets[0]?.data).toEqual(nullDataset); // cumulative total size
    expect(config.datasets[1]?.data).toEqual(nullDataset); // daily average
    expect(config.datasets[2]?.data).toEqual(nullDataset); // cumulative average
  });

  it("keeps aggregated video size series null when all counts are zero", () => {
    vi.mocked(dateRangeModule.getGlobalDateRange).mockReturnValue(["2023-01-15", "2023-01-16"]);

    const stats: SyncStats[] = [
      createStats({
        videoHistory: {
          "2023-01-15": { count: 0, totalSize: 0 },
          "2023-01-16": { count: 0, totalSize: 0 }
        }
      }),
      createStats({
        env: "Staging",
        videoHistory: {
          "2023-01-15": { count: 0, totalSize: 0 },
          "2023-01-16": { count: 0, totalSize: 0 }
        }
      })
    ];

    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Average Video Size Over Time");
    const config = chartSection?.data as MixedChartConfig;

    const nullDataset = new Array(config.labels.length).fill(null);
    expect(config.datasets[0]?.data).toEqual(nullDataset);
    expect(config.datasets[1]?.data).toEqual(nullDataset);
    expect(config.datasets[2]?.data).toEqual(nullDataset);
  });

  describe("Error formatting branch coverage", () => {
    it("should format single error per artifact (line 570)", () => {
      const stats: SyncStats[] = [
        {
          arDataHistory: {},
          arDataSize: 0,
          env: "Production",
          errors: [{ id: "scan1", reason: "Single Error" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
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
          env: "Production",
          errors: [{ id: "scan1", reason: "RawScan download failed (404)" }],
          failed: 1,
          found: 1,
          initialLayoutHistory: {},
          initialLayoutSize: 0,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
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

    it("should handle error reasons without status (line 668)", () => {
      const stats: SyncStats[] = [
        createStats({
          env: "Production",
          errors: [{ id: "scan1", reason: "Video download failed" }],
          failed: 1,
          found: 1
        })
      ];
      const report = buildSyncReport(stats, {});
      const listSection = report.sections.find((s) => s.title === "New Inaccessible");
      const data = (listSection?.data as string[]).join(" ");
      expect(data).toContain("Download failed (unknown) for Video");
    });

    it("should skip environment if no new or known errors remain (line 627)", () => {
      const stats: SyncStats[] = [
        createStats({
          env: "Production",
          errors: [{ id: "scan1", reason: "initialLayout download failed (404)" }],
          failed: 1,
          found: 1,
          knownFailures: 1
        })
      ];
      // known1 is known failure, and it's initialLayout, so it's filtered out
      const failures: SyncFailureDatabase = {
        scan1: { date: "2023-01-01", environment: "Production", reasons: ["initialLayout download failed (404)"] }
      };
      const report = buildSyncReport(stats, failures);
      // Environment header should NOT exist because all errors were filtered
      expect(report.sections.some((s) => s.title === "Environment: Production")).toBe(false);
    });
  });
});
