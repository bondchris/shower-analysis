import { getHorizontalForward, getPhonePanAngle, getPhoneRollAngle, getPhoneTiltAngle } from "../../math/transform";
import { ValidFrame } from "./framerateMetrics";

const BINS_PER_DEGREE = 10;
const MAX_ANGLE_DEGREES = 180;
const MAX_BIN_INDEX = MAX_ANGLE_DEGREES * BINS_PER_DEGREE;
const HISTOGRAM_SIZE_OFFSET = 1;
const HISTOGRAM_BIN_COUNT = MAX_BIN_INDEX + HISTOGRAM_SIZE_OFFSET;
const PAN_HISTOGRAM_BIN_COUNT = 3601;

/**
 * Angular histogram and velocity metrics.
 */
export interface AngularMetrics {
  fastTimings: number[];
  histogram: number[];
  leftOverflow: number;
  maxSpeed: number;
  rightOverflow: number;
}

/**
 * Configuration for angular histogram and velocity computation.
 */
interface AngularMetricsConfig {
  binsPerDegree: number;
  handleWraparound: boolean;
  hasOverflow: boolean;
  histogramSize: number;
  maxBinIndex: number;
}

/**
 * Overflow range configuration for angles outside the main histogram range.
 * Used for tilt/roll to capture phone upside-down states.
 */
interface OverflowConfig {
  leftMax: number;
  leftMin: number;
  rightMax: number;
  rightMin: number;
}

/**
 * Function type for extracting angle from a camera transform.
 * Context (like initial forward direction for pan) should be captured in closure.
 */
type AngleExtractor = (transform: number[]) => number;

/**
 * Standard overflow ranges for tilt and roll histograms.
 * Right overflow: 180-270° (phone tilting backward past vertical)
 * Left overflow: 270-360° (phone upside-down)
 */
const STANDARD_OVERFLOW_CONFIG: OverflowConfig = {
  leftMax: 360,
  leftMin: 270,
  rightMax: 270,
  rightMin: 180
};

/**
 * Configuration for tilt/roll histograms (0-180° range with overflow).
 */
const TILT_ROLL_CONFIG: AngularMetricsConfig = {
  binsPerDegree: BINS_PER_DEGREE,
  handleWraparound: false,
  hasOverflow: true,
  histogramSize: HISTOGRAM_BIN_COUNT,
  maxBinIndex: MAX_BIN_INDEX
};

/**
 * Configuration for pan histogram (full 360° range, no overflow).
 */
const PAN_CONFIG: AngularMetricsConfig = {
  binsPerDegree: 10,
  handleWraparound: true,
  hasOverflow: false,
  histogramSize: PAN_HISTOGRAM_BIN_COUNT,
  maxBinIndex: 3600
};

/**
 * Generic function to compute angular histogram and velocity metrics.
 * Handles tilt, roll, and pan with different configurations.
 *
 * @param validFrames - Array of frames with camera transforms and timestamps
 * @param totalDuration - Total scan duration in seconds
 * @param extractAngle - Function to extract angle from camera transform (context captured in closure)
 * @param config - Histogram and velocity configuration
 * @param overflowConfig - Optional overflow ranges for tilt/roll
 */
function computeAngularMetrics(
  validFrames: ValidFrame[],
  totalDuration: number,
  extractAngle: AngleExtractor,
  config: AngularMetricsConfig,
  overflowConfig?: OverflowConfig
): AngularMetrics {
  const defaultNumeric = 0;
  const minBinIndex = 0;
  const incrementValue = 1;

  const histogram = new Array<number>(config.histogramSize).fill(defaultNumeric);
  let leftOverflow = defaultNumeric;
  let rightOverflow = defaultNumeric;
  const angleData: { timestamp: number; angle: number }[] = [];

  for (const frame of validFrames) {
    const angle = extractAngle(frame.cameraTransform);
    angleData.push({ angle, timestamp: frame.timestamp });

    const binIndex = Math.round(angle * config.binsPerDegree);
    if (binIndex >= minBinIndex && binIndex <= config.maxBinIndex) {
      const currentCount = histogram[binIndex] ?? defaultNumeric;
      histogram[binIndex] = currentCount + incrementValue;
    } else if (config.hasOverflow && overflowConfig !== undefined) {
      if (angle > overflowConfig.rightMin && angle <= overflowConfig.rightMax) {
        rightOverflow++;
      } else if (angle > overflowConfig.leftMin && angle <= overflowConfig.leftMax) {
        leftOverflow++;
      }
    }
  }

  const velocityResult = computeAngularVelocity(angleData, totalDuration, config.handleWraparound);

  return {
    fastTimings: velocityResult.fastTimings,
    histogram,
    leftOverflow,
    maxSpeed: velocityResult.maxSpeed,
    rightOverflow
  };
}

/**
 * Computes tilt angle histogram and angular velocity metrics.
 * Tilt measures phone pitch (forward/backward tilt from vertical).
 * Overflow bins capture angles outside the 0-180° range (phone upside-down states).
 */
