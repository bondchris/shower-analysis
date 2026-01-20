import * as fs from "fs";
import * as path from "path";

import { ArData } from "../../models/arData/arData";
import { ArDataMetadata } from "../../models/arData/arDataMetadata";
import { computeSphericalCoverage } from "./coverage";
import { computePanMetrics, computeRollMetrics, computeTiltMetrics } from "./metadata/angularMetrics";
import {
  COVERAGE_SPHERE_CALCULATION_VERSION,
  PAN_CALCULATION_VERSION,
  PAN_HISTOGRAM_BIN_COUNT,
  ROLL_CALCULATION_VERSION,
  TILT_CALCULATION_VERSION,
  isCacheValid
} from "./metadata/cacheValidation";
import { extractExifMetadata } from "./metadata/exifExtraction";
import { buildValidFrames, computeFramerateMetrics, getSortedTimestamps } from "./metadata/framerateMetrics";
import { computeMotionMetrics } from "./metadata/motionMetrics";
import { computeSensorMetrics } from "./metadata/sensorMetrics";

const EXPECTED_HISTOGRAM_SIZE = 1801;

/**
 * Creates a default ArDataMetadata object with all fields initialized.
 */
function createDefaultMetadata(): ArDataMetadata {
  const defaultNumeric = 0;
  const emptyString = "";
  return {
    arDataFramerate: defaultNumeric,
    avgAmbientIntensity: defaultNumeric,
    avgBrightness: defaultNumeric,
    avgColorTemperature: defaultNumeric,
    avgIso: defaultNumeric,
    avgSpeed: defaultNumeric,
    coverageSphereCalculationVersion: COVERAGE_SPHERE_CALCULATION_VERSION,
    deviceModel: emptyString,
    droppedArFrameCount: defaultNumeric,
    droppedArFramePercentage: defaultNumeric,
    fastPanTimings: [],
    fastRollTimings: [],
    fastTiltTimings: [],
    hasDroppedArFrames: false,
    lensAperture: emptyString,
    lensFocalLength: emptyString,
    lensModel: emptyString,
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
    phoneRollHistogram: new Array<number>(EXPECTED_HISTOGRAM_SIZE).fill(defaultNumeric),
    phoneRollLeftOverflow: defaultNumeric,
    phoneRollRightOverflow: defaultNumeric,
    phoneTiltHistogram: new Array<number>(EXPECTED_HISTOGRAM_SIZE).fill(defaultNumeric),
    phoneTiltLeftOverflow: defaultNumeric,
    phoneTiltRightOverflow: defaultNumeric,
    rollCalculationVersion: ROLL_CALCULATION_VERSION,
    scanDateTime: emptyString,
    tiltCalculationVersion: TILT_CALCULATION_VERSION,
    timezone: emptyString,
    totalDisplacement: defaultNumeric,
    totalDistanceTraveled: defaultNumeric,
    totalScanDurationSeconds: defaultNumeric
  };
}

/**
 * Extracts comprehensive metadata from an arData.json file in the given directory.
 *
 * Computes and caches the following metrics:
 * - Device and lens information from EXIF data
 * - Lighting conditions (ambient intensity, color temperature)
 * - Camera sensor settings (ISO, brightness)
 * - Framerate and dropped frame detection
 * - Distance traveled and displacement (in feet)
 * - Speed statistics using 5-second sliding windows
 * - Phone orientation histograms (tilt, roll, pan)
 * - Angular velocity and fast movement timings
 * - Spherical coverage analysis
 *
 * Results are cached in arDataMetadata.json and reused if valid.
 */
