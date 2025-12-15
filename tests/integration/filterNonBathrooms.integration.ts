import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { BadScanDatabase } from "../../../src/models/badScanRecord";
import { CheckedScanDatabase } from "../../../src/models/checkedScanRecord";
import { findArtifactDirectories, processArtifact } from "../../../src/scripts/filterNonBathrooms";
import { GeminiService } from "../../../src/services/geminiService";
import { getBadScans } from "../../../src/utils/data/badScans";
import { getCheckedScans } from "../../../src/utils/data/checkedScans";

// Mock dependencies (but NOT fs)
jest.mock("../../../src/services/geminiService");
jest.mock("../../../src/utils/data/badScans");
jest.mock("../../../src/utils/data/checkedScans");

// Types for mocks
type MockGeminiService = jest.Mocked<GeminiService>;
type BadScansMap = BadScanDatabase;
type CheckedScansMap = CheckedScanDatabase;

describe("filterNonBathrooms Integration", () => {
  let mockService: MockGeminiService;
  let mockBadScans: BadScansMap;
  let mockCheckedScans: CheckedScansMap;
  let checkedScanIds: Set<string>;

  let tmpDir: string;
  let artifactsRoot: string;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = new GeminiService() as MockGeminiService;
    mockBadScans = {};
    mockCheckedScans = {};
    checkedScanIds = new Set<string>();

    (getBadScans as jest.Mock).mockReturnValue(mockBadScans);
    (getCheckedScans as jest.Mock).mockReturnValue(mockCheckedScans);

    // Setup temp dir
    // Setup temp dir with expected structure
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-integration-"));
    artifactsRoot = path.join(tmpDir, "data", "artifacts");
    fs.mkdirSync(artifactsRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
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

    const env1 = path.join(artifactsRoot, "env1");
    const art1 = path.join(env1, "art1");
    fs.mkdirSync(art1, { recursive: true });
    fs.writeFileSync(path.join(art1, "meta.json"), "{}");

    const env2 = path.join(artifactsRoot, "env2");
    const art2 = path.join(env2, "nested", "art2");
    fs.mkdirSync(art2, { recursive: true });
    fs.writeFileSync(path.join(art2, "meta.json"), "{}");

    fs.mkdirSync(path.join(artifactsRoot, "ignored"));

    const results = findArtifactDirectories(artifactsRoot);
    expect(results).toHaveLength(2);
    expect(results).toContain(art1);
    expect(results).toContain(art2);
  });

  it("processArtifact actually deletes directory on NO (using real Gemini mock)", async () => {
    const artDir = path.join(artifactsRoot, "art_delete");
    fs.mkdirSync(artDir);
    fs.writeFileSync(path.join(artDir, "meta.json"), "{}");
    fs.writeFileSync(path.join(artDir, "video.mp4"), "fake video content");

    mockService.generateContent.mockResolvedValue("NO");

    const result = await processArtifact(artDir, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

    expect(result.removed).toBe(1);
    expect(fs.existsSync(artDir)).toBe(false); // Real deletion check
    expect(mockBadScans["art_delete"]).toBeDefined();
  });

  it("processArtifact keeps directory on YES", async () => {
    const artDir = path.join(artifactsRoot, "art_keep");
    fs.mkdirSync(artDir);
    fs.writeFileSync(path.join(artDir, "meta.json"), "{}");
    fs.writeFileSync(path.join(artDir, "video.mp4"), "fake video content");

    mockService.generateContent.mockResolvedValue("YES");

    const result = await processArtifact(artDir, mockService, mockBadScans, checkedScanIds, mockCheckedScans);

    expect(result.removed).toBe(0);
    expect(fs.existsSync(artDir)).toBe(true);
    expect(mockCheckedScans["art_keep"]).toBeDefined();
  });
});
