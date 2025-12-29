/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MixedChart } from "../../../../../src/templates/components/charts/MixedChart";
import { MixedChartConfig } from "../../../../../src/models/chart/mixedChartConfig";
import { MixedChartDataset } from "../../../../../src/models/chart/mixedChartDataset";

// Spy functions to capture props passed to Visx components
const axisBottomSpy = vi.fn();
const axisLeftSpy = vi.fn();
const axisRightSpy = vi.fn();
const barSpy = vi.fn();
const lineSpy = vi.fn();
const areaSpy = vi.fn();

interface MockProps {
  [key: string]: unknown;
  children?: React.ReactNode;
}

// --- Mocks for specific @visx modules ---

vi.mock("@visx/axis", () => ({
  AxisBottom: (props: MockProps) => {
    axisBottomSpy(props);
    return <g data-testid="AxisBottom" />;
  },
  AxisLeft: (props: MockProps) => {
    axisLeftSpy(props);
    return <g data-testid="AxisLeft" />;
  },
  AxisRight: (props: MockProps) => {
    axisRightSpy(props);
    return <g data-testid="AxisRight" />;
  }
}));

vi.mock("@visx/shape", () => ({
  AreaClosed: (props: MockProps) => {
    areaSpy(props);
    return <path data-testid="AreaClosed" />;
  },
  Bar: (props: MockProps) => {
    barSpy(props);
    return <rect data-testid="Bar" />;
  },
  LinePath: (props: MockProps) => {
    lineSpy(props);
    return <path data-testid="LinePath" />;
  }
}));

vi.mock("@visx/grid", () => ({
  GridRows: () => <g data-testid="GridRows" />
}));

vi.mock("@visx/group", () => ({
  Group: ({ children }: MockProps) => <g data-testid="Group">{children}</g>
}));

