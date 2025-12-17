import { ChartConfiguration, ChartData, LegendItem } from "chart.js";

// --- Constants ---
const INCREMENT_STEP = 1;
const MAX_TICKS = 20;
const ZERO = 0;
const ONE = 1;
const DEFAULT_DECIMALS = 0;
const OFFSET_ADJUST = 1;
const LEGEND_BOX_WIDTH = 12;
const LEGEND_PADDING = 10;
const LEGEND_FONT_SIZE = 10;
const DEFAULT_HEIGHT = 300;
const DEFAULT_PADDING_TOP = 30;
const DEFAULT_PADDING_RIGHT = 40;
const DEFAULT_PADDING_BOTTOM = 10;
const DEFAULT_PADDING_LEFT = 10;
const TITLE_FONT_SIZE = 16;
const DATALABEL_FONT_SIZE = 10;
const ANIMATION_ENABLED = false;
const RIGHT_PADDING_PERCENTAGE = 80;
const TOP_PADDING_PERCENTAGE = 20;
const BAR_CHART_ADDITIONAL_HEIGHT = 100;
const BAR_CHART_ROW_HEIGHT = 30;

// --- Interfaces ---

export interface LineChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth?: number;
}

export interface LineChartOptions {
  width?: number;
  height?: number;
  title?: string;
  yLabel?: string;
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
  totalForPercentages?: number; // If provided, adds % labels
  title?: string;
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
  legendSort?: (a: LegendItem, b: LegendItem, data: ChartData) => number;
}

// --- Pure Helper Functions ---

/**
 * Calculations for histogram bins.
 */
