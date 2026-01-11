import * as fs from "fs";
import * as path from "path";

import { ArData } from "../../models/arData/arData";
import { CoverageSphere, computeSphericalCoverage } from "./coverage";
import {
  distance3D,
  getHorizontalForward,
  getPhonePanAngle,
  getPhoneRollAngle,
  getPhoneTiltAngle,
  getPosition3D
} from "../math/transform";

export interface ArDataMetadata {
  lensModel: string;
  deviceModel: string;
  lensFocalLength: string;
  lensAperture: string;
  timezone: string;
  scanDateTime: string;
  avgAmbientIntensity: number;
  minAmbientIntensity: number;
  maxAmbientIntensity: number;
  avgColorTemperature: number;
  minColorTemperature: number;
  maxColorTemperature: number;
  avgIso: number;
  minIso: number;
  maxIso: number;
  avgBrightness: number;
  minBrightness: number;
  maxBrightness: number;
  arDataFramerate: number;
  hasDroppedArFrames: boolean;
  droppedArFrameCount: number;
  droppedArFramePercentage: number;
  totalDistanceTraveled: number;
  totalDisplacement: number;
  totalScanDurationSeconds: number;
  avgSpeed: number;
  minSpeed: number;
  maxSpeed: number;
  phoneTiltHistogram: number[];
  phoneTiltLeftOverflow: number;
  phoneTiltRightOverflow: number;
  tiltCalculationVersion: number;
  maxTiltSpeed: number;
  fastTiltTimings: number[];
  phoneRollHistogram: number[];
  phoneRollLeftOverflow: number;
  phoneRollRightOverflow: number;
  rollCalculationVersion: number;
  maxRollSpeed: number;
  fastRollTimings: number[];
  phonePanHistogram: number[];
  panCalculationVersion: number;
  maxPanSpeed: number;
  fastPanTimings: number[];
  coverageSphere?: CoverageSphere;
  coverageSphereCalculationVersion?: number;
}

const BINS_PER_DEGREE = 10;
const MAX_ANGLE_DEGREES = 180;
const MAX_BIN_INDEX = MAX_ANGLE_DEGREES * BINS_PER_DEGREE;
const HISTOGRAM_SIZE_OFFSET = 1;
const HISTOGRAM_BIN_COUNT = MAX_BIN_INDEX + HISTOGRAM_SIZE_OFFSET;
const EXPECTED_HISTOGRAM_SIZE = HISTOGRAM_BIN_COUNT;
const TILT_CALCULATION_VERSION = 2;
const ROLL_CALCULATION_VERSION = 2;
const PAN_CALCULATION_VERSION = 1;
const PAN_HISTOGRAM_BIN_COUNT = 3601;

/**
 * Extracts metadata from an arData.json file in the given directory.
 * Caches results in arDataMetadata.json.
 */
