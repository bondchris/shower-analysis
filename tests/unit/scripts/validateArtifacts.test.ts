import { Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { applyArtifactToStats, generateReport, validateEnvironment } from "../../../src/scripts/validateArtifacts";
import { ArtifactResponse, SpatialService } from "../../../src/services/spatialService";
import { EnvStats } from "../../../src/models/envStats";
// ChartUtils Mock
vi.mock("../../../src/utils/chart", () => ({
  getBarChartConfig: vi.fn().mockReturnValue({ type: "bar" }),
  getLineChartConfig: vi.fn().mockReturnValue({ type: "line" }),
  getMixedChartConfig: vi.fn().mockReturnValue({ type: "bar" })
}));

// Logger Mock
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));
import { logger } from "../../../src/utils/logger";

// Progress Mock
vi.mock("../../../src/utils/progress", () => ({
  createProgressBar: vi.fn().mockReturnValue({
    increment: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn()
  })
}));

// Stream Mock
vi.mock("stream", async () => {
  const actual = await vi.importActual<typeof import("stream")>("stream");
  return {
    ...(actual as unknown as Record<string, unknown>),
    finished: ((_s: unknown, cb: () => void) => {
      cb();
      return () => undefined;
    }) as unknown as typeof import("stream").finished
  };
});

// Mock SpatialService and reportGenerator
vi.mock("../../../src/services/spatialService");
vi.mock("../../../src/utils/reportGenerator");

import { generatePdfReport } from "../../../src/utils/reportGenerator";
const mockGeneratePdfReport = generatePdfReport as unknown as Mock;

const mockFetchScanArtifacts = vi.fn();

SpatialService.prototype.fetchScanArtifacts = mockFetchScanArtifacts;

