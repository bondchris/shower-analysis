import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

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

  const { binSize, decimalPlaces = DEFAULT_DECIMALS, height, max, min, width } = options;
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
      const valUnder = buckets[UNDERFLOW_INDEX];
      if (valUnder !== undefined) {
        buckets[UNDERFLOW_INDEX] = valUnder + INCREMENT_STEP;
      }
    } else if (val >= max) {
      const idxOver = buckets.length - INCREMENT_STEP;
      const valOver = buckets[idxOver];
      if (valOver !== undefined) {
        buckets[idxOver] = valOver + INCREMENT_STEP;
      }
    } else {
      const binIdx = Math.floor((val - min) / binSize) + OFFSET;
      const count = buckets[binIdx];
      if (count !== undefined) {
        buckets[binIdx] = count + INCREMENT_STEP;
      }
    }
  }

  const configuration: ChartConfiguration = {
    data: {
      datasets: [
        {
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: INCREMENT_STEP,
          data: buckets,
          label
        }
      ],
      labels
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
          const props = element.getProps(["x", "y"], true) as { x: number; y: number };
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
