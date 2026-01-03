export interface ProtractorChartOptions {
  width?: number;
  height?: number;
  title?: string;
  lineColor?: string;
  chartId?: string;
  fullCircle?: boolean;
  showAverage?: boolean;
  angleOffsetDegrees?: number;
}

export interface ProtractorChartConfig {
  type: "protractor";
  histogram: number[];
  leftOverflowCount: number;
  rightOverflowCount: number;
  options: ProtractorChartOptions;
  height: number;
}
