import { Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeArtifact, createInspectionReports, main } from "../../../src/scripts/inspectArtifacts";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ReportData } from "../../../src/models/report";
import { buildArDataAnalysisReport } from "../../../src/templates/arDataAnalysisReport";
import { buildScanAnalysisReport } from "../../../src/templates/scanAnalysisReport";
import { buildVideoAnalysisReport } from "../../../src/templates/videoAnalysisReport";
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
vi.mock("../../../src/templates/videoAnalysisReport");
vi.mock("../../../src/templates/arDataAnalysisReport");
vi.mock("../../../src/templates/scanAnalysisReport");
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

  describe("createInspectionReports", () => {
    it("should build and generate all three reports, logging progress", async () => {
      const mockMeta = [new ArtifactAnalysis()];
      const mockVideoReportData = { sections: [], title: "Video Analysis" } as unknown as ReportData;
      const mockArDataReportData = { sections: [], title: "AR Data Analysis" } as unknown as ReportData;
      const mockScanReportData = { sections: [], title: "Scan Analysis" } as unknown as ReportData;

      (buildVideoAnalysisReport as Mock).mockReturnValue(mockVideoReportData);
      (buildArDataAnalysisReport as Mock).mockReturnValue(mockArDataReportData);
      (buildScanAnalysisReport as Mock).mockReturnValue(mockScanReportData);

      await createInspectionReports(mockMeta, 10, 1);

      expect(logger.info).toHaveBeenCalledWith("Generating 3.1 - Video Analysis PDF...");
      expect(buildVideoAnalysisReport).toHaveBeenCalledWith(mockMeta, 10, 1);
      expect(generatePdfReport).toHaveBeenCalledWith(mockVideoReportData, "3.1 - Video Analysis.pdf");
      expect(logger.info).toHaveBeenCalledWith("Report generated at: 3.1 - Video Analysis.pdf");

      expect(logger.info).toHaveBeenCalledWith("Generating 3.2 - AR Data Analysis PDF...");
      expect(buildArDataAnalysisReport).toHaveBeenCalledWith(mockMeta, 1);
      expect(generatePdfReport).toHaveBeenCalledWith(mockArDataReportData, "3.2 - AR Data Analysis.pdf");
      expect(logger.info).toHaveBeenCalledWith("Report generated at: 3.2 - AR Data Analysis.pdf");

      expect(logger.info).toHaveBeenCalledWith("Generating 3.3 - Scan Analysis PDF...");
      expect(buildScanAnalysisReport).toHaveBeenCalledWith(mockMeta, 1, undefined);
      expect(generatePdfReport).toHaveBeenCalledWith(mockScanReportData, "3.3 - Scan Analysis.pdf");
      expect(logger.info).toHaveBeenCalledWith("Report generated at: 3.3 - Scan Analysis.pdf");
    });

    it("should bubble up errors from PDF generator", async () => {
      (buildVideoAnalysisReport as Mock).mockReturnValue({ sections: [], title: "Video" });
      (generatePdfReport as Mock).mockRejectedValue(new Error("PDF Error"));
      await expect(createInspectionReports([], 0, 0)).rejects.toThrow("PDF Error");
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

    it("should process artifacts and generate all three reports", async () => {
      const DIRS = ["/a", "/b"];
      (findArtifactDirectories as Mock).mockReturnValue(DIRS);

      // Setup different durations for 2 artifacts
      (extractVideoMetadata as Mock).mockResolvedValueOnce({ duration: 10 }).mockResolvedValueOnce({ duration: 30 });

      // Mock report builders
      const mockVideoReportData = { sections: [], title: "Video" };
      const mockArDataReportData = { sections: [], title: "ArData" };
      const mockScanReportData = { sections: [], title: "Scan" };
      (buildVideoAnalysisReport as Mock).mockReturnValue(mockVideoReportData);
      (buildArDataAnalysisReport as Mock).mockReturnValue(mockArDataReportData);
      (buildScanAnalysisReport as Mock).mockReturnValue(mockScanReportData);

      await main();

      // Verify find dir called with correct path join
      const expectedPath = path.join(process.cwd(), "data", "artifacts");
      expect(findArtifactDirectories).toHaveBeenCalledWith(expectedPath);

      // Verify extraction calls
      expect(extractVideoMetadata).toHaveBeenCalledTimes(2);

      // Verify Average Logic (10 + 30) / 2 = 20
      expect(buildVideoAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 20, 2);
      expect(buildArDataAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 2);
      expect(buildScanAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 2, DIRS);

      // Verify all three PDFs are generated
      expect(generatePdfReport).toHaveBeenCalledWith(mockVideoReportData, "3.1 - Video Analysis.pdf");
      expect(generatePdfReport).toHaveBeenCalledWith(mockArDataReportData, "3.2 - AR Data Analysis.pdf");
      expect(generatePdfReport).toHaveBeenCalledWith(mockScanReportData, "3.3 - Scan Analysis.pdf");
    });

    it("should handle undefined/NaN durations robustly", async () => {
      (findArtifactDirectories as Mock).mockReturnValue(["/a", "/b", "/c"]);

      (extractVideoMetadata as Mock)
        .mockResolvedValueOnce({ duration: 10 }) // Valid
        .mockResolvedValueOnce({ duration: undefined }) // Undefined
        .mockResolvedValueOnce({ duration: 30 }); // Valid

      // Mock report builders
      (buildVideoAnalysisReport as Mock).mockReturnValue({ sections: [] });
      (buildArDataAnalysisReport as Mock).mockReturnValue({ sections: [] });
      (buildScanAnalysisReport as Mock).mockReturnValue({ sections: [] });

      await main();

      // Avg should ignore undefined: (10 + 30) / 2 = 20
      // Total artifact count passed to report is still 3
      expect(buildVideoAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 20, 3);
      expect(buildArDataAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 3);
      expect(buildScanAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 3, ["/a", "/b", "/c"]);
    });

    it("should use zero average duration when no valid durations are present", async () => {
      (findArtifactDirectories as Mock).mockReturnValue(["/only"]);
      (extractVideoMetadata as Mock).mockResolvedValue({ duration: undefined });

      const mockVideoReportData = { sections: [], title: "Video" };
      const mockArDataReportData = { sections: [], title: "AR" };
      const mockScanReportData = { sections: [], title: "Scan" };
      (buildVideoAnalysisReport as Mock).mockReturnValue(mockVideoReportData);
      (buildArDataAnalysisReport as Mock).mockReturnValue(mockArDataReportData);
      (buildScanAnalysisReport as Mock).mockReturnValue(mockScanReportData);

      await main();

      expect(buildVideoAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 0, 1);
      expect(buildArDataAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 1);
      expect(buildScanAnalysisReport).toHaveBeenCalledWith(expect.any(Array), 1, ["/only"]);
    });

    it("logs errors when CLI invocation rejects", async () => {
      const mod = await import("../../../src/scripts/inspectArtifacts");
      const failingRunner = vi.fn().mockRejectedValue(new Error("boom"));

      await mod.runCli(failingRunner);

      expect(failingRunner).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
