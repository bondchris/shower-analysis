import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

import { Point } from "../models/point";

export interface LineChartDataset {
  label: string;
  data: number[];
  borderColor: string;
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
}

export interface BarChartOptions {
  width?: number;
  height?: number;
  horizontal?: boolean;
  totalForPercentages?: number; // If provided, adds % labels
}

export async function createLineChart(labels: string[], datasets: LineChartDataset[]): Promise<Buffer> {
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 400;
  const CHART_BG_COLOR = "white";

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    backgroundColour: CHART_BG_COLOR,
    height: DEFAULT_HEIGHT,
    width: DEFAULT_WIDTH
  });
  const configuration: ChartConfiguration = {
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
        title: { display: true, text: "Data Errors Over Time" }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Error Count" } }
      }
    },
    type: "line"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

export async function createHistogram(
  data: number[],
  label: string,
  title: string,
  options: HistogramOptions
): Promise<Buffer> {
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 400;
  const DEFAULT_DECIMALS = 0;
  const INITIAL_COUNT = 0;
  const INCREMENT_STEP = 1;
  const EXTRA_BUCKETS = 2;
  const UNDERFLOW_INDEX = 0;
  const OFFSET = 1;
  const MAX_TICKS = 20;
  const CHART_BG_COLOR = "white";

  const { binSize, decimalPlaces = DEFAULT_DECIMALS, height, max, min, width, hideUnderflow } = options;
  const CHART_WIDTH = width ?? DEFAULT_WIDTH;
  const CHART_HEIGHT = height ?? DEFAULT_HEIGHT;

  const numMainBins = Math.ceil((max - min) / binSize);
  const buckets: number[] = new Array(numMainBins + EXTRA_BUCKETS).fill(INITIAL_COUNT) as number[];
  const labels: string[] = [];

  labels.push(`< ${min.toString()}`);
  for (let i = 0; i < numMainBins; i++) {
    const startOffset = i * binSize;
    const start = min + startOffset;
    const endOffset = (i + INCREMENT_STEP) * binSize;
    const end = min + endOffset;
    labels.push(`${start.toFixed(decimalPlaces)}-${end.toFixed(decimalPlaces)}`);
  }
  labels.push(`> ${max.toString()}`);

  const chartCallback = (ChartJS: typeof import("chart.js").Chart) => {
    ChartJS.defaults.responsive = false;
    ChartJS.defaults.maintainAspectRatio = false;
  };
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    backgroundColour: CHART_BG_COLOR,
    chartCallback,
    height: CHART_HEIGHT,
    width: CHART_WIDTH
  });

  for (const val of data) {
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

  // Filter out underflow bucket if requested
  let finalBuckets = buckets;
  let finalLabels = labels;

  if (hideUnderflow === true) {
    // Remove the first element (index 0)
    const START_INDEX = 1;
    finalBuckets = buckets.slice(START_INDEX);
    finalLabels = labels.slice(START_INDEX);
  } else {
    // Underflow bucket represents (< min)
    // For coloring, we might treat it as (min - binSize)?
    // But index 0 is underflow.
  }

  // Generate colors if requested
  let backgroundColors: string | string[] = "rgba(54, 162, 235, 0.5)";
  const borderColor = "rgba(54, 162, 235, 1)";

  if (options.colorByValue) {
    backgroundColors = finalLabels.map((_, i) => {
      // Calculate representative value for this bin
      // Original logic:
      // index 0 (if underflow shown) is < min. center approx min - binSize/2
      // index last is > max. center approx max + binSize/2
      // main bins: min + i*binSize + binSize/2

      // Adjustment for hideUnderflow:
      // If hideUnderflow is true, i=0 corresponds to original index 1 (min to min+binSize)
      // So effective original index = i + (hideUnderflow ? 1 : 0)

      const UNDERFLOW_SHIFT = 1;
      const NO_SHIFT = 0;
      const effectiveIndex = i + (hideUnderflow === true ? UNDERFLOW_SHIFT : NO_SHIFT);
      let centerValue = 0;
      const OFFSET_ADJUST = 1;
      const HALF = 2;

      if (effectiveIndex === UNDERFLOW_INDEX) {
        // Underflow
        const halfBin = binSize / HALF;
        centerValue = min - halfBin;
      } else if (effectiveIndex === buckets.length - OFFSET_ADJUST) {
        // Overflow
        const halfBin = binSize / HALF;
        centerValue = max + halfBin;
      } else {
        // Main bin
        // effectiveIndex 1 => range [min, min+binSize] => center min + binSize/2
        // effectiveIndex k => range [min+(k-1)bin, min+k*bin]
        const binOffset = effectiveIndex - OFFSET_ADJUST;
        const offsetVal = binOffset * binSize;
        const halfBin = binSize / HALF;
        centerValue = min + offsetVal + halfBin;
      }

      if (options.colorByValue) {
        return options.colorByValue(centerValue);
      }
      return "rgba(54, 162, 235, 0.5)"; // Fallback
    });
  }

  const configuration: ChartConfiguration = {
    data: {
      datasets: [
        {
          backgroundColor: backgroundColors,
          borderColor,
          borderWidth: INCREMENT_STEP,
          data: finalBuckets,
          label
        }
      ],
      labels: finalLabels
    },
    options: {
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title }
      },
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: MAX_TICKS }, title: { display: true, text: label } },
        y: { beginAtZero: true, title: { display: true, text: "Count" } }
      }
    },
    type: "bar"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

