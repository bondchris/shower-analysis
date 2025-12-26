import { BarChartOptions } from "../../models/chart/barChartOptions";
import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { HistogramOptions } from "../../models/chart/histogramOptions";
import { LineChartDataset } from "../../models/chart/lineChartDataset";
import { LineChartOptions } from "../../models/chart/lineChartOptions";
import { MixedChartDataset } from "../../models/chart/mixedChartDataset";
import { MixedChartOptions } from "../../models/chart/mixedChartOptions";
import { PieChartOptions } from "../../models/chart/pieChartOptions";
import { ScatterChartDataset } from "../../models/chart/scatterChartDataset";
import { ScatterChartOptions } from "../../models/chart/scatterChartOptions";
import { calculateHistogramBinCenter, calculateHistogramBins } from "./histogram";

export function getLineChartConfig(
  labels: string[],
  datasets: LineChartDataset[],
  options: LineChartOptions = {}
): ChartConfiguration {
  if (datasets.some((ds) => ds.data.length !== labels.length)) {
    throw new Error("Dataset data length mismatch with labels length.");
  }

  const defaultHeight = 300;
  const { height = defaultHeight, title, xLabel, yLabel = "Error Count", width } = options;

  const configOptions: LineChartOptions = { yLabel };
  if (title !== undefined) {
    configOptions.title = title;
  }
  if (xLabel !== undefined) {
    configOptions.xLabel = xLabel;
  }
  if (width !== undefined) {
    configOptions.width = width;
  }
  if (options.chartId !== undefined) {
    configOptions.chartId = options.chartId;
  }
  if (options.smooth !== undefined) {
    configOptions.smooth = options.smooth;
  }
  if (options.verticalReferenceLine !== undefined) {
    configOptions.verticalReferenceLine = options.verticalReferenceLine;
  }

  return {
    datasets,
    height,
    labels,
    options: configOptions,
    type: "line"
  };
}

export function getHistogramConfig(data: number[], options: HistogramOptions): ChartConfiguration {
  const { binSize, min, max, colorByValue, hideUnderflow, title, xLabel, height, decimalPlaces, width } = options;
  const { buckets, labels } = calculateHistogramBins(data, options);

  const defaultHeight = 300;
  const startColor = "rgba(54, 162, 235, 0.5)";
  let backgroundColors: string | string[] = startColor;

  if (colorByValue) {
    backgroundColors = labels.map((_, i) => {
      const center = calculateHistogramBinCenter(i, min, max, binSize, hideUnderflow, buckets.length);
      return colorByValue(center);
    });
  }

  const configOptions: HistogramOptions = { binSize, max, min };
  if (colorByValue !== undefined) {
    configOptions.colorByValue = colorByValue;
  }
  if (decimalPlaces !== undefined) {
    configOptions.decimalPlaces = decimalPlaces;
  }
  if (hideUnderflow !== undefined) {
    configOptions.hideUnderflow = hideUnderflow;
  }
  if (title !== undefined) {
    configOptions.title = title;
  }
  if (xLabel !== undefined) {
    configOptions.xLabel = xLabel;
  }
  if (width !== undefined) {
    configOptions.width = width;
  }

  return {
    buckets,
    colors: backgroundColors,
    height: height ?? defaultHeight,
    labels,
    options: configOptions,
    type: "histogram"
  };
}