export function extractArDataMetadata(dirPath: string): ArDataMetadata | null {
  const metaCachePath = path.join(dirPath, "arDataMetadata.json");
  const JSON_INDENT = 2;
  const coverageSphereCalculationVersion = 5;

  // 1. Check Cache
  if (fs.existsSync(metaCachePath)) {
    try {
      const cachedContent = fs.readFileSync(metaCachePath, "utf-8");
      const cached = JSON.parse(cachedContent) as ArDataMetadata;
      // Invalidate cache if new fields are missing
      if (
        typeof cached.deviceModel === "string" &&
        typeof cached.timezone === "string" &&
        typeof cached.scanDateTime === "string" &&
        typeof cached.minAmbientIntensity === "number" &&
        typeof cached.maxAmbientIntensity === "number" &&
        typeof cached.minColorTemperature === "number" &&
        typeof cached.maxColorTemperature === "number" &&
        typeof cached.minIso === "number" &&
        typeof cached.maxIso === "number" &&
        typeof cached.minBrightness === "number" &&
        typeof cached.maxBrightness === "number" &&
        typeof cached.arDataFramerate === "number" &&
        typeof cached.hasDroppedArFrames === "boolean" &&
        typeof cached.droppedArFrameCount === "number" &&
        typeof cached.droppedArFramePercentage === "number" &&
        typeof cached.totalDistanceTraveled === "number" &&
        typeof cached.totalDisplacement === "number" &&
        typeof cached.totalScanDurationSeconds === "number" &&
        typeof cached.avgSpeed === "number" &&
        typeof cached.minSpeed === "number" &&
        typeof cached.maxSpeed === "number" &&
        Array.isArray(cached.phoneTiltHistogram) &&
        cached.phoneTiltHistogram.length === EXPECTED_HISTOGRAM_SIZE &&
        typeof cached.phoneTiltLeftOverflow === "number" &&
        typeof cached.phoneTiltRightOverflow === "number" &&
        cached.tiltCalculationVersion === TILT_CALCULATION_VERSION &&
        typeof cached.maxTiltSpeed === "number" &&
        Array.isArray(cached.fastTiltTimings) &&
        Array.isArray(cached.phoneRollHistogram) &&
        cached.phoneRollHistogram.length === EXPECTED_HISTOGRAM_SIZE &&
        typeof cached.phoneRollLeftOverflow === "number" &&
        typeof cached.phoneRollRightOverflow === "number" &&
        cached.rollCalculationVersion === ROLL_CALCULATION_VERSION &&
        typeof cached.maxRollSpeed === "number" &&
        Array.isArray(cached.fastRollTimings) &&
        Array.isArray(cached.phonePanHistogram) &&
        cached.phonePanHistogram.length === PAN_HISTOGRAM_BIN_COUNT &&
        cached.panCalculationVersion === PAN_CALCULATION_VERSION &&
        typeof cached.maxPanSpeed === "number" &&
        Array.isArray(cached.fastPanTimings) &&
        cached.coverageSphereCalculationVersion === coverageSphereCalculationVersion
      ) {
        return cached;
      }
      // Fall through to re-extraction if stale
    } catch {
      // Proceed to extraction
    }
  }

  const arDataPath = path.join(dirPath, "arData.json");
  const INITIAL_COUNT = 0;
  const NOT_SET = "";
  const MIN_VALID_FRAMES = 0;

  if (fs.existsSync(arDataPath)) {
    try {
      const content = fs.readFileSync(arDataPath, "utf-8");
      const json = JSON.parse(content) as unknown;
      const _arData = new ArData(json);
      const frames = Object.values(_arData.data);
      const firstFrame = frames[INITIAL_COUNT];

      const defaultNumeric = 0;
      const result: ArDataMetadata = {
        arDataFramerate: defaultNumeric,
        avgAmbientIntensity: defaultNumeric,
        avgBrightness: defaultNumeric,
        avgColorTemperature: defaultNumeric,
        avgIso: defaultNumeric,
        avgSpeed: defaultNumeric,
        coverageSphereCalculationVersion,
        deviceModel: NOT_SET,
        droppedArFrameCount: defaultNumeric,
        droppedArFramePercentage: defaultNumeric,
        fastPanTimings: [],
        fastRollTimings: [],
        fastTiltTimings: [],
        hasDroppedArFrames: false,
        lensAperture: NOT_SET,
        lensFocalLength: NOT_SET,
        lensModel: NOT_SET,
        maxAmbientIntensity: defaultNumeric,
        maxBrightness: defaultNumeric,
        maxColorTemperature: defaultNumeric,
        maxIso: defaultNumeric,
        maxPanSpeed: defaultNumeric,
        maxRollSpeed: defaultNumeric,
        maxSpeed: defaultNumeric,
        maxTiltSpeed: defaultNumeric,
        minAmbientIntensity: defaultNumeric,
        minBrightness: defaultNumeric,
        minColorTemperature: defaultNumeric,
        minIso: defaultNumeric,
        minSpeed: defaultNumeric,
        panCalculationVersion: PAN_CALCULATION_VERSION,
        phonePanHistogram: new Array<number>(PAN_HISTOGRAM_BIN_COUNT).fill(defaultNumeric),
        phoneRollHistogram: new Array<number>(HISTOGRAM_BIN_COUNT).fill(defaultNumeric),
        phoneRollLeftOverflow: defaultNumeric,
        phoneRollRightOverflow: defaultNumeric,
        phoneTiltHistogram: new Array<number>(HISTOGRAM_BIN_COUNT).fill(defaultNumeric),
        phoneTiltLeftOverflow: defaultNumeric,
        phoneTiltRightOverflow: defaultNumeric,
        rollCalculationVersion: ROLL_CALCULATION_VERSION,
        scanDateTime: NOT_SET,
        tiltCalculationVersion: TILT_CALCULATION_VERSION,
        timezone: NOT_SET,
        totalDisplacement: defaultNumeric,
        totalDistanceTraveled: defaultNumeric,
        totalScanDurationSeconds: defaultNumeric
      };

      if (frames.length > INITIAL_COUNT && firstFrame !== undefined) {
        // Lens Model & Device Info
        const exif = firstFrame.exifData;

        // Timezone offset from EXIF OffsetTime (e.g., "-07:00", "+05:30")
        if (exif.OffsetTime !== undefined && exif.OffsetTime !== NOT_SET) {
          result.timezone = exif.OffsetTime.trim();
        }

        // Scan date/time from EXIF DateTimeOriginal (e.g., "2025:08:01 10:19:39")
        if (exif.DateTimeOriginal !== undefined && exif.DateTimeOriginal !== NOT_SET) {
          result.scanDateTime = exif.DateTimeOriginal.trim();
        }

        // 1. EXIF Focal Length (takes precedence over parsed fallback)
        if (exif.FocalLength !== undefined && exif.FocalLength !== NOT_SET) {
          result.lensFocalLength = exif.FocalLength.trim();
        }

        // 2. EXIF Aperture (FNumber) (e.g. "1.5" or "f/1.5") - normalize and prefer EXIF
        if (exif.FNumber !== undefined && exif.FNumber !== NOT_SET) {
          const trimmedFNumber = exif.FNumber.trim();
          const hasPrefix = trimmedFNumber.toLowerCase().startsWith("f/");
          const parsedFNumber = parseFloat(trimmedFNumber);
          result.lensAperture = !hasPrefix && !isNaN(parsedFNumber) ? `f/${trimmedFNumber}` : trimmedFNumber;
        }

        // 3. Lens Model -> Device Model (e.g. "iPhone 13 Pro")
        const rawModel = exif.LensModel;
        if (rawModel !== undefined && rawModel !== NOT_SET) {
          result.lensModel = rawModel;
          // Parse "iPhone 13 Pro back triple camera 5.7mm f/1.5"
          // Default regex for device model
          const DEVICE_MODEL_GROUP = 1;
          const deviceRegex = /^(.+?)\s+(?:front|back)/i;
          const matchDevice = deviceRegex.exec(rawModel);

          if (matchDevice !== null && typeof matchDevice[DEVICE_MODEL_GROUP] === "string") {
            result.deviceModel = matchDevice[DEVICE_MODEL_GROUP].trim();
          } else {
            result.deviceModel = rawModel;
          }

          // Parse Focal Length from string if missing or to augment
          // Looks for "5.7mm" or "5.7 mm"
          // Note: Capture "5.7" as group 1
          const CAPTURE_GROUP_INDEX = 1;
          const focalRegex = /([\d.]+)\s*mm/i;
          const matchFocal = focalRegex.exec(rawModel);
          if (matchFocal?.[CAPTURE_GROUP_INDEX] !== undefined) {
            // If EXIF missing, use this
            if (result.lensFocalLength === NOT_SET) {
              result.lensFocalLength = `${matchFocal[CAPTURE_GROUP_INDEX]} mm`;
            }
          }

          // Parse Aperture from string
          // Looks for "f/1.5" or "f1.5"
          const apertureRegex = /f\/?([\d.]+)/i;
          const matchAperture = apertureRegex.exec(rawModel);
          if (matchAperture?.[CAPTURE_GROUP_INDEX] !== undefined) {
            if (result.lensAperture === NOT_SET) {
              result.lensAperture = `f/${matchAperture[CAPTURE_GROUP_INDEX]}`;
            }
          }
        }
      }

      // Calculate Averages, Minimum, and Maximum for all metrics
      let totalIntensity = 0;
      let totalTemperature = 0;
      let lightCount = 0;
      let minIntensity = Infinity;
      let maxIntensity = -Infinity;
      let minTemperature = Infinity;
      let maxTemperature = -Infinity;

      let totalISO = 0;
      let isoCount = 0;
      let minIso = Infinity;
      let maxIso = -Infinity;

      let totalBrightness = 0;
      let brightnessCount = 0;
      let minBrightness = Infinity;
      let maxBrightness = -Infinity;

      for (const frame of frames) {
        if (frame.lightEstimate) {
          const intensity = frame.lightEstimate.ambientIntensity;
          const temperature = frame.lightEstimate.ambientColorTemperature;
          totalIntensity += intensity;
          totalTemperature += temperature;
          lightCount++;
          if (intensity < minIntensity) {
            minIntensity = intensity;
          }
          if (intensity > maxIntensity) {
            maxIntensity = intensity;
          }
          if (temperature < minTemperature) {
            minTemperature = temperature;
          }
          if (temperature > maxTemperature) {
            maxTemperature = temperature;
          }
        }

        const isoRatings = frame.exifData.ISOSpeedRatings;
        if (isoRatings !== undefined && isoRatings !== NOT_SET) {
          const isoStr = isoRatings.replace(/[^0-9.]/g, "");
          const isoVal = parseFloat(isoStr);
          if (!isNaN(isoVal)) {
            totalISO += isoVal;
            isoCount++;
            if (isoVal < minIso) {
              minIso = isoVal;
            }
            if (isoVal > maxIso) {
              maxIso = isoVal;
            }
          }
        }

        const brightness = frame.exifData.BrightnessValue;
        if (brightness !== undefined && brightness !== NOT_SET) {
          const briVal = parseFloat(brightness);
          if (!isNaN(briVal)) {
            totalBrightness += briVal;
            brightnessCount++;
            if (briVal < minBrightness) {
              minBrightness = briVal;
            }
            if (briVal > maxBrightness) {
              maxBrightness = briVal;
            }
          }
        }
      }

      if (lightCount > MIN_VALID_FRAMES) {
        result.avgAmbientIntensity = totalIntensity / lightCount;
        result.avgColorTemperature = totalTemperature / lightCount;
        result.minAmbientIntensity = minIntensity;
        result.maxAmbientIntensity = maxIntensity;
        result.minColorTemperature = minTemperature;
        result.maxColorTemperature = maxTemperature;
      }

      if (isoCount > MIN_VALID_FRAMES) {
        result.avgIso = totalISO / isoCount;
        result.minIso = minIso;
        result.maxIso = maxIso;
      }

      if (brightnessCount > MIN_VALID_FRAMES) {
        result.avgBrightness = totalBrightness / brightnessCount;
        result.minBrightness = minBrightness;
        result.maxBrightness = maxBrightness;
      }

      // Calculate AR Data Framerate from timestamps
      // Uses the relative timestamp keys (seconds from start) to compute average interval
      const minFramesForFramerate = 2;
      const firstIndex = 0;
      const lastIndexOffset = 1;
      const minDuration = 0;
      const minFrameCount = 0;
      if (frames.length >= minFramesForFramerate) {
        const relativeTimestamps = Object.keys(_arData.data)
          .map((k) => parseFloat(k))
          .filter((t) => !isNaN(t))
          .sort((a, b) => a - b);
        if (relativeTimestamps.length >= minFramesForFramerate) {
          const firstTimestamp = relativeTimestamps[firstIndex];
          const lastTimestamp = relativeTimestamps[relativeTimestamps.length - lastIndexOffset];
          if (firstTimestamp !== undefined && lastTimestamp !== undefined) {
            const totalDuration = lastTimestamp - firstTimestamp;
            const frameCount = relativeTimestamps.length - lastIndexOffset;
            if (totalDuration > minDuration && frameCount > minFrameCount) {
              result.arDataFramerate = frameCount / totalDuration;
              result.totalScanDurationSeconds = totalDuration;

              // Detect dropped frames by checking if any interval exceeds 1.5x the median
              const minIntervalsForDroppedCheck = 3;
              const secondFrameIndex = 1;
              if (relativeTimestamps.length >= minIntervalsForDroppedCheck) {
                const intervals: number[] = [];
                for (let i = secondFrameIndex; i < relativeTimestamps.length; i++) {
                  const prev = relativeTimestamps[i - secondFrameIndex];
                  const curr = relativeTimestamps[i];
                  if (prev !== undefined && curr !== undefined) {
                    intervals.push(curr - prev);
                  }
                }
                const midpointDivisor = 2;
                const sortedIntervals = [...intervals].sort((a, b) => a - b);
                const midIndex = Math.floor(sortedIntervals.length / midpointDivisor);
                const median = sortedIntervals[midIndex];
                const droppedFrameThreshold = 1.5;
                const noDroppedFrames = 0;
                const percentageMultiplier = 100;
                if (median !== undefined) {
                  const threshold = median * droppedFrameThreshold;
                  const droppedFrameCount = intervals.filter((interval) => interval > threshold).length;
                  result.hasDroppedArFrames = droppedFrameCount > noDroppedFrames;
                  result.droppedArFrameCount = droppedFrameCount;
                  result.droppedArFramePercentage = (droppedFrameCount / intervals.length) * percentageMultiplier;
                }
              }
            }
          }
        }
      }

      // Calculate total distance traveled and displacement from camera transforms
      // Sort frames by timestamp key and sum 3D distances between consecutive positions
      // Displacement is the straight-line distance from first to last position
      // AR data uses meters; convert to feet for display
      const minFramesForDistance = 2;
      const metersToFeet = 3.28084;
      const sortedTimestampKeys = Object.keys(_arData.data)
        .map((k) => parseFloat(k))
        .filter((t): t is number => typeof t === "number" && !isNaN(t))
        .sort((a, b) => a - b);

      if (sortedTimestampKeys.length >= minFramesForDistance) {
        let totalDistanceMeters = 0;
        let prevPosition = null as ReturnType<typeof getPosition3D> | null;
        let firstPosition = null as ReturnType<typeof getPosition3D> | null;
        let lastPosition = null as ReturnType<typeof getPosition3D> | null;

        for (const timestampKey of sortedTimestampKeys) {
          if (typeof timestampKey !== "number") {
            continue;
          }
          const frame = _arData.data[timestampKey.toString()];
          if (frame === undefined || !Array.isArray(frame.cameraTransform)) {
            continue;
          }
          const currentPosition = getPosition3D(frame.cameraTransform);

          firstPosition ??= currentPosition;
          lastPosition = currentPosition;

          if (prevPosition !== null) {
            totalDistanceMeters += distance3D(prevPosition, currentPosition);
          }
          prevPosition = currentPosition;
        }

        result.totalDistanceTraveled = totalDistanceMeters * metersToFeet;

        if (firstPosition !== null && lastPosition !== null) {
          const displacementMeters = distance3D(firstPosition, lastPosition);
          result.totalDisplacement = displacementMeters * metersToFeet;
        }
      }

      // Calculate average speed (distance traveled per second)
      const minDurationForSpeed = 0;
      if (result.totalScanDurationSeconds > minDurationForSpeed) {
        result.avgSpeed = result.totalDistanceTraveled / result.totalScanDurationSeconds;
      }

      // Calculate min/max speed using 5-second sliding window
      // Build array of (timestamp, position) pairs and cumulative distances
      const windowDurationSeconds = 5;
      const frameData: { timestamp: number; position: ReturnType<typeof getPosition3D> }[] = [];

      for (const timestampKey of sortedTimestampKeys) {
        if (typeof timestampKey !== "number") {
          continue;
        }
        const frame = _arData.data[timestampKey.toString()];
        if (frame === undefined || !Array.isArray(frame.cameraTransform)) {
          continue;
        }
        frameData.push({
          position: getPosition3D(frame.cameraTransform),
          timestamp: timestampKey
        });
      }

      const minFramesForWindow = 2;
      const initialCumulativeDistance = 0;
      const loopStartIndex = 1;
      const prevIndexOffset = 1;
      const nextIndexOffset = 1;
      const defaultCumulative = 0;
      const minWindowDurationFraction = 0.9;

      if (frameData.length >= minFramesForWindow) {
        // Build cumulative distance array (distance from start to each frame)
        const cumulativeDistances: number[] = [initialCumulativeDistance];
        for (let i = loopStartIndex; i < frameData.length; i++) {
          const prevFrame = frameData[i - prevIndexOffset];
          const currFrame = frameData[i];
          if (prevFrame !== undefined && currFrame !== undefined) {
            const segmentDistance = distance3D(prevFrame.position, currFrame.position);
            const prevCumulative = cumulativeDistances[i - prevIndexOffset] ?? defaultCumulative;
            cumulativeDistances.push(prevCumulative + segmentDistance);
          }
        }

        // Slide window starting at each frame
        let minSpeedMetersPerSec = Infinity;
        let maxSpeedMetersPerSec = -Infinity;
        let foundValidWindow = false;

        for (let startIdx = initialCumulativeDistance; startIdx < frameData.length; startIdx++) {
          const startFrame = frameData[startIdx];
          if (startFrame === undefined) {
            continue;
          }
          const windowEndTime = startFrame.timestamp + windowDurationSeconds;

          // Find the last frame within the window
          let endIdx = startIdx;
          for (let j = startIdx + nextIndexOffset; j < frameData.length; j++) {
            const candidateFrame = frameData[j];
            if (candidateFrame !== undefined && candidateFrame.timestamp <= windowEndTime) {
              endIdx = j;
            } else {
              break;
            }
          }

          // Need at least 2 frames in window and window must span approximately full duration
          if (endIdx > startIdx) {
            const endFrame = frameData[endIdx];
            if (endFrame !== undefined) {
              const startCumulative = cumulativeDistances[startIdx] ?? defaultCumulative;
              const endCumulative = cumulativeDistances[endIdx] ?? defaultCumulative;
              const windowDistance = endCumulative - startCumulative;
              const windowDuration = endFrame.timestamp - startFrame.timestamp;

              // Only count windows that span at least 90% of the target window duration
              const minRequiredDuration = windowDurationSeconds * minWindowDurationFraction;
              if (windowDuration >= minRequiredDuration) {
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
      }

      // Extract phone tilt angles from all frames and bin into histogram
      // Also collect tilt data for angular velocity calculation
      const minBinIndex = 0;
      const rightOverflowMin = 180;
      const rightOverflowMax = 270;
      const leftOverflowMin = 270;
      const leftOverflowMax = 360;
      const tiltData: { timestamp: number; tiltAngle: number }[] = [];

      for (const timestampKey of sortedTimestampKeys) {
        if (typeof timestampKey !== "number") {
          continue;
        }
        const frame = _arData.data[timestampKey.toString()];
        if (frame === undefined || !Array.isArray(frame.cameraTransform)) {
          continue;
        }
        const tiltAngle = getPhoneTiltAngle(frame.cameraTransform);
        tiltData.push({ tiltAngle, timestamp: timestampKey });

        const binIndex = Math.round(tiltAngle * BINS_PER_DEGREE);
        if (binIndex >= minBinIndex && binIndex <= MAX_BIN_INDEX) {
          const currentCount = result.phoneTiltHistogram[binIndex] ?? defaultNumeric;
          const incrementValue = 1;
          result.phoneTiltHistogram[binIndex] = currentCount + incrementValue;
        } else if (tiltAngle > rightOverflowMin && tiltAngle <= rightOverflowMax) {
          result.phoneTiltRightOverflow++;
        } else if (tiltAngle > leftOverflowMin && tiltAngle <= leftOverflowMax) {
          result.phoneTiltLeftOverflow++;
        }
      }

      // Calculate max tilt speed (angular velocity) using 5-second sliding window
      // Angular velocity is measured as degrees per second
      // Also track when fast tilts (>5 °/s) occur as percentage of scan progress
      const tiltWindowDurationSeconds = 5;
      const minTiltFramesForWindow = 2;
      const minTiltWindowDurationFraction = 0.9;
      const tiltNextIndexOffset = 1;
      const tiltPrevFrameOffset = 1;
      const fastTiltThreshold = 5;
      const percentageMultiplier = 100;
      const midpointDivisor = 2;
      const minDurationForTiltPercentage = 0;

      if (tiltData.length >= minTiltFramesForWindow) {
        let maxAngularVelocity = -Infinity;
        let foundValidTiltWindow = false;
        const fastTiltPercentages: number[] = [];

        for (let startIdx = 0; startIdx < tiltData.length; startIdx++) {
          const startFrame = tiltData[startIdx];
          if (startFrame === undefined) {
            continue;
          }
          const windowEndTime = startFrame.timestamp + tiltWindowDurationSeconds;

          // Find the last frame within the window
          let endIdx = startIdx;
          for (let j = startIdx + tiltNextIndexOffset; j < tiltData.length; j++) {
            const candidateFrame = tiltData[j];
            if (candidateFrame !== undefined && candidateFrame.timestamp <= windowEndTime) {
              endIdx = j;
            } else {
              break;
            }
          }

          // Need at least 2 frames in window and window must span approximately full duration
          if (endIdx > startIdx) {
            const endFrame = tiltData[endIdx];
            if (endFrame !== undefined) {
              const windowDuration = endFrame.timestamp - startFrame.timestamp;

              // Only count windows that span at least 90% of the target window duration
              const minRequiredDuration = tiltWindowDurationSeconds * minTiltWindowDurationFraction;
              if (windowDuration >= minRequiredDuration) {
                // Sum up total angular change within the window
                let totalAngularChange = 0;
                for (let i = startIdx + tiltNextIndexOffset; i <= endIdx; i++) {
                  const prevFrame = tiltData[i - tiltPrevFrameOffset];
                  const currFrame = tiltData[i];
                  if (prevFrame !== undefined && currFrame !== undefined) {
                    const angleDiff = Math.abs(currFrame.tiltAngle - prevFrame.tiltAngle);
                    totalAngularChange += angleDiff;
                  }
                }
                const angularVelocity = totalAngularChange / windowDuration;
                maxAngularVelocity = Math.max(maxAngularVelocity, angularVelocity);
                foundValidTiltWindow = true;

                // Track fast tilt timing as percentage of scan progress
                if (
                  angularVelocity > fastTiltThreshold &&
                  result.totalScanDurationSeconds > minDurationForTiltPercentage
                ) {
                  const windowCenterTime = (startFrame.timestamp + endFrame.timestamp) / midpointDivisor;
                  const percentage = (windowCenterTime / result.totalScanDurationSeconds) * percentageMultiplier;
                  fastTiltPercentages.push(percentage);
                }
              }
            }
          }
        }

        if (foundValidTiltWindow) {
          result.maxTiltSpeed = maxAngularVelocity;
        }
        result.fastTiltTimings = fastTiltPercentages;
      }

      // Extract phone roll angles from all frames and bin into histogram
      // Also collect roll data for angular velocity calculation
      const rollData: { timestamp: number; rollAngle: number }[] = [];

      for (const timestampKey of sortedTimestampKeys) {
        if (typeof timestampKey !== "number") {
          continue;
        }
        const frame = _arData.data[timestampKey.toString()];
        if (frame === undefined || !Array.isArray(frame.cameraTransform)) {
          continue;
        }
        const rollAngle = getPhoneRollAngle(frame.cameraTransform);
        rollData.push({ rollAngle, timestamp: timestampKey });

        const binIndex = Math.round(rollAngle * BINS_PER_DEGREE);
        if (binIndex >= minBinIndex && binIndex <= MAX_BIN_INDEX) {
          const currentCount = result.phoneRollHistogram[binIndex] ?? defaultNumeric;
          const incrementValue = 1;
          result.phoneRollHistogram[binIndex] = currentCount + incrementValue;
        } else if (rollAngle > rightOverflowMin && rollAngle <= rightOverflowMax) {
          result.phoneRollRightOverflow++;
        } else if (rollAngle > leftOverflowMin && rollAngle <= leftOverflowMax) {
          result.phoneRollLeftOverflow++;
        }
      }

      // Calculate max roll speed (angular velocity) using 5-second sliding window
      // Angular velocity is measured as degrees per second
      // Also track when fast rolls (>5 °/s) occur as percentage of scan progress
      const rollWindowDurationSeconds = 5;
      const minRollFramesForWindow = 2;
      const minRollWindowDurationFraction = 0.9;
      const rollNextIndexOffset = 1;
      const rollPrevFrameOffset = 1;
      const fastRollThreshold = 5;
      const minDurationForRollPercentage = 0;

      if (rollData.length >= minRollFramesForWindow) {
        let maxRollAngularVelocity = -Infinity;
        let foundValidRollWindow = false;
        const fastRollPercentages: number[] = [];

        for (let startIdx = 0; startIdx < rollData.length; startIdx++) {
          const startFrame = rollData[startIdx];
          if (startFrame === undefined) {
            continue;
          }
          const windowEndTime = startFrame.timestamp + rollWindowDurationSeconds;

          // Find the last frame within the window
          let endIdx = startIdx;
          for (let j = startIdx + rollNextIndexOffset; j < rollData.length; j++) {
            const candidateFrame = rollData[j];
            if (candidateFrame !== undefined && candidateFrame.timestamp <= windowEndTime) {
              endIdx = j;
            } else {
              break;
            }
          }

          // Need at least 2 frames in window and window must span approximately full duration
          if (endIdx > startIdx) {
            const endFrame = rollData[endIdx];
            if (endFrame !== undefined) {
              const windowDuration = endFrame.timestamp - startFrame.timestamp;

              // Only count windows that span at least 90% of the target window duration
              const minRequiredDuration = rollWindowDurationSeconds * minRollWindowDurationFraction;
              if (windowDuration >= minRequiredDuration) {
                // Sum up total angular change within the window
                let totalAngularChange = 0;
                for (let i = startIdx + rollNextIndexOffset; i <= endIdx; i++) {
                  const prevFrame = rollData[i - rollPrevFrameOffset];
                  const currFrame = rollData[i];
                  if (prevFrame !== undefined && currFrame !== undefined) {
                    const angleDiff = Math.abs(currFrame.rollAngle - prevFrame.rollAngle);
                    totalAngularChange += angleDiff;
                  }
                }
                const angularVelocity = totalAngularChange / windowDuration;
                maxRollAngularVelocity = Math.max(maxRollAngularVelocity, angularVelocity);
                foundValidRollWindow = true;

                // Track fast roll timing as percentage of scan progress
                if (
                  angularVelocity > fastRollThreshold &&
                  result.totalScanDurationSeconds > minDurationForRollPercentage
                ) {
                  const windowCenterTime = (startFrame.timestamp + endFrame.timestamp) / midpointDivisor;
                  const percentage = (windowCenterTime / result.totalScanDurationSeconds) * percentageMultiplier;
                  fastRollPercentages.push(percentage);
                }
              }
            }
          }
        }

        if (foundValidRollWindow) {
          result.maxRollSpeed = maxRollAngularVelocity;
        }
        result.fastRollTimings = fastRollPercentages;
      }

      // Extract phone pan angles from all frames relative to initial forward direction
      // Pan is measured as 0-360° relative to wherever the camera was pointing at scan start
      const panBinsPerDegree = 10;
      const panMaxAngleDegrees = 360;
      const panMaxBinIndex = panMaxAngleDegrees * panBinsPerDegree;
      const panMinBinIndex = 0;
      const panData: { timestamp: number; panAngle: number }[] = [];

      // Get initial forward direction from first frame
      const defaultForwardX = 0;
      const defaultForwardZ = -1;
      let initialForwardX = defaultForwardX;
      let initialForwardZ = defaultForwardZ;
      const firstFrameIndex = 0;
      const firstTimestampKey = sortedTimestampKeys[firstFrameIndex];
      if (typeof firstTimestampKey === "number") {
        const firstFrame = _arData.data[firstTimestampKey.toString()];
        if (firstFrame !== undefined && Array.isArray(firstFrame.cameraTransform)) {
          const initialForward = getHorizontalForward(firstFrame.cameraTransform);
          initialForwardX = initialForward.forwardX;
          initialForwardZ = initialForward.forwardZ;
        }
      }

      for (const timestampKey of sortedTimestampKeys) {
        if (typeof timestampKey !== "number") {
          continue;
        }
        const frame = _arData.data[timestampKey.toString()];
        if (frame === undefined || !Array.isArray(frame.cameraTransform)) {
          continue;
        }
        const panAngle = getPhonePanAngle(frame.cameraTransform, initialForwardX, initialForwardZ);
        panData.push({ panAngle, timestamp: timestampKey });

        const binIndex = Math.round(panAngle * panBinsPerDegree);
        if (binIndex >= panMinBinIndex && binIndex <= panMaxBinIndex) {
          const currentCount = result.phonePanHistogram[binIndex] ?? defaultNumeric;
          const incrementValue = 1;
          result.phonePanHistogram[binIndex] = currentCount + incrementValue;
        }
      }

      // Calculate max pan speed (angular velocity) using 5-second sliding window
      // Also track when fast pans (>5 °/s) occur as percentage of scan progress
      const panWindowDurationSeconds = 5;
      const minPanFramesForWindow = 2;
      const minPanWindowDurationFraction = 0.9;
      const panNextIndexOffset = 1;
      const panPrevFrameOffset = 1;
      const fastPanThreshold = 5;
      const minDurationForPanPercentage = 0;
      const panPercentageMultiplier = 100;
      const panMidpointDivisor = 2;

      if (panData.length >= minPanFramesForWindow) {
        let maxPanAngularVelocity = -Infinity;
        let foundValidPanWindow = false;
        const fastPanPercentages: number[] = [];

        for (let startIdx = 0; startIdx < panData.length; startIdx++) {
          const startFrame = panData[startIdx];
          if (startFrame === undefined) {
            continue;
          }
          const windowEndTime = startFrame.timestamp + panWindowDurationSeconds;

          // Find the last frame within the window
          let endIdx = startIdx;
          for (let j = startIdx + panNextIndexOffset; j < panData.length; j++) {
            const candidateFrame = panData[j];
            if (candidateFrame !== undefined && candidateFrame.timestamp <= windowEndTime) {
              endIdx = j;
            } else {
              break;
            }
          }

          // Need at least 2 frames in window and window must span approximately full duration
          if (endIdx > startIdx) {
            const endFrame = panData[endIdx];
            if (endFrame !== undefined) {
              const windowDuration = endFrame.timestamp - startFrame.timestamp;

              // Only count windows that span at least 90% of the target window duration
              const minRequiredDuration = panWindowDurationSeconds * minPanWindowDurationFraction;
              if (windowDuration >= minRequiredDuration) {
                // Sum up total angular change within the window
                // For pan, we need to handle wraparound (e.g., 350° to 10° is 20°, not 340°)
                let totalAngularChange = 0;
                const fullCircle = 360;
                const halfCircle = 180;
                for (let i = startIdx + panNextIndexOffset; i <= endIdx; i++) {
                  const prevFrame = panData[i - panPrevFrameOffset];
                  const currFrame = panData[i];
                  if (prevFrame !== undefined && currFrame !== undefined) {
                    let angleDiff = Math.abs(currFrame.panAngle - prevFrame.panAngle);
                    // Handle wraparound: if diff > 180, take the shorter path
                    if (angleDiff > halfCircle) {
                      angleDiff = fullCircle - angleDiff;
                    }
                    totalAngularChange += angleDiff;
                  }
                }
                const angularVelocity = totalAngularChange / windowDuration;
                maxPanAngularVelocity = Math.max(maxPanAngularVelocity, angularVelocity);
                foundValidPanWindow = true;

                // Track fast pan timing as percentage of scan progress
                if (
                  angularVelocity > fastPanThreshold &&
                  result.totalScanDurationSeconds > minDurationForPanPercentage
                ) {
                  const windowCenterTime = (startFrame.timestamp + endFrame.timestamp) / panMidpointDivisor;
                  const percentage = (windowCenterTime / result.totalScanDurationSeconds) * panPercentageMultiplier;
                  fastPanPercentages.push(percentage);
                }
              }
            }
          }
        }

        if (foundValidPanWindow) {
          result.maxPanSpeed = maxPanAngularVelocity;
        }
        result.fastPanTimings = fastPanPercentages;
      }

      const coverageSphere = computeSphericalCoverage(_arData);
      if (coverageSphere !== null) {
        result.coverageSphere = coverageSphere;
      }

      // Persist to cache
      try {
        fs.writeFileSync(metaCachePath, JSON.stringify(result, null, JSON_INDENT));
      } catch {
        // If write fails, still return
      }

      return result;
    } catch {
      return null;
    }
  }

  return null;
}
