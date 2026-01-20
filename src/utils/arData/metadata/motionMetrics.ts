import { Position3D, distance3D, getPosition3D } from "../../math/transform";
import { ValidFrame } from "./framerateMetrics";

/**
 * Motion and speed statistics computed from camera positions.
 */
export interface MotionMetrics {
  avgSpeed: number;
  maxSpeed: number;
  minSpeed: number;
  totalDisplacement: number;
  totalDistanceTraveled: number;
}

/**
 * Frame position data for motion calculations.
 */
interface FramePosition {
  position: Position3D;
  timestamp: number;
}

/**
 * Builds an array of frame positions from valid frames.
 */
function buildFramePositions(validFrames: ValidFrame[]): FramePosition[] {
  return validFrames.map((frame) => ({
    position: getPosition3D(frame.cameraTransform),
    timestamp: frame.timestamp
  }));
}

/**
 * Computes cumulative distances for sliding window speed calculations.
 * Returns an array where distances[i] is the total distance from frame 0 to frame i.
 */
function buildCumulativeDistances(framePositions: FramePosition[]): number[] {
  const initialValue = 0;
  const distances: number[] = [initialValue];
  let cumulative = initialValue;
  let prevPosition: Position3D | null = null;

  for (const frame of framePositions) {
    if (prevPosition !== null) {
      cumulative += distance3D(prevPosition, frame.position);
      distances.push(cumulative);
    }
    prevPosition = frame.position;
  }

  return distances;
}

/**
 * Finds the end index for a sliding window starting at startIdx.
 * Returns the largest index where the timestamp is within windowDuration of start.
 */
function findWindowEndIndex(
  framePositions: FramePosition[],
  startIdx: number,
  startTimestamp: number,
  windowDuration: number
): number {
  const nextOffset = 1;
  const windowEndTime = startTimestamp + windowDuration;

  let endIdx = startIdx;
  for (let j = startIdx + nextOffset; j < framePositions.length; j++) {
    const candidate = framePositions[j];
    if (candidate !== undefined && candidate.timestamp <= windowEndTime) {
      endIdx = j;
    } else {
      break;
    }
  }

  return endIdx;
}

/**
 * Computes distance, displacement, and speed metrics from camera positions.
 * Uses a 5-second sliding window for min/max speed calculations.
 */
export function computeMotionMetrics(validFrames: ValidFrame[], totalDuration: number): MotionMetrics {
  const initialValue = 0;
  const metersToFeet = 3.28084;
  const minFramesForDistance = 2;
  const windowDurationSeconds = 5;
  const minWindowDurationFraction = 0.9;

  const result: MotionMetrics = {
    avgSpeed: initialValue,
    maxSpeed: initialValue,
    minSpeed: initialValue,
    totalDisplacement: initialValue,
    totalDistanceTraveled: initialValue
  };

  if (validFrames.length < minFramesForDistance) {
    return result;
  }

  const framePositions = buildFramePositions(validFrames);

  // Compute total distance and track first/last positions
  let totalDistanceMeters = initialValue;
  let firstPosition: Position3D | null = null;
  let lastPosition: Position3D | null = null;
  let prevPosition: Position3D | null = null;

  for (const frame of framePositions) {
    firstPosition ??= frame.position;
    lastPosition = frame.position;

    if (prevPosition !== null) {
      totalDistanceMeters += distance3D(prevPosition, frame.position);
    }
    prevPosition = frame.position;
  }

  result.totalDistanceTraveled = totalDistanceMeters * metersToFeet;

  if (firstPosition !== null && lastPosition !== null) {
    result.totalDisplacement = distance3D(firstPosition, lastPosition) * metersToFeet;
  }

  if (totalDuration > initialValue) {
    result.avgSpeed = result.totalDistanceTraveled / totalDuration;
  }

  // Compute min/max speed using sliding windows
  const cumulativeDistances = buildCumulativeDistances(framePositions);

  let minSpeedMetersPerSec = Infinity;
  let maxSpeedMetersPerSec = -Infinity;
  let foundValidWindow = false;

  for (const [startIdx, startFrame] of framePositions.entries()) {
    const endIdx = findWindowEndIndex(framePositions, startIdx, startFrame.timestamp, windowDurationSeconds);

    if (endIdx > startIdx) {
      const endFrame = framePositions[endIdx];
      if (endFrame !== undefined) {
        const windowDuration = endFrame.timestamp - startFrame.timestamp;

        const minRequiredDuration = windowDurationSeconds * minWindowDurationFraction;
        if (windowDuration >= minRequiredDuration) {
          const startCumulative = cumulativeDistances[startIdx] ?? initialValue;
          const endCumulative = cumulativeDistances[endIdx] ?? initialValue;
          const windowDistance = endCumulative - startCumulative;
          const speed = windowDistance / windowDuration;
          minSpeedMetersPerSec = Math.min(minSpeedMetersPerSec, speed);
          maxSpeedMetersPerSec = Math.max(maxSpeedMetersPerSec, speed);
          foundValidWindow = true;
        }
      }
    }
  }

  if (foundValidWindow) {
    result.minSpeed = minSpeedMetersPerSec * metersToFeet;
    result.maxSpeed = maxSpeedMetersPerSec * metersToFeet;
  }

  return result;
}
