import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { findArtifactDirectories, main, probeVideo } from "../../../src/scripts/cleanData";
import { getBadScans, saveBadScans } from "../../../src/utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../../../src/utils/data/checkedScans";

// Mock dependencies
jest.mock("fluent-ffmpeg");
jest.mock("../../../src/utils/data/badScans");
jest.mock("../../../src/utils/data/checkedScans");

interface BadScanEntry {
  date?: string;
  environment?: string;
  reason: string;
}
interface CheckedScanEntry {
  cleanedDate?: string;
}
type BadScansMap = Record<string, BadScanEntry>;
type CheckedScansMap = Record<string, CheckedScanEntry>;

// Type helper for ffprobe mock
type FfprobeCallback = (err: unknown, data?: { format?: { duration?: number | string } }) => void;

describe("cleanData", () => {
  // --- Helpers Tests ---
  describe("probeVideo", () => {
    let mockFfmpeg: jest.Mock;

    beforeEach(() => {
      mockFfmpeg = jest.fn();
    });

    it("returns ok:true and duration when valid", async () => {
      mockFfmpeg.mockImplementation((_file: string, cb: FfprobeCallback) => {
        cb(null, { format: { duration: 15.5 } });
      });

      const result = await probeVideo("test.mp4", mockFfmpeg as unknown as typeof ffmpeg.ffprobe);
      expect(result).toEqual({ duration: 15.5, ok: true });
    });

    it("returns ok:false when ffprobe errors", async () => {
      mockFfmpeg.mockImplementation((_file: string, cb: FfprobeCallback) => {
        cb(new Error("fail"));
      });

      const result = await probeVideo("test.mp4", mockFfmpeg as unknown as typeof ffmpeg.ffprobe);
      expect(result).toEqual({ duration: 0, ok: false });
    });

    it("returns ok:true but default duration if duration missing/invalid", async () => {
      mockFfmpeg.mockImplementation((_file: string, cb: FfprobeCallback) => {
        cb(null, { format: { duration: "invalid" } });
      });

      const result = await probeVideo("test.mp4", mockFfmpeg as unknown as typeof ffmpeg.ffprobe);
      expect(result).toEqual({ duration: 0, ok: true });
    });
  });

  describe("findArtifactDirectories", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "find-clean-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it("returns empty if dir missing", () => {
      expect(findArtifactDirectories(path.join(tmpDir, "missing"), fs)).toEqual([]);
    });

    it("finds artifact directory with meta.json", () => {
      const artifactDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");

      const results = findArtifactDirectories(tmpDir, fs);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(artifactDir);
    });

    it("recurses to find nested artifacts", () => {
      const nested = path.join(tmpDir, "env", "artifact2");
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, "meta.json"), "{}");

      const results = findArtifactDirectories(tmpDir, fs);
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(nested);
    });
  });

  // --- Main Logic Tests ---
  describe("main", () => {
    let tmpDir: string;
    let dataDir: string;
    let badScansFile: string;
    let checkedScansFile: string;
    let mockBadScans: BadScansMap;
    let mockCheckedScans: CheckedScansMap;
    let mockLogger: jest.Mock;
    let mockFfmpeg: jest.Mock;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clean-main-"));
      dataDir = path.join(tmpDir, "data");
      fs.mkdirSync(dataDir);
      badScansFile = path.join(tmpDir, "badScans.json");
      checkedScansFile = path.join(tmpDir, "checkedScans.json");

      mockBadScans = {};
      mockCheckedScans = {};

      (getBadScans as jest.Mock).mockReturnValue(mockBadScans);
      (getCheckedScans as jest.Mock).mockReturnValue(mockCheckedScans);

      mockLogger = jest.fn();
      mockFfmpeg = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it("creates data files implicitly via utils if not present (utils logic)", async () => {
      await main({
        badScansFile,
        checkedScansFile,
        dataDir,
        ffprobe: mockFfmpeg as unknown as typeof ffmpeg.ffprobe,
        fs,
        logger: mockLogger
      });

      expect(saveBadScans).toHaveBeenCalled();
    });

    it("skips known clean scans", async () => {
      const artifactDir = path.join(dataDir, "artifact1");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");

      mockCheckedScans["artifact1"] = { cleanedDate: "2025-01-01" };

      await main({
        badScansFile,
        dataDir,
        ffprobe: mockFfmpeg as unknown as typeof ffmpeg.ffprobe,
        fs,
        logger: mockLogger
      });

      expect(mockFfmpeg).not.toHaveBeenCalled();
      expect(fs.existsSync(artifactDir)).toBe(true);
    });

    it("correctly identifies environment from nested path", async () => {
      const envDir = path.join(dataDir, "production");
      const artifactDir = path.join(envDir, "artifact_env");
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");
      // Missing video

      await main({
        badScansFile,
        dataDir,
        fs,
        logger: mockLogger
      });

      expect(mockBadScans["artifact_env"]).toBeDefined();
      expect(mockBadScans["artifact_env"]?.environment).toBe("production");
    });

    it("handles missing video", async () => {
      const artifactDir = path.join(dataDir, "artifact_missing");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");

      const stats = await main({
        badScansFile,
        dataDir,
        fs,
        logger: mockLogger
      });

      expect(mockBadScans["artifact_missing"]).toBeDefined();
      expect(mockBadScans["artifact_missing"]?.reason).toBe("Missing video.mp4");
      expect(fs.existsSync(artifactDir)).toBe(false);
      expect(stats.removedCount).toBe(1);
    });

    it("handles invalid video", async () => {
      const artifactDir = path.join(dataDir, "artifact_invalid");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");
      fs.writeFileSync(path.join(artifactDir, "video.mp4"), "content");

      mockFfmpeg.mockImplementation((_f: string, cb: FfprobeCallback) => {
        cb(new Error("fail"));
      });

      const stats = await main({
        badScansFile,
        dataDir,
        ffprobe: mockFfmpeg as unknown as typeof ffmpeg.ffprobe,
        fs,
        logger: mockLogger
      });

      expect(mockBadScans["artifact_invalid"]?.reason).toBe("Invalid video (ffmpeg probe failed)");
      expect(stats.removedCount).toBe(1);
    });

    it("handles short video", async () => {
      const artifactDir = path.join(dataDir, "artifact_short");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");
      fs.writeFileSync(path.join(artifactDir, "video.mp4"), "content");

      mockFfmpeg.mockImplementation((_f: string, cb: FfprobeCallback) => {
        cb(null, { format: { duration: 5.0 } });
      });

      const stats = await main({
        badScansFile,
        dataDir,
        ffprobe: mockFfmpeg as unknown as typeof ffmpeg.ffprobe,
        fs,
        logger: mockLogger,
        minDuration: 10
      });

      expect(mockBadScans["artifact_short"]?.reason).toContain("Video too short");
      expect(stats.removedCount).toBe(1);
    });

    it("DRY RUN: does not delete or update DBs", async () => {
      const artifactDir = path.join(dataDir, "artifact_missing");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");

      const stats = await main({
        dataDir,
        dryRun: true,
        fs,
        logger: mockLogger
      });

      // Filesystem untouched
      expect(fs.existsSync(artifactDir)).toBe(true);
      // DB functions NOT called (or at least save not called)
      expect(saveBadScans).not.toHaveBeenCalled();
      expect(saveCheckedScans).not.toHaveBeenCalled();

      expect(stats.removedCount).toBe(0);
    });

    it("QUARANTINE: moves instead of deletes", async () => {
      const artifactDir = path.join(dataDir, "artifact_missing");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");

      const quarantineDir = path.join(tmpDir, "quarantine");
      fs.mkdirSync(quarantineDir);

      const stats = await main({
        dataDir,
        fs,
        logger: mockLogger,
        quarantineDir
      });

      expect(fs.existsSync(artifactDir)).toBe(false);
      // Should exist in quarantine
      // Name: "unknown-artifact_missing" (since at root of dataDir)
      const expectedPath = path.join(quarantineDir, "unknown-artifact_missing");
      expect(fs.existsSync(expectedPath)).toBe(true);

      expect(stats.removedCount).toBe(0);
      expect(stats.quarantinedCount).toBe(1);
    });

    it("updates reason for existing bad scan if re-processed", async () => {
      const artifactDir = path.join(dataDir, "artifact_bad");
      fs.mkdirSync(artifactDir);
      fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");
      // Missing video

      mockBadScans["artifact_bad"] = { reason: "Old weak reason" };

      await main({
        dataDir,
        fs,
        logger: mockLogger
      });

      expect(mockBadScans["artifact_bad"].reason).toBe("Missing video.mp4");
    });
  });
});
