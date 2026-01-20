import { ChartConfiguration } from "./chart/chartConfiguration";

export interface ArDataCharts {
  ambient: ChartConfiguration;
  aperture: ChartConfiguration;
  arDataFramerate: ChartConfiguration;
  brightness: ChartConfiguration;
  deviceModel: ChartConfiguration;
  droppedFrames: ChartConfiguration;
  fastPanTiming: ChartConfiguration;
  fastPans: ChartConfiguration;
  fastRollTiming: ChartConfiguration;
  fastRolls: ChartConfiguration;
  fastTiltTiming: ChartConfiguration;
  fastTilts: ChartConfiguration;
  focalLength: ChartConfiguration;
  fullRotation: ChartConfiguration;
  iso: ChartConfiguration;
  movementSpeed: ChartConfiguration;
  partialRotationCoverage: ChartConfiguration;
  maxAmbient: ChartConfiguration;
  maxBrightness: ChartConfiguration;
  maxIso: ChartConfiguration;
  maxPanSpeed: ChartConfiguration;
  maxRollSpeed: ChartConfiguration;
  maxTemperature: ChartConfiguration;
  maxTiltSpeed: ChartConfiguration;
  minAmbient: ChartConfiguration;
  minBrightness: ChartConfiguration;
  minIso: ChartConfiguration;
  minTemperature: ChartConfiguration;
  scanEfficiency: ChartConfiguration;
  temperature: ChartConfiguration;
  timeOfDay: ChartConfiguration;
  timezone: ChartConfiguration;
}
