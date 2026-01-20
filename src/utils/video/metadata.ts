import * as fs from "fs";
import * as path from "path";

import { detectEntropyCodingMode } from "./entropyCoding";
import { getFfprobeData } from "./ffprobeUtils";
import { getGopStatistics } from "./gopAnalysis";
import { type ColorStatistics, calculateColorStatistics, calculateLaplacianStats } from "./signalStats";

export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  duration: number;
  bitrate?: number;
  codecName?: string;
  profile?: string;
  level?: number;
  bFrames?: number;
  refs?: number;
  gopSize?: number;
  maxGopDistance?: number;
  avgGopDistance?: number;
  minGopDistance?: number;
  gopVariance?: number;
  colorTransfer?: string;
  colorRange?: string;
  colorSpace?: string;
  pixelFormat?: string;
  bitDepth?: number;
  entropyCoding?: string;
  creationTime?: string;
  laplacianMedian?: number;
  laplacianStdDev?: number;
  laplacianSampleCount?: number;
  meanHue?: number;
  hueVariance?: number;
  meanSaturation?: number;
  saturationVariance?: number;
  meanBrightness?: number;
  brightnessVariance?: number;
  redMean?: number;
  greenMean?: number;
  blueMean?: number;
  redVariance?: number;
  greenVariance?: number;
  blueVariance?: number;
  clippedPixelPercentage?: number;
  colorSampleCount?: number;
}

type FieldValidator = (value: unknown) => boolean;

const POSITIVE_THRESHOLD = 0;
const MIN_STRING_LENGTH = 0;

const isValidNumber: FieldValidator = (value) => typeof value === "number" && !Number.isNaN(value);

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > POSITIVE_THRESHOLD;
}

const isValidString: FieldValidator = (value) => typeof value === "string";

const isNonEmptyString: FieldValidator = (value) => typeof value === "string" && value.length > MIN_STRING_LENGTH;

const CACHE_REQUIRED_FIELDS: { key: keyof VideoMetadata; validate: FieldValidator }[] = [
  { key: "bitrate", validate: isValidNumber },
  { key: "codecName", validate: isValidString },
  { key: "profile", validate: isValidString },
  { key: "level", validate: isValidNumber },
  { key: "bFrames", validate: isValidNumber },
  { key: "refs", validate: isValidNumber },
  { key: "gopSize", validate: isPositiveNumber },
  { key: "avgGopDistance", validate: isPositiveNumber },
  { key: "maxGopDistance", validate: isPositiveNumber },
  { key: "minGopDistance", validate: isPositiveNumber },
  { key: "gopVariance", validate: isValidNumber },
  { key: "colorTransfer", validate: isValidString },
  { key: "colorRange", validate: isValidString },
  { key: "colorSpace", validate: isValidString },
  { key: "pixelFormat", validate: isValidString },
  { key: "bitDepth", validate: isValidNumber },
  { key: "entropyCoding", validate: isNonEmptyString },
  { key: "laplacianMedian", validate: isValidNumber },
  { key: "laplacianStdDev", validate: isValidNumber },
  { key: "laplacianSampleCount", validate: isValidNumber },
  { key: "meanHue", validate: isValidNumber },
  { key: "hueVariance", validate: isValidNumber },
  { key: "meanSaturation", validate: isValidNumber },
  { key: "saturationVariance", validate: isValidNumber },
  { key: "meanBrightness", validate: isValidNumber },
  { key: "brightnessVariance", validate: isValidNumber },
  { key: "redMean", validate: isValidNumber },
  { key: "greenMean", validate: isValidNumber },
  { key: "blueMean", validate: isValidNumber },
  { key: "redVariance", validate: isValidNumber },
  { key: "greenVariance", validate: isValidNumber },
  { key: "blueVariance", validate: isValidNumber },
  { key: "clippedPixelPercentage", validate: isValidNumber },
  { key: "colorSampleCount", validate: isValidNumber }
];

function isValidCachedMetadata(data: VideoMetadata): boolean {
  if (data.creationTime === undefined) {
    return false;
  }
  return CACHE_REQUIRED_FIELDS.every(({ key, validate }) => validate(data[key]));
}

/**
 * Extracts metadata from a video file in the given directory.
 * Returns null if the video file does not exist or metadata cannot be parsed.
 * Caches results in videoMetadata.json to avoid redundant processing.
 */
