// Visx-based chart utilities
import React from "react";

// --- Interfaces ---

export interface LineChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth?: number;
  fill?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: "vertical" | "horizontal";
}

export interface LineChartOptions {
  width?: number;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  smooth?: boolean;
  chartId?: string;
}

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

export interface BarChartOptions {
  width?: number;
  height?: number;
  horizontal?: boolean;
  totalForPercentages?: number;
  title?: string;
  showCount?: boolean;
  separatorLabel?: string;
  stacked?: boolean;
  stackLabels?: string[];
  stackColors?: string[];
  // For stacked bars: artifact counts per label (for percentage calculation)
  // Maps label to number of artifacts that have this object type
  artifactCountsPerLabel?: Record<string, number>;
}

export interface PieChartOptions {
  width?: number;
  height?: number;
  title?: string;
  colors?: string[];
  legendIcons?: Record<string, string>; // Map of label to SVG file path
  legendIconComponents?: Record<
    string,
    React.ComponentType<{ color: string; x: number; y: number; legendBoxSize: number }>
  >; // Map of label to icon component
}

export interface HistogramResult {
  buckets: number[];
  labels: string[];
}

export interface MixedChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth?: number;
  backgroundColor?: string;
  type?: "line" | "bar";
  yAxisID?: string;
  fill?: boolean;
  order?: number;
}

export interface MixedChartOptions {
  width?: number;
  height?: number;
  title?: string;
  yLabelLeft?: string;
  yLabelRight?: string;
}

export interface LineChartConfig {
  type: "line";
  labels: string[];
  datasets: LineChartDataset[];
  options: LineChartOptions;
  height: number;
}

export interface HistogramConfig {
  type: "histogram";
  buckets: number[];
  labels: string[];
  colors: string | string[];
  options: HistogramOptions;
  height: number;
}

export interface BarChartConfig {
  type: "bar";
  labels: string[];
  data: number[] | number[][];
  options: BarChartOptions;
  height: number;
}

export interface MixedChartConfig {
  type: "mixed";
  labels: string[];
  datasets: MixedChartDataset[];
  options: MixedChartOptions;
  height: number;
}

export interface PieChartConfig {
  type: "pie";
  labels: string[];
  data: number[];
  options: PieChartOptions;
  height: number;
}

export type ChartConfiguration = LineChartConfig | HistogramConfig | BarChartConfig | MixedChartConfig | PieChartConfig;

// --- Pure Helper Functions ---

/**
 * Calculations for histogram bins.
 */
export function calculateHistogramBins(data: number[], options: HistogramOptions): HistogramResult {
  const defaultDecimals = 0;
  const zeroValue = 0;
  const incrementStep = 1;

  const { binSize, decimalPlaces = defaultDecimals, hideUnderflow, max, min } = options;

  if (!Number.isFinite(binSize) || binSize <= zeroValue) {
    throw new Error(`Invalid binSize: ${String(binSize)}. Must be > 0.`);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`Invalid min/max: ${String(min)}/${String(max)}. Must be finite.`);
  }
  if (max <= min) {
    throw new Error(`Invalid range: max (${String(max)}) must be > min (${String(min)}).`);
  }

  const maxBins = 50000;
  const numMainBins = Math.ceil((max - min) / binSize);

  if (numMainBins > maxBins) {
    throw new Error(
      `Bucket count ${String(numMainBins)} exceeds safety limit of ${String(maxBins)}. Increase binSize or reduce range.`
    );
  }

  const initialCount = 0;
  const extraBuckets = 2; // Underflow + Overflow
  const underflowIndex = 0;
  const offset = 1;

  const buckets: number[] = new Array(numMainBins + extraBuckets).fill(initialCount) as number[];
  const labels: string[] = [];

  labels.push(`< ${min.toFixed(decimalPlaces)}`);
  for (let i = 0; i < numMainBins; i++) {
    const startOffset = i * binSize;
    const start = min + startOffset;
    const endOffset = (i + incrementStep) * binSize;
    const end = min + endOffset;
    labels.push(`${start.toFixed(decimalPlaces)}-${end.toFixed(decimalPlaces)}`);
  }
  labels.push(`>= ${max.toFixed(decimalPlaces)}`);

  for (const val of data) {
    if (!Number.isFinite(val)) {
      continue;
    }

    if (val < min) {
      if (buckets[underflowIndex] !== undefined) {
        buckets[underflowIndex] += incrementStep;
      }
    } else if (val >= max) {
      const idxOver = buckets.length - incrementStep;
      if (buckets[idxOver] !== undefined) {
        buckets[idxOver] += incrementStep;
      }
    } else {
      const binIdx = Math.floor((val - min) / binSize) + offset;
      if (buckets[binIdx] !== undefined) {
        buckets[binIdx] += incrementStep;
      }
    }
  }

  if (hideUnderflow === true) {
    const startIndex = 1;
    return {
      buckets: buckets.slice(startIndex),
      labels: labels.slice(startIndex)
    };
  }

  return { buckets, labels };
}

export function calculateHistogramBinCenter(
  index: number,
  min: number,
  max: number,
  binSize: number,
  hideUnderflow = false,
  totalBuckets: number
): number {
  const underflowIndex = 0;
  const underflowShift = 1;
  const noShift = 0;
  const half = 2;
  const offsetAdjust = 1;
  const oneValue = 1;

  const effectiveIndex = index + (hideUnderflow ? underflowShift : noShift);

  if (effectiveIndex === underflowIndex) {
    const halfBin = binSize / half;
    return min - halfBin;
  }

  const noValue = 0;
  const originalLength = totalBuckets + (hideUnderflow ? oneValue : noValue);

  if (effectiveIndex === originalLength - offsetAdjust) {
    const halfBin = binSize / half;
    return max + halfBin;
  }

  const binOffset = effectiveIndex - offsetAdjust;
  const offsetVal = binOffset * binSize;
  const halfBin = binSize / half;
  return min + offsetVal + halfBin;
}

