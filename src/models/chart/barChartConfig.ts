import { BarChartOptions } from "./barChartOptions";

export interface BarChartConfig {
  type: "bar";
  labels: string[];
  data: number[] | number[][];
  options: BarChartOptions;
  height: number;
}
