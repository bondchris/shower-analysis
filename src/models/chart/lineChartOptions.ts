export interface LineChartOptions {
  width?: number;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  yDecimalPlaces?: number;
  yTickSuffix?: string;
  smooth?: boolean;
  chartId?: string;
  verticalLines?: boolean;
  verticalReferenceLine?: {
    value: number;
    label: string;
  };
}
