import { ArFrame } from "../../../models/arData/arFrame";
import { parseExifNumeric } from "./exifExtraction";

/**
 * Statistics computed from a collection of numeric values.
 */
interface NumericStats {
  avg: number;
  max: number;
  min: number;
}

/**
 * Accumulates numeric values and computes min/max/avg statistics in a single pass.
 * Returns zeros if no values were added.
 */
class NumericAccumulator {
  private sum: number;
  private count: number;
  private minValue: number;
  private maxValue: number;

  constructor() {
    const initialValue = 0;
    this.sum = initialValue;
    this.count = initialValue;
    this.minValue = Infinity;
    this.maxValue = -Infinity;
  }

  add(value: number): void {
    this.sum += value;
    this.count++;
    this.minValue = Math.min(this.minValue, value);
    this.maxValue = Math.max(this.maxValue, value);
  }

  getStats(): NumericStats {
    const noValues = 0;
    const defaultValue = 0;
    if (this.count === noValues) {
      return { avg: defaultValue, max: defaultValue, min: defaultValue };
    }
    return {
      avg: this.sum / this.count,
      max: this.maxValue,
      min: this.minValue
    };
  }
}

/**
 * Sensor metrics including lighting, ISO, and brightness statistics.
 */
export interface SensorMetrics {
  avgAmbientIntensity: number;
  avgBrightness: number;
  avgColorTemperature: number;
  avgIso: number;
  maxAmbientIntensity: number;
  maxBrightness: number;
  maxColorTemperature: number;
  maxIso: number;
  minAmbientIntensity: number;
  minBrightness: number;
  minColorTemperature: number;
  minIso: number;
}

/**
 * Computes lighting, ISO, and brightness statistics across all frames.
 */
export function computeSensorMetrics(frames: ArFrame[]): SensorMetrics {
  const intensity = new NumericAccumulator();
  const temperature = new NumericAccumulator();
  const iso = new NumericAccumulator();
  const brightness = new NumericAccumulator();

  for (const frame of frames) {
    if (frame.lightEstimate) {
      intensity.add(frame.lightEstimate.ambientIntensity);
      temperature.add(frame.lightEstimate.ambientColorTemperature);
    }

    const isoValue = parseExifNumeric(frame.exifData.ISOSpeedRatings);
    if (isoValue !== undefined) {
      iso.add(isoValue);
    }

    const brightnessValue = parseExifNumeric(frame.exifData.BrightnessValue);
    if (brightnessValue !== undefined) {
      brightness.add(brightnessValue);
    }
  }

  const intensityStats = intensity.getStats();
  const temperatureStats = temperature.getStats();
  const isoStats = iso.getStats();
  const brightnessStats = brightness.getStats();

  return {
    avgAmbientIntensity: intensityStats.avg,
    avgBrightness: brightnessStats.avg,
    avgColorTemperature: temperatureStats.avg,
    avgIso: isoStats.avg,
    maxAmbientIntensity: intensityStats.max,
    maxBrightness: brightnessStats.max,
    maxColorTemperature: temperatureStats.max,
    maxIso: isoStats.max,
    minAmbientIntensity: intensityStats.min,
    minBrightness: brightnessStats.min,
    minColorTemperature: temperatureStats.min,
    minIso: isoStats.min
  };
}
