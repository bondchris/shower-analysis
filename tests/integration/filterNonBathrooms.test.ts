import * as fs from "fs";
import * as path from "path";

import { Mock, Mocked, beforeEach, describe, expect, it, vi } from "vitest";

import { BadScanDatabase } from "../../src/models/badScanRecord";
import { CheckedScanDatabase } from "../../src/models/checkedScanRecord";
import { processArtifact } from "../../src/scripts/filterNonBathrooms";
import { findArtifactDirectories } from "../../src/utils/data/artifactIterator";
import { GeminiService } from "../../src/services/geminiService";
import { getBadScans } from "../../src/utils/data/badScans";
import { getCheckedScans } from "../../src/utils/data/checkedScans";

vi.mock("../../src/services/geminiService");
vi.mock("../../src/utils/data/badScans");
vi.mock("../../src/utils/data/checkedScans");

// Mock logger
vi.mock("../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Types for mocks
type MockGeminiService = Mocked<GeminiService>;

describe("filterNonBathrooms Integration", () => {
  let mockGeminiService: MockGeminiService;
  const mockArtifactsDir = path.join(__dirname, "data/artifacts/temp-artifacts");
  // Ensure parent directories exist
  const dataDir = path.join(__dirname, "data");
  const artifactsDir = path.join(dataDir, "artifacts");
  let mockBadScans: BadScanDatabase;
  let mockCheckedScans: CheckedScanDatabase;

  beforeEach(() => {
    // Clean up
    if (fs.existsSync(mockArtifactsDir)) {
      fs.rmSync(mockArtifactsDir, { force: true, recursive: true });
    }
    // Setup nested structure to pass safety check
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir);
    }
    fs.mkdirSync(mockArtifactsDir, { recursive: true });

    // Reset mocks
    vi.clearAllMocks();
    mockGeminiService = new GeminiService("test-key") as MockGeminiService; // Re-initialize mockGeminiService
    mockGeminiService.generateContent.mockResolvedValue("NO");
    mockBadScans = {};
    mockCheckedScans = {};
    (getBadScans as Mock).mockReturnValue(mockBadScans);
    (getCheckedScans as Mock).mockReturnValue(mockCheckedScans);
  });

  afterEach(() => {
    if (fs.existsSync(mockArtifactsDir)) {
      fs.rmSync(mockArtifactsDir, { force: true, recursive: true });
    }
    // Cleanup parents if empty? No, unnecessary for temp test
  });

  it("findArtifactDirectories finds nested artifacts with meta.json", () => {
    // Structure:
    // artifacts/
    //   env1/
    //     art1/ meta.json
    //   env2/
    //     nested/
    //       art2/ meta.json
    //   ignored/ (no meta)

    const env1 = path.join(mockArtifactsDir, "env1");
    const art1 = path.join(env1, "art1");
    fs.mkdirSync(art1, { recursive: true });
    fs.writeFileSync(path.join(art1, "meta.json"), "{}");

    const env2 = path.join(mockArtifactsDir, "env2");
    const art2 = path.join(env2, "nested", "art2");
    fs.mkdirSync(art2, { recursive: true });
    fs.writeFileSync(path.join(art2, "meta.json"), "{}");

    fs.mkdirSync(path.join(mockArtifactsDir, "ignored"));

    const results = findArtifactDirectories(mockArtifactsDir);
    expect(results).toHaveLength(2);
    expect(results).toContain(art1);
    expect(results).toContain(art2);
  });

  it("processArtifact actually deletes directory on NO (using real Gemini mock)", async () => {
    const artDir = path.join(mockArtifactsDir, "art_delete");
    fs.mkdirSync(artDir);
    fs.writeFileSync(path.join(artDir, "meta.json"), "{}");
    fs.writeFileSync(path.join(artDir, "video.mp4"), "fake video content");

    mockGeminiService.generateContent.mockResolvedValue("NO");
    const checkedScanIds = new Set<string>();

    const result = await processArtifact(artDir, mockGeminiService, mockBadScans, checkedScanIds, mockCheckedScans);

    expect(result.removed).toBe(1);
    expect(fs.existsSync(artDir)).toBe(false); // Real deletion check
    expect(mockBadScans["art_delete"]).toBeDefined();
  });

  it("processArtifact keeps directory on YES", async () => {
    const artDir = path.join(mockArtifactsDir, "art_keep");
    fs.mkdirSync(artDir);
    fs.writeFileSync(path.join(artDir, "meta.json"), "{}");
    fs.writeFileSync(path.join(artDir, "video.mp4"), "fake video content");

    mockGeminiService.generateContent.mockResolvedValue("YES");
    const checkedScanIds = new Set<string>();

    const result = await processArtifact(artDir, mockGeminiService, mockBadScans, checkedScanIds, mockCheckedScans);

    expect(result.removed).toBe(0);
    expect(fs.existsSync(artDir)).toBe(true);
    expect(mockCheckedScans["art_keep"]).toBeDefined();
  });
});