export function calculateHistogramBins(data: number[], options: HistogramOptions): HistogramResult {
  const { binSize, decimalPlaces = DEFAULT_DECIMALS, hideUnderflow, max, min } = options;

  if (!Number.isFinite(binSize) || binSize <= ZERO) {
    throw new Error(`Invalid binSize: ${String(binSize)}. Must be > 0.`);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`Invalid min/max: ${String(min)}/${String(max)}. Must be finite.`);
  }
  if (max <= min) {
    throw new Error(`Invalid range: max (${String(max)}) must be > min (${String(min)}).`);
  }

  const MAX_BINS = 50000;
  const numMainBins = Math.ceil((max - min) / binSize);

  if (numMainBins > MAX_BINS) {
    throw new Error(
      `Bucket count ${String(numMainBins)} exceeds safety limit of ${String(MAX_BINS)}. Increase binSize or reduce range.`
    );
  }

  const INITIAL_COUNT = 0;
  const EXTRA_BUCKETS = 2; // Underflow + Overflow
  const UNDERFLOW_INDEX = 0;
  const OFFSET = 1;

  const buckets: number[] = new Array(numMainBins + EXTRA_BUCKETS).fill(INITIAL_COUNT) as number[];
  const labels: string[] = [];

  labels.push(`< ${min.toFixed(decimalPlaces)}`);
  for (let i = 0; i < numMainBins; i++) {
    const startOffset = i * binSize;
    const start = min + startOffset;
    const endOffset = (i + INCREMENT_STEP) * binSize;
    const end = min + endOffset;
    labels.push(`${start.toFixed(decimalPlaces)}-${end.toFixed(decimalPlaces)}`);
  }
  labels.push(`>= ${max.toFixed(decimalPlaces)}`);

  for (const val of data) {
    if (!Number.isFinite(val)) {
      continue;
    }

    if (val < min) {
      if (buckets[UNDERFLOW_INDEX] !== undefined) {
        buckets[UNDERFLOW_INDEX] += INCREMENT_STEP;
      }
    } else if (val >= max) {
      const idxOver = buckets.length - INCREMENT_STEP;
      if (buckets[idxOver] !== undefined) {
        buckets[idxOver] += INCREMENT_STEP;
      }
    } else {
      const binIdx = Math.floor((val - min) / binSize) + OFFSET;
      if (buckets[binIdx] !== undefined) {
        buckets[binIdx] += INCREMENT_STEP;
      }
    }
  }

  if (hideUnderflow === true) {
    const START_INDEX = 1;
    return {
      buckets: buckets.slice(START_INDEX),
      labels: labels.slice(START_INDEX)
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
  const UNDERFLOW_INDEX = 0;
  const UNDERFLOW_SHIFT = 1;
  const NO_SHIFT = 0;
  const HALF = 2;

  const effectiveIndex = index + (hideUnderflow ? UNDERFLOW_SHIFT : NO_SHIFT);

  if (effectiveIndex === UNDERFLOW_INDEX) {
    const halfBin = binSize / HALF;
    return min - halfBin;
  }

  const originalLength = totalBuckets + (hideUnderflow ? ONE : ZERO);

  if (effectiveIndex === originalLength - OFFSET_ADJUST) {
    const halfBin = binSize / HALF;
    return max + halfBin;
  }

  const binOffset = effectiveIndex - OFFSET_ADJUST;
  const offsetVal = binOffset * binSize;
  const halfBin = binSize / HALF;
  return min + offsetVal + halfBin;
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

  const { title, yLabel = "Error Count" } = options;

  const plugins: Record<string, unknown> = {
    datalabels: { display: false },
    legend: {
      display: datasets.length > ONE,
      labels: {
        boxWidth: LEGEND_BOX_WIDTH,
        font: { size: LEGEND_FONT_SIZE },
        padding: LEGEND_PADDING,
        usePointStyle: true
      },
      position: "bottom"
    },
    title: { color: "black", display: Boolean(title), font: { size: TITLE_FONT_SIZE, weight: "bold" }, text: title }
  };

  return {
    data: {
      datasets: datasets.map((ds) => ({
        backgroundColor: ds.borderColor,
        borderColor: ds.borderColor,
        borderWidth: ds.borderWidth,
        data: ds.data,
        fill: false,
        label: ds.label,
        pointRadius: 0,
        tension: 0.1
      })),
      labels
    },
    // @ts-expect-error - Custom property for React rendering
    height: DEFAULT_HEIGHT,
    options: {
      animation: ANIMATION_ENABLED,
      layout: {
        padding: {
          bottom: DEFAULT_PADDING_BOTTOM,
          left: DEFAULT_PADDING_LEFT,
          right: DEFAULT_PADDING_RIGHT,
          top: DEFAULT_PADDING_TOP
        }
      },
      maintainAspectRatio: false,
      plugins: plugins,
      responsive: true,
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: MAX_TICKS } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: yLabel }
        }
      }
    },
    type: "line"
  };
}

export function getHistogramConfig(data: number[], options: HistogramOptions): ChartConfiguration {
  const { binSize, min, max, colorByValue, hideUnderflow, title, xLabel } = options;
  const { buckets, labels } = calculateHistogramBins(data, options);

  const startColor = "rgba(54, 162, 235, 0.5)";
  const borderColor = "rgba(54, 162, 235, 1)";
  let backgroundColors: string | string[] = startColor;

  if (colorByValue) {
    backgroundColors = labels.map((_, i) => {
      const center = calculateHistogramBinCenter(i, min, max, binSize, hideUnderflow, buckets.length);
      return colorByValue(center);
    });
  }

  const plugins: Record<string, unknown> = {
    datalabels: { align: "end", anchor: "end", color: "black", font: { size: DATALABEL_FONT_SIZE, weight: "bold" } },
    legend: { display: false },
    title: { color: "black", display: Boolean(title), font: { size: TITLE_FONT_SIZE, weight: "bold" }, text: title }
  };

  return {
    data: {
      datasets: [
        {
          backgroundColor: backgroundColors,
          borderColor: borderColor,
          borderWidth: INCREMENT_STEP,
          data: buckets,
          label: xLabel ?? "Count"
        }
      ],
      labels
    },
    // @ts-expect-error - Custom property for React rendering
    height: DEFAULT_HEIGHT,
    options: {
      animation: ANIMATION_ENABLED,
      layout: {
        padding: {
          bottom: DEFAULT_PADDING_BOTTOM,
          left: DEFAULT_PADDING_LEFT,
          right: DEFAULT_PADDING_RIGHT,
          top: DEFAULT_PADDING_TOP
        }
      },
      maintainAspectRatio: false,
      plugins: plugins,
      responsive: true,
      scales: {
        x: {
          ticks: { autoSkip: true, maxTicksLimit: MAX_TICKS },
          title: { display: Boolean(xLabel), text: xLabel }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Count" }
        }
      }
    },
    type: "bar"
  };
}

