import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoMetadata, extractVideoMetadata } from "../../../../src/utils/video/metadata";

// Mock modules
vi.mock("fs");
vi.mock("fluent-ffmpeg");

describe("extractVideoMetadata", () => {
  const mockDir = "/mock/dir";
  const mockCachePath = path.join(mockDir, "videoMetadata.json");
  const mockVideoPath = path.join(mockDir, "video.mp4");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return cached metadata if it exists and is valid", async () => {
    const cachedData: VideoMetadata = {
      duration: 60,
      fps: 30,
      height: 1080,
      width: 1920
    };

    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(cachedData));

    const result = await extractVideoMetadata(mockDir);

    expect(fs.existsSync).toHaveBeenCalledWith(mockCachePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, "utf-8");
    expect(result).toEqual(cachedData);
  });

  it("should proceed to extraction if cache exists but is corrupt", async () => {
    // 1. Mock cache check (exists but throws on read/parse)
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return true;
      } // Cache exists
      if (p === mockVideoPath) {
        return true;
      } // Video exists
      return false;
    });
    (fs.readFileSync as Mock).mockImplementation(() => {
      throw new Error("Corrupt JSON");
    });

    // 2. Mock ffmpeg execution
    const mockFfprobeData = {
      format: {
        duration: 120
      },
      streams: [
        {
          codec_type: "video",
          height: 720,
          r_frame_rate: "60/1",
          width: 1280
        }
      ]
    };

    // Mock the ffmpeg(path).ffprobe(callback) implementation
    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toEqual({
      duration: 120,
      fps: 60,
      height: 720,
      width: 1280
    });
    // Should have attempted to write cache
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.any(String));
  });

  it("should extract metadata from video file if cache is missing", async () => {
    // 1. Mock cache missing, video exists
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    // 2. Mock ffmpeg
    const mockFfprobeData = {
      format: {
        duration: 10.5
      },
      streams: [
        {
          codec_type: "video",
          height: 2160,
          r_frame_rate: "30000/1001", // ~29.97 fps
          width: 3840
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toEqual({
      duration: 10.5,
      fps: 30, // Math.round(29.97)
      height: 2160,
      width: 3840
    });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("should return null if video file does not exist", async () => {
    (fs.existsSync as Mock).mockReturnValue(false); // No cache, no video

    const result = await extractVideoMetadata(mockDir);

    expect(result).toBeNull();
    expect(ffmpeg.ffprobe).not.toHaveBeenCalled();
  });

  it("should return null if ffprobe fails", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(new Error("FFprobe invalid data"), null);
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toBeNull();
  });

  it("should handle missing stream/format properties gracefully", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    // Return empty/partial structure
    const mockPartialData = {
      format: {}, // No duration
      streams: [] // No video stream
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockPartialData);
      }
    );

    const result = await extractVideoMetadata(mockDir);

    // Should return default values based on initialization in source
    expect(result).toEqual({
      duration: 0,
      fps: 0,
      height: 0,
      width: 0
    });
  });

  it("should fail gracefully if writing cache fails", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    // Valid data
    const mockFfprobeData = {
      format: { duration: 10 },
      streams: [{ codec_type: "video", height: 100, r_frame_rate: "30/1", width: 100 }]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    // Write throws
    (fs.writeFileSync as Mock).mockImplementation(() => {
      throw new Error("Write failed");
    });

    const result = await extractVideoMetadata(mockDir);

    // Should still return valid result
    expect(result).toEqual({ duration: 10, fps: 30, height: 100, width: 100 });
  });
});
