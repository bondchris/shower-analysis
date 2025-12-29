import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadScanDatabase } from "../../../src/models/badScanRecord";
import { CheckedScanDatabase } from "../../../src/models/checkedScanRecord";

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
      "discard-report.pdf"
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

    mockExistsSync.mockReturnValue(true);
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
    mockExistsSync.mockReturnValue(true);
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

    expect(result.stats.skippedCached).toBe(1);
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
