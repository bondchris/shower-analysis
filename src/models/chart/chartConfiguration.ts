import { LineChartConfig } from "./lineChartConfig";
import { HistogramConfig } from "./histogramConfig";
import { BarChartConfig } from "./barChartConfig";
import { MixedChartConfig } from "./mixedChartConfig";
import { PieChartConfig } from "./pieChartConfig";
import { ScatterChartConfig } from "./scatterChartConfig";

export type ChartConfiguration =
  | LineChartConfig
  | HistogramConfig
  | BarChartConfig
  | MixedChartConfig
  | PieChartConfig
  | ScatterChartConfig;
