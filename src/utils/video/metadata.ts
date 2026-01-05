import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

import ffmpeg from "fluent-ffmpeg";

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
}

/**
 * Internal helper to wrap ffprobe in a promise.
 */
async function getFfprobeData(filePath: string): Promise<ffmpeg.FfprobeData> {
  const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        resolve(metadata);
      }
    });
  });
  return data;
}

async function getKeyframeIntervals(videoPath: string, fps: number): Promise<number[]> {
  const ffprobeArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-skip_frame",
    "nokey",
    "-select_streams",
    "v:0",
    "-show_frames",
    "-show_entries",
    "frame=key_frame,pict_type,pkt_pts_time,best_effort_timestamp_time",
    "-of",
    "json",
    videoPath
  ];
  const BYTES_PER_KILOBYTE = 1024;
  const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;
  const DEFAULT_MAX_BUFFER_MB = 20;
  const FFPROBE_MAX_BUFFER = DEFAULT_MAX_BUFFER_MB * BYTES_PER_MEGABYTE;

  try {
    const stdoutValue = await new Promise<string | Buffer>((resolve, reject) => {
      execFile("ffprobe", ffprobeArgs, { maxBuffer: FFPROBE_MAX_BUFFER }, (err: unknown, stdout: string | Buffer) => {
        const unknownErrorMessage = "Unknown ffprobe error";
        if (err !== null && err !== undefined) {
          const errorMessage = typeof err === "string" ? err : unknownErrorMessage;
          reject(err instanceof Error ? err : new Error(errorMessage));
          return;
        }
        resolve(stdout);
      });
    });
    const parsedOutput =
      typeof stdoutValue === "string" || Buffer.isBuffer(stdoutValue)
        ? stdoutValue.toString()
        : JSON.stringify(stdoutValue);
    interface KeyframeEntry {
      key_frame?: number;
      pict_type?: string;
      pkt_pts_time?: string | number;
      best_effort_timestamp_time?: string | number;
    }
    const isKeyframeEntry = (entry: unknown): entry is KeyframeEntry => {
      if (entry === null || typeof entry !== "object") {
        return false;
      }
      const candidate = entry as Partial<KeyframeEntry>;
      return (
        (candidate.key_frame === undefined || typeof candidate.key_frame === "number") &&
        (candidate.pict_type === undefined || typeof candidate.pict_type === "string") &&
        (candidate.pkt_pts_time === undefined ||
          typeof candidate.pkt_pts_time === "string" ||
          typeof candidate.pkt_pts_time === "number") &&
        (candidate.best_effort_timestamp_time === undefined ||
          typeof candidate.best_effort_timestamp_time === "string" ||
          typeof candidate.best_effort_timestamp_time === "number")
      );
    };
    const isKeyframeEntryArray = (value: unknown): value is KeyframeEntry[] =>
      Array.isArray(value) && value.every((entry) => isKeyframeEntry(entry));
    const parsedJson: unknown = JSON.parse(parsedOutput);
    let frames: KeyframeEntry[] = [];
    if (parsedJson !== null && typeof parsedJson === "object") {
      const candidateFrames: unknown = (parsedJson as { frames?: unknown }).frames;
      if (isKeyframeEntryArray(candidateFrames)) {
        frames = candidateFrames;
      }
    }
    const intervals: number[] = [];
    const minIntervalLength = 1;
    const keyFrameFlag = 1;
    const MIN_FPS = 1;
    const DEFAULT_FPS = 30;
    const framesPerSecond = Number.isFinite(fps) && fps >= MIN_FPS ? fps : DEFAULT_FPS;
    const parseTime = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return null;
    };
    let lastIFrameTime: number | null = null;

    for (const frame of frames) {
      const pictType = typeof frame.pict_type === "string" ? frame.pict_type.toUpperCase() : "";
      const isKeyFrame = frame.key_frame === keyFrameFlag || pictType === "I";
      if (!isKeyFrame) {
        continue;
      }
      const INITIAL_FRAME_TIME_SECONDS = 0;
      const frameIntervalSeconds = minIntervalLength / framesPerSecond;
      const sequentialTimeFallback =
        lastIFrameTime === null ? INITIAL_FRAME_TIME_SECONDS : lastIFrameTime + frameIntervalSeconds;
      const resolveTime = (): number => {
        const bestEffortTime = parseTime(frame.best_effort_timestamp_time);
        if (bestEffortTime !== null) {
          return bestEffortTime;
        }
        const ptsTime = parseTime(frame.pkt_pts_time);
        if (ptsTime !== null) {
          return ptsTime;
        }
        return sequentialTimeFallback;
      };
      const time = resolveTime();
      if (lastIFrameTime !== null) {
        const deltaSeconds = time - lastIFrameTime;
        const interval = Math.round(deltaSeconds * framesPerSecond);
        if (interval >= minIntervalLength) {
          intervals.push(interval);
        }
      }
      lastIFrameTime = time;
    }

    return intervals;
  } catch {
    return [];
  }
}

