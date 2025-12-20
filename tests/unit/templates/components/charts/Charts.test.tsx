// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { BarChart, Histogram, LineChart, MixedChart } from "../../../../../src/templates/components/charts";
import {
  BarChartConfig,
  HistogramConfig,
  LineChartConfig,
  MixedChartConfig
} from "../../../../../src/utils/chartUtils";

// Mock Visx components to avoid complex SVG rendering issues in simple smoke tests
// We just want to ensure our wrapper components render without crashing
vi.mock("@visx/group", () => ({ Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g> }));
vi.mock("@visx/shape", () => ({ Bar: () => <rect />, LinePath: () => <path /> }));
vi.mock("@visx/text", () => ({ Text: () => <text /> }));
vi.mock("@visx/axis", () => ({ AxisBottom: () => <g />, AxisLeft: () => <g />, AxisRight: () => <g /> }));
vi.mock("@visx/grid", () => ({ GridColumns: () => <g />, GridRows: () => <g /> }));

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
});
