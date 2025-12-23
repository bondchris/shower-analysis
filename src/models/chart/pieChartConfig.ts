import { PieChartOptions } from "./pieChartOptions";

export interface PieChartConfig {
  type: "pie";
  labels: string[];
  data: number[];
  options: PieChartOptions;
  height: number;
}
