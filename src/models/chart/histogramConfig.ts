import { HistogramOptions } from "./histogramOptions";

export interface HistogramConfig {
  type: "histogram";
  buckets: number[];
  labels: string[];
  colors: string | string[];
  options: HistogramOptions;
  height: number;
}
