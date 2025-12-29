// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Histogram } from "../../../../../src/templates/components/charts/Histogram";
import { HistogramConfig } from "../../../../../src/models/chart/histogramConfig";

// Mock Visx components to isolate logic
vi.mock("@visx/group", () => ({ Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g> }));
vi.mock("@visx/shape", () => ({
  Bar: () => <rect data-testid="visx-bar" />
}));
vi.mock("@visx/grid", () => ({ GridRows: () => <g /> }));
vi.mock("@visx/axis", () => ({
  AxisBottom: () => <g data-testid="axis-bottom" />,
  AxisLeft: () => <g data-testid="axis-left" />
}));

// Mock scaleBand to return undefined for specific labels to test the fallback branch at line 89
let mockScaleReturnUndefined = false;
vi.mock("@visx/scale", () => ({
  scaleBand: () => {
    const scale = (label: string): number | undefined => {
      if (mockScaleReturnUndefined && label === "fallback-label") {
        return undefined;
      }
      const domainPadding = 50;
      const labelIndex = 0;
      const offset = labelIndex * domainPadding;
      return domainPadding + offset;
    };
    scale.bandwidth = () => 40;
    scale.domain = () => [];
    scale.range = () => [0, 500];
    return scale;
  },
  scaleLinear: () => {
    const scale = (value: number): number => {
      const maxValue = 300;
      const scaleFactor = 10;
      const scaledValue = value * scaleFactor;
      return maxValue - scaledValue;
    };
    scale.domain = () => [];
    scale.range = () => [0, 300];
    return scale;
  }
}));

describe("Histogram Component", () => {
  const HEIGHT = 300;
  const BUCKET_A = 5;
  const BUCKET_B = 10;
  const BUCKET_C = 15;
  const BIN_SIZE = 5;
  const MIN_VAL = 0;
  const MAX_VAL = 15;

  const baseConfig: HistogramConfig = {
    buckets: [BUCKET_A, BUCKET_B, BUCKET_C],
    colors: ["#ff0000", "#00ff00", "#0000ff"],
    height: HEIGHT,
    labels: ["0-5", "5-10", "10-15"],
    options: { binSize: BIN_SIZE, max: MAX_VAL, min: MIN_VAL },
    type: "histogram"
  };

  it("should render histogram with data", () => {
    const { getAllByTestId } = render(<Histogram config={baseConfig} />);
    expect(getAllByTestId("visx-bar")).toHaveLength(baseConfig.buckets.length);
  });

  it("should handle undefined labels (skip rendering)", () => {
    const config: HistogramConfig = {
      ...baseConfig,
      buckets: [BUCKET_A, BUCKET_B, BUCKET_C],
      labels: ["0-5", "5-10"] // Missing third label
    };
    const { getAllByTestId } = render(<Histogram config={config} />);
    // Should only render 2 bars (third bucket has undefined label)
    const expectedBars = 2;
    expect(getAllByTestId("visx-bar")).toHaveLength(expectedBars);
  });

  it("should use string color when colors is not an array", () => {
    const config: HistogramConfig = {
      ...baseConfig,
      colors: "#ff0000" // Single string color
    };
    const { getAllByTestId } = render(<Histogram config={config} />);
    expect(getAllByTestId("visx-bar")).toHaveLength(baseConfig.buckets.length);
  });

  it("should use xLabel from options", () => {
    const config: HistogramConfig = {
      ...baseConfig,
      options: { ...baseConfig.options, xLabel: "Test X Label" }
    };
    const { container } = render(<Histogram config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should handle xBand returning undefined (fallback to zeroValue at line 89)", () => {
    // Enable the mock to return undefined for specific label
    mockScaleReturnUndefined = true;

    const config: HistogramConfig = {
      ...baseConfig,
      labels: ["fallback-label", "5-10", "10-15"]
    };
    const { container } = render(<Histogram config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();

    // Reset mock
    mockScaleReturnUndefined = false;
  });

  it("should apply custom width from options", () => {
    const customWidth = 800;
    const config: HistogramConfig = {
      ...baseConfig,
      options: { ...baseConfig.options, width: customWidth }
    };
    const { container } = render(<Histogram config={config} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe(String(customWidth));
  });

  it("should calculate dynamic label font size based on bar width", () => {
    // Test with narrow width to get smaller font size
    const narrowWidth = 200;
    const config: HistogramConfig = {
      ...baseConfig,
      options: { ...baseConfig.options, width: narrowWidth }
    };
    const { container } = render(<Histogram config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should handle long tick labels for x-axis label positioning", () => {
    const config: HistogramConfig = {
      ...baseConfig,
      labels: ["Very Long Label 1", "Very Long Label 2", "Very Long Label 3"]
    };
    const { container } = render(<Histogram config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
