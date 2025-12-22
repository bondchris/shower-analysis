import { Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeArtifact, createInspectionReport, main } from "../../../src/scripts/inspectArtifacts";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ReportData } from "../../../src/models/report";
import { buildDataAnalysisReport } from "../../../src/templates/dataAnalysisReport";
import { extractArDataMetadata } from "../../../src/utils/arData/metadata";
import { findArtifactDirectories } from "../../../src/utils/data/artifactIterator";
import { logger } from "../../../src/utils/logger";
import { extractRawScanMetadata } from "../../../src/utils/room/metadata";
import { extractVideoMetadata } from "../../../src/utils/video/metadata";
import { generatePdfReport } from "../../../src/utils/reportGenerator";
import * as path from "path";

// Mock dependencies
vi.mock("../../../src/utils/video/metadata");
vi.mock("../../../src/utils/room/metadata");
vi.mock("../../../src/utils/arData/metadata");
vi.mock("../../../src/templates/dataAnalysisReport");
vi.mock("../../../src/utils/reportGenerator");
vi.mock("../../../src/utils/logger");
vi.mock("../../../src/utils/data/artifactIterator");
vi.mock("../../../src/utils/progress", () => ({
  createProgressBar: vi.fn().mockReturnValue({
    increment: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  })
}));

interface ExtendedArtifactAnalysis extends ArtifactAnalysis {
  roomHeight?: number;
  arFrameCount?: number;
  floorArea?: number;
}