export function getBarChartConfig(labels: string[], data: number[], options: BarChartOptions = {}): ChartConfiguration {
  if (labels.length !== data.length) {
    throw new Error(`Labels length (${String(labels.length)}) does not match data length (${String(data.length)}).`);
  }

  const { horizontal = false, title, totalForPercentages } = options;

  const plugins: Record<string, unknown> = {
    legend: { display: false },
    title: { color: "black", display: Boolean(title), font: { size: TITLE_FONT_SIZE, weight: "bold" }, text: title }
  };

  if (totalForPercentages !== undefined && totalForPercentages > ZERO) {
    plugins["datalabels"] = {
      // Custom property for client-side hydration to attach the percentage formatter
      _percentageTotal: totalForPercentages,
      align: horizontal ? "end" : "end",
      anchor: horizontal ? "end" : "end",
      color: "black",
      display: true,
      font: { size: DATALABEL_FONT_SIZE, weight: "bold" }
    };
  } else {
    plugins["datalabels"] = {
      align: horizontal ? "end" : "end",
      anchor: horizontal ? "end" : "end",
      color: "black",
      display: true,
      font: { size: DATALABEL_FONT_SIZE, weight: "bold" }
    };
  }

  const totalRowHeight = labels.length * BAR_CHART_ROW_HEIGHT;
  const calculatedHeight = totalRowHeight + BAR_CHART_ADDITIONAL_HEIGHT;

  return {
    data: {
      datasets: [
        {
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
          data: data,
          label: "Count"
        }
      ],
      labels
    },
    // @ts-expect-error - Custom property for React rendering
    height: options.height ?? (horizontal ? calculatedHeight : DEFAULT_HEIGHT),
    options: {
      animation: ANIMATION_ENABLED,
      indexAxis: horizontal ? "y" : "x",
      layout: {
        padding: {
          bottom: DEFAULT_PADDING_BOTTOM,
          left: DEFAULT_PADDING_LEFT,
          right:
            horizontal && totalForPercentages !== undefined && totalForPercentages > ZERO
              ? RIGHT_PADDING_PERCENTAGE
              : DEFAULT_PADDING_RIGHT,
          top:
            !horizontal && totalForPercentages !== undefined && totalForPercentages > ZERO
              ? TOP_PADDING_PERCENTAGE
              : DEFAULT_PADDING_TOP
        }
      },
      maintainAspectRatio: false,
      plugins: plugins,
      responsive: true,
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { beginAtZero: true, ticks: { autoSkip: false } }
      }
    },
    type: "bar"
  };
}

