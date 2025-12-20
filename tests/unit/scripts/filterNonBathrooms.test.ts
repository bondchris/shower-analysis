import * as fs from "fs";
import { BadScanDatabase } from "../../../src/models/badScanRecord";
import { CheckedScanDatabase } from "../../../src/models/checkedScanRecord";
import { Mock, Mocked, beforeEach, describe, expect, it, vi } from "vitest";

import { GeminiService } from "../../../src/services/geminiService";
import { getBadScans } from "../../../src/utils/data/badScans";
import { getCheckedScans } from "../../../src/utils/data/checkedScans";
import { classifyGeminiAnswer, processArtifact } from "../../../src/scripts/filterNonBathrooms";

// Mock dependencies
vi.mock("fs");
vi.mock("../../../src/services/geminiService");
vi.mock("../../../src/utils/data/badScans");
vi.mock("../../../src/utils/data/checkedScans");
vi.mock("../../../src/utils/logger");
vi.mock("../../../src/utils/progress", () => ({
  createProgressBar: vi.fn().mockReturnValue({
    increment: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn()
  })
}));

// Types for mocks
type MockGeminiService = Mocked<GeminiService>;
type BadScansMap = BadScanDatabase;
type CheckedScansMap = CheckedScanDatabase;

describe("filterNonBathrooms Unit", () => {
  let mockService: MockGeminiService;
  let mockBadScans: BadScansMap;
  let mockCheckedScans: CheckedScansMap;
  let checkedScanIds: Set<string>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = new GeminiService() as MockGeminiService;
    mockBadScans = {};
    mockCheckedScans = {};
    checkedScanIds = new Set<string>();

    (getCheckedScans as Mock).mockReturnValue(mockCheckedScans);
    (getBadScans as Mock).mockReturnValue(mockBadScans);
    (GeminiService as unknown as Mock).mockImplementation(function MockGemini() {
      return mockService;
    });
  });

  describe("classifyGeminiAnswer", () => {
    it("classifies YES correctly", () => {
      expect(classifyGeminiAnswer("YES")).toBe("YES");
      expect(classifyGeminiAnswer("yes")).toBe("YES");
      expect(classifyGeminiAnswer("YES!")).toBe("YES");
      expect(classifyGeminiAnswer("Answer is YES.")).toBe("YES");
    });

    it("classifies NO correctly", () => {
      expect(classifyGeminiAnswer("NO")).toBe("NO");
      expect(classifyGeminiAnswer("no")).toBe("NO");
      expect(classifyGeminiAnswer("NO!")).toBe("NO");
      expect(classifyGeminiAnswer("Definitely NO.")).toBe("NO");
    });

    it("classifies ambiguous responses", () => {
      expect(classifyGeminiAnswer("MAYBE")).toBe("AMBIGUOUS");
      expect(classifyGeminiAnswer("YES and NO")).toBe("AMBIGUOUS");
      expect(classifyGeminiAnswer("NO but maybe YES")).toBe("AMBIGUOUS");
      expect(classifyGeminiAnswer("")).toBe("AMBIGUOUS");
    });
  });

  describe("processArtifact Logic", () => {
    const MOCK_DIR = "/mock/data/artifacts/env/artifact1";

    beforeEach(() => {
      (fs.existsSync as Mock).mockReturnValue(true);
      (fs.readFileSync as Mock).mockReturnValue(Buffer.from("video"));
      (fs.rmSync as Mock).mockReturnValue(undefined);
    });

    it("skips if artifact is already in badScans", async () => {
      mockBadScans["artifact1"] = {
        date: "2025-01-01",
        environment: "env",
        reason: "bad"
      };

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      expect(result).toEqual(expect.objectContaining({ processed: 0, removed: 0, skippedCached: 1 }));
      expect(mockService.generateContent).not.toHaveBeenCalled();
    });

    it("skips if artifact is already in checkedScanIds", async () => {
      checkedScanIds.add("artifact1");

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      expect(result).toEqual(expect.objectContaining({ processed: 0, removed: 0, skippedCached: 1 }));
      expect(mockService.generateContent).not.toHaveBeenCalled();
    });

    it("skips if video does not exist", async () => {
      (fs.existsSync as Mock).mockReturnValue(false);

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      expect(result).toEqual(expect.objectContaining({ processed: 0, removed: 0, skipped: 1 }));
      expect(mockService.generateContent).not.toHaveBeenCalled();
    });

    it("keeps artifact if Gemini says YES", async () => {
      mockService.generateContent.mockResolvedValue("YES");

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      expect(result).toEqual(expect.objectContaining({ processed: 1, removed: 0, skipped: 0 }));
      expect(mockCheckedScans["artifact1"]).toBeDefined();
      expect(mockCheckedScans["artifact1"]?.filteredModel).toBe("gemini-3-pro-preview");
      expect(checkedScanIds.has("artifact1")).toBe(true);
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it("removes artifact if Gemini says NO", async () => {
      // Clean "NO" matches strict regex
      mockService.generateContent.mockResolvedValue("NO");

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      expect(result).toEqual(expect.objectContaining({ processed: 1, removed: 1, skipped: 0 }));
      expect(mockBadScans["artifact1"]).toBeDefined();
      expect(mockBadScans["artifact1"]?.reason).toContain("Not a bathroom");
      expect(fs.rmSync).toHaveBeenCalledWith(MOCK_DIR, { force: true, recursive: true });
      expect(checkedScanIds.has("artifact1")).toBe(false);
    });

    it("skips if Gemini says 'YES but mostly NO' (Strict Parsing Ambiguity)", async () => {
      // Contains both YES and NO -> Ambiguous -> Skip
      mockService.generateContent.mockResolvedValue("YES but mostly NO");

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      // result should be scanned as processed but skipped as ambiguous
      expect(result.processed).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.skippedAmbiguous).toBe(1);

      // Should NOT delete
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it("DOES NOT remove artifact in DRY_RUN mode", async () => {
      mockService.generateContent.mockResolvedValue("NO");

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans, {
        dryRun: true
      });

      // In dry run, we increment 'removed' to show what WOULD happen, but fs.rmSync is not called
      expect(result.removed).toBe(1);
      expect(fs.rmSync).not.toHaveBeenCalled();

      // Bad scans should NOT be updated in dry run
      expect(mockBadScans["artifact1"]).toBeUndefined();
    });

    it("handles Gemini error gracefully", async () => {
      mockService.generateContent.mockRejectedValue(new Error("API Fail"));

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      expect(result.errors).toBe(1);
      // No mutation
      expect(mockBadScans["artifact1"]).toBeUndefined();
      expect(checkedScanIds.has("artifact1")).toBe(false);
    });

    it("handles rmSync failure gracefully", async () => {
      mockService.generateContent.mockResolvedValue("NO");
      (fs.rmSync as Mock).mockImplementation(() => {
        throw new Error("Delete Fail");
      });

      const result = await processArtifact(MOCK_DIR, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

      // Processed increments, but removed does NOT increment because delete failed
      expect(result.processed).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.errors).toBe(1);

      // And badScans is NOT updated because delete failed (Safety)
      expect(mockBadScans["artifact1"]).toBeUndefined();
    });

    describe("runBatchProcessing", () => {
      const MOCK_DIRS = [
        "/mock/data/artifacts/env/dir1",
        "/mock/data/artifacts/env/dir2",
        "/mock/data/artifacts/env/dir3"
      ];

      beforeEach(() => {
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue(Buffer.from("video"));
        (fs.rmSync as Mock).mockReturnValue(undefined);
      });

      it("should process all directory items", async () => {
        mockService.generateContent.mockResolvedValue("YES");
        const saveSpy = vi.fn();

        const stats = await import("../../../src/scripts/filterNonBathrooms").then(async (mod) => {
          const result = await mod.runBatchProcessing(
            MOCK_DIRS,
            mockService,
            mockBadScans,
            checkedScanIds,
            mockCheckedScans,
            saveSpy,
            { concurrency: 2 }
          );
          return result;
        });

        // 3 items, all YES -> 3 processed
        expect(stats.processed).toBe(3);
        expect(stats.removed).toBe(0);
        expect(mockService.generateContent).toHaveBeenCalledTimes(3);
      });

      it("should aggregate stats correctly", async () => {
        // Mock generateContent to alternate YES/NO based on call
        mockService.generateContent
          .mockResolvedValueOnce("YES")
          .mockResolvedValueOnce("NO")
          .mockResolvedValueOnce("Invalid");

        const saveSpy = vi.fn();

        const stats = await import("../../../src/scripts/filterNonBathrooms").then(async (mod) => {
          const result = await mod.runBatchProcessing(
            MOCK_DIRS,
            mockService,
            mockBadScans,
            checkedScanIds,
            mockCheckedScans,
            saveSpy,
            { concurrency: 1 }
          );
          return result;
        });

        expect(stats.processed).toBe(3);
        expect(stats.removed).toBe(1); // One NO
        expect(stats.skippedAmbiguous).toBe(1); // One Invalid
      });

      it("should call saveCallback periodically", async () => {
        mockService.generateContent.mockResolvedValue("YES");
        const saveSpy = vi.fn();
        const MANY_DIRS = Array(5).fill("/mock/data/artifacts/env/dir") as string[];

        await import("../../../src/scripts/filterNonBathrooms").then(async (mod) => {
          const result = await mod.runBatchProcessing(
            MANY_DIRS,
            mockService,
            mockBadScans,
            checkedScanIds,
            mockCheckedScans,
            saveSpy,
            { concurrency: 1, saveInterval: 2 }
          );
          return result;
        });

        // 5 items, interval 2. Should save at 2, 4.
        expect(saveSpy).toHaveBeenCalledTimes(2);
      });
    });
    describe("main", () => {
      beforeEach(() => {
        vi.clearAllMocks();
        // Reset env
        process.env["BATHROOM_FILTER_CONCURRENCY"] = "5";
        process.env["DRY_RUN"] = "false";
      });

      it("should orchestration execution and save results", async () => {
        // Setup mocks
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue(Buffer.from("video"));
        mockService.generateContent.mockResolvedValue("YES");

        // Mock Data
        const DIRS = ["/mock/dir1", "/mock/dir2"];
        const findingSpy = vi
          .spyOn(await import("../../../src/utils/data/artifactIterator"), "findArtifactDirectories")
          .mockReturnValue(DIRS);

        const saveBadSpy = vi.spyOn(await import("../../../src/utils/data/badScans"), "saveBadScans");
        const saveCheckedSpy = vi.spyOn(await import("../../../src/utils/data/checkedScans"), "saveCheckedScans");

        // Run main
        const { main } = await import("../../../src/scripts/filterNonBathrooms");
        await main();

        expect(findingSpy).toHaveBeenCalled();
        // Should have saved
        expect(saveBadSpy).toHaveBeenCalled();
        expect(saveCheckedSpy).toHaveBeenCalled();
      });

      it("should respect DRY_RUN env var", async () => {
        process.env["DRY_RUN"] = "true";

        // Mock finding
        vi.spyOn(await import("../../../src/utils/data/artifactIterator"), "findArtifactDirectories").mockReturnValue([
          "/mock/dir1"
        ]);

        const saveBadSpy = vi.spyOn(await import("../../../src/utils/data/badScans"), "saveBadScans");

        const { main } = await import("../../../src/scripts/filterNonBathrooms");
        await main();

        expect(saveBadSpy).not.toHaveBeenCalled();
      });

      it("should filter properly based on checkedScans", async () => {
        // Setup checked scans
        mockCheckedScans["dir1"] = { filteredDate: "2025-01-01" };

        // Mock finding returning dir1 (checked) and dir2 (unchecked)
        vi.spyOn(await import("../../../src/utils/data/artifactIterator"), "findArtifactDirectories").mockReturnValue([
          "/mock/data/artifacts/env/dir1",
          "/mock/data/artifacts/env/dir2"
        ]);

        // Mock Gemini for dir2
        mockService.generateContent.mockResolvedValue("YES");

        const { main } = await import("../../../src/scripts/filterNonBathrooms");
        await main();

        // One should be skipped (dir1), one processed (dir2)
        // We can't easily check the stats variable inside main,
        // but we can check calls to generateContent.
        // Should be called ONCE (for dir2).
        expect(mockService.generateContent).toHaveBeenCalledTimes(1);
      });
    });
  });
});