describe("inspectArtifacts Script", () => {
  const MOCK_DIR = "/mock/dir";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeArtifact", () => {
    it("should aggregate metadata from all sources", async () => {
      // Setup mocks
      (extractVideoMetadata as Mock).mockResolvedValue({
        duration: 60,
        fps: 30,
        height: 1080,
        width: 1920
      });

      (extractRawScanMetadata as Mock).mockReturnValue({
        floorArea: 10,
        roomHeight: 3
      });

      (extractArDataMetadata as Mock).mockReturnValue({
        arFrameCount: 100
      });

      const result = await analyzeArtifact(MOCK_DIR);
      const extendedResult = result as unknown as ExtendedArtifactAnalysis;

      expect(result).toBeInstanceOf(ArtifactAnalysis);
      // Video
      expect(result.width).toBe(1920);
      expect(result.duration).toBe(60);
      // RawScan
      expect(extendedResult.roomHeight).toBe(3);
      // ArData
      expect(extendedResult.arFrameCount).toBe(100);
    });

    it("should handle missing metadata gracefully", async () => {
      (extractVideoMetadata as Mock).mockResolvedValue(null);
      (extractRawScanMetadata as Mock).mockReturnValue({});
      (extractArDataMetadata as Mock).mockReturnValue({});

      const result = await analyzeArtifact(MOCK_DIR);

      expect(result.width).toBe(0);
      expect(result.duration).toBe(0);
    });

    it("should respect merge precedence (RawScan overrides Video)", async () => {
      (extractVideoMetadata as Mock).mockResolvedValue({ duration: 10, width: 1920 });
      // Raw metadata returns a conflicting duration
      (extractRawScanMetadata as Mock).mockReturnValue({ duration: 999 });
      (extractArDataMetadata as Mock).mockReturnValue({});

      const result = await analyzeArtifact(MOCK_DIR);

      // RawScan (applied 2nd) overrides Video (applied 1st)
      expect(result.duration).toBe(999);
      expect(result.width).toBe(1920);
    });

    it("should bubble up errors from extractors", async () => {
      (extractVideoMetadata as Mock).mockRejectedValue(new Error("Video error"));
      await expect(analyzeArtifact(MOCK_DIR)).rejects.toThrow("Video error");
    });
  });

  describe("createInspectionReport", () => {
    it("should build and generate report, logging progress", async () => {
      const mockMeta = [new ArtifactAnalysis()];
      const mockReportData = { sections: [], title: "Test Report" } as unknown as ReportData;

      (buildDataAnalysisReport as Mock).mockReturnValue(mockReportData);

      await createInspectionReport(mockMeta, 10, 1, "report.pdf");

      expect(logger.info).toHaveBeenCalledWith("Generating PDF...");
      expect(buildDataAnalysisReport).toHaveBeenCalledWith(mockMeta, 10, 1, undefined);
      expect(generatePdfReport).toHaveBeenCalledWith(mockReportData, "report.pdf");
      expect(logger.info).toHaveBeenCalledWith("Report generated at: report.pdf");
    });

    it("should bubble up errors from PDF generator", async () => {
      (generatePdfReport as Mock).mockRejectedValue(new Error("PDF Error"));
      await expect(createInspectionReport([], 0, 0, "out.pdf")).rejects.toThrow("PDF Error");
    });
  });

  describe("main", () => {
    /*
     * Note: We are testing the 'main' function exported from the module.
     * We need to be careful not to mock analyzeArtifact if we are testing integration
     * or we can spy on it if we export it from the module, but here we are importing
     * analyzeArtifact from the module. If we wanted to mock analyzeArtifact specifically
     * within main, we'd need to mock the entire module import, which gets circular.
     *
     * Strategy: We will mock the dependencies of analyzeArtifact (extractors)
     * effectively stubbing the behavior of analyzeArtifact indirectly.
     */

    beforeEach(() => {
      // Default successful but empty metadata for extractors
      (extractVideoMetadata as Mock).mockResolvedValue({});
      (extractRawScanMetadata as Mock).mockReturnValue({});
      (extractArDataMetadata as Mock).mockReturnValue({});
      (generatePdfReport as Mock).mockResolvedValue(undefined);
    });

    it("should handle empty artifact list", async () => {
      (findArtifactDirectories as Mock).mockReturnValue([]);

      await main();

      expect(logger.info).toHaveBeenCalledWith("Finding artifacts...");
      expect(logger.info).toHaveBeenCalledWith("Found 0 artifact directories.");
      expect(logger.info).toHaveBeenCalledWith("No metadata available to report.");
      // Ensure we didn't try to generate a report
      expect(generatePdfReport).not.toHaveBeenCalled();
    });

    it("should process artifacts and generate report", async () => {
      const DIRS = ["/a", "/b"];
      (findArtifactDirectories as Mock).mockReturnValue(DIRS);

      // Setup different durations for 2 artifacts
      (extractVideoMetadata as Mock).mockResolvedValueOnce({ duration: 10 }).mockResolvedValueOnce({ duration: 30 });

      // Mock PDF gen
      const mockReportData = { sections: [] };
      (buildDataAnalysisReport as Mock).mockReturnValue(mockReportData);

      await main();

      // Verify find dir called with correct path join
      const expectedPath = path.join(process.cwd(), "data", "artifacts");
      expect(findArtifactDirectories).toHaveBeenCalledWith(expectedPath);

      // Verify extraction calls
      expect(extractVideoMetadata).toHaveBeenCalledTimes(2);

      // Verify Average Logic (10 + 30) / 2 = 20
      expect(buildDataAnalysisReport).toHaveBeenCalledWith(
        expect.any(Array),
        20, // Avg duration
        2, // Video count
        DIRS
      );

      expect(generatePdfReport).toHaveBeenCalledWith(mockReportData, "data-analysis.pdf");
    });

    it("should handle undefined/NaN durations robustly", async () => {
      (findArtifactDirectories as Mock).mockReturnValue(["/a", "/b", "/c"]);

      (extractVideoMetadata as Mock)
        .mockResolvedValueOnce({ duration: 10 }) // Valid
        .mockResolvedValueOnce({ duration: undefined }) // Undefined
        .mockResolvedValueOnce({ duration: 30 }); // Valid

      await main();

      // Avg should ignore undefined: (10 + 30) / 2 = 20

      expect(buildDataAnalysisReport).toHaveBeenCalledWith(
        expect.any(Array),
        20,
        3, // Total artifact count passed to report is still 3
        ["/a", "/b", "/c"]
      );
    });
  });
});
