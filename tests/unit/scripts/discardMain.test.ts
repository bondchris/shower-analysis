import path from "path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FfprobeData } from "fluent-ffmpeg";

import { BadScanDatabase } from "../../../src/models/badScanRecord";
import { CheckedScanDatabase } from "../../../src/models/checkedScanRecord";
import { DiscardReportInput } from "../../../src/models/discardStats";

// Mocks
vi.mock("../../../src/utils/data/badScans", () => ({
  getBadScans: vi.fn().mockReturnValue({}),
  saveBadScans: vi.fn()
}));

vi.mock("../../../src/utils/data/checkedScans", () => ({
  getCheckedScans: vi.fn().mockReturnValue({}),
  saveCheckedScans: vi.fn()
}));

vi.mock("../../../src/utils/data/videoHashes", () => ({
  addVideoHash: vi.fn(),
  findDuplicateArtifacts: vi.fn().mockReturnValue([]),
  getVideoHashes: vi.fn().mockReturnValue({}),
  saveVideoHashes: vi.fn()
}));

vi.mock("../../../src/utils/video/hash", () => ({
  hashVideoInDirectory: vi.fn().mockResolvedValue(null)
}));

vi.mock("../../../src/utils/video/blackFrames", () => ({
  detectBlackFrames: vi.fn().mockResolvedValue([])
}));

vi.mock("../../../src/utils/data/discardArtifact", () => ({
  discardArtifact: vi.fn().mockReturnValue("/mock/discarded/artifact")
}));

vi.mock("../../../src/utils/data/artifactIterator", () => ({
  findArtifactDirectories: vi.fn().mockReturnValue(["/mock/artifact/a"])
}));

vi.mock("../../../src/utils/progress", () => ({
  createProgressBar: vi.fn().mockReturnValue({
    increment: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn()
  })
}));

// Keep logger quiet
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock("../../../src/utils/reportGenerator", () => ({
  generatePdfReport: vi.fn()
}));

vi.mock("../../../src/templates/discardReport", () => ({
  buildDiscardReport: vi.fn().mockReturnValue({ sections: [], title: "Discard Report" })
}));

// Avoid real Gemini calls
const mockGenerateContent = vi.fn(async () => {
  await Promise.resolve();
  return "YES";
});
class MockGeminiService {
  generateContent = mockGenerateContent;
}

vi.mock("../../../src/services/geminiService", () => ({
  GeminiService: MockGeminiService
}));

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("video")),
  readdirSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn()
}));

