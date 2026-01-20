import { CoverageSphere } from "./coverageSphere";

/**
 * Comprehensive metadata extracted from AR data files.
 * Contains device info, sensor metrics, motion analysis, and orientation histograms.
 */
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