export async function createBarChart(
  labels: string[],
  data: number[],
  title: string,
  options: BarChartOptions = {}
): Promise<Buffer> {
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 400;
  const INCREMENT_STEP = 1;
  const RIGHT_PADDING = 60;
  const NO_PADDING = 0;
  const PCT_MULTIPLIER = 100;
  const PCT_DECIMALS = 2;
  const LABEL_OFFSET = 4;
  const FONT_SIZE_PX = 12;
  const CHART_BG_COLOR = "white";

  const { height, horizontal = false, totalForPercentages, width } = options;
  const CHART_WIDTH = width ?? DEFAULT_WIDTH;
  const CHART_HEIGHT = height ?? DEFAULT_HEIGHT;

  // Custom plugin to draw percentages manually
  const customLabelsPlugin = {
    afterDatasetsDraw(chart: import("chart.js").Chart) {
      const DATASET_INDEX = 0;

      if (totalForPercentages === undefined) {
        return;
      }
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(DATASET_INDEX);

      ctx.save();
      ctx.font = `bold ${FONT_SIZE_PX.toString()}px sans-serif`;
      ctx.fillStyle = "black";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      meta.data.forEach((element, index) => {
        const value = data[index];
        if (value !== undefined) {
          const pctVal = (value / totalForPercentages) * PCT_MULTIPLIER;
          const pctStr = parseFloat(pctVal.toFixed(PCT_DECIMALS)).toString();
          const text = `${pctStr}%`;
          // element.x is the end of the bar for horizontal charts
          // element.y is the vertical center of the bar
          const props = element.getProps(["x", "y"], true) as Point;
          const { x, y } = props;
          ctx.fillText(text, x + LABEL_OFFSET, y);
        }
      });
      ctx.restore();
    },
    id: "customLabels"
  };

  const chartCallback = (ChartJS: typeof import("chart.js").Chart) => {
    ChartJS.defaults.responsive = false;
    ChartJS.defaults.maintainAspectRatio = false;
  };
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    backgroundColour: CHART_BG_COLOR,
    chartCallback,
    height: CHART_HEIGHT,
    width: CHART_WIDTH
  });

  const configuration: ChartConfiguration = {
    data: {
      datasets: [
        {
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: INCREMENT_STEP,
          data,
          label: "Count"
        }
      ],
      labels
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      layout: {
        padding: {
          right: totalForPercentages !== undefined ? RIGHT_PADDING : NO_PADDING
        }
      },
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: title }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { beginAtZero: true, ticks: { autoSkip: false } }
      }
    },
    plugins: [customLabelsPlugin],
    type: "bar"
  };
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}

// Based on Tanner Helland's algorithm
export function kelvinToRgb(k: number): string {
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

  const temp = k / KELVIN_SCALE;
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