describe("discard main orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs clean + filter in dry-run mode without persisting databases", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { saveBadScans } = await import("../../../src/utils/data/badScans");
    const { saveCheckedScans } = await import("../../../src/utils/data/checkedScans");

    const result = await main({
      artifactDirs: [],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.clean).toEqual({
      failedDeletes: [],
      quarantinedCount: 0,
      removedCount: 0,
      skippedCleanCount: 0
    });
    expect(result.filter).toEqual({
      errors: 0,
      processed: 0,
      removed: 0,
      skipped: 0,
      skippedAmbiguous: 0,
      skippedCached: 0
    });

    expect(saveBadScans).not.toHaveBeenCalled();
    expect(saveCheckedScans).not.toHaveBeenCalled();
  });

  it("persists databases when not dry-run, skipping clean and running empty filter set", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { saveBadScans } = await import("../../../src/utils/data/badScans");
    const { saveCheckedScans } = await import("../../../src/utils/data/checkedScans");

    const result = await main({
      artifactDirs: [],
      databases: { badScans: {}, checkedScans: {} },
      skipClean: true
    });

    expect(result.clean).toEqual({
      failedDeletes: [],
      quarantinedCount: 0,
      removedCount: 0,
      skippedCleanCount: 0
    });
    expect(result.filter).toEqual({
      errors: 0,
      processed: 0,
      removed: 0,
      skipped: 0,
      skippedAmbiguous: 0,
      skippedCached: 0
    });

    expect(saveBadScans).toHaveBeenCalledTimes(1);
    expect(saveCheckedScans).toHaveBeenCalledTimes(1);
  });

  it("loads default databases and artifacts when both phases are skipped", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { getBadScans } = await import("../../../src/utils/data/badScans");
    const { getCheckedScans } = await import("../../../src/utils/data/checkedScans");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const result = await main({ skipClean: true, skipFilter: true });

    expect(result.clean).toEqual({
      failedDeletes: [],
      quarantinedCount: 0,
      removedCount: 0,
      skippedCleanCount: 0
    });
    expect(result.filter).toEqual({
      errors: 0,
      processed: 0,
      removed: 0,
      skipped: 0,
      skippedAmbiguous: 0,
      skippedCached: 0
    });

    expect(getBadScans).toHaveBeenCalled();
    expect(getCheckedScans).toHaveBeenCalled();
    expect(findArtifactDirectories).toHaveBeenCalled();
  });

  it("ignores bad scan ids without database entries when collecting new bad scans", async () => {
    const mod = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const badScans: BadScanDatabase = {};
    const checkedScans: CheckedScanDatabase = {};

    const cleanSpy = vi
      .spyOn(mod, "runCleanPhase")
      .mockImplementation(async (options): Promise<Awaited<ReturnType<typeof mod.runCleanPhase>>> => {
        badScans["missingEntry"] = undefined as unknown as (typeof badScans)[string];
        await Promise.resolve();
        return {
          databases: options?.databases ?? { badScans, checkedScans },
          remainingArtifacts: [],
          stats: {
            failedDeletes: [],
            quarantinedCount: 0,
            removedCount: 0,
            skippedCleanCount: 0
          }
        };
      });

    await mod.main({
      artifactDirs: [],
      databases: { badScans, checkedScans },
      dryRun: true,
      skipDuplicates: true,
      skipFilter: true,
      skipMismatch: true
    });

    const callArgs = (buildDiscardReport as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | DiscardReportInput
      | undefined;
    expect(callArgs?.newBadScans).toEqual([]);

    cleanSpy.mockRestore();
  });

  it("skips missing entries when collecting new bad scans directly", async () => {
    const { collectNewBadScans } = await import("../../../src/scripts/discard");

    const badScans: BadScanDatabase = {};
    const beforeIds = new Set<string>();
    const afterIds = new Set<string>(["orphan"]);
    badScans["orphan"] = undefined as unknown as (typeof badScans)[string];

    const additions = collectNewBadScans(badScans, beforeIds, afterIds, "clean");

    expect(additions).toEqual([]);
  });

  it("saves during filter phase when work is present and saveInterval triggers", async () => {
    const { runFilterPhase } = await import("../../../src/scripts/discard");
    const { saveBadScans } = await import("../../../src/utils/data/badScans");
    const { saveCheckedScans } = await import("../../../src/utils/data/checkedScans");
    const { GeminiService } = await import("../../../src/services/geminiService");

    const mockService = new GeminiService();
    const badDb: BadScanDatabase = {};
    const checkedDb: CheckedScanDatabase = {};

    const result = await runFilterPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: badDb, checkedScans: checkedDb },
      dryRun: false,
      saveInterval: 1,
      saveResults: true,
      service: mockService
    });

    expect(result.stats.processed).toBe(1);
    expect(result.stats.removed).toBe(0);
    expect(checkedDb["artifact1"]?.filteredDate).toBeDefined();
    expect(saveBadScans).toHaveBeenCalledTimes(2); // save callback + final save
    expect(saveCheckedScans).toHaveBeenCalledTimes(2);
  });

  it("does not save during filter dry-run", async () => {
    const { runFilterPhase } = await import("../../../src/scripts/discard");
    const { saveBadScans } = await import("../../../src/utils/data/badScans");
    const { saveCheckedScans } = await import("../../../src/utils/data/checkedScans");
    const { GeminiService } = await import("../../../src/services/geminiService");

    const mockService = new GeminiService();

    const result = await runFilterPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact2"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      saveInterval: 1,
      saveResults: true,
      service: mockService
    });

    expect(result.stats.processed).toBe(1);
    expect(saveBadScans).not.toHaveBeenCalled();
    expect(saveCheckedScans).not.toHaveBeenCalled();
  });

  it("generates discard report after processing", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");
    const { generatePdfReport } = await import("../../../src/utils/reportGenerator");

    await main({
      artifactDirs: [],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      skipClean: true,
      skipFilter: true
    });

    expect(buildDiscardReport).toHaveBeenCalled();
    expect(generatePdfReport).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Discard Report" }),
      "2 - Discard Report.pdf"
    );
  });

  it("adds new bad scans during filter and forwards them to the discard report", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    mockGenerateContent.mockResolvedValueOnce("NO");

    await main({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: false,
      skipClean: true
    });

    expect(buildDiscardReport).toHaveBeenCalledWith(
      expect.objectContaining({
        finalBadScanCount: 1,
        initialBadScanCount: 0,
        newBadScans: [
          expect.objectContaining({
            environment: "env",
            id: "artifact1",
            stage: "filter"
          })
        ]
      })
    );
  });

  it("collects newly added bad scans between stages", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const ffprobe = vi.fn((_: string, cb: (err: Error | null, data: FfprobeData) => void) => {
      cb(null, { format: { duration: 1 } } as FfprobeData);
    }) as unknown as typeof import("fluent-ffmpeg").ffprobe;

    const badDb: BadScanDatabase = {
      cached: { date: "2024-01-01", environment: "env", reason: "Existing cached" }
    };

    await main({
      artifactDirs: ["/mock/data/artifacts/env/newbad"],
      databases: { badScans: badDb, checkedScans: {} },
      dryRun: false,
      ffprobe,
      minDuration: 12,
      skipDuplicates: true,
      skipFilter: true,
      skipMismatch: true
    });

    const reportCall = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { newBadScans?: { id: string; stage: string }[] }
      | undefined;

    expect(reportCall?.newBadScans).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "newbad", stage: "clean" })])
    );
  });

  it("includes duplicate entries with scanDate in badScanHistory", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const badDb: BadScanDatabase = {
      dup1: {
        date: "2024-01-01",
        environment: "env",
        reason: "Duplicate video (hash abc123)",
        scanDate: "2024-08-01T10:00:00Z"
      }
    };

    await main({
      artifactDirs: [],
      databases: { badScans: badDb, checkedScans: {} },
      dryRun: true,
      skipClean: true,
      skipDuplicates: true,
      skipFilter: true
    });

    expect(buildDiscardReport).toHaveBeenCalledWith(
      expect.objectContaining({
        badScanHistory: [
          expect.objectContaining({
            id: "dup1",
            reason: "Duplicate video (hash abc123)",
            scanDate: "2024-08-01T10:00:00Z"
          })
        ]
      })
    );
  });

  it("includes cached valid artifacts in countsByEnv", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;
    mockFindArtifacts.mockReturnValue(["/mock/data/artifacts/production/artifact1"]);

    const checkedDb: CheckedScanDatabase = {
      artifact1: { filteredDate: "2024-01-01" }
    };

    await main({
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: true,
      skipClean: true,
      skipDuplicates: true,
      skipFilter: true
    });

    const reportCall = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { countsByEnv?: Record<string, { validCached?: number }> }
      | undefined;
    expect(reportCall?.countsByEnv?.["production"]?.validCached).toBe(1);
  });

  it("categorizes bad scans by reason type in countsByEnv", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const badDb: BadScanDatabase = {
      dup1: { date: "2024-01-01", environment: "env", reason: "Duplicate video (hash abc)" },
      nb1: { date: "2024-01-01", environment: "env", reason: "Not a bathroom" },
      short1: { date: "2024-01-01", environment: "env", reason: "Video too short (5s)" }
    };

    await main({
      artifactDirs: [],
      databases: { badScans: badDb, checkedScans: {} },
      dryRun: true,
      skipClean: true,
      skipDuplicates: true,
      skipFilter: true
    });

    const reportCall = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | {
          countsByEnv?: Record<
            string,
            { duplicateCached?: number; notBathroomCached?: number; tooShortCached?: number }
          >;
        }
      | undefined;
    expect(reportCall?.countsByEnv?.["env"]?.duplicateCached).toBe(1);
    expect(reportCall?.countsByEnv?.["env"]?.notBathroomCached).toBe(1);
    expect(reportCall?.countsByEnv?.["env"]?.tooShortCached).toBe(1);
  });

  it("counts new bad scans by reason category for the current run", async () => {
    const fs = await import("fs");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-01-01T00:00:00Z" });
      }
      return Buffer.from("video");
    });

    mockHash.mockResolvedValue("dup-hash");

    mockFindDuplicates.mockImplementation((_, hash: string) => (hash === "dup-hash" ? ["existing"] : []));

    mockGenerateContent.mockReset();
    mockGenerateContent.mockResolvedValue("YES");
    mockGenerateContent.mockResolvedValueOnce("NO").mockResolvedValueOnce("YES");

    const ffprobe = vi.fn((filePath: string, cb: (err: Error | null, data: FfprobeData) => void) => {
      const isShort = filePath.includes("artifact-short");
      cb(null, { format: { duration: isShort ? 5 : 20 } } as FfprobeData);
    }) as unknown as typeof import("fluent-ffmpeg").ffprobe;

    const { main } = await import("../../../src/scripts/discard");

    await main({
      artifactDirs: [
        "/mock/data/artifacts/env/artifact-short",
        "/mock/data/artifacts/env/artifact-not-bathroom",
        "/mock/data/artifacts/env/artifact-duplicate"
      ],
      concurrency: 1,
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans: {} },
      dryRun: false,
      ffprobe,
      minDuration: 10,
      skipMismatch: true,
      videoHashes: {}
    });

    const reportCall = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | {
          countsByEnv?: Record<string, { duplicateNew?: number; notBathroomNew?: number; tooShortNew?: number }>;
        }
      | undefined;

    expect(reportCall?.countsByEnv?.["env"]?.tooShortNew).toBe(1);
    expect(reportCall?.countsByEnv?.["env"]?.notBathroomNew).toBe(1);
    expect(reportCall?.countsByEnv?.["env"]?.duplicateNew).toBe(1);

    mockReadFileSync.mockReset();
    mockReadFileSync.mockReturnValue(Buffer.from("video"));
    mockHash.mockReset();
    mockHash.mockResolvedValue(null);
    mockFindDuplicates.mockReset();
    mockFindDuplicates.mockReturnValue([]);
    mockGenerateContent.mockReset();
    mockGenerateContent.mockResolvedValue("YES");
  });

  it("includes badScanHistory entries with scanDate", async () => {
    const { main } = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const badDb: BadScanDatabase = {
      withDate: { date: "2024-01-01", environment: "env", reason: "test", scanDate: "2024-08-01T10:00:00Z" },
      withoutDate: { date: "2024-01-01", environment: "env", reason: "test2" }
    };

    await main({
      artifactDirs: [],
      databases: { badScans: badDb, checkedScans: {} },
      dryRun: true,
      skipClean: true,
      skipDuplicates: true,
      skipFilter: true
    });

    expect(buildDiscardReport).toHaveBeenCalledWith(
      expect.objectContaining({
        badScanHistory: [
          expect.objectContaining({
            id: "withDate",
            scanDate: "2024-08-01T10:00:00Z"
          })
        ]
      })
    );
  });

  it("should run only mismatch phase when requested", async () => {
    const { runMismatchOnly } = await import("../../../src/scripts/discard");
    const result = await runMismatchOnly({
      artifactDirs: [],
      dryRun: true
    });
    expect(result).toBeDefined();
    expect(result.processed).toBe(0);
  });
});

