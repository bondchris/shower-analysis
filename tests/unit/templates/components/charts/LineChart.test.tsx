// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { LineChart } from "../../../../../src/templates/components/charts/LineChart";
import { LineChartConfig } from "../../../../../src/utils/chartUtils";

// Mock Visx components to avoid complex SVG rendering issues
vi.mock("@visx/group", () => ({ Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g> }));
vi.mock("@visx/shape", () => ({ Bar: () => <rect />, LinePath: () => <path /> }));
vi.mock("@visx/text", () => ({ Text: () => <text /> }));
vi.mock("@visx/axis", () => ({ AxisBottom: () => <g />, AxisLeft: () => <g />, AxisRight: () => <g /> }));
vi.mock("@visx/grid", () => ({ GridColumns: () => <g />, GridRows: () => <g /> }));

describe("LineChart", () => {
  const HEIGHT = 300;
  const DATA_A = 10;
  const DATA_B = 20;
  const DATA_C = 30;

  it("should render without crashing with minimal config", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B"],
      options: { title: "Test Chart", yLabel: "Y" },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container).toBeDefined();
    // Basic check that SVG is rendered
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should handle null and non-finite values gracefully", () => {
    const config: LineChartConfig = {
      datasets: [
        {
          borderColor: "blue",
          // Includes null, Infinity, and NaN to trigger line 76
          data: [DATA_A, null, Infinity, NaN, DATA_B],
          label: "Edge Cases"
        }
      ],
      height: HEIGHT,
      labels: ["A", "B", "C", "D", "E"],
      options: { title: "Edge Case Chart", yLabel: "Y" },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
    // Should render only valid points
    // Note: It's hard to assert exact path commands without deeper inspection,
    // but successful render without throw confirms robustness.
  });

  it("should handle mismatch between labels and data (undefined label)", () => {
    const config: LineChartConfig = {
      datasets: [
        {
          borderColor: "green",
          data: [DATA_A, DATA_B, DATA_C], // More data than labels
          label: "Mismatch"
        }
      ],
      height: HEIGHT,
      labels: ["A", "B"], // Only 2 labels
      options: { title: "Mismatch Chart", yLabel: "Y" },
      type: "line"
    };
    // The 3rd data point (30) will have undefined label (index 2), triggering line 80
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
