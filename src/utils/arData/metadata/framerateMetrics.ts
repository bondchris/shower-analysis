import { ArData } from "../../../models/arData/arData";

/**
 * Framerate and dropped frame statistics.
 */
export interface FramerateMetrics {
  arDataFramerate: number;
  droppedArFrameCount: number;
  droppedArFramePercentage: number;
  hasDroppedArFrames: boolean;
  totalScanDurationSeconds: number;
}

/**
 * A validated frame with camera transform data.
 */
export interface ValidFrame {
  cameraTransform: number[];
  timestamp: number;
}

/**
 * Parses and sorts all timestamp keys from AR data.
 * Returns an array of numeric timestamps in ascending order.
 * Filters out any non-numeric or NaN values for robustness.
 */
export function getSortedTimestamps(arData: ArData): number[] {
  return Object.keys(arData.data)
    .map((k) => parseFloat(k))
    .filter((t): t is number => typeof t === "number" && !isNaN(t))
    .sort((a, b) => a - b);
}

/**
 * Computes framerate and detects dropped frames from AR data timestamps.
 * Dropped frames are detected when any interval exceeds 1.5x the median interval.
 */
export function computeFramerateMetrics(sortedTimestamps: number[]): FramerateMetrics {
  const initialValue = 0;
  const firstIndex = 0;
  const lastIndexOffset = 1;
  const prevOffset = 1;
  const midpointDivisor = 2;
  const percentMultiplier = 100;

  const result: FramerateMetrics = {
    arDataFramerate: initialValue,
    droppedArFrameCount: initialValue,
    droppedArFramePercentage: initialValue,
    hasDroppedArFrames: false,
    totalScanDurationSeconds: initialValue
  };

  const minFramesForFramerate = 2;

  if (sortedTimestamps.length < minFramesForFramerate) {
    return result;
  }

  const firstTimestamp = sortedTimestamps[firstIndex];
  const lastTimestamp = sortedTimestamps[sortedTimestamps.length - lastIndexOffset];

  if (firstTimestamp === undefined || lastTimestamp === undefined) {
    return result;
  }

  const totalDuration = lastTimestamp - firstTimestamp;
  const frameCount = sortedTimestamps.length - lastIndexOffset;

  if (totalDuration <= initialValue || frameCount <= initialValue) {
    return result;
  }

  result.arDataFramerate = frameCount / totalDuration;
  result.totalScanDurationSeconds = totalDuration;

  const minIntervalsForDroppedCheck = 3;
  if (sortedTimestamps.length >= minIntervalsForDroppedCheck) {
    const intervals: number[] = [];
    for (let i = lastIndexOffset; i < sortedTimestamps.length; i++) {
      const prev = sortedTimestamps[i - prevOffset];
      const curr = sortedTimestamps[i];
      if (prev !== undefined && curr !== undefined) {
        intervals.push(curr - prev);
      }
    }

    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const midIndex = Math.floor(sortedIntervals.length / midpointDivisor);
    const median = sortedIntervals[midIndex];

    if (median !== undefined) {
      const droppedFrameThreshold = 1.5;
      const threshold = median * droppedFrameThreshold;
      const droppedFrameCount = intervals.filter((interval) => interval > threshold).length;

      result.hasDroppedArFrames = droppedFrameCount > initialValue;
      result.droppedArFrameCount = droppedFrameCount;
      result.droppedArFramePercentage = (droppedFrameCount / intervals.length) * percentMultiplier;
    }
  }

  return result;
}

/**
 * Builds a sorted array of valid frames with camera transforms from AR data.
 * Uses pre-sorted timestamps to avoid redundant sorting.
 * Defensively skips any non-numeric timestamp values.
 */
export function buildValidFrames(arData: ArData, sortedTimestamps: number[]): ValidFrame[] {
  const validFrames: ValidFrame[] = [];

  for (const timestamp of sortedTimestamps) {
    if (typeof timestamp !== "number") {
      continue;
    }
    const frame = arData.data[timestamp.toString()];
    if (frame !== undefined && Array.isArray(frame.cameraTransform)) {
      validFrames.push({
        cameraTransform: frame.cameraTransform,
        timestamp
      });
    }
  }

  return validFrames;
}