function calculateGopStatistics(
  intervals: number[],
  fallbackGopSize: number
): {
  average: number;
  max: number;
  min: number;
  variance: number;
} {
  const minValidInterval = 1;
  const defaultGopStat = 0;
  const initialSum = 0;
  const noIntervals = 0;
  const validIntervals = intervals.filter((value) => Number.isFinite(value) && value >= minValidInterval);
  const fallbackValue =
    Number.isFinite(fallbackGopSize) && fallbackGopSize >= minValidInterval ? fallbackGopSize : minValidInterval;
  if (validIntervals.length === noIntervals) {
    return { average: fallbackValue, max: fallbackValue, min: fallbackValue, variance: defaultGopStat };
  }

  const total = validIntervals.reduce((sum, value) => sum + value, initialSum);
  const average = total / validIntervals.length;
  const max = Math.max(...validIntervals);
  const min = Math.min(...validIntervals);
  const variance =
    validIntervals.reduce((sum, value) => {
      const deviation = value - average;
      const squaredDeviation = deviation * deviation;
      return sum + squaredDeviation;
    }, initialSum) / validIntervals.length;

  return { average, max, min, variance };
}

async function getGopStatistics(
  videoPath: string,
  gopSizeFromStream: number,
  fps: number
): Promise<{
  average: number;
  max: number;
  min: number;
  variance: number;
}> {
  const intervals = await getKeyframeIntervals(videoPath, fps);
  return calculateGopStatistics(intervals, gopSizeFromStream);
}

function safeByteAt(buffer: Buffer, index: number): number | undefined {
  const MIN_INDEX = 0;
  if (index < MIN_INDEX || index >= buffer.length) {
    return undefined;
  }
  return buffer[index];
}