export async function extractVideoMetadata(dirPath: string): Promise<VideoMetadata | null> {
  const metaCachePath = path.join(dirPath, "videoMetadata.json");
  const JSON_INDENT = 2;

  if (fs.existsSync(metaCachePath)) {
    try {
      const cachedContent = fs.readFileSync(metaCachePath, "utf-8");
      const cachedData = JSON.parse(cachedContent) as VideoMetadata;
      if (isValidCachedMetadata(cachedData)) {
        return cachedData;
      }
    } catch {
      // If cache is corrupt or missing new fields, proceed to extraction
    }
  }

  const videoPath = path.join(dirPath, "video.mp4");
  const EXPECTED_PARTS = 2;
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const RADIX = 10;
  const ZERO_DENOMINATOR = 0;
  const DEFAULT_DIMENSION = 0;
  const DEFAULT_FPS = 0;
  const DEFAULT_DURATION = 0;
  const DEFAULT_BITRATE = 0;
  const DEFAULT_STRING = "";
  const DEFAULT_BIT_DEPTH = 0;
  const DEFAULT_LEVEL = 0;
  const DEFAULT_B_FRAMES = 0;
  const DEFAULT_REFS = 0;
  const DEFAULT_GOP = 0;
  const DEFAULT_ENTROPY = "";
  const UNKNOWN_ENTROPY = "Unknown";
  const DEFAULT_LAPLACIAN = 0;
  const DEFAULT_LAPLACIAN_COUNT = 0;

  if (fs.existsSync(videoPath)) {
    try {
      const vidMeta = await getFfprobeData(videoPath);
      const stream = vidMeta.streams.find((s) => s.codec_type === "video");

      const result: VideoMetadata = {
        avgGopDistance: DEFAULT_GOP,
        bFrames: DEFAULT_B_FRAMES,
        bitDepth: DEFAULT_BIT_DEPTH,
        bitrate: DEFAULT_BITRATE,
        codecName: DEFAULT_STRING,
        colorRange: DEFAULT_STRING,
        colorSpace: DEFAULT_STRING,
        colorTransfer: DEFAULT_STRING,
        duration: DEFAULT_DURATION,
        entropyCoding: DEFAULT_ENTROPY,
        fps: DEFAULT_FPS,
        gopSize: DEFAULT_GOP,
        gopVariance: DEFAULT_GOP,
        height: DEFAULT_DIMENSION,
        laplacianMedian: DEFAULT_LAPLACIAN,
        laplacianSampleCount: DEFAULT_LAPLACIAN_COUNT,
        laplacianStdDev: DEFAULT_LAPLACIAN,
        level: DEFAULT_LEVEL,
        maxGopDistance: DEFAULT_GOP,
        minGopDistance: DEFAULT_GOP,
        pixelFormat: DEFAULT_STRING,
        profile: DEFAULT_STRING,
        refs: DEFAULT_REFS,
        width: DEFAULT_DIMENSION
      };

      if (stream) {
        if (typeof stream.codec_name === "string") {
          result.codecName = stream.codec_name;
        }
        if (typeof stream.profile === "string") {
          result.profile = stream.profile;
        }
        if (typeof stream.level === "number") {
          result.level = stream.level;
        }
        if (typeof stream.has_b_frames === "number") {
          result.bFrames = stream.has_b_frames;
        }
        if (typeof stream.refs === "number") {
          result.refs = stream.refs;
        }
        const gopSizeValue = (stream as Record<string, unknown>)["gop_size"];
        const parsedGopSize = typeof gopSizeValue === "string" ? parseInt(gopSizeValue, RADIX) : gopSizeValue;
        if (isPositiveNumber(parsedGopSize)) {
          result.gopSize = parsedGopSize;
        }
        if (typeof stream.color_transfer === "string") {
          result.colorTransfer = stream.color_transfer;
        }
        if (typeof stream.color_range === "string") {
          result.colorRange = stream.color_range;
        }
        if (typeof stream.color_space === "string") {
          result.colorSpace = stream.color_space;
        }
        if (typeof stream.pix_fmt === "string") {
          result.pixelFormat = stream.pix_fmt;
        }
        if (typeof stream.bits_per_raw_sample === "string" || typeof stream.bits_per_raw_sample === "number") {
          const parsedBits =
            typeof stream.bits_per_raw_sample === "string"
              ? parseInt(stream.bits_per_raw_sample, RADIX)
              : stream.bits_per_raw_sample;
          if (!Number.isNaN(parsedBits)) {
            result.bitDepth = parsedBits;
          }
        }
        const entropyCodingMode = detectEntropyCodingMode(stream, videoPath);
        if (entropyCodingMode.length > DEFAULT_ENTROPY.length) {
          result.entropyCoding = entropyCodingMode;
        }
        const entropyCodingLength = (result.entropyCoding ?? DEFAULT_ENTROPY).length;
        if (entropyCodingLength === DEFAULT_ENTROPY.length) {
          result.entropyCoding = UNKNOWN_ENTROPY;
        }
        if (stream.width !== undefined && stream.height !== undefined) {
          result.width = stream.width;
          result.height = stream.height;
        }
        if (stream.r_frame_rate !== undefined) {
          const parts = stream.r_frame_rate.split("/");
          if (
            parts.length === EXPECTED_PARTS &&
            parts[NUMERATOR_IDX] !== undefined &&
            parts[DENOMINATOR_IDX] !== undefined
          ) {
            const num = parseInt(parts[NUMERATOR_IDX], RADIX);
            const den = parseInt(parts[DENOMINATOR_IDX], RADIX);
            if (den !== ZERO_DENOMINATOR) {
              result.fps = Math.round(num / den);
            }
          }
        }
      }

      const format = vidMeta.format;
      if (format.duration !== undefined) {
        result.duration = format.duration;
      }
      const bitrateCandidates = [stream?.bit_rate, format.bit_rate];
      const RADIX_BITRATE = 10;
      for (const candidate of bitrateCandidates) {
        if (candidate === undefined) {
          continue;
        }
        const parsed = typeof candidate === "string" ? parseInt(candidate, RADIX_BITRATE) : candidate;
        if (!Number.isNaN(parsed)) {
          result.bitrate = parsed;
          break;
        }
      }

      const DEFAULT_FPS_FOR_GOP = 30;
      const fpsForGop = result.fps > POSITIVE_THRESHOLD ? result.fps : DEFAULT_FPS_FOR_GOP;
      const gopStats = await getGopStatistics(videoPath, result.gopSize ?? DEFAULT_GOP, fpsForGop);
      result.maxGopDistance = gopStats.max;
      result.avgGopDistance = gopStats.average;
      result.minGopDistance = gopStats.min;
      result.gopVariance = gopStats.variance;
      if (!isPositiveNumber(result.gopSize) && isPositiveNumber(gopStats.average)) {
        result.gopSize = gopStats.average;
      }

      const laplacianStats = await calculateLaplacianStats(videoPath);
      if (laplacianStats !== null) {
        result.laplacianMedian = laplacianStats.median;
        result.laplacianStdDev = laplacianStats.standardDeviation;
        result.laplacianSampleCount = laplacianStats.frameCount;
      }

      const fallbackColorStats: ColorStatistics = {
        blueMean: 0,
        blueVariance: 0,
        brightnessVariance: 0,
        clippedPixelPercentage: 0,
        greenMean: 0,
        greenVariance: 0,
        hueVariance: 0,
        meanBrightness: 0,
        meanHue: 0,
        meanSaturation: 0,
        redMean: 0,
        redVariance: 0,
        sampleCount: 0,
        saturationVariance: 0
      };
      const colorStatsOptions: { colorRange?: string; colorSpace?: string } = {};
      if (result.colorRange !== undefined) {
        colorStatsOptions.colorRange = result.colorRange;
      }
      if (result.colorSpace !== undefined) {
        colorStatsOptions.colorSpace = result.colorSpace;
      }
      const colorStats = (await calculateColorStatistics(videoPath, colorStatsOptions)) ?? fallbackColorStats;
      result.meanHue = colorStats.meanHue;
      result.hueVariance = colorStats.hueVariance;
      result.meanSaturation = colorStats.meanSaturation;
      result.saturationVariance = colorStats.saturationVariance;
      result.meanBrightness = colorStats.meanBrightness;
      result.brightnessVariance = colorStats.brightnessVariance;
      result.redMean = colorStats.redMean;
      result.greenMean = colorStats.greenMean;
      result.blueMean = colorStats.blueMean;
      result.redVariance = colorStats.redVariance;
      result.greenVariance = colorStats.greenVariance;
      result.blueVariance = colorStats.blueVariance;
      result.clippedPixelPercentage = colorStats.clippedPixelPercentage;
      result.colorSampleCount = colorStats.sampleCount;

      const finalEntropyLength = (result.entropyCoding ?? DEFAULT_ENTROPY).length;
      if (finalEntropyLength === DEFAULT_ENTROPY.length) {
        result.entropyCoding = UNKNOWN_ENTROPY;
      }

      if (format.tags?.["creation_time"] !== undefined) {
        result.creationTime = String(format.tags["creation_time"]);
      }

      try {
        fs.writeFileSync(metaCachePath, JSON.stringify(result, null, JSON_INDENT));
      } catch {
        // If write fails, still return the result
      }

      return result;
    } catch {
      return null;
    }
  }
  return null;
}
