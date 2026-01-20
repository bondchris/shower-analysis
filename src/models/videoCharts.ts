import { ChartConfiguration } from "./chart/chartConfiguration";

export interface VideoCharts {
  bitrateValues: ChartConfiguration;
  colorSpace: ChartConfiguration;
  duration: ChartConfiguration;
  fps: ChartConfiguration;
  profile: ChartConfiguration;
  level: ChartConfiguration;
  bFrames: ChartConfiguration;
  gopMax: ChartConfiguration;
  gopAverage: ChartConfiguration;
  gopMin: ChartConfiguration;
  gopVariance: ChartConfiguration;
  resolution: ChartConfiguration;
  laplacianMedian: ChartConfiguration;
  laplacianStdDev: ChartConfiguration;
  meanHue: ChartConfiguration;
  hueVariance: ChartConfiguration;
  meanSaturation: ChartConfiguration;
  saturationVariance: ChartConfiguration;
  meanBrightness: ChartConfiguration;
  brightnessVariance: ChartConfiguration;
  rgbMeans: ChartConfiguration;
  rgbVariance: ChartConfiguration;
  clippedPixels: ChartConfiguration;
}