describe("validateArtifacts script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applyArtifactToStats", () => {
    let stats: EnvStats;

    beforeEach(() => {
      stats = {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: "Test Env",
        pageErrors: {},
        processed: 0,
        propertyCounts: {},
        totalArtifacts: 0,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: {}
      };
    });

    const createArtifact = (overrides: Partial<ArtifactResponse> = {}): ArtifactResponse =>
      ({
        arData: "s3://ar",
        id: "test-id",
        projectId: "test-project",
        rawScan: "s3://raw",
        scanDate: "2025-12-14T10:00:00Z",
        video: "s3://video",
        ...overrides
      }) as unknown as ArtifactResponse;

    it("should count a valid artifact as processed and successful", () => {
      const artifact = createArtifact();
      applyArtifactToStats(stats, artifact);

      expect(stats.processed).toBe(1);
      expect(stats.artifactsWithIssues).toBe(0);
      expect(stats.totalScansByDate).toHaveProperty("2025-12-14", 1);
      expect(stats.cleanScansByDate).toHaveProperty("2025-12-14", 1);
    });

    it("should detect missing required fields", () => {
      const artifact = createArtifact({ id: undefined } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts).toHaveProperty("id", 1);
      expect(stats.errorsByDate).toHaveProperty("2025-12-14", 1);
      expect(stats.cleanScansByDate["2025-12-14"]).toBeUndefined();
    });

    it("should handle invalid dates (0001-01-01)", () => {
      const artifact = createArtifact({ scanDate: "0001-01-01T00:00:00Z" });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts).toHaveProperty("scanDate (invalid)", 1);
      expect(stats.totalScansByDate["0001-01-01"]).toBeUndefined();
    });

    it("should detect missing warnings (projectId)", () => {
      const artifact = createArtifact({ projectId: undefined } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithWarnings).toBe(1);
      expect(stats.warningCounts).toHaveProperty("projectId", 1);
    });

    it("should track dynamic properties", () => {
      const artifact = createArtifact({
        extraField: "some value",
        pointCloud: "s3://pc"
      } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.propertyCounts).toHaveProperty("id", 1);
      expect(stats.propertyCounts).toHaveProperty("extraField", 1);
      expect(stats.propertyCounts).toHaveProperty("pointCloud", 1);
    });

    it("should handle non-string scanDate (null/undefined/number)", () => {
      const artifact = createArtifact({ scanDate: null } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.processed).toBe(1);
      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts).toHaveProperty("scanDate", 1);
      expect(Object.keys(stats.totalScansByDate).length).toBe(0);
    });

    it("should detect floors with parentIdentifier set", () => {
      const rawScanWithParentId = JSON.stringify({
        floors: [{ parentIdentifier: "some-parent-id" }]
      });
      const artifact = createArtifact({ rawScan: rawScanWithParentId });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts).toHaveProperty("floors with parent id", 1);
    });

    it("should not duplicate floors with parent id issue when multiple floors have parentIdentifier", () => {
      const rawScanWithMultipleParentIds = JSON.stringify({
        floors: [{ parentIdentifier: "parent-1" }, { parentIdentifier: "parent-2" }]
      });
      const artifact = createArtifact({ rawScan: rawScanWithMultipleParentIds });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts).toHaveProperty("floors with parent id", 1);
    });

    it("should not flag floors without parentIdentifier", () => {
      const rawScanWithoutParentId = JSON.stringify({
        floors: [{ parentIdentifier: null }, { parentIdentifier: undefined }]
      });
      const artifact = createArtifact({ rawScan: rawScanWithoutParentId });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(0);
      expect(stats.missingCounts["floors with parent id"]).toBeUndefined();
    });

    it("should handle rawScan with empty floors array", () => {
      const rawScanEmptyFloors = JSON.stringify({ floors: [] });
      const artifact = createArtifact({ rawScan: rawScanEmptyFloors });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(0);
    });

    it("should handle rawScan with non-array floors", () => {
      const rawScanNonArrayFloors = JSON.stringify({ floors: "not-an-array" });
      const artifact = createArtifact({ rawScan: rawScanNonArrayFloors });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(0);
    });

    it("should handle invalid rawScan JSON gracefully", () => {
      const artifact = createArtifact({ rawScan: "invalid json {{{" });
      applyArtifactToStats(stats, artifact);

      expect(stats.processed).toBe(1);
      expect(stats.missingCounts["floors with parent id"]).toBeUndefined();
    });

    it("should track warningsByDate when artifact has warnings and valid date", () => {
      const artifact = createArtifact({
        projectId: undefined,
        scanDate: "2025-06-15T12:00:00Z"
      } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithWarnings).toBe(1);
      expect(stats.warningsByDate).toHaveProperty("2025-06-15", 1);
    });

    it("should not track warningsByDate when scanDate is invalid (non-string)", () => {
      const artifact = createArtifact({
        projectId: undefined,
        scanDate: 12345
      } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithWarnings).toBe(1);
      expect(Object.keys(stats.warningsByDate).length).toBe(0);
    });

    it("should skip null/undefined property values in propertyCounts", () => {
      const artifact = createArtifact({
        extraNull: null,
        extraUndefined: undefined
      } as unknown as Partial<ArtifactResponse>);
      applyArtifactToStats(stats, artifact);

      expect(stats.propertyCounts["extraNull"]).toBeUndefined();
      expect(stats.propertyCounts["extraUndefined"]).toBeUndefined();
    });
  });

  describe("validateEnvironment", () => {
    it("should process all pages and summarize stats", async () => {
      mockFetchScanArtifacts
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        })
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "2", projectId: "p1", rawScan: "r", scanDate: "2025-01-02T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        });

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.name).toBe("Test Env");
      expect(stats.totalArtifacts).toBe(2);
      expect(stats.processed).toBe(2);
      expect(stats.totalArtifacts).toBe(2);
      expect(stats.processed).toBe(2);
      expect(mockFetchScanArtifacts).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Starting validation"));
    });

    it("should handle fetch errors gracefully", async () => {
      mockFetchScanArtifacts
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        })
        .mockRejectedValueOnce(new Error("Network Error"));

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.processed).toBe(1);
      expect(stats.totalArtifacts).toBe(2);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error fetching page"));
    });

    it("should handle fetch errors that are not Error instances", async () => {
      mockFetchScanArtifacts
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        })
        .mockRejectedValueOnce("string error");

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.processed).toBe(1);
      expect(stats.pageErrors[2]).toBe("string error");
    });

    it("should handle single page result with no remaining pages", async () => {
      mockFetchScanArtifacts.mockResolvedValueOnce({
        data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
        pagination: { lastPage: 1, total: 1 }
      });

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.processed).toBe(1);
      expect(stats.totalArtifacts).toBe(1);
      expect(mockFetchScanArtifacts).toHaveBeenCalledTimes(1);
    });

    it("should handle initial fetch failure", async () => {
      mockFetchScanArtifacts.mockRejectedValueOnce(new Error("Initial fetch failed"));

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.processed).toBe(0);
      expect(stats.totalArtifacts).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch"));
    });

    it("should process multiple pages with concurrency", async () => {
      mockFetchScanArtifacts
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
          pagination: { lastPage: 4, total: 4 }
        })
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "2", projectId: "p1", rawScan: "r", scanDate: "2025-01-02T10:00:00Z", video: "v" }],
          pagination: { lastPage: 4, total: 4 }
        })
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "3", projectId: "p1", rawScan: "r", scanDate: "2025-01-03T10:00:00Z", video: "v" }],
          pagination: { lastPage: 4, total: 4 }
        })
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "4", projectId: "p1", rawScan: "r", scanDate: "2025-01-04T10:00:00Z", video: "v" }],
          pagination: { lastPage: 4, total: 4 }
        });

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.processed).toBe(4);
      expect(mockFetchScanArtifacts).toHaveBeenCalledTimes(4);
    });
  });

  describe("generateReport", () => {
    it("should create a PDF and add charts", async () => {
      const stats: EnvStats = {
        artifactsWithIssues: 1,
        artifactsWithWarnings: 1,
        cleanScansByDate: { "2025-01-01": 1 },
        errorsByDate: { "2025-01-01": 1 },
        missingCounts: { id: 1 },
        name: "Env 1",
        pageErrors: {},
        processed: 2,
        propertyCounts: { id: 2 },
        totalArtifacts: 2,
        totalScansByDate: { "2025-01-01": 2 },
        warningCounts: { projectId: 1 },
        warningsByDate: { "2025-01-01": 1 }
      };

      await generateReport([stats]);

      const calls = mockGeneratePdfReport.mock.calls as unknown[][];
      const reportData = calls[0]?.[0] as { title: string; sections: unknown[] };
      expect(reportData.title).toBe("Validation Report");
      expect(reportData.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            options: expect.objectContaining({
              headers: expect.arrayContaining(["", "Env 1", "Total"]) as unknown,
              rowClasses: expect.any(Object) as unknown
            }) as unknown,
            type: "table"
          }),
          expect.objectContaining({ title: "Property Presence", type: "chart" }),
          expect.objectContaining({ title: "Scan Volume (All Environments)", type: "chart" }),
          expect.objectContaining({ title: "Scan Success Percentage Over Time", type: "chart" }),
          expect.objectContaining({ title: "Upload Failures Over Time", type: "chart" }),
          expect.objectContaining({ title: "Missing Project IDs Over Time", type: "chart" })
        ])
      );
      expect(mockGeneratePdfReport).toHaveBeenCalledTimes(1);
    });

    it("should handle empty data gracefully", async () => {
      await generateReport([]);

      const calls = mockGeneratePdfReport.mock.calls as unknown[][];
      const reportData = calls[0]?.[0] as { title: string; sections: unknown[] };
      expect(reportData.title).toBe("Validation Report");
      expect(reportData.sections).toEqual(
        expect.arrayContaining([{ data: "No environments / no data.", type: "text" }])
      );
      expect(mockGeneratePdfReport).toHaveBeenCalledTimes(1);
    });
  });
});
