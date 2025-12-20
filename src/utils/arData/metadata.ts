import * as fs from "fs";
import * as path from "path";

import { ArData } from "../../models/arData/arData";

export interface ArDataMetadata {
  lensModel: string;
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
      return JSON.parse(cachedContent) as ArDataMetadata;
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

      const result: ArDataMetadata = {
        avgAmbientIntensity: 0,
        avgBrightness: 0,
        avgColorTemperature: 0,
        avgIso: 0,
        lensModel: NOT_SET
      };

      if (frames.length > INITIAL_COUNT) {
        // Lens Model
        const firstFrame = frames[INITIAL_COUNT];
        if (firstFrame) {
          const model = firstFrame.exifData.LensModel;
          if (model !== undefined && model !== NOT_SET) {
            result.lensModel = model;
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
