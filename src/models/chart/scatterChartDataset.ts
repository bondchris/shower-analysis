export interface ScatterPoint {
  opacity?: number;
  x: number;
  y: number;
}

export interface ScatterChartDataset {
  label: string;
  data: ScatterPoint[];
  pointColor?: string;
  pointRadius?: number;
}
