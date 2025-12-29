import { describe, expect, it } from "vitest";

import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { BarChartConfig } from "../../../src/models/chart/barChartConfig";
import { DiscardReportInput } from "../../../src/models/discardStats";
import { buildDiscardReport } from "../../../src/templates/discardReport";

describe("buildDiscardReport", () => {
  it("builds summary, distributions, and detail table when new bad scans exist", () => {
    const input: DiscardReportInput = {
      artifactCount: 5,
      artifactsAfterClean: 4,
      badScanHistory: [
        { environment: "production", id: "short-1", reason: "Video too short (5s)", scanDate: "2025-01-15T10:00:00Z" },
        { environment: "staging", id: "short-2", reason: "Video too short (3s)", scanDate: "2025-01-15T10:00:00Z" },
        { environment: "production", id: "nb-1", reason: "Not a bathroom (Gemini)", scanDate: "2025-02-20T10:00:00Z" },
        { environment: "staging", id: "nb-2", reason: "Not a bathroom (Gemini)", scanDate: "2025-02-20T10:00:00Z" }
      ],
      badScansByEnv: { production: 3, staging: 2 },
      cleanStats: { failedDeletes: ["fail-1"], quarantinedCount: 1, removedCount: 1, skippedCleanCount: 0 },
      countsByEnv: {
        production: {
          notBathroomCached: 1,
          notBathroomNew: 1,
          processed: 10,
          tooShortCached: 0,
          tooShortNew: 1,
          validCached: 5,
          validNew: 2
        },
        staging: {
          notBathroomCached: 0,
          notBathroomNew: 1,
          processed: 5,
          tooShortCached: 1,
          tooShortNew: 0,
          validCached: 2,
          validNew: 1
        }
      },
      discardedOnDiskCount: 123,
      dryRun: false,
      filterStats: { errors: 0, processed: 3, removed: 2, skipped: 0, skippedAmbiguous: 1, skippedCached: 0 },
      finalBadScanCount: 5,
      initialBadScanCount: 2,
      minDuration: 12,
      newBadScans: [
        { environment: "production", id: "abc<script>", reason: "Missing video.mp4", stage: "clean" },
        { environment: "staging", id: "filter-1", reason: "Not a bathroom", stage: "filter" },
        { environment: "staging", id: "filter-2", reason: "Not a bathroom", stage: "filter" }
      ]
    };

    const report = buildDiscardReport(input);
    expect(report.title).toBe("Discard Report");

    const summarySection = report.sections.find((s) => s.title === "Processing Summary");
    expect(summarySection?.type).toBe("table");
    if (summarySection?.type === "table") {
      const headers = (summarySection.options as { headers?: string[] } | undefined)?.headers ?? [];
      expect(headers).toEqual(["", "production", "staging", "Total"]);
      const rows = summarySection.data as string[][];
      expect(rows[0]?.[0]).toBe("Artifacts Processed");
      expect(rows[1]?.[0]).toBe("Valid");
      expect(rows[2]?.[0]).toBe("    Cached");
      expect(rows[3]?.[0]).toBe("    New");
      expect(rows[4]?.[0]).toBe("Video < 12 s");
      expect(rows[5]?.[0]).toBe("    Cached");
      expect(rows[6]?.[0]).toBe("    New");
      expect(rows[7]?.[0]).toBe("Not a Bathroom");
      expect(rows[8]?.[0]).toBe("    Cached");
      expect(rows[9]?.[0]).toBe("    New");
    }

    const distributionRow = report.sections.find((s) => s.type === "chart-row");
    expect(distributionRow).toBeDefined();
    if (distributionRow?.type === "chart-row") {
      const charts = distributionRow.data as { title?: string; data: ChartConfiguration }[];
      const reasonChart = charts.find((c) => c.title === "Reasons")?.data as BarChartConfig | undefined;
      const environmentChart = charts.find((c) => c.title === "Environments")?.data as BarChartConfig | undefined;

      expect(reasonChart?.labels).toEqual(["Not a bathroom", "Missing video.mp4"]);
      expect(environmentChart?.labels).toEqual(["staging", "production"]);
    }

    const detailSection = report.sections.find((s) => s.title === "New Bad Scans");
    expect(detailSection?.type).toBe("table");
    if (detailSection?.type === "table") {
      const rows = detailSection.data as string[][];
      expect(rows[0]?.[0]).toContain("&lt;script&gt;");
      expect(rows[0]?.[3]).toBe("Clean");
    }

    const failedSection = report.sections.find((s) => s.title === "Failed Moves (Clean Stage)");
    expect(failedSection?.type).toBe("list");
  });

  it("handles runs with no new bad scans", () => {
    const input: DiscardReportInput = {
      artifactCount: 2,
      artifactsAfterClean: 2,
      badScanHistory: [],
      badScansByEnv: { production: 1 },
      cleanStats: { failedDeletes: [], quarantinedCount: 0, removedCount: 0, skippedCleanCount: 2 },
      countsByEnv: {
        production: {
          notBathroomCached: 0,
          notBathroomNew: 0,
          processed: 2,
          tooShortCached: 1,
          tooShortNew: 0,
          validCached: 1,
          validNew: 0
        }
      },
      discardedOnDiskCount: 0,
      dryRun: true,
      filterStats: { errors: 0, processed: 0, removed: 0, skipped: 0, skippedAmbiguous: 0, skippedCached: 0 },
      finalBadScanCount: 1,
      initialBadScanCount: 1,
      minDuration: 12,
      newBadScans: []
    };

    const report = buildDiscardReport(input);
    expect(report.sections.some((s) => s.title === "Dry Run")).toBe(true);
    // Should not have a New Bad Scans section when there are none
    expect(report.sections.some((s) => s.title === "New Bad Scans")).toBe(false);
  });
});