export function computeTiltMetrics(validFrames: ValidFrame[], totalDuration: number): AngularMetrics {
  const extractTiltAngle: AngleExtractor = (transform) => getPhoneTiltAngle(transform);
  return computeAngularMetrics(
    validFrames,
    totalDuration,
    extractTiltAngle,
    TILT_ROLL_CONFIG,
    STANDARD_OVERFLOW_CONFIG
  );
}

/**
 * Computes roll angle histogram and angular velocity metrics.
 * Roll measures phone rotation around its forward axis (tilting left/right).
 */
export function computeRollMetrics(validFrames: ValidFrame[], totalDuration: number): AngularMetrics {
  const extractRollAngle: AngleExtractor = (transform) => getPhoneRollAngle(transform);
  return computeAngularMetrics(
    validFrames,
    totalDuration,
    extractRollAngle,
    TILT_ROLL_CONFIG,
    STANDARD_OVERFLOW_CONFIG
  );
}

/**
 * Computes pan angle histogram and angular velocity metrics.
 * Pan measures horizontal rotation relative to initial forward direction.
 * Uses wraparound handling for the 0°/360° boundary.
 */
export function computePanMetrics(validFrames: ValidFrame[], totalDuration: number): AngularMetrics {
  const defaultForwardX = 0;
  const defaultForwardZ = -1;
  let initialForwardX = defaultForwardX;
  let initialForwardZ = defaultForwardZ;

  const firstFrameIndex = 0;
  const firstFrame = validFrames[firstFrameIndex];
  if (firstFrame !== undefined) {
    const initialForward = getHorizontalForward(firstFrame.cameraTransform);
    initialForwardX = initialForward.forwardX;
    initialForwardZ = initialForward.forwardZ;
  }

  const extractPanAngle: AngleExtractor = (transform) => getPhonePanAngle(transform, initialForwardX, initialForwardZ);

  return computeAngularMetrics(validFrames, totalDuration, extractPanAngle, PAN_CONFIG);
}

/**
 * Computes maximum angular velocity using a 5-second sliding window.
 * Also tracks when fast rotations (>5°/s) occur as percentages of scan progress.
 *
 * @param angleData - Array of timestamp/angle pairs
 * @param totalDuration - Total scan duration in seconds
 * @param handleWraparound - If true, handles 0°/360° wraparound for pan angles
 */
function computeAngularVelocity(
  angleData: { timestamp: number; angle: number }[],
  totalDuration: number,
  handleWraparound: boolean
): { maxSpeed: number; fastTimings: number[] } {
  const initialValue = 0;
  const prevOffset = 1;
  const nextOffset = 1;
  const midpointDivisor = 2;
  const percentMultiplier = 100;
  const halfCircleDegrees = 180;
  const fullCircleDegrees = 360;

  const windowDurationSeconds = 5;
  const minWindowDurationFraction = 0.9;
  const fastThresholdDegreesPerSec = 5;
  const minFramesForWindow = 2;

  if (angleData.length < minFramesForWindow) {
    return { fastTimings: [], maxSpeed: initialValue };
  }

  let maxAngularVelocity = -Infinity;
  let foundValidWindow = false;
  const fastTimings: number[] = [];

  for (let startIdx = initialValue; startIdx < angleData.length; startIdx++) {
    const startFrame = angleData[startIdx];
    if (startFrame === undefined) {
      continue;
    }
    const windowEndTime = startFrame.timestamp + windowDurationSeconds;

    let endIdx = startIdx;
    for (let j = startIdx + nextOffset; j < angleData.length; j++) {
      const candidateFrame = angleData[j];
      if (candidateFrame !== undefined && candidateFrame.timestamp <= windowEndTime) {
        endIdx = j;
      } else {
        break;
      }
    }

    if (endIdx > startIdx) {
      const endFrame = angleData[endIdx];
      if (endFrame !== undefined) {
        const windowDuration = endFrame.timestamp - startFrame.timestamp;
        const minRequiredDuration = windowDurationSeconds * minWindowDurationFraction;

        if (windowDuration >= minRequiredDuration) {
          let totalAngularChange = initialValue;
          for (let i = startIdx + nextOffset; i <= endIdx; i++) {
            const prevFrame = angleData[i - prevOffset];
            const currFrame = angleData[i];
            if (prevFrame !== undefined && currFrame !== undefined) {
              let angleDiff = Math.abs(currFrame.angle - prevFrame.angle);
              if (handleWraparound) {
                if (angleDiff > halfCircleDegrees) {
                  angleDiff = fullCircleDegrees - angleDiff;
                }
              }
              totalAngularChange += angleDiff;
            }
          }

          const angularVelocity = totalAngularChange / windowDuration;
          maxAngularVelocity = Math.max(maxAngularVelocity, angularVelocity);
          foundValidWindow = true;

          if (angularVelocity > fastThresholdDegreesPerSec && totalDuration > initialValue) {
            const windowCenterTime = (startFrame.timestamp + endFrame.timestamp) / midpointDivisor;
            const percentage = (windowCenterTime / totalDuration) * percentMultiplier;
            fastTimings.push(percentage);
          }
        }
      }
    }
  }

  return {
    fastTimings,
    maxSpeed: foundValidWindow ? maxAngularVelocity : initialValue
  };
}
