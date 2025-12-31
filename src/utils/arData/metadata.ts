import * as fs from "fs";
import * as path from "path";

import { ArData } from "../../models/arData/arData";

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
}

/**
 * Extracts metadata from an arData.json file in the given directory.
 * Caches results in arDataMetadata.json.
 */
export function extractArDataMetadata(dirPath: string): ArDataMetadata | null {
  const metaCachePath = path.join(dirPath, "arDataMetadata.json");
  const JSON_INDENT = 2;

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
        typeof cached.hasDroppedArFrames === "boolean"
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

      const result: ArDataMetadata = {
        arDataFramerate: 0,
        avgAmbientIntensity: 0,
        avgBrightness: 0,
        avgColorTemperature: 0,
        avgIso: 0,
        deviceModel: NOT_SET,
        hasDroppedArFrames: false,
        lensAperture: NOT_SET,
        lensFocalLength: NOT_SET,
        lensModel: NOT_SET,
        maxAmbientIntensity: 0,
        maxBrightness: 0,
        maxColorTemperature: 0,
        maxIso: 0,
        minAmbientIntensity: 0,
        minBrightness: 0,
        minColorTemperature: 0,
        minIso: 0,
        scanDateTime: NOT_SET,
        timezone: NOT_SET
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
                if (median !== undefined) {
                  const threshold = median * droppedFrameThreshold;
                  result.hasDroppedArFrames = intervals.some((interval) => interval > threshold);
                }
              }
            }
          }
        }
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