describe("runDuplicatesPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("detects duplicate videos and adds them to bad scans", async () => {
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;

    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue(["existingArtifact"]);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.stats.duplicateCount).toBe(1);
    expect(result.stats.newDuplicateCount).toBe(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]).toMatchObject({
      artifactId: "artifact1",
      hash: "abc123"
    });
  });

  it("skips artifacts already in bad scans cache", async () => {
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    mockHash.mockResolvedValue("abc123");

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const badDb: BadScanDatabase = {
      artifact1: { date: "2024-01-01", environment: "env", reason: "Duplicate video" }
    };

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: badDb, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.stats.skippedCached).toBe(1);
    expect(result.stats.duplicateCount).toBe(0);
  });

  it("skips artifacts without video file", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    mockExistsSync.mockReturnValue(false);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.stats.processed).toBe(0);
  });

  it("handles hash errors gracefully", async () => {
    const fs = await import("fs");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockHash.mockResolvedValue(null);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.stats.errors).toBe(1);
  });

  it("extracts scanDate from meta.json for duplicate entries", async () => {
    const fs = await import("fs");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;

    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue(["existingArtifact"]);
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.duplicates[0]?.scanDate).toBe("2024-08-01T10:00:00Z");
  });

  it("discards artifacts when not in dry-run mode", async () => {
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts, addVideoHash, saveVideoHashes } =
      await import("../../../src/utils/data/videoHashes");
    const { discardArtifact } = await import("../../../src/utils/data/discardArtifact");
    const { saveBadScans } = await import("../../../src/utils/data/badScans");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;

    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue(["existingArtifact"]);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: false,
      saveResults: true,
      videoHashes: {}
    });

    expect(discardArtifact).toHaveBeenCalled();
    expect(addVideoHash).toHaveBeenCalled();
    expect(saveBadScans).toHaveBeenCalled();
    expect(saveVideoHashes).toHaveBeenCalled();
  });

  it("marks duplicate as not new when hash already exists in database", async () => {
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;

    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue(["existingArtifact"]);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: { abc123: ["existingArtifact"] }
    });

    expect(result.stats.newDuplicateCount).toBe(0);
    expect(result.duplicates[0]?.isNew).toBe(false);
  });

  it("returns only stats from runDuplicatesOnly helper", async () => {
    const { runDuplicatesOnly } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesOnly({ artifactDirs: [] });

    expect(result).toEqual({
      duplicateCount: 0,
      errors: 0,
      newDuplicateCount: 0,
      processed: 0,
      skippedCached: 0
    });
  });
});

