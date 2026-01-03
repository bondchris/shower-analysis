export interface ZoomBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface ScatterChartOptions {
  width?: number;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  chartId?: string;
  independentAxes?: boolean;
  zoomBox?: ZoomBox;
}
