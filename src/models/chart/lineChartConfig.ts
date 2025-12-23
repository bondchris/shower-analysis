import { LineChartDataset } from "./lineChartDataset";
import { LineChartOptions } from "./lineChartOptions";

export interface LineChartConfig {
  type: "line";
  labels: string[];
  datasets: LineChartDataset[];
  options: LineChartOptions;
  height: number;
}
