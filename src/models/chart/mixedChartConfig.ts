import { MixedChartDataset } from "./mixedChartDataset";
import { MixedChartOptions } from "./mixedChartOptions";

export interface MixedChartConfig {
  type: "mixed";
  labels: string[];
  datasets: MixedChartDataset[];
  options: MixedChartOptions;
  height: number;
}
