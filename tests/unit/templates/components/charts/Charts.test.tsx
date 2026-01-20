// @vitest-environment jsdom
import { setupChartVisxMocks } from "./testUtils";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarChart } from "../../../../../src/templates/components/charts/BarChart";
import { Histogram } from "../../../../../src/templates/components/charts/Histogram";
import { LineChart } from "../../../../../src/templates/components/charts/LineChart";
import { MixedChart } from "../../../../../src/templates/components/charts/MixedChart";
import { BarChartConfig } from "../../../../../src/models/chart/barChartConfig";
import { HistogramConfig } from "../../../../../src/models/chart/histogramConfig";
import { LineChartConfig } from "../../../../../src/models/chart/lineChartConfig";
import { MixedChartConfig } from "../../../../../src/models/chart/mixedChartConfig";

setupChartVisxMocks();

describe("Chart Components", () => {
  const HEIGHT = 300;
  const WIDTH = 500;
  const DATA_A = 10;
  const DATA_B = 20;
  const DATA_C = 1;
  const DATA_D = 2;
  const DATA_E = 3;
  const BIN_SIZE = 5;
  const MIN_VAL = 0;
  const MAX_VAL = 10;
  const BUCKET_A = 0;
  const BUCKET_B = 5;
  const BUCKET_C = 10;
  const TOTAL_PCT = 100;

  const barConfig: BarChartConfig = {
    data: [DATA_A, DATA_B],
    height: HEIGHT,
    labels: ["A", "B"],
    options: {},
    type: "bar"
  };

  const histogramConfig: HistogramConfig = {
    buckets: [BUCKET_A, BUCKET_B, BUCKET_C],
    colors: [],
    height: HEIGHT,
    labels: ["0-5", "5-10"],
    options: { binSize: BIN_SIZE, max: MAX_VAL, min: MIN_VAL },
    type: "histogram"
  };

  const lineConfig: LineChartConfig = {
    datasets: [{ borderColor: "red", data: [DATA_D, DATA_D], label: "L1" }],
    height: HEIGHT,
    labels: ["A", "B"],
    options: {},
    type: "line"
  };

  const mixedConfig: MixedChartConfig = {
    datasets: [{ borderColor: "blue", data: [DATA_D, DATA_D], label: "M1", type: "line" }],
    height: HEIGHT,
    labels: ["A", "B"],
    options: {},
    type: "mixed"
  };

  it("BarChart renders", () => {
    const { container } = render(<BarChart config={{ ...barConfig, options: { width: WIDTH } }} />);
    expect(container).toBeInTheDocument();
  });

  it("BarChart renders horizontal", () => {
    const horizontalConfig: BarChartConfig = {
      ...barConfig,
      options: { horizontal: true, totalForPercentages: TOTAL_PCT }
    };
    const { container } = render(<BarChart config={horizontalConfig} />);
    expect(container).toBeInTheDocument();
  });

  it("BarChart renders separator line and hides text for separator item", () => {
    const VAL_10 = 10;
    const VAL_0 = 0;
    const VAL_20 = 20;
    const sepConfig: BarChartConfig = {
      ...barConfig,
      data: [VAL_10, VAL_0, VAL_20],
      labels: ["A", "---", "B"],
      options: { horizontal: true, separatorLabel: "---" }
    };

    // We need to render with enough width/height
    const { queryByText, getAllByTestId } = render(<BarChart config={sepConfig} />);

    // "---" text should be hidden
    expect(queryByText("---")).not.toBeInTheDocument();

    // "10" and "20" should be visible (if showing counts, defaults might be off, checking logic)
    // Actually default showCount might be false.
    // Let's check pure existence of checks.

    // The separator line should be rendered
    const lines = getAllByTestId("separator-line");
    expect(lines.length).toBeGreaterThan(VAL_0);
  });

  it("BarChart displays percentages when totalForPercentages is set", () => {
    const VAL_50 = 50;
    const TOTAL_100 = 100;
    const pctConfig: BarChartConfig = {
      ...barConfig,
      data: [VAL_50],
      labels: ["Item"],
      options: { horizontal: true, totalForPercentages: TOTAL_100 }
    };

    const { getByText } = render(<BarChart config={pctConfig} />);
    // 50 / 100 * 100 = 50%
    expect(getByText("50%")).toBeInTheDocument();
  });

  it("BarChart displays counts and percentages if showCount is true", () => {
    const VAL_25 = 25;
    const TOTAL_100 = 100;
    const countPctConfig: BarChartConfig = {
      ...barConfig,
      data: [VAL_25],
      labels: ["Item"],
      options: { horizontal: true, showCount: true, totalForPercentages: TOTAL_100 }
    };

    const { getByText } = render(<BarChart config={countPctConfig} />);
    // 25 (25%)
    expect(getByText("25 (25%)")).toBeInTheDocument();
  });

  it("Histogram renders", () => {
    const { container } = render(
      <Histogram config={{ ...histogramConfig, options: { ...histogramConfig.options, width: WIDTH } }} />
    );
    expect(container).toBeInTheDocument();
  });

  it("Histogram renders with underflow hidden", () => {
    const hiddenConfig: HistogramConfig = {
      ...histogramConfig,
      options: { ...histogramConfig.options, hideUnderflow: true }
    };
    const { container } = render(<Histogram config={hiddenConfig} />);
    expect(container).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("Histogram renders with single string color", () => {
    const stringColorConfig: HistogramConfig = {
      ...histogramConfig,
      colors: "blue"
    };
    const { container } = render(<Histogram config={stringColorConfig} />);
    expect(container).toBeInTheDocument();
  });

  it("LineChart renders", () => {
    const { container } = render(<LineChart config={{ ...lineConfig, options: { width: WIDTH } }} />);
    expect(container).toBeInTheDocument();
  });

  it("MixedChart renders", () => {
    const { container } = render(<MixedChart config={{ ...mixedConfig, options: { width: WIDTH } }} />);
    expect(container).toBeInTheDocument();
  });

  it("MixedChart renders with dual axes", () => {
    const dualConfig: MixedChartConfig = {
      ...mixedConfig,
      datasets: [
        { borderColor: "black", data: [DATA_C], label: "Left", type: "line", yAxisID: "y1" },
        { borderColor: "black", data: [DATA_D], label: "Right", type: "bar", yAxisID: "y2" },
        { borderColor: "black", data: [DATA_E], label: "Default" }
      ],
      options: { yLabelLeft: "L", yLabelRight: "R" }
    };
    const { container } = render(<MixedChart config={dualConfig} />);
    expect(container).toBeInTheDocument();
  });

  it("MixedChart renders filled line dataset", () => {
    const filledConfig: MixedChartConfig = {
      ...mixedConfig,
      datasets: [
        {
          backgroundColor: "rgba(0,0,255,0.2)",
          borderColor: "blue",
          data: [DATA_D, DATA_E],
          fill: true,
          label: "Filled line",
          type: "line"
        }
      ]
    };

    const { getAllByTestId, container } = render(<MixedChart config={filledConfig} />);
    expect(container).toBeInTheDocument();
    expect(getAllByTestId("mixed-area").length).toBeGreaterThan(0);
  });
});