describe("runMismatchPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("loads cached mismatch data from checkedScans", async () => {
    const fs = await import("fs");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      // Return false for discarded-artifacts directory check
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockFindArtifacts.mockReturnValue(["/mock/data/artifacts/env/artifact1"]);

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const checkedDb: CheckedScanDatabase = {
      artifact1: {
        filteredDate: "2024-01-01",
        mismatchCheckedDate: "2024-01-01",
        mismatchDiffHours: 48,
        mismatchScanDate: "2024-08-01T10:00:00Z",
        mismatchVideoDate: "2024-07-30T10:00:00Z"
      }
    };

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: true
    });

    expect(result.stats.skippedCached).toBe(0);
    expect(result.stats.mismatchCount).toBe(1);
    expect(result.dateMismatches[0]?.diffHours).toBe(48);
    expect(result.dateMismatches[0]?.isNew).toBe(false);
  });

  it("skips artifacts without video or meta file", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    mockExistsSync.mockReturnValue(false);

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.processed).toBe(0);
  });
});

describe("main - newBadScans from duplicates phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("counts new duplicate detections in duplicateNew", async () => {
    const fs = await import("fs");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue(["existingArtifact"]);

    const { main } = await import("../../../src/scripts/discard");

    await main({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: false,
      skipClean: true,
      skipFilter: true,
      skipMismatch: true
    });

    const reportCall = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | { countsByEnv?: Record<string, { duplicateNew?: number }> }
      | undefined;
    expect(reportCall?.countsByEnv?.["env"]?.duplicateNew).toBe(1);
  });
});

describe("runDuplicatesPhase - edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("skips .DS_Store entries", async () => {
    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/.DS_Store"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.stats.processed).toBe(0);
  });

  it("adds non-duplicate artifacts to remaining", async () => {
    const fs = await import("fs");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue([]);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(result.stats.processed).toBe(1);
    expect(result.stats.duplicateCount).toBe(0);
    expect(result.remainingArtifacts).toContain("/mock/data/artifacts/env/artifact1");
  });

  it("handles discard error gracefully", async () => {
    const fs = await import("fs");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");
    const { discardArtifact } = await import("../../../src/utils/data/discardArtifact");

    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockDiscard = discardArtifact as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockHash.mockResolvedValue("abc123");
    mockFindDuplicates.mockReturnValue(["existingArtifact"]);
    mockDiscard.mockReturnValue(null);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: false,
      videoHashes: {}
    });

    expect(result.stats.errors).toBe(1);
    expect(result.remainingArtifacts).toContain("/mock/data/artifacts/env/artifact1");
  });

  it("warns and records an error when hashing fails", async () => {
    const fs = await import("fs");
    const { logger } = await import("../../../src/utils/logger");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockHash = hashVideoInDirectory as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockHash.mockRejectedValue(new Error("hash failure"));

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: {}
    });

    expect(logger.warn).toHaveBeenCalled();
    expect(result.stats.errors).toBe(1);
    expect(result.remainingArtifacts).toContain("/mock/data/artifacts/env/artifact1");
  });
});

describe("runMismatchPhase - edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("skips .DS_Store entries", async () => {
    const fs = await import("fs");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    // Make discarded-artifacts directory not exist to avoid scanning it
    mockExistsSync.mockReturnValue(false);
    mockFindArtifacts.mockReturnValue([]);

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/.DS_Store"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.processed).toBe(0);
  });

  it("skips artifacts with empty scanDate in meta.json", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "" }));

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.processed).toBe(0);
  });
});