export function getMixedChartConfig(
  labels: string[],
  datasets: MixedChartDataset[],
  options: MixedChartOptions = {}
): ChartConfiguration {
  const { title, yLabelLeft, yLabelRight, legendSort } = options;

  const plugins: Record<string, unknown> = {
    datalabels: { display: false },
    legend: {
      display: datasets.length > ONE,
      labels: {
        boxWidth: LEGEND_BOX_WIDTH,
        font: { size: LEGEND_FONT_SIZE },
        padding: LEGEND_PADDING,
        sort: legendSort,
        usePointStyle: true
      },
      position: "bottom"
    },
    title: { color: "black", display: Boolean(title), font: { size: TITLE_FONT_SIZE, weight: "bold" }, text: title }
  };

  return {
    data: {
      datasets: datasets.map((ds) => ({
        backgroundColor: ds.backgroundColor ?? ds.borderColor,
        borderColor: ds.borderColor,
        borderWidth: ds.borderWidth,
        data: ds.data,
        fill: ds.fill ?? false,
        label: ds.label,
        order: ds.order,
        pointRadius: 0,
        tension: 0.1,
        type: ds.type ?? "line",
        yAxisID: ds.yAxisID ?? "y"
      })),
      labels
    },
    // @ts-expect-error - Custom property for React rendering
    height: DEFAULT_HEIGHT,
    options: {
      animation: ANIMATION_ENABLED,
      layout: {
        padding: {
          bottom: DEFAULT_PADDING_BOTTOM,
          left: DEFAULT_PADDING_LEFT,
          right: DEFAULT_PADDING_RIGHT,
          top: DEFAULT_PADDING_TOP
        }
      },
      maintainAspectRatio: false,
      plugins: plugins,
      responsive: true,
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: MAX_TICKS } },
        y: {
          beginAtZero: true,
          display: true,
          position: "left",
          title: { display: Boolean(yLabelLeft), text: yLabelLeft }
        },
        y1: {
          beginAtZero: true,
          display: true,
          grid: {
            drawOnChartArea: false
          },
          position: "right",
          title: { display: Boolean(yLabelRight), text: yLabelRight }
        }
      }
    },
    type: "line"
  };
}

// --- Utils ---

export function kelvinToRgb(kelvin: number): string {
  if (!Number.isFinite(kelvin) || kelvin <= ZERO) {
    return "rgba(0, 0, 0, 0.8)";
  }

  const KELVIN_SCALE = 100;
  const TEMP_THRESHOLD = 66;
  const MIN_TEMP_BLUE = 19;
  const BLUE_OFFSET = 10;
  const RED_MAX = 255;
  const GREEN_LOG_MULT = 99.4708025861;
  const GREEN_LOG_SUB = 161.1195681661;
  const BLUE_LOG_MULT = 138.5177312231;
  const BLUE_LOG_SUB = 305.0447927307;
  const HIGH_TEMP_OFFSET = 60;
  const RED_POW_MULT = 329.698727446;
  const RED_POW_EXP = -0.1332047592;
  const GREEN_POW_MULT = 288.1221695283;
  const GREEN_POW_EXP = -0.0755148492;
  const BLUE_MAX = 255;
  const CLAMP_MIN = 0;
  const CLAMP_MAX = 255;
  const ALPHA = 0.8;

  const temp = kelvin / KELVIN_SCALE;
  let r = CLAMP_MIN;
  let g = CLAMP_MIN;
  let b = CLAMP_MIN;

  if (temp <= TEMP_THRESHOLD) {
    r = RED_MAX;
    g = temp;
    const gLog = GREEN_LOG_MULT * Math.log(g);
    g = gLog - GREEN_LOG_SUB;

    if (temp <= MIN_TEMP_BLUE) {
      b = CLAMP_MIN;
    } else {
      b = temp - BLUE_OFFSET;
      const bLog = BLUE_LOG_MULT * Math.log(b);
      b = bLog - BLUE_LOG_SUB;
    }
  } else {
    const rBase = temp - HIGH_TEMP_OFFSET;
    r = RED_POW_MULT * Math.pow(rBase, RED_POW_EXP);

    const gBase = temp - HIGH_TEMP_OFFSET;
    g = GREEN_POW_MULT * Math.pow(gBase, GREEN_POW_EXP);

    b = BLUE_MAX;
  }

  r = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, r));
  g = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, g));
  b = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, b));

  return `rgba(${Math.round(r).toString()}, ${Math.round(g).toString()}, ${Math.round(b).toString()}, ${ALPHA.toString()})`;
}
