import fs from "fs";
import { Mock, Mocked, MockedClass, MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";

import { generateSyncReport, main, syncEnvironment } from "../../../src/scripts/syncArtifacts";
import { Artifact, SpatialService } from "../../../src/services/spatialService";
import { getBadScans } from "../../../src/utils/data/badScans";
import { getSyncFailures } from "../../../src/utils/data/syncFailures";
import { generatePdfReport } from "../../../src/utils/reportGenerator";
import { downloadFile, downloadJsonFile } from "../../../src/utils/sync/downloadHelpers";

vi.mock("../../../src/utils/reportGenerator", () => ({
  generatePdfReport: vi.fn()
}));

// Mock logger to suppress output during tests
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock("fs");
vi.mock("../../../src/services/spatialService");
vi.mock("../../../src/utils/data/badScans");
vi.mock("../../../src/utils/data/syncFailures", () => ({
  getSyncFailures: vi.fn(),
  saveSyncFailures: vi.fn()
}));

vi.mock("../../../config/config", () => ({
  ENVIRONMENTS: [{ domain: "test.com", name: "test-env" }]
}));
vi.mock("../../../src/utils/sync/downloadHelpers");

// Mock cli-progress
vi.mock("../../../src/utils/progress", () => ({
  createProgressBar: vi.fn().mockReturnValue({
    increment: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn()
  })
}));

const mockFs = fs as unknown as Mocked<typeof fs>;
const MockSpatialService = SpatialService as unknown as MockedClass<typeof SpatialService>;
const mockGetBadScans = getBadScans as unknown as MockedFunction<typeof getBadScans>;
const mockGetSyncFailures = getSyncFailures as unknown as MockedFunction<typeof getSyncFailures>;
const mockGeneratePdfReport = generatePdfReport as unknown as Mock;
const mockDownloadFile = downloadFile as unknown as Mock;
const mockDownloadJsonFile = downloadJsonFile as unknown as Mock;

describe("syncArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBadScans.mockReturnValue({});
    mockGetSyncFailures.mockReturnValue({});
  });

  describe("syncEnvironment", () => {
    const env = { domain: "test.com", name: "test-env" };
    const artifact = { arData: "a.json", id: "123", rawScan: "r.json", video: "v.mp4" };

    beforeEach(() => {
      // Default happy path for service
      MockSpatialService.prototype.fetchScanArtifacts.mockResolvedValue({
        data: [artifact] as unknown as Artifact[],
        pagination: { currentPage: 1, from: 1, lastPage: 1, perPage: 10, to: 1, total: 1 }
      });
      // Default file mocks
      mockFs.existsSync.mockReturnValue(false); // No dirs, no files exist
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.writeFileSync.mockImplementation(() => undefined);

      // Default helper mocks (Success)
      mockDownloadFile.mockResolvedValue(null);
      mockDownloadJsonFile.mockResolvedValue(null);

      mockFs.createWriteStream.mockReturnValue({
        close: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        write: vi.fn()
      } as unknown as fs.WriteStream);
      // We mock rmSync to ensure it doesn't fail
      mockFs.rmSync.mockImplementation(() => undefined);
    });

    it("creates directories and processes artifacts", async () => {
      const stats = await syncEnvironment(env);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("test_env"), expect.anything());
      expect(stats.found).toBe(1);
      expect(stats.new).toBe(1);
      expect(stats.failed).toBe(0);
      expect(mockDownloadFile).toHaveBeenCalledWith(artifact.video, expect.stringContaining("video.mp4"), "video");
      expect(mockDownloadJsonFile).toHaveBeenCalledWith(
        artifact.rawScan,
        expect.stringContaining("rawScan.json"),
        "rawScan"
      );
    });

    it("skips bad scans", async () => {
      mockGetBadScans.mockReturnValue({ "123": { date: "2023-01-01", environment: "test", reason: "bad" } });
      const stats = await syncEnvironment(env);
      expect(stats.skipped).toBe(1);
      expect(stats.new).toBe(0);
      expect(mockDownloadFile).not.toHaveBeenCalled();
    });

    it("handles partial download failure (Video fails)", async () => {
      // Mock video failure
      mockDownloadFile.mockResolvedValue("Video download failed (404)");

      const stats = await syncEnvironment(env);
      expect(stats.failed).toBe(1);
      expect(stats.errors[0]?.id).toBe("123");
      expect(stats.errors[0]?.reason).toBe("Video download failed (404)");
      expect(mockFs.rmSync).toHaveBeenCalledWith(expect.stringContaining("123"), expect.anything());
    });

    it("consolidates multiple failures", async () => {
      // Fail everything
      mockDownloadFile.mockResolvedValue("Video failed");
      mockDownloadJsonFile.mockResolvedValue("JSON failed");

      const stats = await syncEnvironment(env);
      expect(stats.failed).toBe(1);
      // Should have 3 errors for the same ID (1 video + 2 json)
      const errorsForId = stats.errors.filter((e) => e.id === "123");
      expect(errorsForId.length).toBe(3);
    });
  });

  describe("generateSyncReport", () => {
    it("generates report with no failures", async () => {
      const stats = [
        {
          env: "test",
          errors: [],
          failed: 0,
          found: 10,
          knownFailures: 0,
          new: 5,
          newFailures: 0,
          processedIds: new Set<string>(),
          skipped: 0
        }
      ];
      await generateSyncReport(stats, {});
      const calls = mockGeneratePdfReport.mock.calls as unknown[][];
      const reportData = calls[0]?.[0] as { title: string; sections: unknown[] };
      expect(reportData.title).toBe("Sync Report");
      expect(reportData.sections).toEqual(
        expect.arrayContaining([{ data: "No failures occurred during sync.", type: "text" }])
      );
      expect(mockGeneratePdfReport).toHaveBeenCalledTimes(1);
    });

    it("generates report with grouped failures", async () => {
      const stats = [
        {
          env: "test",
          errors: [
            { id: "123", reason: "Video failed" },
            { id: "123", reason: "JSON failed" }
          ],
          failed: 1,
          found: 1,
          knownFailures: 0,
          new: 0,
          newFailures: 0,
          processedIds: new Set<string>(),
          skipped: 0
        }
      ];
      await generateSyncReport(stats, {});

      const calls = mockGeneratePdfReport.mock.calls as unknown[][];
      const reportData = calls[0]?.[0] as { title: string; sections: unknown[] };
      expect(reportData.title).toBe("Sync Report");
      expect(reportData.sections).toEqual(
        expect.arrayContaining([expect.objectContaining({ title: "Sync Failures", type: "header" })])
      );
      expect(mockGeneratePdfReport).toHaveBeenCalledTimes(1);
    });
  });

  describe("main", () => {
    it("runs happy path integration", async () => {
      await main();
      expect(MockSpatialService).toHaveBeenCalled();
      // generatePdfReport is called inside generateSyncReport which is called in main
      // We can check if generatePdfReport was called
      expect(mockGeneratePdfReport).toHaveBeenCalled();
    });
  });
});