export function getBarChartConfig(
  labels: string[],
  data: number[] | number[][],
  options: BarChartOptions = {}
): ChartConfiguration {
  const firstDataIndex = 0;
  const dataLength = Array.isArray(data[firstDataIndex]) ? data.length : (data as number[]).length;
  if (labels.length !== dataLength) {
    throw new Error(`Labels length (${String(labels.length)}) does not match data length (${String(dataLength)}).`);
  }

  const defaultHeight = 300;
  const barChartAdditionalHeight = 100;
  const barChartRowHeight = 30;
  const { horizontal = false, title, totalForPercentages, height, width } = options;

  const totalRowHeight = labels.length * barChartRowHeight;
  const calculatedHeight = totalRowHeight + barChartAdditionalHeight;

  const configOptions: BarChartOptions = { horizontal };
  if (title !== undefined) {
    configOptions.title = title;
  }
  if (totalForPercentages !== undefined) {
    configOptions.totalForPercentages = totalForPercentages;
  }
  if (width !== undefined) {
    configOptions.width = width;
  }
  if (options.showCount === true) {
    configOptions.showCount = true;
  }
  if (options.separatorLabel !== undefined) {
    configOptions.separatorLabel = options.separatorLabel;
  }
  if (options.stacked === true) {
    configOptions.stacked = true;
  }
  if (options.stackLabels !== undefined) {
    configOptions.stackLabels = options.stackLabels;
  }
  if (options.stackColors !== undefined) {
    configOptions.stackColors = options.stackColors;
  }
  if (options.artifactCountsPerLabel !== undefined) {
    configOptions.artifactCountsPerLabel = options.artifactCountsPerLabel;
  }

  return {
    data,
    height: height ?? (horizontal ? calculatedHeight : defaultHeight),
    labels,
    options: configOptions,
    type: "bar"
  };
}

export function getMixedChartConfig(
  labels: string[],
  datasets: MixedChartDataset[],
  options: MixedChartOptions = {}
): ChartConfiguration {
  const defaultHeight = 300;
  const { title, yLabelLeft, yLabelRight, height, width } = options;

  const configOptions: MixedChartOptions = {};
  if (title !== undefined) {
    configOptions.title = title;
  }
  if (width !== undefined) {
    configOptions.width = width;
  }
  if (yLabelLeft !== undefined) {
    configOptions.yLabelLeft = yLabelLeft;
  }
  if (yLabelRight !== undefined) {
    configOptions.yLabelRight = yLabelRight;
  }

  return {
    datasets,
    height: height ?? defaultHeight,
    labels,
    options: configOptions,
    type: "mixed"
  };
}

export function getPieChartConfig(labels: string[], data: number[], options: PieChartOptions = {}): ChartConfiguration {
  if (labels.length !== data.length) {
    throw new Error(`Labels length (${String(labels.length)}) does not match data length (${String(data.length)}).`);
  }

  const defaultHeight = 300;
  const defaultWidth = 300;
  const defaultColors = ["#1e40af", "#047857", "#b45309", "#b91c1c", "#6d28d9", "#be185d", "#0891b2", "#65a30d"];

  const {
    height = defaultHeight,
    title,
    width = defaultWidth,
    colors = defaultColors,
    legendIconComponents,
    shrinkToLegend
  } = options;

  const configOptions: PieChartOptions = {};
  if (title !== undefined) {
    configOptions.title = title;
  }
  configOptions.width = width;
  configOptions.colors = colors;
  if (legendIconComponents !== undefined) {
    configOptions.legendIconComponents = legendIconComponents;
  }
  if (shrinkToLegend !== undefined) {
    configOptions.shrinkToLegend = shrinkToLegend;
  }

  return {
    data,
    height,
    labels,
    options: configOptions,
    type: "pie"
  };
}

export function getScatterChartConfig(
  datasets: ScatterChartDataset[],
  options: ScatterChartOptions = {}
): ChartConfiguration {
  const defaultHeight = 300;
  const { height = defaultHeight, title, xLabel, yLabel, width } = options;

  const configOptions: ScatterChartOptions = {};
  if (title !== undefined) {
    configOptions.title = title;
  }
  if (xLabel !== undefined) {
    configOptions.xLabel = xLabel;
  }
  if (yLabel !== undefined) {
    configOptions.yLabel = yLabel;
  }
  if (width !== undefined) {
    configOptions.width = width;
  }
  if (options.chartId !== undefined) {
    configOptions.chartId = options.chartId;
  }

  return {
    datasets,
    height,
    options: configOptions,
    type: "scatter"
  };
}
