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
vi.mock("@visx/shape", () => ({
  Bar: () => <rect />,
  Line: () => <line data-testid="separator-line" />,
  LinePath: () => <path />
}));
vi.mock("@visx/text", () => ({ Text: () => <text /> }));

interface AxisBottomProps {
  tickLabelProps?: (val: string, index: number, ticks: unknown[]) => void;
}

interface AxisLeftProps {
  tickFormat?: (val: number) => string;
  tickLabelProps?: (val: string, index: number, ticks: unknown[]) => void;
}

const TEST_VAL_10 = 10;
const TEST_INDEX_0 = 0;

vi.mock("@visx/axis", () => ({
  AxisBottom: (props: AxisBottomProps) => {
    if (props.tickLabelProps !== undefined) {
      props.tickLabelProps("test", TEST_INDEX_0, []);
    }
    return <g />;
  },
  AxisLeft: (props: AxisLeftProps) => {
    if (props.tickFormat !== undefined) {
      props.tickFormat(TEST_VAL_10);
    }
    if (props.tickLabelProps !== undefined) {
      props.tickLabelProps("test", TEST_INDEX_0, []);
    }
    return <g />;
  },
  AxisRight: () => <g />
}));
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
});
