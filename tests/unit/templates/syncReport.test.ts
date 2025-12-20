import { describe, expect, it } from "vitest";
import { buildSyncReport } from "../../../src/templates/syncReport";
import { SyncStats } from "../../../src/models/syncStats";
import { SyncFailureDatabase } from "../../../src/utils/data/syncFailures";

describe("buildSyncReport", () => {
  it("should generate summary table and handle no failures", () => {
    const stats: SyncStats[] = [
      {
        env: "Production",
        errors: [],
        failed: 0,
        found: 10,
        knownFailures: 0,
        new: 0,

        newFailures: 0,
        processedIds: new Set(),
        skipped: 0
      }
    ];
    const failures: SyncFailureDatabase = {};

    const report = buildSyncReport(stats, failures);

    expect(report.title).toBe("Inaccessible Artifacts Report");
    expect(report.sections[0]?.title).toBe("Sync Summary");
    expect(report.sections[1]?.data).toBe("No failures occurred during sync.");
  });

  it("should report failures categorized as new or known", () => {
    const stats: SyncStats[] = [
      {
        env: "Production",
        errors: [{ id: "scan1", reason: "Access Denied" }],
        failed: 1,
        found: 10,
        knownFailures: 0,
        new: 5,
        newFailures: 1,
        processedIds: new Set(),
        skipped: 0
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
        newFailures: 1,
        processedIds: new Set(),
        skipped: 0
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
          env: "Production",
          errors: [{ id: "known1", reason: "Access Denied" }],
          failed: 1,
          found: 1,
          knownFailures: 1, // Stats are computed independently, report logic uses this
          new: 0,
          newFailures: 0,
          processedIds: new Set(),
          skipped: 0
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
          newFailures: 1,
          processedIds: new Set(),
          skipped: 0
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
          env: "Production",
          errors: [{ id: "scan1", reason: "RawScan download failed (404)" }],
          failed: 1,
          found: 1,
          knownFailures: 0,
          new: 1,
          newFailures: 1,
          processedIds: new Set(),
          skipped: 0
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
          env: "Production",
          errors: [
            { id: "scan1", reason: "Error A" },
            { id: "scan1", reason: "Error B" }
          ],
          failed: 1,
          found: 1,
          knownFailures: 0,
          new: 1,
          newFailures: 1,
          processedIds: new Set(),
          skipped: 0
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
});
