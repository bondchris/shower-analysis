import * as fs from "fs";
import * as path from "path";

import { ArData } from "../../models/arData/arData";

export interface ArDataMetadata {
  lensModel: string;
  deviceModel: string;
  lensFocalLength: string;
  lensAperture: string;
  avgAmbientIntensity: number;
  avgColorTemperature: number;
  avgIso: number;
  avgBrightness: number;
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
      if (typeof cached.deviceModel === "string") {
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
        avgAmbientIntensity: 0,
        avgBrightness: 0,
        avgColorTemperature: 0,
        avgIso: 0,
        deviceModel: NOT_SET,
        lensAperture: NOT_SET,
        lensFocalLength: NOT_SET,
        lensModel: NOT_SET
      };

      if (frames.length > INITIAL_COUNT && firstFrame !== undefined) {
        // Lens Model & Device Info
        const exif = firstFrame.exifData;

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

      // Calculate Averages
      let totalIntensity = 0;
      let totalTemperature = 0;
      let lightCount = 0;

      let totalISO = 0;
      let isoCount = 0;

      let totalBrightness = 0;
      let brightnessCount = 0;

      for (const frame of frames) {
        if (frame.lightEstimate) {
          totalIntensity += frame.lightEstimate.ambientIntensity;
          totalTemperature += frame.lightEstimate.ambientColorTemperature;
          lightCount++;
        }

        const isoRatings = frame.exifData.ISOSpeedRatings;
        if (isoRatings !== undefined && isoRatings !== NOT_SET) {
          const isoStr = isoRatings.replace(/[^0-9.]/g, "");
          const isoVal = parseFloat(isoStr);
          if (!isNaN(isoVal)) {
            totalISO += isoVal;
            isoCount++;
          }
        }

        const brightness = frame.exifData.BrightnessValue;
        if (brightness !== undefined && brightness !== NOT_SET) {
          const briVal = parseFloat(brightness);
          if (!isNaN(briVal)) {
            totalBrightness += briVal;
            brightnessCount++;
          }
        }
      }

      if (lightCount > MIN_VALID_FRAMES) {
        result.avgAmbientIntensity = totalIntensity / lightCount;
        result.avgColorTemperature = totalTemperature / lightCount;
      }

      if (isoCount > MIN_VALID_FRAMES) {
        result.avgIso = totalISO / isoCount;
      }

      if (brightnessCount > MIN_VALID_FRAMES) {
        result.avgBrightness = totalBrightness / brightnessCount;
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