describe("MixedChart", () => {
  const HEIGHT = 400;
  const DATA_1 = 1;
  const DATA_2 = 2;
  const DATA_3 = 3;
  const DATA_10 = 10;
  const DATA_20 = 20;
  const DATA_30 = 30;
  const DATA_FLOAT_1 = 1.2;
  const DATA_FLOAT_2 = 2.4;
  const DATA_FLOAT_LARGE = 10.55;
  const MAX_TICKS = 15;
  const MANY_LABELS_COUNT = 30;
  const EXPECTED_FEW_TICKS = 3;
  const FIRST_CALL = 0;
  const FIRST_ARG = 0;
  const ONE_CALL = 1;
  const TWO_CALLS = 2;
  const DEFAULT_COLOR = "black";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to bypass unsafe member access on config.options
  const configCommonOptions = (options: MixedChartConfig["options"] | undefined): MixedChartConfig["options"] =>
    options ?? {};

  // Helper to render with minimal config
  const renderChart = (config: Partial<MixedChartConfig> & { datasets: MixedChartDataset[]; labels: string[] }) => {
    render(
      <MixedChart
        config={
          {
            height: HEIGHT,
            ...config,
            options: { ...configCommonOptions(config.options) }
          } as MixedChartConfig
        }
      />
    );
  };

  describe("Legend Logic", () => {
    it("does not render legend when only one dataset exists", () => {
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: [DATA_1, DATA_2], label: "Single" }],
        labels: ["a", "b"]
      });

      expect(screen.queryByText("Single")).toBeNull();
    });

    it("renders legend when multiple datasets exist", () => {
      renderChart({
        datasets: [
          { borderColor: DEFAULT_COLOR, data: [DATA_1, DATA_2], label: "Dataset 1" },
          { borderColor: DEFAULT_COLOR, data: [DATA_2, DATA_3], label: "Dataset 2" }
        ],
        labels: ["a", "b"]
      });

      expect(screen.getByText("Dataset 1")).toBeTruthy();
      expect(screen.getByText("Dataset 2")).toBeTruthy();
    });
  });

  describe("Axis Logic", () => {
    it("caps x-axis ticks at 15 when many labels exist", () => {
      const labels = Array.from({ length: MANY_LABELS_COUNT }, (_, i) => `d${String(i)}`);
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: labels.map((_, i) => i), label: "Data" }],
        labels
      });

      expect(axisBottomSpy).toHaveBeenCalled();
      const props = axisBottomSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as { numTicks: number };
      expect(props.numTicks).toBe(MAX_TICKS);
    });

    it("uses label length for ticks when <= 15 labels", () => {
      const labels = ["a", "b", "c"];
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: [DATA_1, DATA_2, DATA_3], label: "Data" }],
        labels
      });

      expect(axisBottomSpy).toHaveBeenCalled();
      const props = axisBottomSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as { numTicks: number };
      expect(props.numTicks).toBe(EXPECTED_FEW_TICKS); // matches label length
    });

    it("renders right axis only when a dataset uses yAxisID='y1'", () => {
      renderChart({
        datasets: [
          { borderColor: DEFAULT_COLOR, data: [DATA_10, DATA_20], label: "Left", yAxisID: "y" },
          { borderColor: DEFAULT_COLOR, data: [DATA_FLOAT_1, DATA_FLOAT_2], label: "Right", yAxisID: "y1" }
        ],
        labels: ["a", "b"],
        options: { yLabelRight: "Right Label" }
      });

      expect(screen.getByTestId("AxisRight")).toBeTruthy();

      const props = axisRightSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as {
        label: string;
        tickFormat: (v: number) => string;
      };
      expect(props.label).toBe("Right Label");

      expect(props.tickFormat(DATA_10)).toBe("10");
      expect(props.tickFormat(DATA_FLOAT_LARGE)).toBe("10.6");
    });

    it("does not render right axis if no y1 dataset", () => {
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: [DATA_10], label: "Left", yAxisID: "y" }],
        labels: ["a"]
      });
      expect(screen.queryByTestId("AxisRight")).toBeNull();
    });
  });

  describe("Series Logic", () => {
    it("renders bars for 'bar' type datasets", () => {
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: [DATA_10, DATA_20], label: "Bars", type: "bar" }],
        labels: ["a", "b"]
      });

      expect(barSpy).toHaveBeenCalled();
      expect(lineSpy).not.toHaveBeenCalled();
      expect(areaSpy).not.toHaveBeenCalled();
      expect(barSpy).toHaveBeenCalledTimes(TWO_CALLS);
    });

    it("renders line for 'line' (default) type datasets", () => {
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: [DATA_10, DATA_20], label: "Line" }],
        labels: ["a", "b"]
      });

      expect(lineSpy).toHaveBeenCalled();
      expect(barSpy).not.toHaveBeenCalled();
    });

    it("renders area and line when fill: true", () => {
      renderChart({
        datasets: [{ borderColor: DEFAULT_COLOR, data: [DATA_10, DATA_20], fill: true, label: "Area" }],
        labels: ["a", "b"]
      });

      expect(areaSpy).toHaveBeenCalledTimes(ONE_CALL);
      expect(lineSpy).toHaveBeenCalledTimes(ONE_CALL);
    });
  });

  describe("Filtering Logic", () => {
    it("skips rendering bars for null/NaN values", () => {
      renderChart({
        datasets: [
          {
            borderColor: DEFAULT_COLOR,
            data: [DATA_10, null, NaN, DATA_20],
            label: "Bars",
            type: "bar"
          }
        ],
        labels: ["a", "b", "c", "d"]
      });

      expect(barSpy).toHaveBeenCalledTimes(TWO_CALLS);
    });

    it("skips points where labels are missing", () => {
      renderChart({
        datasets: [
          {
            borderColor: DEFAULT_COLOR,
            data: [DATA_10, DATA_20, DATA_30],
            label: "Line"
          }
        ],
        labels: ["a"]
      });

      const lineProps = lineSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as { data: unknown[] };
      expect(lineProps.data).toHaveLength(ONE_CALL);
    });

    it("skips rendering bars when label is undefined (line 113)", () => {
      // More data points than labels - some will have undefined labels
      renderChart({
        datasets: [
          {
            borderColor: DEFAULT_COLOR,
            data: [DATA_10, DATA_20, DATA_30],
            label: "Bars",
            type: "bar"
          }
        ],
        labels: ["a", "b"] // Only 2 labels for 3 data points
      });

      // Should only render 2 bars (third has undefined label)
      expect(barSpy).toHaveBeenCalledTimes(TWO_CALLS);
    });
  });

  describe("Line Chart Rendering", () => {
    it("renders line without fill", () => {
      renderChart({
        datasets: [
          {
            borderColor: DEFAULT_COLOR,
            data: [DATA_10, DATA_20],
            fill: false,
            label: "Line"
          }
        ],
        labels: ["a", "b"]
      });

      expect(lineSpy).toHaveBeenCalled();
      expect(areaSpy).not.toHaveBeenCalled();
    });

    it("renders with custom borderWidth", () => {
      const customBorderWidth = 4;
      renderChart({
        datasets: [
          {
            borderColor: DEFAULT_COLOR,
            borderWidth: customBorderWidth,
            data: [DATA_10, DATA_20],
            label: "Line"
          }
        ],
        labels: ["a", "b"]
      });

      expect(lineSpy).toHaveBeenCalled();
      const lineProps = lineSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as { strokeWidth: number };
      expect(lineProps.strokeWidth).toBe(customBorderWidth);
    });

    it("uses backgroundColor for filled area", () => {
      const bgColor = "#123456";
      renderChart({
        datasets: [
          {
            backgroundColor: bgColor,
            borderColor: DEFAULT_COLOR,
            data: [DATA_10, DATA_20],
            fill: true,
            label: "Area"
          }
        ],
        labels: ["a", "b"]
      });

      expect(areaSpy).toHaveBeenCalled();
      const areaProps = areaSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as { fill: string };
      expect(areaProps.fill).toBe(bgColor);
    });
  });

  describe("Axis Formatting", () => {
    it("formats left axis with decimal values for small maxValue", () => {
      const verySmallValue1 = 0.1;
      const verySmallValue2 = 0.2;
      renderChart({
        datasets: [
          {
            borderColor: DEFAULT_COLOR,
            data: [verySmallValue1, verySmallValue2],
            label: "Small Values"
          }
        ],
        labels: ["a", "b"]
      });

      expect(axisLeftSpy).toHaveBeenCalled();
      const props = axisLeftSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as {
        tickFormat: (v: number) => string;
      };
      const smallValue = 0.15;
      // When maxLeftValue < 1, should use 3 decimal places
      expect(props.tickFormat(smallValue)).toBe("0.150");
    });

    it("formats right axis with decimal values for fractional numbers", () => {
      renderChart({
        datasets: [
          { borderColor: DEFAULT_COLOR, data: [DATA_10, DATA_20], label: "Left", yAxisID: "y" },
          { borderColor: DEFAULT_COLOR, data: [DATA_FLOAT_1, DATA_FLOAT_2], label: "Right", yAxisID: "y1" }
        ],
        labels: ["a", "b"]
      });

      expect(axisRightSpy).toHaveBeenCalled();
      const props = axisRightSpy.mock.calls[FIRST_CALL]?.[FIRST_ARG] as {
        tickFormat: (v: number) => string;
      };
      // Whole number should show without decimals
      expect(props.tickFormat(DATA_10)).toBe("10");
      // Fractional number should show with 1 decimal
      expect(props.tickFormat(DATA_FLOAT_LARGE)).toBe("10.6");
    });
  });
});
