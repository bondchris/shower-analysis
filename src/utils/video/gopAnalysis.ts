import { BYTES_PER_MEGABYTE, runFfprobe } from "./ffprobeUtils";

export function parseTimestamp(value: unknown): number | null {
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
}

export interface KeyframeEntry {
  key_frame?: number;
  pict_type?: string;
  pkt_pts_time?: string | number;
  best_effort_timestamp_time?: string | number;
}

export function resolveFrameTime(frame: KeyframeEntry, fallbackTime: number): number {
  const bestEffortTime = parseTimestamp(frame.best_effort_timestamp_time);
  if (bestEffortTime !== null) {
    return bestEffortTime;
  }
  const ptsTime = parseTimestamp(frame.pkt_pts_time);
  if (ptsTime !== null) {
    return ptsTime;
  }
  return fallbackTime;
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
  const KEYFRAME_BUFFER_MB = 20;
  const KEYFRAME_MAX_BUFFER = KEYFRAME_BUFFER_MB * BYTES_PER_MEGABYTE;

  try {
    const parsedOutput = await runFfprobe(ffprobeArgs, KEYFRAME_MAX_BUFFER);
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
    const INITIAL_FRAME_TIME_SECONDS = 0;
    const framesPerSecond = Number.isFinite(fps) && fps >= MIN_FPS ? fps : DEFAULT_FPS;
    let lastIFrameTime: number | null = null;

    for (const frame of frames) {
      const pictType = typeof frame.pict_type === "string" ? frame.pict_type.toUpperCase() : "";
      const isKeyFrame = frame.key_frame === keyFrameFlag || pictType === "I";
      if (!isKeyFrame) {
        continue;
      }
      const frameIntervalSeconds = minIntervalLength / framesPerSecond;
      const sequentialTimeFallback =
        lastIFrameTime === null ? INITIAL_FRAME_TIME_SECONDS : lastIFrameTime + frameIntervalSeconds;
      const time = resolveFrameTime(frame, sequentialTimeFallback);
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

export function calculateGopStatistics(
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

export interface GopStatistics {
  average: number;
  max: number;
  min: number;
  variance: number;
}

export async function getGopStatistics(
  videoPath: string,
  gopSizeFromStream: number,
  fps: number
): Promise<GopStatistics> {
  const intervals = await getKeyframeIntervals(videoPath, fps);
  return calculateGopStatistics(intervals, gopSizeFromStream);
}