// Mock extractVideoMetadata at module level for mismatch detection tests
vi.mock("../../../src/utils/video/metadata", () => ({
  extractVideoMetadata: vi.fn()
}));

describe("runMismatchPhase - mismatch detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("detects date mismatch when video date differs > 24 hours from scan date", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-07-01T10:00:00Z" });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.processed).toBe(1);
    expect(result.stats.mismatchCount).toBe(1);
    expect(result.stats.newMismatchCount).toBe(1);
    expect(result.dateMismatches).toHaveLength(1);
  });

  it("does not flag mismatch when dates are within 24 hours", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    // 1 hour difference - not a mismatch
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T09:00:00Z" });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.processed).toBe(1);
    expect(result.stats.mismatchCount).toBe(0);
    expect(result.dateMismatches).toHaveLength(0);
  });

  it("updates checkedScans when not in dry-run mode", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");
    const { saveCheckedScans } = await import("../../../src/utils/data/checkedScans");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-07-01T10:00:00Z" });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const checkedDb: CheckedScanDatabase = {};

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: false,
      saveResults: true
    });

    expect(result.stats.mismatchCount).toBe(1);
    expect(checkedDb["artifact1"]).toBeDefined();
    expect(checkedDb["artifact1"]?.mismatchCheckedDate).toBeDefined();
    expect(checkedDb["artifact1"]?.mismatchDiffHours).toBeGreaterThan(24);
    expect(saveCheckedScans).toHaveBeenCalled();
  });

  it("creates new checkedScans entry if not present", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    // 1 hour difference - not a mismatch, but should still update checkedScans
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T09:00:00Z" });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const checkedDb: CheckedScanDatabase = {};

    await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: false,
      saveResults: true
    });

    expect(checkedDb["artifact1"]).toBeDefined();
    expect(checkedDb["artifact1"]?.mismatchCheckedDate).toBeDefined();
    // Should not have mismatch data since no mismatch was detected
    expect(checkedDb["artifact1"]?.mismatchDiffHours).toBeUndefined();
  });

  it("marks as checked even when creationTime is undefined", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    // No creationTime in metadata
    mockExtractMetadata.mockResolvedValue({});

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const checkedDb: CheckedScanDatabase = {};

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: false,
      saveResults: true
    });

    expect(result.stats.processed).toBe(1);
    expect(result.stats.mismatchCount).toBe(0);
    expect(checkedDb["artifact1"]).toBeDefined();
    expect(checkedDb["artifact1"]?.mismatchCheckedDate).toBeDefined();
  });

  it("detects stray avcC bytes before the primary header", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });

    const validPayload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const headerSize = 8;
    const validSize = headerSize + validPayload.length;
    const validChunk = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, validSize]), Buffer.from("avcC"), validPayload]);
    const invalidChunk = Buffer.from("xxavcC");

    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.concat([invalidChunk, validChunk]);
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T10:00:00Z" });

    const checkedDb: CheckedScanDatabase = {};
    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-header"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: false,
      saveResults: false
    });

    expect(result.videoHeaderAnomalies).toEqual([
      expect.objectContaining({ environment: "env", id: "artifact-header", isNew: true })
    ]);
    expect(result.stats.headerAnomalyCount).toBe(1);
    expect(result.stats.newHeaderAnomalyCount).toBe(1);
    expect(checkedDb["artifact-header"]?.avcAnomalyDetected).toBe(true);
    expect(checkedDb["artifact-header"]?.avcAnomalyCheckedDate).toBeDefined();
  });

  it("records header checks when no anomaly is present", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });

    const validPayload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const headerSize = 8;
    const validSize = headerSize + validPayload.length;
    const validChunk = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, validSize]), Buffer.from("avcC"), validPayload]);

    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.concat([validChunk, validChunk]);
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T10:00:00Z" });

    const checkedDb: CheckedScanDatabase = {};
    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-clean"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans: checkedDb },
      dryRun: false,
      saveResults: false
    });

    expect(result.videoHeaderAnomalies).toHaveLength(0);
    expect(result.stats.headerAnomalyCount).toBe(0);
    expect(result.stats.newHeaderAnomalyCount).toBe(0);
    expect(checkedDb["artifact-clean"]?.avcAnomalyDetected).toBe(false);
    expect(checkedDb["artifact-clean"]?.avcAnomalyCheckedDate).toBeDefined();
  });

  it("handles mismatch check errors gracefully", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue([]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    mockExtractMetadata.mockRejectedValue(new Error("ffprobe error"));

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact1"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.errors).toBe(1);
  });
});

