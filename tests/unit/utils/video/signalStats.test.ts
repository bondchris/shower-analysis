import { Mock, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateColorStatistics,
  calculateLaplacianStats,
  calculateMeanAndVariance,
  convertYuvToRgb
} from "../../../../src/utils/video/signalStats";
import * as ffprobeUtils from "../../../../src/utils/video/ffprobeUtils";

vi.mock("../../../../src/utils/video/ffprobeUtils");

describe("signalStats", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("calculateMeanAndVariance", () => {
    it("returns zeros for empty array", () => {
      const result = calculateMeanAndVariance([]);
      expect(result).toEqual({ mean: 0, variance: 0 });
    });

    it("calculates mean and variance for valid values", () => {
      const result = calculateMeanAndVariance([2, 4, 6, 8]);
      expect(result.mean).toBe(5);
      expect(result.variance).toBe(5);
    });

    it("filters out non-finite values", () => {
      const result = calculateMeanAndVariance([2, NaN, 4, Infinity, 6]);
      expect(result.mean).toBe(4);
    });
  });

  describe("convertYuvToRgb", () => {
    it("converts YUV to RGB with full range (pc)", () => {
      const result = convertYuvToRgb(128, 128, 128, "pc");
      expect(result.r).toBeCloseTo(128, 0);
      expect(result.g).toBeCloseTo(128, 0);
      expect(result.b).toBeCloseTo(128, 0);
    });

    it("converts YUV to RGB with limited range (tv)", () => {
      const result = convertYuvToRgb(128, 128, 128, "tv");
      // Limited range applies offset and scaling
      expect(result.r).toBeGreaterThan(128);
      expect(result.g).toBeGreaterThan(128);
      expect(result.b).toBeGreaterThan(128);
    });

    it("uses full range by default when colorRange is undefined", () => {
      const fullRangeResult = convertYuvToRgb(128, 128, 128, "pc");
      const undefinedResult = convertYuvToRgb(128, 128, 128, undefined);
      expect(undefinedResult).toEqual(fullRangeResult);
    });

    it("uses BT.709 coefficients by default when colorSpace is undefined", () => {
      const bt709Result = convertYuvToRgb(200, 100, 150, "pc", "bt709");
      const undefinedResult = convertYuvToRgb(200, 100, 150, "pc", undefined);
      expect(undefinedResult.r).toBeCloseTo(bt709Result.r, 1);
      expect(undefinedResult.g).toBeCloseTo(bt709Result.g, 1);
      expect(undefinedResult.b).toBeCloseTo(bt709Result.b, 1);
    });

    it("uses BT.601 coefficients for 601 color space", () => {
      const bt601Result = convertYuvToRgb(200, 100, 150, "pc", "bt601");
      const bt709Result = convertYuvToRgb(200, 100, 150, "pc", "bt709");
      // BT.601 and BT.709 have different coefficients, so results differ
      expect(bt601Result.r).not.toBeCloseTo(bt709Result.r, 0);
    });

    it("uses BT.2020 coefficients for 2020 color space", () => {
      const bt2020Result = convertYuvToRgb(200, 100, 150, "pc", "bt2020");
      const bt709Result = convertYuvToRgb(200, 100, 150, "pc", "bt709");
      // BT.2020 and BT.709 have different coefficients
      expect(bt2020Result.r).not.toBeCloseTo(bt709Result.r, 0);
    });

    it("clamps RGB values to 0-255 range", () => {
      // High V value should push red high, potentially above 255
      const result = convertYuvToRgb(255, 0, 255, "pc");
      expect(result.r).toBeLessThanOrEqual(255);
      expect(result.r).toBeGreaterThanOrEqual(0);
      expect(result.g).toBeLessThanOrEqual(255);
      expect(result.g).toBeGreaterThanOrEqual(0);
      expect(result.b).toBeLessThanOrEqual(255);
      expect(result.b).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateLaplacianStats", () => {
    it("returns null when ffprobe fails", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockRejectedValue(new Error("ffprobe error"));
      const result = await calculateLaplacianStats("/path/to/video.mp4");
      expect(result).toBeNull();
    });

    it("returns null when no valid values are parsed", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue("\n\n");
      const result = await calculateLaplacianStats("/path/to/video.mp4");
      expect(result).toBeNull();
    });

    it("parses values and computes statistics", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue("10|\n20|\n30|\n40|\n50|");
      const result = await calculateLaplacianStats("/path/to/video.mp4");
      expect(result).not.toBeNull();
      expect(result?.frameCount).toBe(5);
      expect(result?.median).toBe(30);
    });

    it("computes median for even number of values", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue("10|\n20|\n30|\n40|");
      const result = await calculateLaplacianStats("/path/to/video.mp4");
      expect(result).not.toBeNull();
      expect(result?.frameCount).toBe(4);
      expect(result?.median).toBe(25); // Average of 20 and 30
    });

    it("handles lines without pipe trailer", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue("10\n20\n30");
      const result = await calculateLaplacianStats("/path/to/video.mp4");
      expect(result).not.toBeNull();
      expect(result?.frameCount).toBe(3);
    });

    it("skips non-numeric values", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue("10|\ninvalid|\n30|");
      const result = await calculateLaplacianStats("/path/to/video.mp4");
      expect(result).not.toBeNull();
      expect(result?.frameCount).toBe(2);
    });

    it("escapes single quotes in video path", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue("10|");
      await calculateLaplacianStats("/path/to/video's file.mp4");
      expect(ffprobeUtils.runFfprobe).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining("video\\'s file")])
      );
    });
  });

  describe("calculateColorStatistics", () => {
    const createFrameJson = (tags: Record<string, string>): string => {
      return JSON.stringify({
        frames: [{ tags }]
      });
    };

    const createMultiFrameJson = (framesTags: Record<string, string>[]): string => {
      return JSON.stringify({
        frames: framesTags.map((tags) => ({ tags }))
      });
    };

    it("returns null when ffprobe fails", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockRejectedValue(new Error("ffprobe error"));
      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).toBeNull();
    });

    it("returns statistics with empty frames array when JSON has no frames", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(JSON.stringify({ noframes: [] }));
      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.sampleCount).toBe(0);
    });

    it("returns statistics when frames is not an array", async () => {
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(JSON.stringify({ frames: "not-an-array" }));
      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.sampleCount).toBe(0);
    });

    it("parses numeric tags and calculates statistics", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.BRNG": "0.01",
        "lavfi.signalstats.HUEAVG": "180",
        "lavfi.signalstats.SATAVG": "50",
        "lavfi.signalstats.UAVG": "128",
        "lavfi.signalstats.VAVG": "128",
        "lavfi.signalstats.YAVG": "128",
        "lavfi.signalstats.YBITDEPTH": "8",
        "lavfi.signalstats.YMAX": "235",
        "lavfi.signalstats.YMIN": "16"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.sampleCount).toBe(1);
      expect(result?.meanBrightness).toBeCloseTo(128, 0);
    });

    it("handles non-numeric tag values gracefully", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.HUEAVG": "NaN",
        "lavfi.signalstats.SATAVG": "undefined",
        "lavfi.signalstats.YAVG": "invalid"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.sampleCount).toBe(0);
    });

    it("applies limited color range when colorRange is tv", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.UAVG": "128",
        "lavfi.signalstats.VAVG": "128",
        "lavfi.signalstats.YAVG": "128"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const fullRangeResult = await calculateColorStatistics("/path/to/video.mp4", { colorRange: "pc" });
      const limitedRangeResult = await calculateColorStatistics("/path/to/video.mp4", { colorRange: "tv" });

      expect(fullRangeResult?.meanBrightness).not.toBe(limitedRangeResult?.meanBrightness);
    });

    it("uses full range by default when colorRange is undefined", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.YAVG": "128"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const explicitFullRange = await calculateColorStatistics("/path/to/video.mp4", { colorRange: "pc" });
      const undefinedRange = await calculateColorStatistics("/path/to/video.mp4", {});

      expect(undefinedRange?.meanBrightness).toBe(explicitFullRange?.meanBrightness);
    });

    it("uses fallback brightness for U/V when they are missing", async () => {
      // Frame has brightness but no U/V values
      const json = createFrameJson({
        "lavfi.signalstats.YAVG": "128"
        // No UAVG or VAVG
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      // RGB should still be calculated using brightness as fallback for U/V
      expect(result?.redMean).toBeGreaterThanOrEqual(0);
    });

    it("uses previous U/V values when current frame is missing them", async () => {
      // First frame has U/V, second doesn't
      const json = createMultiFrameJson([
        {
          "lavfi.signalstats.UAVG": "100",
          "lavfi.signalstats.VAVG": "150",
          "lavfi.signalstats.YAVG": "128"
        },
        {
          "lavfi.signalstats.YAVG": "200"
          // No UAVG or VAVG - should fall back to last known values or brightness
        }
      ]);
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.sampleCount).toBe(2);
    });

    it("detects clipped pixels from BRNG values", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.BRNG": "0.05", // 5% clipping
        "lavfi.signalstats.YAVG": "128"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.clippedPixelPercentage).toBeCloseTo(5, 1);
    });

    it("detects clipping from YMIN/YMAX when BRNG is missing", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.YAVG": "128",
        "lavfi.signalstats.YBITDEPTH": "8",
        "lavfi.signalstats.YMAX": "255", // Clipped at white
        "lavfi.signalstats.YMIN": "0" // Clipped at black
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.clippedPixelPercentage).toBeGreaterThan(0);
    });

    it("excludes low-saturation frames from hue calculations", async () => {
      // Low saturation (< 15% of 100) should exclude hue
      const json = createFrameJson({
        "lavfi.signalstats.HUEAVG": "180",
        "lavfi.signalstats.SATAVG": "10", // 10% saturation, below threshold
        "lavfi.signalstats.YAVG": "128"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      // Hue should be 0 since saturation is too low
      expect(result?.meanHue).toBe(0);
    });

    it("includes high-saturation frames in hue calculations", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.HUEAVG": "180",
        "lavfi.signalstats.SATAVG": "50", // 50% saturation, above threshold
        "lavfi.signalstats.YAVG": "128"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.meanHue).toBe(180);
    });

    it("passes correct color space to RGB conversion", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.UAVG": "100",
        "lavfi.signalstats.VAVG": "150",
        "lavfi.signalstats.YAVG": "200"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const bt709Result = await calculateColorStatistics("/path/to/video.mp4", { colorSpace: "bt709" });
      const bt601Result = await calculateColorStatistics("/path/to/video.mp4", { colorSpace: "bt601" });

      // Different color spaces should produce different RGB means
      expect(bt709Result?.redMean).not.toBeCloseTo(bt601Result?.redMean ?? 0, 0);
    });

    it("handles frames with missing tags object", async () => {
      const json = JSON.stringify({
        frames: [{}] // Frame without tags
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.sampleCount).toBe(0);
    });

    it("uses default bit depth when YBITDEPTH is missing", async () => {
      const json = createFrameJson({
        "lavfi.signalstats.YAVG": "128",
        "lavfi.signalstats.YMAX": "255",
        "lavfi.signalstats.YMIN": "0"
        // No YBITDEPTH - should default to 8
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
    });

    it("clamps clipped pixel percentage to 0-100 range", async () => {
      // Edge case: very high BRNG value
      const json = createFrameJson({
        "lavfi.signalstats.BRNG": "1.5", // 150% would be invalid
        "lavfi.signalstats.YAVG": "128"
      });
      (ffprobeUtils.runFfprobe as Mock).mockResolvedValue(json);

      const result = await calculateColorStatistics("/path/to/video.mp4", {});
      expect(result).not.toBeNull();
      expect(result?.clippedPixelPercentage).toBeLessThanOrEqual(100);
    });
  });
});
