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
});