describe("discard additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses default artifact discovery for duplicates and handles missing meta when duplicate is found", async () => {
    const fs = await import("fs");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;
    const mockHashVideo = hashVideoInDirectory as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockReturnValue(["/mock/data/artifacts/env/artifact-dupe"]);
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.endsWith("video.mp4")) {
        return true;
      }
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return false;
      }
      return true;
    });
    mockHashVideo.mockResolvedValue("hash-1");
    mockFindDuplicates.mockReturnValue(["existing"]);

    const { runDuplicatesPhase } = await import("../../../src/scripts/discard");

    const result = await runDuplicatesPhase({
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      videoHashes: { "hash-1": ["existing"] }
    });

    expect(mockFindArtifacts).toHaveBeenCalled();
    expect(result.duplicates).toEqual([expect.objectContaining({ artifactId: "artifact-dupe" })]);
    expect(result.stats.duplicateCount).toBe(1);
  });

  it("returns cached mismatch and header anomalies from discarded artifacts without reprocessing", async () => {
    const fs = await import("fs");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });

    const checkedScans: CheckedScanDatabase = {
      "artifact-cached": {
        avcAnomalyCheckedDate: "2024-01-03T00:00:00Z",
        avcAnomalyDetected: true,
        mismatchCheckedDate: "2024-01-02T00:00:00Z",
        mismatchDiffHours: 30,
        mismatchScanDate: "2024-01-02T00:00:00Z",
        mismatchVideoDate: "2024-01-01T00:00:00Z"
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/discarded-artifacts/env/artifact-cached"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.stats.skippedCached).toBe(0);
    expect(result.stats.headerAnomalyCount).toBe(1);
    expect(result.stats.mismatchCount).toBe(1);
    expect(result.videoHeaderAnomalies[0]).toMatchObject({ id: "artifact-cached", isNew: false });
    expect(result.dateMismatches[0]).toMatchObject({ id: "artifact-cached", isNew: false });
  });

  it("respects DRY_RUN env fallback and default discovery in mismatch phase", async () => {
    const fs = await import("fs");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockFindArtifacts.mockImplementation((dir: string) => [path.join(dir, "env1", "artifact-env")]);
    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      if (typeof p === "string" && p.endsWith("video.mp4")) {
        return true;
      }
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return true;
      }
      return true;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T11:00:00Z" });

    const prevEnv = process.env["DRY_RUN"];
    process.env["DRY_RUN"] = "true";

    try {
      const { runMismatchPhase } = await import("../../../src/scripts/discard");

      const result = await runMismatchPhase({
        databases: { badScans: {}, checkedScans: {} },
        saveResults: false
      });

      expect(mockFindArtifacts).toHaveBeenCalled();
      expect(result.stats.processed).toBe(1);
      expect(result.stats.errors).toBe(0);
    } finally {
      if (prevEnv === undefined) {
        delete process.env["DRY_RUN"];
      } else {
        process.env["DRY_RUN"] = prevEnv;
      }
    }
  });

  it("does not mark cached mismatches as new when mismatchCheckedDate is already set", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-02T10:00:00Z" }));
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-07-01T10:00:00Z" });

    const checkedScans: CheckedScanDatabase = {
      "artifact-repeat": { mismatchCheckedDate: "" }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-repeat"],
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.stats.mismatchCount).toBe(1);
    expect(result.stats.newMismatchCount).toBe(0);
  });

  it("flags malformed avcC payload sizes before a valid header as cached anomalies", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      // Size field claims payload larger than the buffer, making it invalid
      return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x05]), Buffer.from("avcC"), Buffer.from([0x00])]);
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T12:00:00Z" });

    const checkedScans: CheckedScanDatabase = {
      "artifact-header-invalid": {
        avcAnomalyCheckedDate: "2024-01-01T00:00:00Z",
        avcAnomalyDetected: false
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-header-invalid"],
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.stats.headerAnomalyCount).toBe(1);
    expect(result.stats.newHeaderAnomalyCount).toBe(0);
  });

  it("records header parsing errors without crashing", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      throw new Error("read failure");
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T11:00:00Z" });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-read-error"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true
    });

    expect(result.stats.errors).toBe(1);
  });

  it("retains cached mismatch entries without diff hours and skips processing when all caches are set", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    mockExistsSync.mockReturnValue(true);

    const checkedScans: CheckedScanDatabase = {
      "artifact-cached-partial": {
        avcAnomalyCheckedDate: "2024-01-02T00:00:00Z",
        avcAnomalyDetected: false,
        blackFrameCheckedDate: "2024-01-03T00:00:00Z",
        blackFrameDetected: false,
        mismatchCheckedDate: "2024-01-01T00:00:00Z"
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");
    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-cached-partial"],
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.stats.skippedCached).toBe(1);
    expect(result.dateMismatches).toEqual([]);
    expect(result.blackFrameFindings).toEqual([]);
    expect(result.videoHeaderAnomalies).toEqual([]);
  });

  it("marks mismatch check as completed when metadata creation time is missing in non-dry runs", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.from("video");
    });
    mockExtractMetadata.mockResolvedValue({});

    const checkedScans: CheckedScanDatabase = {};

    const { runMismatchPhase } = await import("../../../src/scripts/discard");
    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-no-creation"],
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.stats.processed).toBeGreaterThanOrEqual(1);
    expect(checkedScans["artifact-no-creation"]?.mismatchCheckedDate).toBeDefined();
  });

  it("returns cached mismatch, header anomaly, and black frame findings without reprocessing", async () => {
    const fs = await import("fs");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });

    const cachedSegments = [{ duration: 1, end: 1, start: 0 }];
    const checkedScans: CheckedScanDatabase = {
      "artifact-cached": {
        avcAnomalyCheckedDate: "2024-01-02T00:00:00Z",
        avcAnomalyDetected: true,
        blackFrameCheckedDate: "2024-01-03T00:00:00Z",
        blackFrameDetected: true,
        blackFrameSegments: cachedSegments,
        mismatchCheckedDate: "2024-01-01T00:00:00Z",
        mismatchDiffHours: 26,
        mismatchScanDate: "2024-01-01T00:00:00Z",
        mismatchVideoDate: "2024-01-02T00:00:00Z"
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-cached"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.stats.skippedCached).toBe(1);
    expect(result.blackFrameFindings).toEqual([
      { environment: "env", id: "artifact-cached", isNew: false, segments: cachedSegments }
    ]);
    expect(result.videoHeaderAnomalies).toEqual([{ environment: "env", id: "artifact-cached", isNew: false }]);
    expect(result.dateMismatches[0]?.isNew).toBe(false);
    expect(mockDetectBlackFrames).not.toHaveBeenCalled();
  });

  it("skips cached black frame findings when the cached flag is false", async () => {
    const fs = await import("fs");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");
    const { findArtifactDirectories } = await import("../../../src/utils/data/artifactIterator");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;
    const mockFindArtifacts = findArtifactDirectories as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockFindArtifacts.mockReturnValue([]);
    mockDetectBlackFrames.mockClear();

    const checkedScans: CheckedScanDatabase = {
      "artifact-cached-black": {
        blackFrameCheckedDate: "2024-01-03T00:00:00Z",
        blackFrameDetected: false
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");
    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-cached-black"],
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.blackFrameFindings).toEqual([]);
    expect(result.stats.blackFrameCount).toBe(0);
    expect(mockDetectBlackFrames).not.toHaveBeenCalled();
  });

  it("captures new black frame findings and rebuilds missing checked-scan entries", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.from("noop");
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T11:00:00Z" });

    const checkedScans: CheckedScanDatabase = {};
    mockDetectBlackFrames.mockImplementation(() => {
      delete checkedScans["artifact-new-black"];
      return [{ duration: 1, end: 1, start: 0 }];
    });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-new-black"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.blackFrameFindings).toEqual([
      { environment: "env", id: "artifact-new-black", isNew: true, segments: [{ duration: 1, end: 1, start: 0 }] }
    ]);
    expect(result.stats.blackFrameCount).toBe(1);
    expect(result.stats.newBlackFrameCount).toBe(1);
    expect(checkedScans["artifact-new-black"]?.blackFrameDetected).toBe(true);
    expect(checkedScans["artifact-new-black"]?.blackFrameSegments).toEqual([{ duration: 1, end: 1, start: 0 }]);
  });

  it("handles detector failures and records header anomalies when avcC markers are malformed", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x05]), Buffer.from("avcC"), Buffer.from([0x00])]);
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T11:00:00Z" });

    const checkedScans: CheckedScanDatabase = {};
    mockDetectBlackFrames.mockImplementation(() => {
      delete checkedScans["artifact-anomaly"];
      throw new Error("detector failure");
    });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-anomaly"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.stats.errors).toBeGreaterThanOrEqual(1);
    expect(result.stats.newHeaderAnomalyCount).toBeGreaterThanOrEqual(1);
    expect(result.videoHeaderAnomalies).toEqual([{ environment: "env", id: "artifact-anomaly", isNew: true }]);
    expect(checkedScans["artifact-anomaly"]?.avcAnomalyDetected).toBe(true);
  });

  it("marks headers as clean when detection fails but no avcC anomalies are present", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return false;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.from("no-avcc-marker");
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T11:00:00Z" });

    const checkedScans: CheckedScanDatabase = {};
    mockDetectBlackFrames.mockImplementation(() => {
      delete checkedScans["artifact-clean-header"];
      throw new Error("detector failure");
    });

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-clean-header"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.stats.errors).toBeGreaterThanOrEqual(1);
    expect(result.videoHeaderAnomalies).toHaveLength(0);
    expect(checkedScans["artifact-clean-header"]?.avcAnomalyDetected).toBe(false);
  });

  it("counts duplicate bad scans in the discard report data", async () => {
    const fs = await import("fs");
    const { findDuplicateArtifacts } = await import("../../../src/utils/data/videoHashes");
    const { hashVideoInDirectory } = await import("../../../src/utils/video/hash");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");
    const { collectNewBadScans } = await import("../../../src/scripts/discard");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockFindDuplicates = findDuplicateArtifacts as ReturnType<typeof vi.fn>;
    const mockHashVideo = hashVideoInDirectory as ReturnType<typeof vi.fn>;

    mockExistsSync.mockImplementation((p: string) => {
      if (typeof p === "string" && p.endsWith("video.mp4")) {
        return true;
      }
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return true;
      }
      if (typeof p === "string" && p.includes("discarded-artifacts")) {
        return true;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.from("video");
    });
    mockHashVideo.mockResolvedValue("dup-hash");
    mockFindDuplicates.mockReturnValue(["existing"]);

    const { main } = await import("../../../src/scripts/discard");

    const result = await main({
      artifactDirs: ["/mock/data/artifacts/env/artifact-dup"],
      dataDir: "/mock/data/artifacts",
      databases: { badScans: {}, checkedScans: {} },
      dryRun: false,
      saveResults: false,
      skipClean: true,
      skipFilter: true,
      skipMismatch: true,
      videoHashes: { "dup-hash": ["existing"] }
    });

    const reportInput = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls.pop()?.[0] as DiscardReportInput;

    expect(result.duplicates.duplicateCount).toBe(1);
    expect(reportInput.newBadScans.some((entry) => entry.stage === "duplicates")).toBe(true);
    expect(reportInput.countsByEnv["env"]?.duplicateNew).toBe(1);

    const additions = collectNewBadScans(
      {
        "artifact-dup": {
          date: "2024-01-01T00:00:00Z",
          environment: "env",
          reason: "Duplicate video (hash dup-hash) matches existing"
        }
      },
      new Set<string>(),
      new Set<string>(["artifact-dup"]),
      "duplicates"
    );
    expect(additions.some((a) => a.reason.toLowerCase().includes("duplicate video"))).toBe(true);
  });
});

