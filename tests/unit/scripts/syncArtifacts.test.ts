import * as fs from "fs";
import PDFDocument from "pdfkit";

import { generateSyncReport, main, syncEnvironment } from "../../../src/scripts/syncArtifacts";
import { Artifact, SpatialService } from "../../../src/services/spatialService";
import { getBadScans } from "../../../src/utils/data/badScans";
import { downloadFile, downloadJsonFile } from "../../../src/utils/sync/downloadHelpers";

// Mocks
jest.mock("fs");
jest.mock("pdfkit");
jest.mock("../../../src/services/spatialService");
jest.mock("../../../src/utils/data/badScans");
jest.mock("../../../config/config", () => ({
  ENVIRONMENTS: [{ domain: "test.com", name: "test-env" }]
}));
jest.mock("../../../src/utils/sync/downloadHelpers");

// Progress Mock
jest.mock("../../../src/utils/progress", () => ({
  createProgressBar: jest.fn().mockReturnValue({
    increment: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    update: jest.fn()
  })
}));

// Types
const mockFs = fs as unknown as jest.Mocked<typeof fs>;
const MockSpatialService = SpatialService as unknown as jest.MockedClass<typeof SpatialService>;
const mockGetBadScans = getBadScans as unknown as jest.MockedFunction<typeof getBadScans>;
const MockPDFDocument = PDFDocument as unknown as jest.MockedClass<typeof PDFDocument>;
const mockDownloadFile = downloadFile as unknown as jest.Mock;
const mockDownloadJsonFile = downloadJsonFile as unknown as jest.Mock;

describe("syncArtifacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBadScans.mockReturnValue({});
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
        close: jest.fn(),
        on: jest.fn()
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
      expect(mockDownloadFile).toHaveBeenCalledWith(artifact.video, expect.stringContaining("video.mp4"), "Video");
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
    let mockDoc: {
      end: jest.Mock;
      font: jest.Mock;
      fontSize: jest.Mock;
      moveDown: jest.Mock;
      pipe: jest.Mock;
      text: jest.Mock;
      x: number;
      y: number;
    };

    beforeEach(() => {
      mockDoc = {
        end: jest.fn(),
        font: jest.fn().mockReturnThis(),
        fontSize: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        pipe: jest.fn(),
        text: jest.fn().mockReturnThis(),
        x: 0,
        y: 0
      };
      MockPDFDocument.mockImplementation(() => mockDoc as unknown as InstanceType<typeof PDFDocument>);
      mockFs.createWriteStream.mockReturnValue({
        on: (evt: string, cb: (e?: unknown) => void) => {
          if (evt === "finish") {
            cb();
          }
        }
      } as unknown as fs.WriteStream);
    });

    it("generates report with no failures", async () => {
      const stats = [{ env: "test", errors: [], failed: 0, found: 10, new: 5, skipped: 0 }];
      await generateSyncReport(stats);
      expect(mockDoc.text).toHaveBeenCalledWith("No failures occurred during sync.");
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
          new: 0,
          skipped: 0
        }
      ];
      await generateSyncReport(stats);

      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining("- ID: 123"));
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining("Video failed"));
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining("JSON failed"));
    });
  });

  describe("main", () => {
    it("runs happy path integration", async () => {
      await main();
      expect(MockSpatialService).toHaveBeenCalled();
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(expect.stringContaining("sync-report.pdf"));
    });
  });
});
