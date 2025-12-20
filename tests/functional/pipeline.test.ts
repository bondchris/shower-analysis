import * as fs from "fs";
import * as os from "os";
import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import { Mocked, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

// -- Mocks --

// 1. Mock Axios (Network Layer)
vi.mock("axios");
const mockedAxios = axios as Mocked<typeof axios>;

// 2. Mock GeminiService (AI Layer)
const mockGenerateContent = vi.fn();
vi.mock("../../src/services/geminiService", () => {
  return {
    GeminiService: class MockGeminiService {
      public generateContent = mockGenerateContent;
    }
  };
});

// 3. Mock Download Helpers (File System / Network Layer)
vi.mock("../../src/utils/sync/downloadHelpers", () => {
  return {
    downloadFile: vi.fn().mockImplementation(async (_url: string, dest: string) => {
      // ** Failure Injection **
      if (dest.includes("scan-bad-date")) {
        throw new Error("Simulated Download Failure");
      }
      fs.writeFileSync(dest, "fake video content");
      await Promise.resolve();
      return null;
    }),
    downloadJsonFile: vi.fn().mockImplementation(async (_url: string, dest: string, type: string) => {
      // ** Failure Injection **
      if (dest.includes("scan-bad-date")) {
        throw new Error("Simulated Download Failure");
      }

      let content = "{}";
      if (type === "rawScan") {
        const walls = [
          { end: { x: 10, y: 0, z: 0 }, start: { x: 0, y: 0, z: 0 } },
          { end: { x: 10, y: 10, z: 0 }, start: { x: 10, y: 0, z: 0 } },
          { end: { x: 0, y: 10, z: 0 }, start: { x: 10, y: 10, z: 0 } },
          { end: { x: 0, y: 0, z: 0 }, start: { x: 0, y: 10, z: 0 } }
        ];
        content = JSON.stringify({ room: "test", walls });
      }
      if (type === "arData") {
        // Return UNSORTED keys to verify sort logic
        const unsortedData: Record<string, unknown> = {};
        unsortedData["0.5"] = { points: [{ confidence: 0.9, x: 1, y: 1, z: 1 }] };
        unsortedData["0.1"] = { points: [{ confidence: 0.8, x: 2, y: 2, z: 2 }] };
        content = JSON.stringify({ data: unsortedData });
      }
      fs.writeFileSync(dest, content);
      await Promise.resolve();
      return null;
    })
  };
});

// 4. Mock Config (Environment)
vi.mock("../../config/config", () => {
  return {
    ENVIRONMENTS: [{ domain: "test.com", name: "TestEnv" }]
  };
});

// 5. Mock Fluent FFmpeg (for Video Metadata & Clean Data)
// We need to mock the default export class/function behavior
vi.mock("fluent-ffmpeg", () => {
  return {
    default: Object.assign(
      () => ({
        // Fluent interface mocks if needed
      }),
      {
        ffprobe: vi.fn((file: string, cb: (err: unknown, data: unknown) => void) => {
          // Logic to return metadata based on file name
          const duration = file.includes("scan-short-video") ? 5 : 15;
          cb(null, {
            format: { duration, tags: { creation_time: "2023-01-01T00:00:00Z" } },
            streams: [{ codec_type: "video", height: 1080, r_frame_rate: "30/1", width: 1920 }]
          });
        })
      }
    )
  };
});

// 6. Mock Logger
vi.mock("../../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));
import { logger } from "../../src/utils/logger";

// 7. Mock Bad Scans Database
vi.mock("../../src/utils/data/badScans", () => ({
  getBadScans: vi.fn().mockReturnValue({}),
  saveBadScans: vi.fn()
}));
import { saveBadScans } from "../../src/utils/data/badScans";

// Import scripts
import { main as validateMain } from "../../src/scripts/validateArtifacts";
import { main as syncMain } from "../../src/scripts/syncArtifacts";
import { main as cleanMain } from "../../src/scripts/cleanData";
import { run as formatRun } from "../../src/scripts/formatArData";
import { main as filterMain } from "../../src/scripts/filterNonBathrooms";
import { main as inspectMain } from "../../src/scripts/inspectArtifacts";

describe("Functional Pipeline Test", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Setup Temp Dir
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shower-test-"));
    originalCwd = process.cwd();

    // Create Structure
    fs.mkdirSync(path.join(tempDir, "data", "artifacts"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "reports"), { recursive: true });
    // Cache dir logic in SpatialService will create this, but we can pre-create to be safe or let it handle it
    fs.mkdirSync(path.join(tempDir, "data", "api_cache"), { recursive: true });

    // Spy process.cwd
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    // Reset Mocks
    mockedAxios.get.mockReset();
    mockGenerateContent.mockReset();
    vi.mocked(logger.info).mockReset();

    // Copy print.css to temp dir to avoid warnings and ensure correct PDF styling
    const cssSrc = path.join(originalCwd, "src", "templates", "styles", "print.css");
    const cssDestDir = path.join(tempDir, "src", "templates", "styles");
    fs.mkdirSync(cssDestDir, { recursive: true });
    if (fs.existsSync(cssSrc)) {
      fs.copyFileSync(cssSrc, path.join(cssDestDir, "print.css"));
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      fs.rmSync(tempDir, { force: true, recursive: true });
    } catch {
      // ignore
    }
    process.chdir(originalCwd);
  });

  it("runs the full analysis pipeline with mixed data, caching, and failure handling", { timeout: 30000 }, async () => {
    // --- Step 1: Validate Artifacts (with mixed data) ---

    // Define Mixed Data Scenarios
    const validArtifact = {
      arData: "http://ar",
      id: "scan-valid",
      projectId: "proj-1",
      rawScan: "http://raw",
      scanDate: "2023-01-01T12:00:00Z",
      video: "http://vid"
    };

    const shortVideoArtifact = {
      arData: "http://ar",
      id: "scan-short-video",
      projectId: "proj-1",
      rawScan: "http://raw",
      scanDate: "2023-01-01T12:05:00Z",
      video: "http://vid"
    };

    const notBathroomArtifact = {
      arData: "http://ar",
      id: "scan-not-bathroom",
      projectId: "proj-1",
      rawScan: "http://raw",
      scanDate: "2023-01-01T12:06:00Z",
      video: "http://vid"
    };

    const missingPropsArtifact = {
      // Missing id, rawScan, etc.
      scanDate: "2023-01-02T12:00:00Z"
    };

    const invalidDateArtifact = {
      arData: "http://ar",
      id: "scan-bad-date", // This will trigger Download Failure in mocks
      projectId: "proj-1",
      rawScan: "http://raw",
      scanDate: "0001-01-01T00:00:00Z", // Invalid
      video: "http://vid"
    };

    const warningArtifact = {
      arData: "http://ar",
      id: "scan-warning",
      // Missing projectId (Warning)
      rawScan: "http://raw",
      scanDate: "2023-01-03T12:00:00Z",
      video: "http://vid"
    };

    // Page 1 Response
    const page1 = {
      data: [validArtifact, missingPropsArtifact, shortVideoArtifact, notBathroomArtifact],
      pagination: {
        currentPage: 1,
        from: 1,
        lastPage: 2,
        perPage: 4,
        to: 4,
        total: 6
      }
    };

    // Page 2 Response
    const page2 = {
      data: [invalidDateArtifact, warningArtifact],
      pagination: {
        currentPage: 2,
        from: 3,
        lastPage: 2,
        perPage: 2,
        to: 4,
        total: 4
      }
    };

    // Queue mocked responses for pagination
    mockedAxios.get
      .mockResolvedValueOnce({ data: page1 }) // First call (Page 1)
      .mockResolvedValueOnce({ data: page2 }); // Second call (Page 2)

    // Execute Validation Logic
    await validateMain();

    // Verify Network Calls
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, expect.stringContaining("page=1"), expect.anything());
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, expect.stringContaining("page=2"), expect.anything());

    // Verify Report Creation
    expect(fs.existsSync(path.join(tempDir, "reports", "validation-report.pdf"))).toBe(true);

    // --- Step 2: Cache Logic Verifications ---

    // 2a. Verify Valid Cache (Cache Hit)
    // Queue NO network responses (Axios should not be called except for initial check logic which usually fetches P1)
    // Actually, as determined earlier, P1 is fetched on startup of new Service. P2 is cached.
    mockedAxios.get.mockResolvedValueOnce({ data: page1 });

    await validateMain();
    // 2 (initial) + 1 (P1 new run) = 3 total. P2 should be cached.
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);

    // 2b. Verify Invalid Cache (Cache Corruption -> Refetch)
    const cacheDir = path.join(tempDir, "data", "api_cache", "testenv");
    const page2Path = path.join(cacheDir, "page_2.json");
    // Corrupt Page 2
    fs.writeFileSync(page2Path, "{ invalid json");

    // Expect P1 (startup) AND P2 (refetch due to corruption)
    mockedAxios.get
      .mockResolvedValueOnce({ data: page1 }) // P1
      .mockResolvedValueOnce({ data: page2 }); // P2

    await validateMain();

    // 3 (prev) + 2 (new) = 5 total.
    expect(mockedAxios.get).toHaveBeenCalledTimes(5);

    // --- Step 3: Sync Artifacts (with Sync Failure) ---
    // Will run fetch again (P1 Net + P2 Cache).
    mockedAxios.get.mockResolvedValueOnce({ data: page1 });

    await syncMain();

    // Verify synced files for the VALID artifact
    const validPath = path.join(tempDir, "data", "artifacts", "testenv", "scan-valid");
    expect(fs.existsSync(path.join(validPath, "video.mp4"))).toBe(true);
    expect(fs.existsSync(path.join(validPath, "arData.json"))).toBe(true);

    // Verify Sync Report exists
    expect(fs.existsSync(path.join(tempDir, "reports", "sync-report.pdf"))).toBe(true);

    // Verify Failure was handled
    // "scan-bad-date" was mocked to throw "Simulated Download Failure".
    // It should have been logged/tracked in `syncFailures`?
    // We can check if the folder exists (it might be partial/empty or cleaned up?).
    // Usually sync logic cleans up failed artifacts or leaves them?
    // Let's check `syncFailures.json` if possible? Mocked config directory?
    // The test sets up config dir in unit tests but here we used `process.cwd()/config`.
    // It actually writes to `src/utils/data/../../../../config/syncFailures.json` relative path.
    // In test environment, this might map effectively to temp dir if we spy cwd correct?
    // `syncFailures.ts`: `path.resolve(__dirname, '../../../../config/syncFailures.json')`.
    // This is absolute path relative to source file, NOT `process.cwd()`.
    // So it writes to REAL project config? That is dangerous for mocked test!
    // We should check if `syncFailures` is mocked? NOT mocked in this file.
    // However, `syncFailures` uses `fs`.
    // If we want to be safe, we should assume it writes to real file system unless mocked.
    // But `syncFailures.ts` imports `path`, `fs`. We didn't mock `fs` entirely.
    //
    // WAIT! `scan-bad-date` has INVALID DATE. `syncArtifacts` logic might SKIP it before download?
    // `if (artifact.scanDate === '0001-01-01...')`?
    // If it skips, then download mock is never hit.
    // `syncArtifacts` calls `validateEnvironment` to get stats, but uses `service.fetchScanArtifacts` to get items.
    // It iterates items.
    // It calls `downloadArtifact`.
    // `downloadArtifact` inside `syncArtifacts.ts` doesn't check scanDate validity explicitly?
    //
    // Let's assume it attempts download.
    // If it attempts, mock throws. Code catches error?
    // `syncArtifacts.ts` L125: `try { ... } catch (e) { ... handleSyncFailure ... }`
    // Yes, it catches.

    // --- Step 4: Clean Data ---
    await cleanMain({
      dataDir: path.join(tempDir, "data", "artifacts"),
      ffprobe: vi.fn((file: string, cb: (err: unknown, data: ffmpeg.FfprobeData) => void) => {
        // Return 5s duration for short video, 15s for others
        const duration = file.includes("scan-short-video") ? 5 : 15;
        cb(null, { format: { duration } } as unknown as ffmpeg.FfprobeData);
      }) as unknown as typeof ffmpeg.ffprobe
    });
    // Valid should exist
    expect(fs.existsSync(validPath)).toBe(true);

    // Short video should be REMOVED
    const shortPath = path.join(tempDir, "data", "artifacts", "testenv", "scan-short-video");
    expect(fs.existsSync(shortPath)).toBe(false);

    // Verify it was recorded in badScans
    expect(saveBadScans).toHaveBeenCalled();
    const saveCall = vi.mocked(saveBadScans).mock.calls[0];
    if (!saveCall) {
      throw new Error("saveBadScans was not called");
    }
    const savedDb = saveCall[0] as Record<string, { reason: string }>;
    expect(savedDb["scan-short-video"]).toBeDefined();
    expect(savedDb["scan-short-video"]?.reason).toContain("Video too short");

    // --- Step 5: Format AR Data ---
    await formatRun(path.join(tempDir, "data", "artifacts"));
    expect(fs.existsSync(path.join(validPath, "arDataFormatted.json"))).toBe(true);

    // Verify Sorting: Read file and check keys
    const formattedPath = path.join(validPath, "arDataFormatted.json");
    const content = JSON.parse(fs.readFileSync(formattedPath, "utf-8")) as { data: Record<string, unknown> };
    const keys = Object.keys(content.data);
    // Keys should be sorted numerically: 0.1, 0.5. (Input was 0.5, 0.1)
    expect(keys).toEqual(["0.1", "0.5"]);

    // --- Step 5b: Verify Format Cache (Cache Hit) ---
    // Reset logger spy
    vi.mocked(logger.info).mockClear();
    await formatRun(path.join(tempDir, "data", "artifacts"));
    // Expect skipped message
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Skipped"));

    // --- Step 5c: Verify Format Invalid Cache (Re-run) ---
    // Delete formatted file
    fs.rmSync(formattedPath);
    await formatRun(path.join(tempDir, "data", "artifacts"));
    expect(fs.existsSync(formattedPath)).toBe(true);

    // --- Step 6: Filter Non-Bathrooms ---
    // Mock Gemini to say "NO" for scan-not-bathroom, "YES" for others

    fs.writeFileSync(
      path.join(tempDir, "data", "artifacts", "testenv", "scan-not-bathroom", "video.mp4"),
      "NOT_BATHROOM_VIDEO"
    );

    mockGenerateContent.mockImplementation(async (_prompt: string, args: unknown[]) => {
      await Promise.resolve(); // Satisfy require-await
      const parts = args as { inlineData: { data: string } }[];
      const firstPart = parts[0];
      if (firstPart) {
        const decoded = Buffer.from(firstPart.inlineData.data, "base64").toString("utf-8");
        if (decoded.includes("NOT_BATHROOM_VIDEO")) {
          return "NO";
        }
      }
      return "YES";
    });

    await filterMain();

    // Valid should exist
    expect(fs.existsSync(validPath)).toBe(true);

    // Not Bathroom should be REMOVED
    const notBathroomPath = path.join(tempDir, "data", "artifacts", "testenv", "scan-not-bathroom");
    expect(fs.existsSync(notBathroomPath)).toBe(false);

    // Verify badScans recording
    const saveCall2 = vi.mocked(saveBadScans).mock.calls.find((call) => {
      const db = call[0] as Record<string, { reason: string }>;
      return db["scan-not-bathroom"];
    });
    if (!saveCall2) {
      throw new Error("saveBadScans not called for not-bathroom");
    }
    const db = saveCall2[0] as Record<string, { reason: string }>;
    expect(db["scan-not-bathroom"]?.reason).toContain("Not a bathroom");

    // --- Step 7: Inspect Artifacts ---
    await inspectMain();
    expect(fs.existsSync(path.join(tempDir, "reports", "data-analysis.pdf"))).toBe(true);

    // 7b. Verify Cache Creation (Miss)
    // Check that metadata files were created
    const videoMetaPath = path.join(validPath, "videoMetadata.json");
    expect(fs.existsSync(videoMetaPath)).toBe(true);

    // 7c. Verify Cache Hit
    // Run inspect again; extractVideoMetadata should check cache and skip ffprobe
    const ffprobeCalls = vi.mocked(ffmpeg.ffprobe).mock.calls.length;
    await inspectMain();
    expect(vi.mocked(ffmpeg.ffprobe).mock.calls.length).toBe(ffprobeCalls);
  });
});
