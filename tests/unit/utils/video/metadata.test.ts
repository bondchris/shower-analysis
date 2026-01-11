import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoMetadata, extractVideoMetadata } from "../../../../src/utils/video/metadata";

// Mock modules
vi.mock("fs");
vi.mock("fluent-ffmpeg");
vi.mock("child_process");

describe("extractVideoMetadata", () => {
  type ExecCallback = (err: Error | null, stdout: string, stderr?: string) => void;
  const getExecCallback = (optionsOrCallback: unknown, maybeCallback?: ExecCallback): ExecCallback => {
    const isCallback = (candidate: unknown): candidate is ExecCallback => typeof candidate === "function";
    if (isCallback(optionsOrCallback)) {
      return optionsOrCallback;
    }
    if (isCallback(maybeCallback)) {
      return maybeCallback;
    }
    throw new Error("execFile callback missing in test");
  };
  const mockDir = "/mock/dir";
  const mockCachePath = path.join(mockDir, "videoMetadata.json");
  const mockVideoPath = path.join(mockDir, "video.mp4");
  const mockExecFile = execFile as unknown as Mock;
  const laplacianDefaults = {
    blueMean: 0,
    blueVariance: 0,
    brightnessVariance: 0,
    clippedPixelPercentage: 0,
    colorSampleCount: 0,
    greenMean: 0,
    greenVariance: 0,
    hueVariance: 0,
    laplacianMedian: 0,
    laplacianSampleCount: 0,
    laplacianStdDev: 0,
    meanBrightness: 0,
    meanHue: 0,
    meanSaturation: 0,
    redMean: 0,
    redVariance: 0,
    saturationVariance: 0
  };
  const gopDefaults = {
    avgGopDistance: 1,
    gopVariance: 0,
    maxGopDistance: 1,
    minGopDistance: 1,
    ...laplacianDefaults
  };
  const buildUniformGopStats = (value: number) => ({
    ...laplacianDefaults,
    avgGopDistance: value,
    gopVariance: 0,
    maxGopDistance: value,
    minGopDistance: value
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        optionsOrCallback: unknown,
        maybeCallback?: (err: Error | null, stdout: string, stderr?: string) => void
      ) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, '{ "frames": [] }', "");
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const computeExpectedRgb = (kb: number, kr: number): { b: number; g: number; r: number } => {
    const yAvg = 100;
    const uAvg = 148;
    const vAvg = 138;
    const minChannelValue = 0;
    const maxChannelValue = 255;
    const chromaCenter = 128;
    const lumaOffset = 0;
    const lumaScale = 1;
    const chromaScale = 1;
    const channelScaleBase = 2;
    const unityValue = 1;

    const normalizedY = (yAvg - lumaOffset) * lumaScale;
    const normalizedU = (uAvg - chromaCenter) * chromaScale;
    const normalizedV = (vAvg - chromaCenter) * chromaScale;

    const kg = unityValue - kr - kb;
    const redScale = channelScaleBase * (unityValue - kr);
    const blueScale = channelScaleBase * (unityValue - kb);
    const greenBlueComponent = (kb / kg) * blueScale;
    const greenRedComponent = (kr / kg) * redScale;

    const redContribution = redScale * normalizedV;
    const blueContribution = blueScale * normalizedU;
    const greenBlueAdjustment = greenBlueComponent * normalizedU;
    const greenRedAdjustment = greenRedComponent * normalizedV;
    const greenAdjustment = greenBlueAdjustment + greenRedAdjustment;
    const red = normalizedY + redContribution;
    const blue = normalizedY + blueContribution;
    const green = normalizedY - greenAdjustment;

    const clamp = (value: number): number => Math.min(maxChannelValue, Math.max(minChannelValue, value));

    return {
      b: clamp(blue),
      g: clamp(green),
      r: clamp(red)
    };
  };

  it("should return cached metadata if it exists and is valid", async () => {
    const cachedGop = {
      gopSize: 48,
      ...buildUniformGopStats(48),
      laplacianMedian: 1.25,
      laplacianSampleCount: 150,
      laplacianStdDev: 0.5
    };
    const cachedData: VideoMetadata = {
      bFrames: 2,
      bitDepth: 8,
      bitrate: 700000,
      codecName: "h264",
      colorRange: "pc",
      colorSpace: "bt709",
      colorTransfer: "bt709",
      creationTime: "2023-01-01T00:00:00Z",
      duration: 60,
      entropyCoding: "CABAC",
      fps: 30,
      ...cachedGop,
      height: 1080,
      level: 30,
      pixelFormat: "yuvj420p",
      profile: "Main",
      refs: 1,
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 120,
      entropyCoding: "Unknown",
      fps: 60,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
    // Should have attempted to write cache
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.any(String));
  });

  it("should re-extract metadata if cache is missing creationTime", async () => {
    // 1. Mock cache exists but is missing creationTime
    const staleCache = {
      duration: 60,
      fps: 30,
      height: 1080,
      width: 1920
    };
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return true;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(staleCache));

    // 2. Mock ffmpeg execution with fresh data including creationTime
    const mockFfprobeData = {
      format: {
        bit_rate: "650000",
        duration: 60,
        tags: {
          creation_time: "2023-01-01T12:00:00Z"
        }
      },
      streams: [
        {
          codec_type: "video",
          height: 1080,
          r_frame_rate: "30/1",
          width: 1920
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 650000,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      creationTime: "2023-01-01T12:00:00Z",
      duration: 60,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      ...gopDefaults,
      height: 1080,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1920
    });
    // Should have written updated cache
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.stringContaining("creationTime"));
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
        bit_rate: "601000",
        duration: 10.5,
        tags: {
          creation_time: "2023-01-01T10:00:00Z"
        }
      },
      streams: [
        {
          bits_per_raw_sample: "10",
          codec_type: "video",
          gop_size: 45,
          has_b_frames: 3,
          height: 2160,
          level: 40,
          profile: "High",
          r_frame_rate: "30000/1001", // ~29.97 fps
          refs: 2,
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
      ...laplacianDefaults,
      avgGopDistance: 45,
      bFrames: 3,
      bitDepth: 10,
      bitrate: 601000,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      creationTime: "2023-01-01T10:00:00Z",
      duration: 10.5,
      entropyCoding: "Unknown",
      fps: 30, // Math.round(29.97)
      gopSize: 45,
      gopVariance: 0,
      height: 2160,
      level: 40,
      maxGopDistance: 45,
      minGopDistance: 45,
      pixelFormat: "",
      profile: "High",
      refs: 2,
      width: 3840
    });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("should compute color statistics from signalstats frames", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 2 },
      streams: [
        {
          codec_type: "video",
          color_range: "pc",
          height: 480,
          r_frame_rate: "30/1",
          width: 640
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const emptyFrames = '{ "frames": [] }';
    const colorStatsFrames = JSON.stringify({
      frames: [
        {
          tags: {
            "lavfi.signalstats.BRNG": "0.01",
            "lavfi.signalstats.HUEAVG": "50",
            "lavfi.signalstats.SATAVG": "20",
            "lavfi.signalstats.UAVG": "128",
            "lavfi.signalstats.VAVG": "128",
            "lavfi.signalstats.YAVG": "100",
            "lavfi.signalstats.YBITDEPTH": "8",
            "lavfi.signalstats.YMAX": "200",
            "lavfi.signalstats.YMIN": "0"
          }
        },
        {
          tags: {
            "lavfi.signalstats.BRNG": "0.02",
            "lavfi.signalstats.HUEAVG": "70",
            "lavfi.signalstats.SATAVG": "30",
            "lavfi.signalstats.UAVG": "128",
            "lavfi.signalstats.VAVG": "128",
            "lavfi.signalstats.YAVG": "200",
            "lavfi.signalstats.YBITDEPTH": "8",
            "lavfi.signalstats.YMAX": "255",
            "lavfi.signalstats.YMIN": "0"
          }
        }
      ]
    });

    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, emptyFrames, "");
      }
    );
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, emptyFrames, "");
      }
    );
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, colorStatsFrames, "");
      }
    );

    const result = await extractVideoMetadata(mockDir);

    if (!result) {
      throw new Error("Expected video metadata");
    }

    expect(result.meanBrightness).toBe(150);
    expect(result.brightnessVariance).toBe(2500);
    expect(result.meanHue).toBe(60);
    expect(result.hueVariance).toBe(100);
    expect(result.meanSaturation).toBe(25);
    expect(result.saturationVariance).toBe(25);
    expect(result.clippedPixelPercentage).toBe(1.5);
    expect(result.redMean).toBe(150);
    expect(result.greenMean).toBe(150);
    expect(result.blueMean).toBe(150);
    expect(result.redVariance).toBe(2500);
    expect(result.greenVariance).toBe(2500);
    expect(result.blueVariance).toBe(2500);
    expect(result.colorSampleCount).toBe(2);
  });

  it("applies BT.601 coefficients when color_space includes 601", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => p === mockVideoPath);

    const mockFfprobeData = {
      format: { duration: 1 },
      streams: [
        {
          codec_type: "video",
          color_range: "pc",
          color_space: "BT601",
          height: 100,
          r_frame_rate: "30/1",
          width: 100
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const emptyFrames = '{ "frames": [] }';
    const colorStatsFrames = JSON.stringify({
      frames: [
        {
          tags: {
            "lavfi.signalstats.BRNG": "0",
            "lavfi.signalstats.SATAVG": "10",
            "lavfi.signalstats.UAVG": "148",
            "lavfi.signalstats.VAVG": "138",
            "lavfi.signalstats.YAVG": "100",
            "lavfi.signalstats.YBITDEPTH": "8",
            "lavfi.signalstats.YMAX": "200",
            "lavfi.signalstats.YMIN": "1"
          }
        }
      ]
    });

    mockExecFile
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, emptyFrames, "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, "1.0|", "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, colorStatsFrames, "");
        }
      );

    const result = await extractVideoMetadata(mockDir);

    const expected = computeExpectedRgb(0.114, 0.299);

    expect(result?.redMean).toBeCloseTo(expected.r, 5);
    expect(result?.greenMean).toBeCloseTo(expected.g, 5);
    expect(result?.blueMean).toBeCloseTo(expected.b, 5);
  });

  it("applies BT.2020 coefficients when color_space includes 2020", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => p === mockVideoPath);

    const mockFfprobeData = {
      format: { duration: 1 },
      streams: [
        {
          codec_type: "video",
          color_range: "pc",
          color_space: "BT2020nc",
          height: 100,
          r_frame_rate: "30/1",
          width: 100
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const emptyFrames = '{ "frames": [] }';
    const colorStatsFrames = JSON.stringify({
      frames: [
        {
          tags: {
            "lavfi.signalstats.BRNG": "0",
            "lavfi.signalstats.SATAVG": "10",
            "lavfi.signalstats.UAVG": "148",
            "lavfi.signalstats.VAVG": "138",
            "lavfi.signalstats.YAVG": "100",
            "lavfi.signalstats.YBITDEPTH": "8",
            "lavfi.signalstats.YMAX": "200",
            "lavfi.signalstats.YMIN": "1"
          }
        }
      ]
    });

    mockExecFile
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, emptyFrames, "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, "1.0|", "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, colorStatsFrames, "");
        }
      );

    const result = await extractVideoMetadata(mockDir);

    const expected = computeExpectedRgb(0.0593, 0.2627);

    expect(result?.redMean).toBeCloseTo(expected.r, 5);
    expect(result?.greenMean).toBeCloseTo(expected.g, 5);
    expect(result?.blueMean).toBeCloseTo(expected.b, 5);
  });

  it("should derive GOP statistics from frame data when available", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 6 },
      streams: [
        {
          codec_type: "video",
          height: 720,
          r_frame_rate: "30/1",
          width: 1280
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const framePayload = JSON.stringify({
      frames: [
        { key_frame: 1, pict_type: "I", pkt_pts_time: "0" },
        { key_frame: 0, pict_type: "P", pkt_pts_time: "0.0333333" },
        { key_frame: 0, pict_type: "P", pkt_pts_time: "0.05" },
        { key_frame: 1, pict_type: "I", pkt_pts_time: "0.0666667" },
        { key_frame: 0, pict_type: "P", pkt_pts_time: "0.1" },
        { key_frame: 1, pict_type: "I", pkt_pts_time: "0.1666667" }
      ]
    });

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        optionsOrCallback: unknown,
        maybeCallback?: (err: Error | null, stdout: string, stderr?: string) => void
      ) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, framePayload, "");
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toEqual({
      ...laplacianDefaults,
      avgGopDistance: 2.5,
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 6,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 2.5,
      gopVariance: 0.25,
      height: 720,
      level: 0,
      maxGopDistance: 3,
      minGopDistance: 2,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should capture laplacian statistics from ffprobe output", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 2 },
      streams: [
        {
          codec_type: "video",
          height: 480,
          r_frame_rate: "30/1",
          width: 640
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const gopPayload = JSON.stringify({
      frames: [{ key_frame: 1, pkt_pts_time: "0" }]
    });
    const laplacianOutput = "1.0|\n2.0|\n3.0|";

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        optionsOrCallback: unknown,
        maybeCallback?: (err: Error | null, stdout: string, stderr?: string) => void
      ) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        const isLaplacianCall =
          Array.isArray(args) && args.some((arg) => typeof arg === "string" && arg.includes("signalstats"));
        if (isLaplacianCall) {
          callback(null, laplacianOutput, "");
          return;
        }
        callback(null, gopPayload, "");
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result?.laplacianMedian).toBeCloseTo(2);
    expect(result?.laplacianStdDev).toBeCloseTo(Math.sqrt(2 / 3));
    expect(result?.laplacianSampleCount).toBe(3);
  });

  it("skips blank laplacian lines and computes even median", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => p === mockVideoPath);

    const mockFfprobeData = {
      format: { duration: 1 },
      streams: [
        {
          codec_type: "video",
          height: 120,
          r_frame_rate: "24/1",
          width: 160
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const emptyFrames = '{ "frames": [] }';
    const laplacianWithGaps = "\n1.0|\n   \n3.0|\n";

    mockExecFile
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, emptyFrames, "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, laplacianWithGaps, "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, emptyFrames, "");
        }
      );

    const result = await extractVideoMetadata(mockDir);

    expect(result?.laplacianMedian).toBe(2);
    expect(result?.laplacianStdDev).toBe(1);
    expect(result?.laplacianSampleCount).toBe(2);
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 0,
      entropyCoding: "Unknown",
      fps: 0,
      gopSize: 1,
      ...gopDefaults,
      height: 0,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
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
      format: { bit_rate: 123456, duration: 10 },
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
    expect(result).toEqual({
      bFrames: 0,
      bitDepth: 0,
      bitrate: 123456,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 10,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      ...gopDefaults,
      height: 100,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 100
    });
  });

  it("should wrap non-Error objects in Error when ffprobe fails", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: unknown, data: unknown) => void) => {
        cb("string error message", null);
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toBeNull();
  });

  it("should handle stream with missing width/height", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 10 },
      streams: [
        {
          codec_type: "video",
          r_frame_rate: "30/1"
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 10,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      ...gopDefaults,
      height: 0,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 0
    });
  });

  it("should parse numeric bit depth values", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 10 },
      streams: [
        {
          bits_per_raw_sample: 12,
          codec_type: "video",
          height: 720,
          r_frame_rate: "24/1",
          width: 1280
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
      bFrames: 0,
      bitDepth: 12,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 10,
      entropyCoding: "Unknown",
      fps: 24,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should detect entropy coding mode from PPS data", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 5 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: "AWQAHv/hAARnZAAeAQACaOw=",
          height: 720,
          r_frame_rate: "24/1",
          width: 1280
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 5,
      entropyCoding: "CABAC",
      fps: 24,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should detect entropy coding mode from Annex B PPS data", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 5 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: "AAAAAWjs",
          height: 720,
          r_frame_rate: "24/1",
          width: 1280
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 5,
      entropyCoding: "CABAC",
      fps: 24,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should read avcC data from file when extradata is not provided", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const avcCPayloadBase64 = "AWQAHv/hAARnZAAeAQACaOw=";
    const avcCPayload = Buffer.from(avcCPayloadBase64, "base64");
    const AVC_BOX_HEADER = Buffer.alloc(8);
    AVC_BOX_HEADER.writeUInt32BE(avcCPayload.length + 8, 0);
    AVC_BOX_HEADER.write("avcC", 4);
    const badSizeHeader = Buffer.alloc(4); // zero payload; should be skipped
    const fakeFile = Buffer.concat([
      badSizeHeader,
      Buffer.from("avcC"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("ftyp"),
      AVC_BOX_HEADER,
      avcCPayload
    ]);
    (fs.readFileSync as Mock).mockReturnValue(fakeFile);

    const mockFfprobeData = {
      format: { duration: 5 },
      streams: [
        {
          codec_type: "video",
          height: 720,
          r_frame_rate: "24/1",
          width: 1280
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 5,
      entropyCoding: "CABAC",
      fps: 24,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should handle stream with missing r_frame_rate", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 10 },
      streams: [
        {
          codec_type: "video",
          height: 720,
          width: 1280
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 10,
      entropyCoding: "Unknown",
      fps: 0,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should handle malformed r_frame_rate with wrong number of parts", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 10 },
      streams: [
        {
          codec_type: "video",
          height: 720,
          r_frame_rate: "30",
          width: 1280
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 10,
      entropyCoding: "Unknown",
      fps: 0,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("should handle r_frame_rate with zero denominator", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 10 },
      streams: [
        {
          codec_type: "video",
          height: 720,
          r_frame_rate: "30/0",
          width: 1280
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 10,
      entropyCoding: "Unknown",
      fps: 0,
      gopSize: 1,
      ...gopDefaults,
      height: 720,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("derives GOP stats when keyframes mix numeric timestamps and missing timing data", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 3 },
      streams: [
        {
          codec_type: "video",
          height: 480,
          r_frame_rate: "25/1",
          width: 640
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const framePayload = JSON.stringify({
      frames: [{ best_effort_timestamp_time: 0, key_frame: 1 }, { key_frame: 1, pkt_pts_time: 0.125 }, { key_frame: 1 }]
    });

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        optionsOrCallback: unknown,
        maybeCallback?: (err: Error | null, stdout: string, stderr?: string) => void
      ) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, framePayload, "");
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toEqual({
      ...laplacianDefaults,
      avgGopDistance: 2,
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 3,
      entropyCoding: "Unknown",
      fps: 25,
      gopSize: 2,
      gopVariance: 1,
      height: 480,
      level: 0,
      maxGopDistance: 3,
      minGopDistance: 1,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 640
    });
  });

  it("falls back to the stream GOP size when frame metadata cannot be parsed", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const mockFfprobeData = {
      format: { duration: 4 },
      streams: [
        {
          codec_type: "video",
          gop_size: 5,
          height: 720,
          r_frame_rate: "24/1",
          width: 1280
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const framePayload = JSON.stringify({
      frames: [null]
    });

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        optionsOrCallback: unknown,
        maybeCallback?: (err: Error | null, stdout: string, stderr?: string) => void
      ) => {
        const callback = getExecCallback(optionsOrCallback, maybeCallback);
        callback(null, framePayload, "");
      }
    );

    const result = await extractVideoMetadata(mockDir);

    expect(result).toEqual({
      ...laplacianDefaults,
      avgGopDistance: 5,
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 4,
      entropyCoding: "Unknown",
      fps: 24,
      gopSize: 5,
      gopVariance: 0,
      height: 720,
      level: 0,
      maxGopDistance: 5,
      minGopDistance: 5,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1280
    });
  });

  it("returns unknown entropy coding when avcC atoms are malformed", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const headerWithOversizedBox = Buffer.alloc(16, 0);
    headerWithOversizedBox.write("avcC", 0);
    headerWithOversizedBox.writeUInt32BE(100, 4); // Oversized total size
    headerWithOversizedBox.write("avcC", 8);
    const invalidAvcCFile = headerWithOversizedBox;

    (fs.readFileSync as Mock).mockImplementation((p: string) => {
      if (p === mockVideoPath) {
        return invalidAvcCFile;
      }
      return Buffer.alloc(0);
    });

    const mockFfprobeData = {
      format: { duration: 2 },
      streams: [
        {
          codec_type: "video",
          height: 360,
          r_frame_rate: "30/1",
          width: 640
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
      ...laplacianDefaults,
      avgGopDistance: 1,
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 2,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      gopVariance: 0,
      height: 360,
      level: 0,
      maxGopDistance: 1,
      minGopDistance: 1,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 640
    });
  });

  it("walks multiple entropy candidates when neither avcC nor Annex B provide PPS data", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const base64Candidate = Buffer.from([0, 0, 0, 0, 0, 1]).toString("base64");
    const hexCandidate = "0000000165";

    const mockFfprobeData = {
      format: { duration: 1 },
      streams: [
        {
          codec_type: "video",
          extradata: hexCandidate,
          extradata_base64: base64Candidate,
          height: 144,
          r_frame_rate: "24/1",
          width: 256
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
      ...laplacianDefaults,
      avgGopDistance: 1,
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 1,
      entropyCoding: "Unknown",
      fps: 24,
      gopSize: 1,
      gopVariance: 0,
      height: 144,
      level: 0,
      maxGopDistance: 1,
      minGopDistance: 1,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 256
    });
  });

  it("handles PPS NAL units with emulation prevention bytes while detecting entropy coding", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const annexBPpsWithEmulationPrevention = Buffer.from([
      0x00, // start code
      0x00,
      0x00,
      0x01,
      0x68, // PPS NAL header (type 8)
      0x01,
      0x00,
      0x00,
      0x03,
      0x80
    ]).toString("base64");

    const mockFfprobeData = {
      format: { duration: 6 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: annexBPpsWithEmulationPrevention,
          height: 900,
          r_frame_rate: "60/1",
          width: 1600
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
      ...laplacianDefaults,
      avgGopDistance: 1,
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 6,
      entropyCoding: "Unknown",
      fps: 60,
      gopSize: 1,
      gopVariance: 0,
      height: 900,
      level: 0,
      maxGopDistance: 1,
      minGopDistance: 1,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1600
    });
  });

  it("returns unknown entropy when avcC marker lacks preceding size data", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const minimalAvcMarker = Buffer.from("avcC");
    (fs.readFileSync as Mock).mockReturnValue(minimalAvcMarker);

    const mockFfprobeData = {
      format: { duration: 2 },
      streams: [
        {
          codec_type: "video",
          height: 240,
          r_frame_rate: "30/1",
          width: 320
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 2,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      ...gopDefaults,
      height: 240,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 320
    });
  });

  it("returns unknown entropy when avcC declares an oversized SPS length", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const avcCWithOversizedSps = Buffer.from([0, 0, 0, 0, 0, 1, 0, 5]);
    const mockFfprobeData = {
      format: { duration: 1 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: avcCWithOversizedSps.toString("base64"),
          height: 108,
          r_frame_rate: "24/1",
          width: 192
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 1,
      entropyCoding: "Unknown",
      fps: 24,
      gopSize: 1,
      ...gopDefaults,
      height: 108,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 192
    });
  });

  it("returns unknown entropy when avcC ends immediately after SPS count", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const avcCWithNoPps = Buffer.from([0, 0, 0, 0, 0, 0]);
    const mockFfprobeData = {
      format: { duration: 2 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: avcCWithNoPps.toString("base64"),
          height: 200,
          r_frame_rate: "30/1",
          width: 300
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 2,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      ...gopDefaults,
      height: 200,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 300
    });
  });

  it("returns unknown entropy when PPS length extends beyond avcC buffer", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const avcCWithLongPps = Buffer.from([0, 0, 0, 0, 0, 0, 1, 0, 5, 0]);
    const mockFfprobeData = {
      format: { duration: 3 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: avcCWithLongPps.toString("base64"),
          height: 300,
          r_frame_rate: "30/1",
          width: 400
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 3,
      entropyCoding: "Unknown",
      fps: 30,
      gopSize: 1,
      ...gopDefaults,
      height: 300,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 400
    });
  });

  it("returns unknown entropy when PPS length is zero in avcC", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const avcCWithEmptyPps = Buffer.from([0, 0, 0, 0, 0, 0, 1, 0, 0]);
    const mockFfprobeData = {
      format: { duration: 4 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: avcCWithEmptyPps.toString("base64"),
          height: 360,
          r_frame_rate: "24/1",
          width: 640
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 4,
      entropyCoding: "Unknown",
      fps: 24,
      gopSize: 1,
      ...gopDefaults,
      height: 360,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 640
    });
  });

  it("returns unknown entropy when PPS data is too short to parse", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const avcCWithShortPps = Buffer.from([0, 0, 0, 0, 0, 0, 1, 0, 1, 255]);
    const mockFfprobeData = {
      format: { duration: 5 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: avcCWithShortPps.toString("base64"),
          height: 480,
          r_frame_rate: "25/1",
          width: 720
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 5,
      entropyCoding: "Unknown",
      fps: 25,
      gopSize: 1,
      ...gopDefaults,
      height: 480,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 720
    });
  });

  it("falls back to clipped frame ratio when BRNG tags are missing", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => p === mockVideoPath);

    const mockFfprobeData = {
      format: { duration: 1 },
      streams: [
        {
          codec_type: "video",
          color_range: "pc",
          height: 480,
          r_frame_rate: "30/1",
          width: 640
        }
      ]
    };

    (ffmpeg.ffprobe as unknown as Mock).mockImplementation(
      (_file: string, cb: (err: Error | null, data: unknown) => void) => {
        cb(null, mockFfprobeData);
      }
    );

    const emptyFrames = '{ "frames": [] }';
    const colorStatsFrames = JSON.stringify({
      frames: [
        {
          tags: {
            "lavfi.signalstats.SATAVG": "15",
            "lavfi.signalstats.UAVG": "140",
            "lavfi.signalstats.VAVG": "150",
            "lavfi.signalstats.YAVG": "90",
            "lavfi.signalstats.YBITDEPTH": "8",
            "lavfi.signalstats.YMAX": "200",
            "lavfi.signalstats.YMIN": "0"
          }
        },
        {
          tags: {
            "lavfi.signalstats.SATAVG": "20",
            "lavfi.signalstats.UAVG": "130",
            "lavfi.signalstats.VAVG": "135",
            "lavfi.signalstats.YAVG": "100",
            "lavfi.signalstats.YBITDEPTH": "8",
            "lavfi.signalstats.YMAX": "200",
            "lavfi.signalstats.YMIN": "10"
          }
        }
      ]
    });

    mockExecFile
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, emptyFrames, "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, "1.0|", "");
        }
      )
      .mockImplementationOnce(
        (_cmd: string, _args: string[], optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
          const callback = getExecCallback(optionsOrCallback, maybeCallback);
          callback(null, colorStatsFrames, "");
        }
      );

    const result = await extractVideoMetadata(mockDir);

    expect(result?.clippedPixelPercentage).toBe(50);
    expect(result?.colorSampleCount).toBe(2);
  });

  it("walks Annex B start codes that include multiple NAL units", async () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockVideoPath) {
        return true;
      }
      return false;
    });

    const annexBWithTwoStartCodes = Buffer.from([0, 0, 0, 1, 0x68, 0x01, 0x02, 0, 0, 1, 0x65, 0]);
    const mockFfprobeData = {
      format: { duration: 6 },
      streams: [
        {
          codec_type: "video",
          extradata_base64: annexBWithTwoStartCodes.toString("base64"),
          height: 1080,
          r_frame_rate: "60/1",
          width: 1920
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
      bFrames: 0,
      bitDepth: 0,
      bitrate: 0,
      codecName: "",
      colorRange: "",
      colorSpace: "",
      colorTransfer: "",
      duration: 6,
      entropyCoding: "Unknown",
      fps: 60,
      gopSize: 1,
      ...gopDefaults,
      height: 1080,
      level: 0,
      pixelFormat: "",
      profile: "",
      refs: 0,
      width: 1920
    });
  });
});
