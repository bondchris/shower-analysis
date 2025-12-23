export interface HistogramOptions {
  binSize: number;
  min: number;
  max: number;
  width?: number;
  height?: number;
  decimalPlaces?: number;
  hideUnderflow?: boolean;
  colorByValue?: (value: number) => string;
  title?: string;
  xLabel?: string;
}