export function extractArDataMetadata(dirPath: string): ArDataMetadata | null {
  const metaCachePath = path.join(dirPath, "arDataMetadata.json");
  const jsonIndent = 2;

  if (fs.existsSync(metaCachePath)) {
    try {
      const cachedContent = fs.readFileSync(metaCachePath, "utf-8");
      const cached = JSON.parse(cachedContent) as ArDataMetadata;
      if (isCacheValid(cached)) {
        return cached;
      }
    } catch {
      // Cache invalid or corrupted, proceed to extraction
    }
  }

  const arDataPath = path.join(dirPath, "arData.json");

  if (!fs.existsSync(arDataPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(arDataPath, "utf-8");
    const json = JSON.parse(content) as unknown;
    const arData = new ArData(json);
    const frames = Object.values(arData.data);

    const result = createDefaultMetadata();

    const firstFrameIndex = 0;
    const minFrameCount = 0;
    if (frames.length > minFrameCount && frames[firstFrameIndex] !== undefined) {
      const exifMetadata = extractExifMetadata(frames[firstFrameIndex]);
      result.lensModel = exifMetadata.lensModel;
      result.deviceModel = exifMetadata.deviceModel;
      result.lensFocalLength = exifMetadata.lensFocalLength;
      result.lensAperture = exifMetadata.lensAperture;
      result.timezone = exifMetadata.timezone;
      result.scanDateTime = exifMetadata.scanDateTime;
    }

    const sensorMetrics = computeSensorMetrics(frames);
    result.avgAmbientIntensity = sensorMetrics.avgAmbientIntensity;
    result.minAmbientIntensity = sensorMetrics.minAmbientIntensity;
    result.maxAmbientIntensity = sensorMetrics.maxAmbientIntensity;
    result.avgColorTemperature = sensorMetrics.avgColorTemperature;
    result.minColorTemperature = sensorMetrics.minColorTemperature;
    result.maxColorTemperature = sensorMetrics.maxColorTemperature;
    result.avgIso = sensorMetrics.avgIso;
    result.minIso = sensorMetrics.minIso;
    result.maxIso = sensorMetrics.maxIso;
    result.avgBrightness = sensorMetrics.avgBrightness;
    result.minBrightness = sensorMetrics.minBrightness;
    result.maxBrightness = sensorMetrics.maxBrightness;

    const sortedTimestamps = getSortedTimestamps(arData);

    const framerateMetrics = computeFramerateMetrics(sortedTimestamps);
    result.arDataFramerate = framerateMetrics.arDataFramerate;
    result.hasDroppedArFrames = framerateMetrics.hasDroppedArFrames;
    result.droppedArFrameCount = framerateMetrics.droppedArFrameCount;
    result.droppedArFramePercentage = framerateMetrics.droppedArFramePercentage;
    result.totalScanDurationSeconds = framerateMetrics.totalScanDurationSeconds;

    const validFrames = buildValidFrames(arData, sortedTimestamps);

    const motionMetrics = computeMotionMetrics(validFrames, result.totalScanDurationSeconds);
    result.totalDistanceTraveled = motionMetrics.totalDistanceTraveled;
    result.totalDisplacement = motionMetrics.totalDisplacement;
    result.avgSpeed = motionMetrics.avgSpeed;
    result.minSpeed = motionMetrics.minSpeed;
    result.maxSpeed = motionMetrics.maxSpeed;

    const tiltMetrics = computeTiltMetrics(validFrames, result.totalScanDurationSeconds);
    result.phoneTiltHistogram = tiltMetrics.histogram;
    result.phoneTiltLeftOverflow = tiltMetrics.leftOverflow;
    result.phoneTiltRightOverflow = tiltMetrics.rightOverflow;
    result.maxTiltSpeed = tiltMetrics.maxSpeed;
    result.fastTiltTimings = tiltMetrics.fastTimings;

    const rollMetrics = computeRollMetrics(validFrames, result.totalScanDurationSeconds);
    result.phoneRollHistogram = rollMetrics.histogram;
    result.phoneRollLeftOverflow = rollMetrics.leftOverflow;
    result.phoneRollRightOverflow = rollMetrics.rightOverflow;
    result.maxRollSpeed = rollMetrics.maxSpeed;
    result.fastRollTimings = rollMetrics.fastTimings;

    const panMetrics = computePanMetrics(validFrames, result.totalScanDurationSeconds);
    result.phonePanHistogram = panMetrics.histogram;
    result.maxPanSpeed = panMetrics.maxSpeed;
    result.fastPanTimings = panMetrics.fastTimings;

    const coverageSphere = computeSphericalCoverage(arData);
    if (coverageSphere !== null) {
      result.coverageSphere = coverageSphere;
    }

    try {
      fs.writeFileSync(metaCachePath, JSON.stringify(result, null, jsonIndent));
    } catch {
      // Cache write failure is non-fatal
    }

    return result;
  } catch {
    return null;
  }
}