describe("runMismatchPhase - additional branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("fills missing cached mismatch dates with empty strings", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(false);

    const checkedScans: CheckedScanDatabase = {
      "artifact-cached-missing": {
        mismatchCheckedDate: "2024-01-01T00:00:00Z",
        mismatchDiffHours: 30
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-cached-missing"],
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.dateMismatches).toEqual([
      expect.objectContaining({ id: "artifact-cached-missing", scanDate: "", videoDate: "" })
    ]);
    expect(result.stats.mismatchCount).toBe(1);
  });

  it("uses empty segments for cached black frame detections without saved segments", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(false);

    const checkedScans: CheckedScanDatabase = {
      "artifact-cached-black-empty": {
        blackFrameCheckedDate: "2024-01-01T00:00:00Z",
        blackFrameDetected: true
      }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-cached-black-empty"],
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.blackFrameFindings).toEqual([
      expect.objectContaining({ id: "artifact-cached-black-empty", segments: [] })
    ]);
    expect(result.stats.blackFrameCount).toBe(1);
  });

  it("reuses existing checked scan entries when marking mismatch checks without creation time", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    mockExtractMetadata.mockResolvedValue({});

    const checkedScans: CheckedScanDatabase = {
      "artifact-existing": { filteredDate: "2024-01-01" }
    };

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-existing"],
      databases: { badScans: {}, checkedScans },
      dryRun: false,
      saveResults: false
    });

    expect(result.stats.processed).toBe(1);
    expect(checkedScans["artifact-existing"]?.filteredDate).toBe("2024-01-01");
    expect(checkedScans["artifact-existing"]?.mismatchCheckedDate).toBeDefined();
  });

  it("treats black frame detections as not new when the checked date appears after the cache check", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" }));
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T10:00:00Z" });
    mockDetectBlackFrames.mockResolvedValue([{ duration: 1, end: 1, start: 0 }]);

    const checkedScans: CheckedScanDatabase = {};
    let firstAccess = true;
    const entry = {} as CheckedScanDatabase[string];
    Object.defineProperty(entry, "blackFrameCheckedDate", {
      configurable: true,
      get: () => {
        if (firstAccess) {
          firstAccess = false;
          return undefined;
        }
        return "2024-07-01T00:00:00Z";
      }
    });
    entry.mismatchCheckedDate = "2024-01-01T00:00:00Z";
    checkedScans["artifact-recheck-black"] = entry;

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-recheck-black"],
      databases: { badScans: {}, checkedScans },
      dryRun: true
    });

    expect(result.blackFrameFindings).toEqual([
      expect.objectContaining({ id: "artifact-recheck-black", isNew: false })
    ]);
    expect(result.stats.newBlackFrameCount).toBe(0);
  });

  it("records header anomalies on malformed avcC sizes in dry-run mode", async () => {
    const fs = await import("fs");
    const { extractVideoMetadata } = await import("../../../src/utils/video/metadata");
    const { detectBlackFrames } = await import("../../../src/utils/video/blackFrames");

    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
    const mockExtractMetadata = extractVideoMetadata as ReturnType<typeof vi.fn>;
    const mockDetectBlackFrames = detectBlackFrames as ReturnType<typeof vi.fn>;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("meta.json")) {
        return JSON.stringify({ scanDate: "2024-08-01T10:00:00Z" });
      }
      return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x05]), Buffer.from("avcC"), Buffer.from([0x00])]);
    });
    mockExtractMetadata.mockResolvedValue({ creationTime: "2024-08-01T10:00:00Z" });
    mockDetectBlackFrames.mockResolvedValue([]);

    const { runMismatchPhase } = await import("../../../src/scripts/discard");

    const result = await runMismatchPhase({
      artifactDirs: ["/mock/data/artifacts/env/artifact-anomaly-dry"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      saveResults: false
    });

    expect(result.videoHeaderAnomalies).toEqual([{ environment: "env", id: "artifact-anomaly-dry", isNew: true }]);
    expect(result.stats.headerAnomalyCount).toBe(1);
    expect(result.stats.newHeaderAnomalyCount).toBe(1);
  });
});

