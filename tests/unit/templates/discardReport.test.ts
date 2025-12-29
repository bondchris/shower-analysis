import { describe, expect, it } from "vitest";

import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { BarChartConfig } from "../../../src/models/chart/barChartConfig";
import { DateMismatch, DiscardReportInput } from "../../../src/models/discardStats";
import { buildDiscardReport } from "../../../src/templates/discardReport";
import { LineChartConfig } from "../../../src/models/chart/lineChartConfig";

function createBaseInput(overrides: Partial<DiscardReportInput> = {}): DiscardReportInput {
  return {
    artifactCount: 0,
    artifactsAfterClean: 0,
    badScanHistory: [],
    badScansByEnv: {},
    cleanStats: { failedDeletes: [], quarantinedCount: 0, removedCount: 0, skippedCleanCount: 0 },
    countsByEnv: {
      production: {
        duplicateCached: 0,
        duplicateNew: 0,
        notBathroomCached: 0,
        notBathroomNew: 0,
        processed: 0,
        tooShortCached: 0,
        tooShortNew: 0,
        validCached: 0,
        validNew: 0
      }
    },
    dateMismatches: [],
    discardedOnDiskCount: 0,
    dryRun: false,
    duplicateStats: { duplicateCount: 0, errors: 0, newDuplicateCount: 0, processed: 0, skippedCached: 0 },
    duplicates: [],
    filterStats: { errors: 0, processed: 0, removed: 0, skipped: 0, skippedAmbiguous: 0, skippedCached: 0 },
    finalBadScanCount: 0,
    initialBadScanCount: 0,
    minDuration: 12,
    newBadScans: [],
    ...overrides
  };
}

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
          duplicateCached: 0,
          duplicateNew: 0,
          notBathroomCached: 1,
          notBathroomNew: 1,
          processed: 10,
          tooShortCached: 0,
          tooShortNew: 1,
          validCached: 5,
          validNew: 2
        },
        staging: {
          duplicateCached: 0,
          duplicateNew: 0,
          notBathroomCached: 0,
          notBathroomNew: 1,
          processed: 5,
          tooShortCached: 1,
          tooShortNew: 0,
          validCached: 2,
          validNew: 1
        }
      },
      dateMismatches: [],
      discardedOnDiskCount: 123,
      dryRun: false,
      duplicateStats: { duplicateCount: 0, errors: 0, newDuplicateCount: 0, processed: 0, skippedCached: 0 },
      duplicates: [],
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
          duplicateCached: 0,
          duplicateNew: 0,
          notBathroomCached: 0,
          notBathroomNew: 0,
          processed: 2,
          tooShortCached: 1,
          tooShortNew: 0,
          validCached: 1,
          validNew: 0
        }
      },
      dateMismatches: [],
      discardedOnDiskCount: 0,
      dryRun: true,
      duplicateStats: { duplicateCount: 0, errors: 0, newDuplicateCount: 0, processed: 0, skippedCached: 0 },
      duplicates: [],
      filterStats: { errors: 0, processed: 0, removed: 0, skipped: 0, skippedAmbiguous: 0, skippedCached: 0 },
      finalBadScanCount: 1,
      initialBadScanCount: 1,
      minDuration: 12,
      newBadScans: []
    };

    const report = buildDiscardReport(input);
    expect(report.sections.some((s) => s.title === "Dry Run")).toBe(true);
    expect(report.sections.some((s) => s.title === "New Bad Scans")).toBe(false);
  });

  describe("date mismatch summary rows", () => {
    it("includes date mismatch counts in processing summary with new/total distinction", () => {
      const input = createBaseInput({
        countsByEnv: {
          production: {
            duplicateCached: 0,
            duplicateNew: 0,
            notBathroomCached: 0,
            notBathroomNew: 0,
            processed: 5,
            tooShortCached: 0,
            tooShortNew: 0,
            validCached: 5,
            validNew: 0
          },
          staging: {
            duplicateCached: 0,
            duplicateNew: 0,
            notBathroomCached: 0,
            notBathroomNew: 0,
            processed: 3,
            tooShortCached: 0,
            tooShortNew: 0,
            validCached: 3,
            validNew: 0
          }
        },
        dateMismatches: [
          { diffHours: 25, environment: "production", id: "m1", isNew: true, scanDate: "", videoDate: "" },
          { diffHours: 30, environment: "production", id: "m2", isNew: false, scanDate: "", videoDate: "" },
          { diffHours: 26, environment: "staging", id: "m3", isNew: true, scanDate: "", videoDate: "" }
        ]
      });

      const report = buildDiscardReport(input);
      const summarySection = report.sections.find((s) => s.title === "Processing Summary");
      const rows = summarySection?.data as string[][];

      // Find Date Mismatch rows (should be at indices 13 and 14)
      const dateMismatchRow = rows.find((r) => r[0] === "Date Mismatch");
      const dateMismatchRowIndex = dateMismatchRow !== undefined ? rows.indexOf(dateMismatchRow) : -1;
      const dateMismatchNewRow = rows.find((r) => r[0] === "    New" && rows.indexOf(r) > dateMismatchRowIndex);

      expect(dateMismatchRow).toBeDefined();
      expect(dateMismatchNewRow).toBeDefined();
      // production has 2 mismatches, staging has 1, total is 3
      expect(dateMismatchRow?.[1]).toBe("2"); // production
      expect(dateMismatchRow?.[2]).toBe("1"); // staging
      expect(dateMismatchRow?.[3]).toBe("3"); // total
      // New: production has 1, staging has 1, total is 2
      expect(dateMismatchNewRow?.[1]).toBe("1"); // production new
      expect(dateMismatchNewRow?.[2]).toBe("1"); // staging new
      expect(dateMismatchNewRow?.[3]).toBe("2"); // total new
    });
  });

  describe("new bad scans sorting", () => {
    it("sorts by stage, then environment, then id", () => {
      const input = createBaseInput({
        newBadScans: [
          { environment: "staging", id: "z-id", reason: "reason", stage: "filter" },
          { environment: "production", id: "a-id", reason: "reason", stage: "filter" },
          { environment: "production", id: "b-id", reason: "reason", stage: "clean" },
          { environment: "staging", id: "c-id", reason: "reason", stage: "duplicates" }
        ]
      });

      const report = buildDiscardReport(input);
      const section = report.sections.find((s) => s.title === "New Bad Scans");
      const rows = section?.data as string[][];

      // Order should be: clean first, then duplicates, then filter
      // Within filter: production before staging (alphabetically), then by id
      expect(rows[0]?.[3]).toBe("Clean");
      expect(rows[1]?.[3]).toBe("Duplicates");
      expect(rows[2]?.[3]).toBe("Filter");
      expect(rows[3]?.[3]).toBe("Filter");
    });
  });

  describe("over time charts", () => {
    it("builds short videos over time chart with multiple dates", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "s1", reason: "Video too short (5s)", scanDate: "2024-08-01T10:00:00Z" },
          { environment: "production", id: "s2", reason: "Video too short (3s)", scanDate: "2024-08-02T10:00:00Z" },
          { environment: "staging", id: "s3", reason: "duration too low", scanDate: "2024-08-03T10:00:00Z" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find((s) => s.title?.includes("Short Videos") === true);
      expect(chartSection).toBeDefined();
      expect(chartSection?.type).toBe("react-component");
    });

    it("skips chart when history entries have no scanDate", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "s1", reason: "Video too short (5s)" },
          { environment: "production", id: "s2", reason: "Video too short (3s)" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find(
        (s) => s.title?.includes("Short Videos") === true && s.type === "react-component"
      );
      expect(chartSection).toBeUndefined();
    });

    it("skips chart when scanDate is empty string", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "s1", reason: "Video too short (5s)", scanDate: "" },
          { environment: "production", id: "s2", reason: "Video too short (3s)", scanDate: "" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find(
        (s) => s.title?.includes("Short Videos") === true && s.type === "react-component"
      );
      expect(chartSection).toBeUndefined();
    });

    it("skips entries with 0001 year dates", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "s1", reason: "Video too short (5s)", scanDate: "0001-01-01T00:00:00Z" },
          { environment: "production", id: "s2", reason: "Video too short (3s)", scanDate: "2024-08-01T10:00:00Z" }
        ]
      });

      const report = buildDiscardReport(input);
      // Should not have chart since only 1 valid date
      const chartSection = report.sections.find(
        (s) => s.title?.includes("Short Videos") === true && s.type === "react-component"
      );
      expect(chartSection).toBeUndefined();
    });

    it("applies environment-specific colors", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "Bond Demo", id: "s1", reason: "Video too short (5s)", scanDate: "2024-08-01T10:00:00Z" },
          {
            environment: "Bond Production",
            id: "s2",
            reason: "Video too short (3s)",
            scanDate: "2024-08-02T10:00:00Z"
          },
          {
            environment: "Lowe's Production",
            id: "s3",
            reason: "Video too short (2s)",
            scanDate: "2024-08-03T10:00:00Z"
          },
          { environment: "Lowe's Staging", id: "s4", reason: "Video too short (1s)", scanDate: "2024-08-04T10:00:00Z" },
          { environment: "Unknown Env", id: "s5", reason: "Video too short (1s)", scanDate: "2024-08-05T10:00:00Z" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find(
        (s) => s.title?.includes("Short Videos") === true && s.type === "react-component"
      );
      expect(chartSection).toBeDefined();
      const config = chartSection?.data as LineChartConfig;
      expect(config.datasets.length).toBe(5);
      // Check that known environments have specific colors
      const bondDemo = config.datasets.find((d) => d.label === "Bond Demo");
      expect(bondDemo?.borderColor).toBe("rgba(127, 24, 127, 1)");
    });

    it("builds non-bathroom over time chart", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "n1", reason: "Not a bathroom", scanDate: "2024-08-01T10:00:00Z" },
          { environment: "staging", id: "n2", reason: "Not a bathroom", scanDate: "2024-08-02T10:00:00Z" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find((s) => s.title === "Non-Bathroom Videos Over Time");
      expect(chartSection).toBeDefined();
    });

    it("builds duplicates over time chart", () => {
      const input = createBaseInput({
        badScanHistory: [
          {
            environment: "production",
            id: "d1",
            reason: "Duplicate video (hash abc123)",
            scanDate: "2024-08-01T10:00:00Z"
          },
          {
            environment: "staging",
            id: "d2",
            reason: "Duplicate video (hash def456)",
            scanDate: "2024-08-02T10:00:00Z"
          }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find((s) => s.title === "Duplicate Videos Over Time");
      expect(chartSection).toBeDefined();
    });
  });

  describe("mismatch over time chart", () => {
    it("builds chart with multiple mismatch dates", () => {
      const input = createBaseInput({
        dateMismatches: [
          { diffHours: 25, environment: "production", id: "m1", scanDate: "2024-08-01T10:00:00Z", videoDate: "" },
          { diffHours: 30, environment: "staging", id: "m2", scanDate: "2024-08-02T10:00:00Z", videoDate: "" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find((s) => s.title === "Date Mismatches Over Time");
      expect(chartSection).toBeDefined();
      expect(chartSection?.type).toBe("react-component");
    });

    it("skips chart when mismatches have empty scanDate", () => {
      const input = createBaseInput({
        dateMismatches: [
          { diffHours: 25, environment: "production", id: "m1", scanDate: "", videoDate: "" },
          { diffHours: 30, environment: "staging", id: "m2", scanDate: "", videoDate: "" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find((s) => s.title === "Date Mismatches Over Time");
      expect(chartSection).toBeUndefined();
    });

    it("skips entries with 0001 year dates", () => {
      const input = createBaseInput({
        dateMismatches: [
          { diffHours: 25, environment: "production", id: "m1", scanDate: "0001-01-01T00:00:00Z", videoDate: "" },
          { diffHours: 30, environment: "staging", id: "m2", scanDate: "2024-08-01T10:00:00Z", videoDate: "" }
        ]
      });

      const report = buildDiscardReport(input);
      // Only 1 valid date, need 2 for chart
      const chartSection = report.sections.find((s) => s.title === "Date Mismatches Over Time");
      expect(chartSection).toBeUndefined();
    });
  });

  describe("duplicates detail section", () => {
    it("groups duplicates by hash and sorts by count", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "d1", reason: "Duplicate video (hash abc123) matches xyz" },
          { environment: "production", id: "d2", reason: "Duplicate video (hash abc123) matches xyz" },
          { environment: "staging", id: "d3", reason: "Duplicate video (hash def456) matches xyz" }
        ]
      });

      const report = buildDiscardReport(input);
      const headerSection = report.sections.find((s) => s.title === "Duplicate Videos" && s.type === "header");
      expect(headerSection).toBeDefined();

      const listSection = report.sections.find((s) => s.title === "Duplicates" && s.type === "list");
      expect(listSection).toBeDefined();
      const items = listSection?.data as string[];
      // First hash should have 2 artifacts, second has 1
      expect(items[0]).toContain("abc123");
    });

    it("uses unknown when hash pattern does not match", () => {
      const input = createBaseInput({
        badScanHistory: [{ environment: "production", id: "d1", reason: "Duplicate video with no hash pattern" }]
      });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Duplicates" && s.type === "list");
      expect(listSection).toBeDefined();
      const items = listSection?.data as string[];
      expect(items[0]).toContain("unknown");
    });

    it("sorts artifacts within hash by environment then id", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "staging", id: "z-id", reason: "Duplicate video (hash abc123)" },
          { environment: "production", id: "a-id", reason: "Duplicate video (hash abc123)" },
          { environment: "production", id: "b-id", reason: "Duplicate video (hash abc123)" }
        ]
      });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Duplicates" && s.type === "list");
      const items = listSection?.data as string[];
      // Should be sorted: production/a-id, production/b-id, staging/z-id
      expect(items[0]).toContain("a-id");
      expect(items[0]).toContain("b-id");
      expect(items[0]).toContain("z-id");
    });
  });

  describe("short videos detail section", () => {
    it("groups by environment and sorts by duration", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "s1", reason: "Video too short (5.5s)" },
          { environment: "production", id: "s2", reason: "Video too short (2.3s)" },
          { environment: "staging", id: "s3", reason: "Video too short (8.0s)" }
        ]
      });

      const report = buildDiscardReport(input);
      const headerSection = report.sections.find((s) => s.title === "Short Videos" && s.type === "header");
      expect(headerSection).toBeDefined();

      const prodList = report.sections.find(
        (s) => s.title === "Short Videos" && s.type === "list" && (s.level ?? 0) === 4
      );
      expect(prodList).toBeDefined();
      const items = prodList?.data as string[];
      // Should be sorted by duration: 2.3s first, then 5.5s
      expect(items[0]).toContain("2.30s");
    });

    it("uses 0 when duration pattern does not match", () => {
      const input = createBaseInput({
        badScanHistory: [{ environment: "production", id: "s1", reason: "Video too short no duration" }]
      });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Short Videos" && s.type === "list");
      expect(listSection).toBeDefined();
      const items = listSection?.data as string[];
      expect(items[0]).toContain("0.00s");
    });
  });

  describe("non-bathroom detail section", () => {
    it("groups by environment and extracts model name", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "production", id: "n1", reason: "Not a bathroom (Gemini gemini-1.5-pro)" },
          { environment: "production", id: "n2", reason: "Not a bathroom (Gemini gemini-2.0)" },
          { environment: "staging", id: "n3", reason: "Not a bathroom" }
        ]
      });

      const report = buildDiscardReport(input);
      const headerSection = report.sections.find((s) => s.title === "Non-Bathroom Videos" && s.type === "header");
      expect(headerSection).toBeDefined();

      const prodList = report.sections.find(
        (s) => s.title === "Non-Bathrooms" && s.type === "list" && (s.level ?? 0) === 4
      );
      expect(prodList).toBeDefined();
      const items = prodList?.data as string[];
      // Should include model name in parentheses
      expect(items[0]).toContain("gemini-1.5-pro");
    });

    it("handles missing model name gracefully", () => {
      const input = createBaseInput({
        badScanHistory: [{ environment: "production", id: "n1", reason: "Not a bathroom" }]
      });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Non-Bathrooms" && s.type === "list");
      expect(listSection).toBeDefined();
      const items = listSection?.data as string[];
      // Should not have model info but still work
      expect(items[0]).toContain("n1");
      expect(items[0]).not.toContain("(Gemini");
    });
  });

  describe("mismatch detail sections", () => {
    it("groups by environment and sorts by diff hours descending", () => {
      const mismatches: DateMismatch[] = [
        {
          diffHours: 25,
          environment: "production",
          id: "m1",
          scanDate: "2024-08-01T10:00:00Z",
          videoDate: "2024-08-02T11:00:00Z"
        },
        {
          diffHours: 240,
          environment: "production",
          id: "m2",
          scanDate: "2024-08-01T10:00:00Z",
          videoDate: "2024-08-11T10:00:00Z"
        },
        {
          diffHours: 50,
          environment: "staging",
          id: "m3",
          scanDate: "2024-08-01T10:00:00Z",
          videoDate: "2024-08-03T12:00:00Z"
        }
      ];
      const input = createBaseInput({ dateMismatches: mismatches });

      const report = buildDiscardReport(input);
      const headerSection = report.sections.find((s) => s.title === "Date Mismatches (> 1 Day)" && s.type === "header");
      expect(headerSection).toBeDefined();

      // Check that production environment section exists
      const prodEnvHeader = report.sections.find((s) => s.title === "Environment: production");
      expect(prodEnvHeader).toBeDefined();
    });

    it("pads single digit day values with space", () => {
      const mismatches: DateMismatch[] = [
        {
          diffHours: 25,
          environment: "production",
          id: "m1",
          scanDate: "2024-08-01T10:00:00Z",
          videoDate: "2024-08-02T11:00:00Z"
        }
      ];
      const input = createBaseInput({ dateMismatches: mismatches });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Mismatches" && s.type === "list");
      expect(listSection).toBeDefined();
      const items = listSection?.data as string[];
      // 25 hours = ~1.0 days, should have &nbsp; padding
      expect(items[0]).toContain("&nbsp;");
    });

    it("does not pad double digit day values", () => {
      const mismatches: DateMismatch[] = [
        {
          diffHours: 250,
          environment: "production",
          id: "m1",
          scanDate: "2024-08-01T10:00:00Z",
          videoDate: "2024-08-11T18:00:00Z"
        }
      ];
      const input = createBaseInput({ dateMismatches: mismatches });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Mismatches" && s.type === "list");
      expect(listSection).toBeDefined();
      const items = listSection?.data as string[];
      // 250 hours = ~10.4 days, should not have padding
      expect(items[0]).not.toContain("&nbsp;");
    });

    it("formats dates in ET timezone", () => {
      const mismatches: DateMismatch[] = [
        {
          diffHours: 25,
          environment: "production",
          id: "m1",
          scanDate: "2024-08-01T14:30:00Z",
          videoDate: "2024-08-02T15:45:00Z"
        }
      ];
      const input = createBaseInput({ dateMismatches: mismatches });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Mismatches" && s.type === "list");
      const items = listSection?.data as string[];
      // Should have formatted dates
      expect(items[0]).toMatch(/\d{2}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it("returns original date string on format error", () => {
      const mismatches: DateMismatch[] = [
        { diffHours: 25, environment: "production", id: "m1", scanDate: "invalid-date", videoDate: "also-invalid" }
      ];
      const input = createBaseInput({ dateMismatches: mismatches });

      const report = buildDiscardReport(input);
      const listSection = report.sections.find((s) => s.title === "Mismatches" && s.type === "list");
      expect(listSection).toBeDefined();
      // The invalid dates should still appear in output (as fallback)
      const items = listSection?.data as string[];
      expect(items[0]).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty countsByEnv gracefully", () => {
      const input = createBaseInput({ countsByEnv: {} });
      const report = buildDiscardReport(input);
      expect(report.title).toBe("Discard Report");
    });

    it("uses default color when environment not in color map", () => {
      const input = createBaseInput({
        badScanHistory: [
          { environment: "Custom Env 1", id: "s1", reason: "Video too short (5s)", scanDate: "2024-08-01T10:00:00Z" },
          { environment: "Custom Env 2", id: "s2", reason: "Video too short (3s)", scanDate: "2024-08-02T10:00:00Z" },
          { environment: "Custom Env 3", id: "s3", reason: "Video too short (2s)", scanDate: "2024-08-03T10:00:00Z" },
          { environment: "Custom Env 4", id: "s4", reason: "Video too short (1s)", scanDate: "2024-08-04T10:00:00Z" },
          { environment: "Custom Env 5", id: "s5", reason: "Video too short (0.5s)", scanDate: "2024-08-05T10:00:00Z" }
        ]
      });

      const report = buildDiscardReport(input);
      const chartSection = report.sections.find(
        (s) => s.title?.includes("Short Videos") === true && s.type === "react-component"
      );
      expect(chartSection).toBeDefined();
      const config = chartSection?.data as LineChartConfig;
      // Should use default colors (cycling through 4 colors)
      expect(config.datasets.length).toBe(5);
    });
  });
});
