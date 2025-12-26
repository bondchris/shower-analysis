import { ScatterChartDataset } from "./scatterChartDataset";
import { ScatterChartOptions } from "./scatterChartOptions";

export interface ScatterChartConfig {
  type: "scatter";
  datasets: ScatterChartDataset[];
  options: ScatterChartOptions;
  height: number;
}