describe("countsByEnv - uncategorized reasons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("handles new bad scans with reasons outside the primary categories", async () => {
    const fs = await import("fs");
    const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;

    const mod = await import("../../../src/scripts/discard");
    const { buildDiscardReport } = await import("../../../src/templates/discardReport");

    mockExistsSync.mockImplementation((p: string | Buffer) => {
      if (typeof p === "string" && p.endsWith("video.mp4")) {
        return false;
      }
      return true;
    });

    await mod.main({
      artifactDirs: ["/mock/data/artifacts/env/artifact-uncategorized"],
      databases: { badScans: {}, checkedScans: {} },
      dryRun: true,
      skipDuplicates: true,
      skipFilter: true,
      skipMismatch: true
    });

    const reportInput = (buildDiscardReport as ReturnType<typeof vi.fn>).mock.calls.pop()?.[0] as DiscardReportInput;

    expect(reportInput.countsByEnv["env"]).toBeDefined();
    expect(reportInput.countsByEnv["env"]?.tooShortNew).toBe(0);
    expect(reportInput.countsByEnv["env"]?.notBathroomNew).toBe(0);
    expect(reportInput.countsByEnv["env"]?.duplicateNew).toBe(0);
    expect(reportInput.newBadScans.some((entry) => entry.reason.toLowerCase().includes("missing video"))).toBe(true);
  });
});