function extractAvcCFromFile(videoPath: string): Buffer | undefined {
  const AVC_MARKER = "avcC";
  const MARKER_LENGTH = 4;
  const HEADER_SIZE = 8;
  const SIZE_BYTES = 4;
  const MIN_PAYLOAD_SIZE = 1;

  try {
    const fileBuffer = fs.readFileSync(videoPath);
    const markerBuffer = Buffer.from(AVC_MARKER, "ascii");
    let searchStart = 0;
    const NOT_FOUND = -1;
    while (searchStart < fileBuffer.length) {
      const markerIndex = fileBuffer.indexOf(markerBuffer, searchStart);
      if (markerIndex === NOT_FOUND) {
        return undefined;
      }
      searchStart = markerIndex + MARKER_LENGTH;
      if (markerIndex < SIZE_BYTES) {
        continue;
      }
      const headerEnd = markerIndex + MARKER_LENGTH;
      if (headerEnd > fileBuffer.length) {
        continue;
      }

      const sizeFieldStart = markerIndex - SIZE_BYTES;
      const sizeFieldEnd = sizeFieldStart + SIZE_BYTES;
      if (sizeFieldEnd > fileBuffer.length) {
        continue;
      }

      const totalSize = fileBuffer.readUInt32BE(sizeFieldStart);
      const payloadSize = totalSize - HEADER_SIZE;
      if (payloadSize < MIN_PAYLOAD_SIZE) {
        continue;
      }

      const payloadStart = markerIndex + MARKER_LENGTH;
      const payloadEnd = payloadStart + payloadSize;
      if (payloadEnd > fileBuffer.length) {
        continue;
      }

      return fileBuffer.subarray(payloadStart, payloadEnd);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function removeEmulationPreventionBytes(nal: Buffer): Buffer {
  const TRIPLE_BYTE_WINDOW = 3;
  const ZERO_BYTE = 0x00;
  const PREVENTION_BYTE = 0x03;
  const START_INDEX = 0;
  const SINGLE_BYTE_STEP = 1;
  const PREVENTION_SKIP_COUNT = 2;
  const SECOND_BYTE_OFFSET = 1;
  const THIRD_BYTE_OFFSET = 2;
  const cleaned: number[] = [];
  for (let i = START_INDEX; i < nal.length; i += SINGLE_BYTE_STEP) {
    const currentByte = safeByteAt(nal, i);
    const secondByte = safeByteAt(nal, i + SECOND_BYTE_OFFSET);
    const thirdByte = safeByteAt(nal, i + THIRD_BYTE_OFFSET);
    if (currentByte === undefined) {
      continue;
    }
    const remaining = nal.length - i;
    const hasPreventionSequence =
      remaining >= TRIPLE_BYTE_WINDOW &&
      currentByte === ZERO_BYTE &&
      secondByte === ZERO_BYTE &&
      thirdByte === PREVENTION_BYTE;
    if (hasPreventionSequence) {
      cleaned.push(currentByte, secondByte as number);
      i += PREVENTION_SKIP_COUNT;
      continue;
    }
    cleaned.push(currentByte);
  }
  return Buffer.from(cleaned);
}

class BitReader {
  private static readonly INITIAL_BIT_POSITION = Number.parseInt("0", 10);
  private static readonly BIT_POSITION_STEP = Number.parseInt("1", 10);

  private readonly buffer: Buffer;
  private bitPosition = BitReader.INITIAL_BIT_POSITION;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readBits(count: number): number {
    const BITS_PER_BYTE = 8;
    const BIT_BASE = 2;
    const MOST_SIGNIFICANT_BIT = 7;
    const INITIAL_VALUE = 0;
    const maxBits = this.buffer.length * BITS_PER_BYTE;
    if (this.bitPosition + count > maxBits) {
      throw new Error("Not enough bits to read");
    }

    let value = INITIAL_VALUE;
    for (let i = INITIAL_VALUE; i < count; i += BitReader.BIT_POSITION_STEP) {
      const byteIndex = Math.floor(this.bitPosition / BITS_PER_BYTE);
      const bitOffset = MOST_SIGNIFICANT_BIT - (this.bitPosition % BITS_PER_BYTE);
      const byte = safeByteAt(this.buffer, byteIndex);
      if (byte === undefined) {
        throw new Error("BitReader read out of range");
      }
      const bit = Math.floor(byte / Math.pow(BIT_BASE, bitOffset)) % BIT_BASE;
      const scaledValue = value * BIT_BASE;
      value = scaledValue + bit;
      this.bitPosition += BitReader.BIT_POSITION_STEP;
    }
    return value;
  }

  readUE(): number {
    const BIT_BASE = 2;
    const SINGLE_BIT = 1;
    const NO_LEADING_ZEROS = 0;
    let leadingZeroBits = NO_LEADING_ZEROS;
    while (this.readBits(SINGLE_BIT) === NO_LEADING_ZEROS) {
      leadingZeroBits += SINGLE_BIT;
    }
    if (leadingZeroBits === NO_LEADING_ZEROS) {
      return NO_LEADING_ZEROS;
    }
    const suffix = this.readBits(leadingZeroBits);
    const baseValue = Math.pow(BIT_BASE, leadingZeroBits);
    const ADJUSTMENT = 1;
    return baseValue - ADJUSTMENT + suffix;
  }
}

function parsePpsForEntropyCoding(ppsNal: Buffer): string | undefined {
  const MIN_NAL_LENGTH = 2;
  if (ppsNal.length < MIN_NAL_LENGTH) {
    return undefined;
  }
  const FIRST_BYTE = 1;
  const rbsp = removeEmulationPreventionBytes(ppsNal.subarray(FIRST_BYTE)); // drop NAL header
  try {
    const reader = new BitReader(rbsp);
    reader.readUE(); // pps_pic_parameter_set_id
    reader.readUE(); // seq_parameter_set_id
    const ENTROPY_FLAG_BITS = 1;
    const CABAC_FLAG = 1;
    const entropyFlag = reader.readBits(ENTROPY_FLAG_BITS);
    return entropyFlag === CABAC_FLAG ? "CABAC" : "CAVLC";
  } catch {
    return undefined;
  }
}

function parseAvcCForPps(avcC: Buffer): Buffer | undefined {
  const MIN_HEADER_LENGTH = 6;
  const LENGTH_FIELD_SIZE = 2;
  const SPS_MODULO = 32;
  const PPS_COUNT_OFFSET = 1;
  if (avcC.length < MIN_HEADER_LENGTH) {
    return undefined;
  }

  const SPS_COUNT_POSITION = 5; // position of numOfSequenceParameterSets
  const initialOffset = SPS_COUNT_POSITION;
  let offset = initialOffset;
  const spsCountByte = safeByteAt(avcC, offset);
  if (spsCountByte === undefined) {
    return undefined;
  }
  const spsCount = spsCountByte % SPS_MODULO;
  offset += PPS_COUNT_OFFSET;

  for (let i = 0; i < spsCount; i += PPS_COUNT_OFFSET) {
    if (offset + LENGTH_FIELD_SIZE > avcC.length) {
      return undefined;
    }
    const spsLength = avcC.readUInt16BE(offset);
    offset += LENGTH_FIELD_SIZE + spsLength;
    if (offset > avcC.length) {
      return undefined;
    }
  }

  if (offset >= avcC.length) {
    return undefined;
  }

  const ppsCountByte = safeByteAt(avcC, offset);
  if (ppsCountByte === undefined) {
    return undefined;
  }
  const ppsCount = ppsCountByte;
  offset += PPS_COUNT_OFFSET;

  for (let i = 0; i < ppsCount; i += PPS_COUNT_OFFSET) {
    if (offset + LENGTH_FIELD_SIZE > avcC.length) {
      return undefined;
    }
    const ppsLength = avcC.readUInt16BE(offset);
    offset += LENGTH_FIELD_SIZE;
    const end = offset + ppsLength;
    if (end > avcC.length) {
      return undefined;
    }
    const ppsNal = avcC.subarray(offset, end);
    const MIN_PPS_DATA_LENGTH = 0;
    if (ppsNal.length > MIN_PPS_DATA_LENGTH) {
      return ppsNal;
    }
    offset = end;
  }

  return undefined;
}

function parseAnnexBPps(data: Buffer): Buffer | undefined {
  const START_CODE_PADDING = 0x00;
  const START_CODE_MARKER = 0x01;
  const START_CODE_SHORT_VALUES = [START_CODE_PADDING, START_CODE_PADDING, START_CODE_MARKER];
  const START_CODE_LONG_VALUES = [START_CODE_PADDING, START_CODE_PADDING, START_CODE_PADDING, START_CODE_MARKER];
  const START_CODE_SHORT = Buffer.from(START_CODE_SHORT_VALUES);
  const START_CODE_LONG = Buffer.from(START_CODE_LONG_VALUES);
  const ppsNalType = 8;
  const MIN_START_CODE_LENGTH = 3;
  const NAL_TYPE_MODULO = 32;
  const FIRST_NAL_INDEX = 0;
  const NAL_TYPE_INDEX = 0;
  const PREVIOUS_BYTE = 1;
  const EMPTY_NAL_LENGTH = 0;

  const startCodes = [START_CODE_LONG, START_CODE_SHORT];

  const INDEX_STEP = 1;
  for (let i = FIRST_NAL_INDEX; i < data.length; i += INDEX_STEP) {
    let startCodeLength = FIRST_NAL_INDEX;
    for (const sc of startCodes) {
      const candidate = data.subarray(i, i + sc.length);
      if (candidate.equals(sc)) {
        startCodeLength = sc.length;
        break;
      }
    }
    if (startCodeLength === FIRST_NAL_INDEX) {
      continue;
    }

    const nalStart = i + startCodeLength;
    let nalEnd = data.length;
    for (let j = nalStart; j < data.length - MIN_START_CODE_LENGTH; j += INDEX_STEP) {
      if (
        data.subarray(j, j + START_CODE_LONG.length).equals(START_CODE_LONG) ||
        data.subarray(j, j + START_CODE_SHORT.length).equals(START_CODE_SHORT)
      ) {
        nalEnd = j;
        break;
      }
    }

    const nal = data.subarray(nalStart, nalEnd);
    const nalTypeByte = safeByteAt(nal, NAL_TYPE_INDEX);
    if (nalTypeByte === undefined) {
      return undefined;
    }
    const nalType = nal.length > EMPTY_NAL_LENGTH ? nalTypeByte % NAL_TYPE_MODULO : FIRST_NAL_INDEX;
    if (nalType === ppsNalType) {
      return nal;
    }
    i = nalEnd - PREVIOUS_BYTE; // continue scanning after this NAL
  }

  return undefined;
}

function detectEntropyCodingMode(stream: ffmpeg.FfprobeStream, videoPath: string): string {
  const extradataBase64 = (stream as Record<string, unknown>)["extradata_base64"];
  const extradataHex = (stream as Record<string, unknown>)["extradata"];

  const candidateBuffers: Buffer[] = [];
  const NO_BUFFERS = 0;

  if (typeof extradataBase64 === "string") {
    try {
      candidateBuffers.push(Buffer.from(extradataBase64, "base64"));
    } catch {
      // ignore invalid base64
    }
  }

  if (typeof extradataHex === "string") {
    try {
      candidateBuffers.push(Buffer.from(extradataHex, "hex"));
    } catch {
      // ignore invalid hex
    }
  }

  if (candidateBuffers.length === NO_BUFFERS) {
    const avcC = extractAvcCFromFile(videoPath);
    if (avcC !== undefined) {
      candidateBuffers.push(avcC);
    }
  }

  const ppsNalType = 8;
  const NAL_TYPE_MODULO = 32;
  const FIRST_BYTE_INDEX = 0;
  const DEFAULT_ENTROPY_STRING = "";

  for (const buffer of candidateBuffers) {
    const ppsFromAvcC = parseAvcCForPps(buffer);
    if (ppsFromAvcC !== undefined) {
      const entropy = parsePpsForEntropyCoding(ppsFromAvcC);
      if (entropy !== undefined) {
        return entropy;
      }
    }

    const ppsFromAnnexB = parseAnnexBPps(buffer);
    if (ppsFromAnnexB !== undefined) {
      const nalFirstByte = safeByteAt(ppsFromAnnexB, FIRST_BYTE_INDEX);
      if (nalFirstByte !== undefined && nalFirstByte % NAL_TYPE_MODULO === ppsNalType) {
        const entropy = parsePpsForEntropyCoding(ppsFromAnnexB);
        if (entropy !== undefined) {
          return entropy;
        }
      }
    }
  }

  return DEFAULT_ENTROPY_STRING;
}

async function calculateLaplacianStats(videoPath: string): Promise<{
  frameCount: number;
  median: number;
  standardDeviation: number;
} | null> {
  const escapedPath = videoPath.replace(/'/g, "\\'");
  const filterGraph = `movie='${escapedPath}',format=gray,convolution='0 1 0 1 -4 1 0 1 0',signalstats`;
  const compactFormat = "compact=p=0:nk=1";
  const outputField = "frame_tags=lavfi.signalstats.YAVG";
  const ffprobeArgs = ["-v", "error", "-of", compactFormat, "-show_entries", outputField, "-f", "lavfi", filterGraph];
  const BYTES_PER_KILOBYTE = 1024;
  const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;
  const DEFAULT_MAX_BUFFER_MB = 50;
  const FFPROBE_MAX_BUFFER = DEFAULT_MAX_BUFFER_MB * BYTES_PER_MEGABYTE;

  try {
    const stdoutValue = await new Promise<string>((resolve, reject) => {
      execFile("ffprobe", ffprobeArgs, { maxBuffer: FFPROBE_MAX_BUFFER }, (err: unknown, stdout: string | Buffer) => {
        const unknownErrorMessage = "Unknown ffprobe error";
        if (err !== null && err !== undefined) {
          const errorMessage = typeof err === "string" ? err : unknownErrorMessage;
          reject(err instanceof Error ? err : new Error(errorMessage));
          return;
        }
        const parsedOutput =
          typeof stdout === "string" || Buffer.isBuffer(stdout) ? stdout.toString() : JSON.stringify(stdout);
        resolve(parsedOutput);
      });
    });

    const lines = stdoutValue.split(/\r?\n/);
    const values: number[] = [];
    const EMPTY_STRING_LENGTH = 0;
    const PIPE_TRAILER_LENGTH = 1;
    const FIRST_INDEX = 0;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed.length === EMPTY_STRING_LENGTH) {
        continue;
      }
      const cleaned = trimmed.endsWith("|")
        ? trimmed.slice(FIRST_INDEX, Math.max(FIRST_INDEX, trimmed.length - PIPE_TRAILER_LENGTH))
        : trimmed;
      const parsed = parseFloat(cleaned);
      if (Number.isFinite(parsed)) {
        values.push(parsed);
      }
    }

    const NO_VALUES = 0;
    if (values.length === NO_VALUES) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const EVEN_DIVISOR = 2;
    const EVEN_REMAINDER = 0;
    const PREVIOUS_OFFSET = 1;
    const DEFAULT_MEDIAN = 0;
    const middleIndex = Math.floor(sorted.length / EVEN_DIVISOR);
    let median: number = sorted[middleIndex] ?? sorted[FIRST_INDEX] ?? DEFAULT_MEDIAN;
    const hasEvenLength = sorted.length % EVEN_DIVISOR === EVEN_REMAINDER;
    if (hasEvenLength) {
      const previousIndex = middleIndex - PREVIOUS_OFFSET;
      const lowerValue: number = sorted[previousIndex] ?? median;
      const upperValue: number = sorted[middleIndex] ?? lowerValue;
      median = (lowerValue + upperValue) / EVEN_DIVISOR;
    }
    const INITIAL_SUM = 0;
    const sum = values.reduce((acc, value) => acc + value, INITIAL_SUM);
    const mean = sum / values.length;
    const variance = values.reduce((acc, value) => {
      const delta = value - mean;
      const squaredDelta = delta * delta;
      return acc + squaredDelta;
    }, INITIAL_SUM);
    const standardDeviation = Math.sqrt(variance / values.length);

    return {
      frameCount: values.length,
      median,
      standardDeviation
    };
  } catch {
    return null;
  }
}

/**
 * Extracts metadata from a video file in the given directory.
 * Returns null if the video file does not exist or metadata cannot be parsed.
 * Caches results in videoMetadata.json to avoid redundant processing.
 */
export async function extractVideoMetadata(dirPath: string): Promise<VideoMetadata | null> {
  const metaCachePath = path.join(dirPath, "videoMetadata.json");
  const JSON_INDENT = 2;
  const EMPTY_STRING_LENGTH = 0;
  const POSITIVE_MIN = 0;
  const isPositiveNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > POSITIVE_MIN;

  // 1. Check Cache
  if (fs.existsSync(metaCachePath)) {
    try {
      const cachedContent = fs.readFileSync(metaCachePath, "utf-8");
      const cachedData = JSON.parse(cachedContent) as VideoMetadata;
      const hasBitrate = typeof cachedData.bitrate === "number" && !Number.isNaN(cachedData.bitrate);
      const hasCodec = typeof cachedData.codecName === "string";
      const hasProfile = typeof cachedData.profile === "string";
      const hasLevel = typeof cachedData.level === "number" && !Number.isNaN(cachedData.level);
      const hasBFrames = typeof cachedData.bFrames === "number" && !Number.isNaN(cachedData.bFrames);
      const hasRefs = typeof cachedData.refs === "number" && !Number.isNaN(cachedData.refs);
      const hasGop = isPositiveNumber(cachedData.gopSize);
      const hasAvgGop = isPositiveNumber(cachedData.avgGopDistance);
      const hasMaxGop = isPositiveNumber(cachedData.maxGopDistance);
      const hasMinGop = isPositiveNumber(cachedData.minGopDistance);
      const hasGopVariance = typeof cachedData.gopVariance === "number" && !Number.isNaN(cachedData.gopVariance);
      const hasColorTransfer = typeof cachedData.colorTransfer === "string";
      const hasColorRange = typeof cachedData.colorRange === "string";
      const hasColorSpace = typeof cachedData.colorSpace === "string";
      const hasPixelFormat = typeof cachedData.pixelFormat === "string";
      const hasBitDepth = typeof cachedData.bitDepth === "number" && !Number.isNaN(cachedData.bitDepth);
      const hasEntropyCoding =
        typeof cachedData.entropyCoding === "string" && cachedData.entropyCoding.length > EMPTY_STRING_LENGTH;
      const hasLaplacianMedian =
        typeof cachedData.laplacianMedian === "number" && !Number.isNaN(cachedData.laplacianMedian);
      const hasLaplacianStdDev =
        typeof cachedData.laplacianStdDev === "number" && !Number.isNaN(cachedData.laplacianStdDev);
      const hasLaplacianSampleCount =
        typeof cachedData.laplacianSampleCount === "number" && !Number.isNaN(cachedData.laplacianSampleCount);
      if (
        cachedData.creationTime !== undefined &&
        hasBitrate &&
        hasProfile &&
        hasLevel &&
        hasBFrames &&
        hasRefs &&
        hasGop &&
        hasAvgGop &&
        hasMaxGop &&
        hasMinGop &&
        hasGopVariance &&
        hasCodec &&
        hasColorTransfer &&
        hasColorRange &&
        hasColorSpace &&
        hasPixelFormat &&
        hasBitDepth &&
        hasEntropyCoding &&
        hasLaplacianMedian &&
        hasLaplacianStdDev &&
        hasLaplacianSampleCount
      ) {
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
      const fpsForGop = result.fps > POSITIVE_MIN ? result.fps : DEFAULT_FPS_FOR_GOP;
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

      const finalEntropyLength = (result.entropyCoding ?? DEFAULT_ENTROPY).length;
      if (finalEntropyLength === DEFAULT_ENTROPY.length) {
        result.entropyCoding = UNKNOWN_ENTROPY;
      }

      if (format.tags?.["creation_time"] !== undefined) {
        result.creationTime = String(format.tags["creation_time"]);
      }

      // Persist to cache
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