export function calculateMean(data: number[]): number {
  const zeroValue = 0;
  if (data.length === zeroValue) {
    return zeroValue;
  }
  const initialSum = 0;
  return data.reduce((sum, val) => sum + val, initialSum) / data.length;
}

export function calculateStdDev(data: number[]): number {
  const minLength = 2;
  const zeroValue = 0;
  if (data.length < minLength) {
    return zeroValue;
  }
  const mean = calculateMean(data);
  const power = 2;
  const offset = 1;
  const initialSum = 0;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, power), initialSum) / (data.length - offset);
  return Math.sqrt(variance);
}

export interface KdeResult {
  labels: string[];
  values: number[];
}

export function calculateKde(data: number[], options: { min: number; max: number; resolution?: number }): KdeResult {
  const defaultResolution = 100;
  const { min, max, resolution = defaultResolution } = options;
  const validData = data.filter((d) => Number.isFinite(d));
  const n = validData.length;

  const zeroValue = 0;
  if (n === zeroValue) {
    return { labels: [], values: [] };
  }

  const std = calculateStdDev(validData);

  // Silverman's Rule of Thumb for bandwidth
  // Fallback to non-zero bandwidth if std is 0 (all points same)
  const defaultBandwidth = 1.0;
  const hMult = 1.06;
  const hPow = -0.2;
  let h = hMult * std * Math.pow(n, hPow);
  if (h === zeroValue) {
    h = defaultBandwidth;
  }

  const labels: string[] = [];
  const values: number[] = [];

  const resolutionOffset = 1;
  const step = (max - min) / (resolution - resolutionOffset);
  const PI_FACTOR = 2;
  const sqrt2Pi = Math.sqrt(PI_FACTOR * Math.PI);
  const EXP_FACTOR = -0.5;

  for (let i = 0; i < resolution; i++) {
    const offset = i * step;
    const x = min + offset;
    let sumKernel = 0;
    for (const d of validData) {
      const u = (x - d) / h;
      sumKernel += Math.exp(EXP_FACTOR * u * u) / sqrt2Pi;
    }
    // Density * N gives approximate count density per unit
    // We multiply by N so the magnitude reflects point counts roughly
    // value = (1/h) * sumKernel
    // This is the sum of kernels.
    // If we want Density: (1 / (n * h)) * sumKernel
    // If we want "Sum of kernels": (1/h) * sumKernel
    // We'll return Sum of Kernels (scaled density) for nicer Y-axis values
    const unit = 1;
    const value = (unit / h) * sumKernel;

    const labelDecimalPlaces = 1;
    labels.push(x.toFixed(labelDecimalPlaces));
    values.push(value);
  }

  return { labels, values };
}

// --- Config Builders ---

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

  const { height = defaultHeight, title, width = defaultWidth, colors = defaultColors, legendIconComponents } = options;

  const configOptions: PieChartOptions = {};
  if (title !== undefined) {
    configOptions.title = title;
  }
  configOptions.width = width;
  configOptions.colors = colors;
  if (legendIconComponents !== undefined) {
    configOptions.legendIconComponents = legendIconComponents;
  }

  return {
    data,
    height,
    labels,
    options: configOptions,
    type: "pie"
  };
}

// --- Utils ---

export function kelvinToRgb(kelvin: number): string {
  const zeroValue = 0;
  if (!Number.isFinite(kelvin) || kelvin <= zeroValue) {
    return "rgba(0, 0, 0, 0.8)";
  }

  const kelvinScale = 100;
  const tempThreshold = 66;
  const minTempBlue = 19;
  const blueOffset = 10;
  const redMax = 255;
  const greenLogMult = 99.4708025861;
  const greenLogSub = 161.1195681661;
  const blueLogMult = 138.5177312231;
  const blueLogSub = 305.0447927307;
  const highTempOffset = 60;
  const redPowMult = 329.698727446;
  const redPowExp = -0.1332047592;
  const greenPowMult = 288.1221695283;
  const greenPowExp = -0.0755148492;
  const blueMax = 255;
  const clampMin = 0;
  const clampMax = 255;
  const alpha = 0.8;

  const temp = kelvin / kelvinScale;
  let r = clampMin;
  let g = clampMin;
  let b = clampMin;

  if (temp <= tempThreshold) {
    r = redMax;
    g = temp;
    const gLog = greenLogMult * Math.log(g);
    g = gLog - greenLogSub;

    if (temp <= minTempBlue) {
      b = clampMin;
    } else {
      b = temp - blueOffset;
      const bLog = blueLogMult * Math.log(b);
      b = bLog - blueLogSub;
    }
  } else {
    const rBase = temp - highTempOffset;
    r = redPowMult * Math.pow(rBase, redPowExp);

    const gBase = temp - highTempOffset;
    g = greenPowMult * Math.pow(gBase, greenPowExp);

    b = blueMax;
  }

  r = Math.min(clampMax, Math.max(clampMin, r));
  g = Math.min(clampMax, Math.max(clampMin, g));
  b = Math.min(clampMax, Math.max(clampMin, b));

  return `rgba(${Math.round(r).toString()}, ${Math.round(g).toString()}, ${Math.round(b).toString()}, ${alpha.toString()})`;
}
