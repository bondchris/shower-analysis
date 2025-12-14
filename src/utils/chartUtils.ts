import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

// --- Constants ---
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
const CHART_BG_COLOR = "white";
const INCREMENT_STEP = 1;
const MAX_TICKS = 20;

/* eslint-disable no-magic-numbers */

// --- Interfaces ---

export interface LineChartDataset {
  label: string;
  data: number[];
  borderColor: string;
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

// --- Pure Helper Functions ---

export function calculateHistogramBins(data: number[], options: HistogramOptions): HistogramResult {
  const { binSize, decimalPlaces = 0, hideUnderflow, max, min } = options;

  // Validation
  if (!Number.isFinite(binSize) || binSize <= 0) {
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

  // Consistent formatting for boundary labels
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
    } // Skip non-finite values

    if (val < min) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      buckets[UNDERFLOW_INDEX]! += INCREMENT_STEP;
    } else if (val >= max) {
      const idxOver = buckets.length - INCREMENT_STEP;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      buckets[idxOver]! += INCREMENT_STEP;
    } else {
      const binIdx = Math.floor((val - min) / binSize) + OFFSET;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      buckets[binIdx]! += INCREMENT_STEP;
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
  const OFFSET_ADJUST = 1;
  const HALF = 2;

  // If hideUnderflow is true, the input index 0 corresponds to the original index 1.
  const effectiveIndex = index + (hideUnderflow ? UNDERFLOW_SHIFT : NO_SHIFT);

  if (effectiveIndex === UNDERFLOW_INDEX) {
    // Underflow
    const halfBin = binSize / HALF;
    return min - halfBin;
  }

  const originalLength = totalBuckets + (hideUnderflow ? 1 : 0);

  if (effectiveIndex === originalLength - OFFSET_ADJUST) {
    // Overflow
    const halfBin = binSize / HALF;
    return max + halfBin;
  }

  // Main bin
  const binOffset = effectiveIndex - OFFSET_ADJUST;
  const offsetVal = binOffset * binSize;
  const halfBin = binSize / HALF;
  return min + offsetVal + halfBin;
}

export function formatPercentageLabel(value: number, total: number): string {
  const PCT_MULTIPLIER = 100;
  const PCT_DECIMALS = 2;
  const pctVal = (value / total) * PCT_MULTIPLIER;
  // Show up to 2 decimals, trim trailing zeros
  const pctStr = parseFloat(pctVal.toFixed(PCT_DECIMALS)).toString();
  return `${pctStr}%`;
}

// --- Config Builders ---

export function buildLineChartConfig(
  labels: string[],
  datasets: LineChartDataset[],
  options: LineChartOptions = {}
): ChartConfiguration {
  // Validation
  if (datasets.some((ds) => ds.data.length !== labels.length)) {
    throw new Error("Dataset data length mismatch with labels length.");
  }

  const { title = "Data Errors Over Time", yLabel = "Error Count" } = options;

  return {
    data: {
      datasets: datasets.map((ds) => ({
        backgroundColor: ds.borderColor,
        borderColor: ds.borderColor,
        data: ds.data,
        fill: false,
        label: ds.label,
        tension: 0.1
      })),
      labels
    },
    options: {
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title }
      },
      scales: {
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

export function buildHistogramConfig(data: number[], options: HistogramOptions): ChartConfiguration {
  const { binSize, min, max, colorByValue, hideUnderflow, title, xLabel } = options;

  const { buckets, labels } = calculateHistogramBins(data, options);

  const startColor = "rgba(54, 162, 235, 0.5)";
  const borderColor = "rgba(54, 162, 235, 1)";

  let backgroundColors: string | string[] = startColor;

  if (colorByValue) {
    backgroundColors = labels.map((_, i) => {
      const center = calculateHistogramBinCenter(i, min, max, binSize, hideUnderflow, buckets.length);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return colorByValue(center);
    });
  }

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
    options: {
      plugins: {
        legend: { position: "top" },
        title: { display: Boolean(title), text: title }
      },
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

export function buildBarChartConfig(
  labels: string[],
  data: number[],
  options: BarChartOptions = {}
): ChartConfiguration {
  // Validation
  if (labels.length !== data.length) {
    throw new Error(`Labels length (${String(labels.length)}) does not match data length (${String(data.length)}).`);
  }

  const { horizontal = false, title, totalForPercentages } = options;

  const RIGHT_PADDING = 60;
  const NO_PADDING = 0;
  const LABEL_OFFSET = 4;
  const FONT_SIZE_PX = 12;

  const customLabelsPlugin = {
    afterDatasetsDraw(chart: import("chart.js").Chart) {
      if (totalForPercentages === undefined || totalForPercentages <= 0) {
        return;
      }
      const DATASET_INDEX = 0;

      const { ctx } = chart;
      const meta = chart.getDatasetMeta(DATASET_INDEX);
      /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */
      const datasetData = chart.data.datasets[DATASET_INDEX]?.data as number[];

      ctx.save();
      ctx.font = `bold ${String(FONT_SIZE_PX)}px sans-serif`;
      ctx.fillStyle = "black";
      ctx.textBaseline = "middle";

      meta.data.forEach((element, index) => {
        const value = datasetData[index];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (value !== undefined) {
          const text = formatPercentageLabel(value, totalForPercentages);

          // Local type to avoid importing domain models
          // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
          type XY = { x: number; y: number };
          const { x, y } = element.getProps(["x", "y"], true) as XY;

          if (horizontal) {
            ctx.textAlign = "left";
            ctx.fillText(text, x + LABEL_OFFSET, y);
          } else {
            // Vertical bar: place above the bar
            ctx.textAlign = "center";
            // y is the top of the bar in vertical mode (usually, depending on base)
            // Actually in Chart.js 'y' is the end of the bar (top).
            ctx.fillText(text, x, y - LABEL_OFFSET);
          }
        }
      });
      ctx.restore();
    },
    id: "customLabels"
  };

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
    options: {
      indexAxis: horizontal ? "y" : "x",
      layout: {
        padding: {
          // Only add right padding if horizontal and showing %
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, no-magic-numbers
          right: horizontal && totalForPercentages ? RIGHT_PADDING : NO_PADDING,
          // Maybe add top padding for vertical?
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, no-magic-numbers
          top: !horizontal && totalForPercentages ? 20 : 0
        }
      },
      plugins: {
        legend: { position: "top" },
        title: { display: Boolean(title), text: title }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { beginAtZero: true, ticks: { autoSkip: false } }
      }
    },
    plugins: [customLabelsPlugin],
    type: "bar"
  };
}

// --- Render Helper ---

const chartCallback = (ChartJS: typeof import("chart.js").Chart) => {
  ChartJS.defaults.responsive = false;
  ChartJS.defaults.maintainAspectRatio = false;
};

async function renderChart(
  config: ChartConfiguration,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): Promise<Buffer> {
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    backgroundColour: CHART_BG_COLOR,
    chartCallback,
    height,
    width
  });
  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  return buffer;
}

// --- Exported Creators ---

export async function createLineChart(
  labels: string[],
  datasets: LineChartDataset[],
  options: LineChartOptions = {}
): Promise<Buffer> {
  const config = buildLineChartConfig(labels, datasets, options);
  const buffer = await renderChart(config, options.width, options.height);
  return buffer;
}

export async function createHistogram(
  data: number[],
  label: string,
  title: string,
  options: HistogramOptions
): Promise<Buffer> {
  const config = buildHistogramConfig(data, { ...options, title, xLabel: label });
  const buffer = await renderChart(config, options.width, options.height);
  return buffer;
}

export async function createBarChart(
  labels: string[],
  data: number[],
  title: string,
  options: BarChartOptions = {}
): Promise<Buffer> {
  const config = buildBarChartConfig(labels, data, { ...options, title });
  const buffer = await renderChart(config, options.width, options.height);
  return buffer;
}

// --- Utils ---

export function kelvinToRgb(kelvin: number): string {
  // eslint-disable-next-line no-magic-numbers
  if (!Number.isFinite(kelvin) || kelvin <= 0) {
    return "rgba(0, 0, 0, 0.8)";
  }

  const KELVIN_SCALE = 100;
  const TEMP_THRESHOLD = 66;
  const MIN_TEMP_BLUE = 19;
  const BLUE_OFFSET = 10;

  // Red/Green/Blue calculation constants
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
    // High temp red
    const rBase = temp - HIGH_TEMP_OFFSET;
    r = RED_POW_MULT * Math.pow(rBase, RED_POW_EXP);

    // High temp green
    const gBase = temp - HIGH_TEMP_OFFSET;
    g = GREEN_POW_MULT * Math.pow(gBase, GREEN_POW_EXP);

    b = BLUE_MAX;
  }

  // Clamp 0-255
  r = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, r));
  g = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, g));
  b = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, b));

  return `rgba(${Math.round(r).toString()}, ${Math.round(g).toString()}, ${Math.round(b).toString()}, ${ALPHA.toString()})`;
}
