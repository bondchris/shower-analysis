import { ArDataMetadata } from "../../../models/arData/arDataMetadata";

const BINS_PER_DEGREE = 10;
const MAX_ANGLE_DEGREES = 180;
const MAX_BIN_INDEX = MAX_ANGLE_DEGREES * BINS_PER_DEGREE;
const HISTOGRAM_SIZE_OFFSET = 1;
const HISTOGRAM_BIN_COUNT = MAX_BIN_INDEX + HISTOGRAM_SIZE_OFFSET;

export const EXPECTED_HISTOGRAM_SIZE = HISTOGRAM_BIN_COUNT;
export const PAN_HISTOGRAM_BIN_COUNT = 3601;
export const TILT_CALCULATION_VERSION = 2;
export const ROLL_CALCULATION_VERSION = 2;
export const PAN_CALCULATION_VERSION = 1;
export const COVERAGE_SPHERE_CALCULATION_VERSION = 5;

/**
 * Fields that must be strings in valid cache.
 */
const STRING_FIELDS: (keyof ArDataMetadata)[] = [
  "deviceModel",
  "lensAperture",
  "lensFocalLength",
  "lensModel",
  "scanDateTime",
  "timezone"
];

/**
 * Fields that must be numbers in valid cache.
 */
const NUMBER_FIELDS: (keyof ArDataMetadata)[] = [
  "arDataFramerate",
  "avgAmbientIntensity",
  "avgBrightness",
  "avgColorTemperature",
  "avgIso",
  "avgSpeed",
  "droppedArFrameCount",
  "droppedArFramePercentage",
  "maxAmbientIntensity",
  "maxBrightness",
  "maxColorTemperature",
  "maxIso",
  "maxPanSpeed",
  "maxRollSpeed",
  "maxSpeed",
  "maxTiltSpeed",
  "minAmbientIntensity",
  "minBrightness",
  "minColorTemperature",
  "minIso",
  "minSpeed",
  "panCalculationVersion",
  "phoneTiltLeftOverflow",
  "phoneTiltRightOverflow",
  "phoneRollLeftOverflow",
  "phoneRollRightOverflow",
  "rollCalculationVersion",
  "tiltCalculationVersion",
  "totalDisplacement",
  "totalDistanceTraveled",
  "totalScanDurationSeconds"
];

/**
 * Fields that must be booleans in valid cache.
 */
const BOOLEAN_FIELDS: (keyof ArDataMetadata)[] = ["hasDroppedArFrames"];

/**
 * Fields that must be arrays in valid cache.
 */
const ARRAY_FIELDS: (keyof ArDataMetadata)[] = [
  "fastPanTimings",
  "fastRollTimings",
  "fastTiltTimings",
  "phonePanHistogram",
  "phoneRollHistogram",
  "phoneTiltHistogram"
];

/**
 * Checks that all histogram arrays have the expected sizes.
 * Only call after confirming arrays exist via hasValidArrays.
 */
function hasValidHistogramSizes(cached: ArDataMetadata): boolean {
  return (
    cached.phoneTiltHistogram.length === EXPECTED_HISTOGRAM_SIZE &&
    cached.phoneRollHistogram.length === EXPECTED_HISTOGRAM_SIZE &&
    cached.phonePanHistogram.length === PAN_HISTOGRAM_BIN_COUNT
  );
}

/**
 * Checks that all calculation versions match current versions.
 */
function hasValidVersions(cached: ArDataMetadata): boolean {
  return (
    cached.tiltCalculationVersion === TILT_CALCULATION_VERSION &&
    cached.rollCalculationVersion === ROLL_CALCULATION_VERSION &&
    cached.panCalculationVersion === PAN_CALCULATION_VERSION &&
    cached.coverageSphereCalculationVersion === COVERAGE_SPHERE_CALCULATION_VERSION
  );
}

/**
 * Validates that cached metadata has all required fields with correct types and versions.
 * Returns true if cache is valid and can be used, false if re-extraction is needed.
 */
export function isCacheValid(cached: ArDataMetadata): boolean {
  const hasValidStrings = STRING_FIELDS.every((field) => typeof cached[field] === "string");
  const hasValidNumbers = NUMBER_FIELDS.every((field) => typeof cached[field] === "number");
  const hasValidBooleans = BOOLEAN_FIELDS.every((field) => typeof cached[field] === "boolean");
  const hasValidArrays = ARRAY_FIELDS.every((field) => Array.isArray(cached[field]));

  return (
    hasValidStrings &&
    hasValidNumbers &&
    hasValidBooleans &&
    hasValidArrays &&
    hasValidHistogramSizes(cached) &&
    hasValidVersions(cached)
  );
}
