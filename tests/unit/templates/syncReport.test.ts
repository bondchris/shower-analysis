import { describe, expect, it } from "vitest";
import { buildSyncReport } from "../../../src/templates/syncReport";
import { SyncStats } from "../../../src/models/syncStats";
import { SyncFailureDatabase } from "../../../src/utils/data/syncFailures";
import { LineChartConfig } from "../../../src/utils/chartUtils";

describe("buildSyncReport", () => {
  it("should generate summary table and handle no failures", () => {
    const stats: SyncStats[] = [
      {
        arDataSize: 1024 * 50, // 50 KB
        env: "Production",
        errors: [],
        failed: 0,
        found: 10,
        knownFailures: 0,
        new: 0,
        newArDataSize: 0,
        newFailures: 0,
        newRawScanSize: 0,
        newVideoSize: 0,
        processedIds: new Set(),
        rawScanSize: 1024 * 1024 * 10, // 10 MB
        skipped: 0,
        videoHistory: {},
        videoSize: 1024 * 1024 * 100 // 100 MB
      }
    ];
    const failures: SyncFailureDatabase = {};

    const report = buildSyncReport(stats, failures);

    expect(report.title).toBe("Inaccessible Artifacts Report");
    expect(report.sections[0]?.title).toBe("Sync Summary");
    expect(report.sections[1]?.title).toBe("Disk Usage Summary");
    expect(report.sections[2]?.data).toBe("No failures occurred during sync.");

    // Verify formatBytes output in Disk Usage Summary
    const usageData = report.sections[1]?.data as string[][];

    // Video Total
    expect(usageData[0]?.[1]).toBe("100 MB");
    // Video Avg
    expect(usageData[1]?.[1]).toBe("10 MB");
    // Video New
    expect(usageData[2]?.[1]).toBe("0 B");

    // ArData Total
    expect(usageData[3]?.[1]).toBe("50 KB");
    // ArData Avg
    expect(usageData[4]?.[1]).toBe("5 KB");
    // ArData New
    expect(usageData[5]?.[1]).toBe("0 B");

    // RawScan Total
    expect(usageData[6]?.[1]).toBe("10 MB");
    // RawScan Avg
    expect(usageData[7]?.[1]).toBe("1 MB");
    // RawScan New
    expect(usageData[8]?.[1]).toBe("0 B");
  });
  it("should report failures categorized as new or known", () => {
    const stats: SyncStats[] = [
      {
        arDataSize: 0,
        env: "Production",
        errors: [{ id: "scan1", reason: "Access Denied" }],
        failed: 1,
        found: 10,
        knownFailures: 0,
        new: 5,
        newArDataSize: 0,
        newFailures: 1,
        newRawScanSize: 0,
        newVideoSize: 0,
        processedIds: new Set(),
        rawScanSize: 0,
        skipped: 0,
        videoHistory: {},
        videoSize: 0
      }
    ];
    const failures: SyncFailureDatabase = {}; // No known failures

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
        knownFailures: 0,
        new: 5,
        newArDataSize: 0,
        newFailures: 1,
        newRawScanSize: 0,
        newVideoSize: 0,
        processedIds: new Set(),
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
          arDataSize: 0,
          env: "Production",
          errors: [{ id: "known1", reason: "Access Denied" }],
          failed: 1,
          found: 1,
          knownFailures: 1, // Stats are computed independently, report logic uses this
          new: 0,
          newArDataSize: 0,
          newFailures: 0,
          newRawScanSize: 0,
          newVideoSize: 0,
          processedIds: new Set(),
          rawScanSize: 0,
          skipped: 0,
          videoHistory: {},
          videoSize: 0
        }
      ];
      // Define a known failure
      const failures: SyncFailureDatabase = {
        known1: { date: "2023-01-01", environment: "Production", reason: "Access Denied" }
      };

      const report = buildSyncReport(stats, failures);
      const listSection = report.sections.find((s) => s.title === "Known Inaccessible");
      expect(listSection).toBeDefined();

      const data = (listSection?.data as string[]).join(" ");
      expect(data).toContain("known1");
      expect(data).toContain("Access Denied");
    });

    it("should format list of 3+ failure types with Oxford comma", () => {
      const stats: SyncStats[] = [
        {
          arDataSize: 0,
          env: "Production",
          errors: [
            { id: "scan1", reason: "RawScan download failed (404)" },
            { id: "scan1", reason: "Video download failed (404)" },
            { id: "scan1", reason: "ArData download failed (404)" }
          ],
          failed: 1,
          found: 1,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newFailures: 1,
          newRawScanSize: 0,
          newVideoSize: 0,
          processedIds: new Set(),
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
          arDataSize: 0,
          env: "Production",
          errors: [{ id: "scan1", reason: "RawScan download failed (404)" }],
          failed: 1,
          found: 1,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newFailures: 1,
          newRawScanSize: 0,
          newVideoSize: 0,
          processedIds: new Set(),
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
          arDataSize: 0,
          env: "Production",
          errors: [
            { id: "scan1", reason: "Error A" },
            { id: "scan1", reason: "Error B" }
          ],
          failed: 1,
          found: 1,
          knownFailures: 0,
          new: 1,
          newArDataSize: 0,
          newFailures: 1,
          newRawScanSize: 0,
          newVideoSize: 0,
          processedIds: new Set(),
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
    const stats: SyncStats[] = [
      {
        arDataSize: 0,
        env: "Production",
        errors: [],
        failed: 0,
        found: 2,
        knownFailures: 0,
        new: 0,
        newArDataSize: 0,
        newFailures: 0,
        newRawScanSize: 0,
        newVideoSize: 0,
        processedIds: new Set(),
        rawScanSize: 0,
        skipped: 0,
        videoHistory: {
          "2023-01": { count: 2, totalSize: 1048576 * 20 } // 20 MB total, 10 MB avg
        },
        videoSize: 0
      }
    ];

    const report = buildSyncReport(stats, {});
    const chartSection = report.sections.find((s) => s.title === "Average Video Size Trend");
    expect(chartSection).toBeDefined();
    expect(chartSection?.type).toBe("react-component");

    // Check config
    const config = chartSection?.data as LineChartConfig;
    expect(config).toBeDefined();
    expect(config.labels).toEqual(["2023-01"]);
    expect(config.datasets[0]?.data).toEqual([10]); // 20MB / 2 = 10MB
    expect(config.datasets[0]?.label).toBe("Production");
  });

  it("should handle zero artifacts found correctly (division by zero protection)", () => {
    const stats: SyncStats[] = [
      {
        arDataSize: 0,
        env: "Production",
        errors: [],
        failed: 0,
        found: 0, // Zero found
        knownFailures: 0,
        new: 0,
        newArDataSize: 0,
        newFailures: 0,
        newRawScanSize: 0,
        newVideoSize: 0,
        processedIds: new Set(),
        rawScanSize: 0,
        skipped: 0,
        videoHistory: {},
        videoSize: 0
      }
    ];

    const report = buildSyncReport(stats, {});
    const diskUsageSection = report.sections.find((s) => s.title === "Disk Usage Summary");
    const tableData = diskUsageSection?.data as string[][];

    // Video Avg Row (Index 1)
    // Should be "0 B" or similar, not NaN or Infinity
    expect(tableData[1]?.[1]).toBe("0 B");
  });
});
