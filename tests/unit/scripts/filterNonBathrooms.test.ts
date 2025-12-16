import * as fs from "fs";

import { BadScanDatabase } from "../../../src/models/badScanRecord";
import { CheckedScanDatabase } from "../../../src/models/checkedScanRecord";
import { Mock, Mocked, beforeEach, describe, expect, it, vi } from "vitest";

import { processArtifact } from "../../../src/scripts/filterNonBathrooms";
import { GeminiService } from "../../../src/services/geminiService";
import { getBadScans } from "../../../src/utils/data/badScans";
import { getCheckedScans } from "../../../src/utils/data/checkedScans";

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

    (getBadScans as Mock).mockReturnValue(mockBadScans);
    (getCheckedScans as Mock).mockReturnValue(mockCheckedScans);
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

      // Bad scans should NOT be updated in dry run (strictly speaking, function doesn't update it in dry run block)
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
  });
});
