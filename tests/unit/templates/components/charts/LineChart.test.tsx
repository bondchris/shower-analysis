// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import * as visxScale from "@visx/scale";
import { LineChart } from "../../../../../src/templates/components/charts/LineChart";
import { LineChartConfig } from "../../../../../src/models/chart/lineChartConfig";

// Mock Visx components to avoid complex SVG rendering issues
vi.mock("@visx/group", () => ({ Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g> }));
vi.mock("@visx/shape", () => ({
  AreaClosed: ({ x, y, data }: { data?: unknown[]; x?: (d: unknown) => number; y?: (d: unknown) => number }) => {
    if (data && x && y) {
      data.forEach((d) => {
        try {
          x(d);
          y(d);
        } catch {
          /* ignore */
        }
      });
    }
    return <path data-testid="area-closed" />;
  },
  Bar: () => <rect />,
  LinePath: () => <path />
}));
vi.mock("@visx/text", () => ({ Text: () => <text /> }));
let capturedTickValues: string[] | undefined;
vi.mock("@visx/axis", () => ({
  AxisBottom: (props: { tickValues?: string[] }) => {
    capturedTickValues = props.tickValues;
    return <g />;
  },
  AxisLeft: () => <g />,
  AxisRight: () => <g />
}));
vi.mock("@visx/grid", () => ({ GridColumns: () => <g />, GridRows: () => <g /> }));

describe("LineChart", () => {
  const HEIGHT = 300;
  const DATA_A = 10;
  const DATA_B = 20;
  const DATA_C = 30;

  beforeEach(() => {
    vi.restoreAllMocks();
    capturedTickValues = undefined;
  });

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

  it("should render AreaClosed when fill is true (triggers accessors)", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], fill: true, label: "Filled" }],
      height: HEIGHT,
      labels: ["A", "B"],
      options: { title: "Filled Chart", yLabel: "Y" },
      type: "line"
    };
    const { getByTestId } = render(<LineChart config={config} />);
    expect(getByTestId("area-closed")).toBeDefined();
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

  it("should render legend for multiple datasets", () => {
    const config: LineChartConfig = {
      datasets: [
        { borderColor: "red", data: [DATA_A, DATA_B], label: "Set A" },
        { borderColor: "blue", data: [DATA_B, DATA_C], label: "Set B" }
      ],
      height: HEIGHT,
      labels: ["1", "2"],
      options: { title: "Multi Chart", yLabel: "Y" },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    // Check if legend is rendered (foreignObject)
    expect(container.querySelector("foreignObject")).not.toBeNull();
    // Check for labels
    expect(container.textContent).toContain("Set A");
    expect(container.textContent).toContain("Set B");
  });

  it("should render vertical reference line when verticalReferenceLine is provided", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C], label: "Test" }],
      height: HEIGHT,
      labels: ["10", "20", "30"],
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Avg: 20",
          value: 20
        },
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    // Check if line element is rendered (dashed line)
    const line = container.querySelector("line[stroke-dasharray]");
    expect(line).not.toBeNull();
    // Check if text label is rendered
    const text = container.querySelector("text");
    expect(text).not.toBeNull();
    expect(text?.textContent).toBe("Avg: 20");
  });

  it("should not render vertical reference line when no valid numeric labels exist", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B"], // Non-numeric labels
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Avg: 20",
          value: 20
        },
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    // Should not render the reference line when labels are not numeric
    const line = container.querySelector("line[stroke-dasharray]");
    expect(line).toBeNull();
  });

  it("should handle vertical reference line when value is between labels", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C], label: "Test" }],
      height: HEIGHT,
      labels: ["10", "20", "30"],
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Avg: 25",
          value: 25
        },
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    // Should still render the line (finds closest label)
    const line = container.querySelector("line[stroke-dasharray]");
    expect(line).not.toBeNull();
  });

  it("should handle vertical reference line when all labels are non-numeric", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B"], // All non-numeric
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Avg: 20",
          value: 20
        },
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    // Should not render the line when no valid numeric labels exist
    const line = container.querySelector("line[stroke-dasharray]");
    expect(line).toBeNull();
  });

  it("should handle vertical reference line with mixed numeric and non-numeric labels", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "20", "B"], // Mixed labels
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Avg: 20",
          value: 20
        },
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    // Should render the line using the numeric label
    const line = container.querySelector("line[stroke-dasharray]");
    expect(line).not.toBeNull();
  });

  it("should handle undefined label during vertical reference line calculation (line 127)", () => {
    // Test when labels array has gaps or undefined values during iteration
    // This triggers the `continue` at line 127 when labelValue is undefined
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C, DATA_A], label: "Test" }],
      height: HEIGHT,
      // Create a scenario where some indices may have undefined behavior
      // We use more data points than labels to create undefined label access
      labels: ["10", "20", "30"],
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Avg: 25",
          value: 25
        },
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("falls back to labels when first or last tick label is missing", () => {
    const labelCount = 20;
    const labels = new Array<string>(labelCount);
    for (let i = 1; i < labelCount - 1; i++) {
      labels[i] = `Label-${String(i)}`;
    }
    const dataValues = Array.from({ length: labelCount }, () => DATA_A);

    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: dataValues, label: "Missing labels" }],
      height: HEIGHT,
      labels,
      options: { title: "Missing labels", yLabel: "Y" },
      type: "line"
    };

    render(<LineChart config={config} />);

    expect(capturedTickValues).toEqual(labels);
  });

  it("renders reference line even when labels contain null gaps", () => {
    const labels = new Array<string>(3);
    labels[0] = "1";
    labels[2] = "5";

    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C], label: "Test" }],
      height: HEIGHT,
      labels,
      options: {
        title: "Reference with null label",
        verticalReferenceLine: {
          label: "Ref: 5",
          value: 5
        },
        yLabel: "Y"
      },
      type: "line"
    };

    const { container } = render(<LineChart config={config} />);

    const line = container.querySelector("line[stroke-dasharray]");
    expect(line).not.toBeNull();
    expect(container.querySelector("text")?.textContent).toBe("Ref: 5");
  });

  it("falls back ticks and skips invalid scale outputs while still drawing the reference line", () => {
    const realScaleLinear = visxScale.scaleLinear;
    const linearSpy = vi
      .spyOn(visxScale, "scaleLinear")
      .mockImplementation((config: Parameters<typeof visxScale.scaleLinear>[0]) => {
        const realScale = realScaleLinear(config);
        const wrapped = ((value: number) => {
          if (value === 999) {
            return "bad-value" as unknown as number;
          }
          return realScale(value);
        }) as unknown as ReturnType<typeof visxScale.scaleLinear>;
        return wrapped;
      });

    const labels = new Array<string>(3);
    labels[1] = "2";

    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, 999, DATA_B], label: "Gappy labels" }],
      height: HEIGHT,
      labels,
      options: {
        title: "Reference with gaps",
        verticalReferenceLine: { label: "Target", value: 2 },
        yLabel: "Y"
      },
      type: "line"
    };

    const { container } = render(<LineChart config={config} />);

    expect(capturedTickValues).toEqual(labels);
    const referenceLine = container.querySelector("line[stroke-dasharray]");
    expect(referenceLine).not.toBeNull();

    linearSpy.mockRestore();
  });

  it("skips points when scales return non-numeric values", () => {
    const realScalePoint = visxScale.scalePoint;
    const realScaleLinear = visxScale.scaleLinear;

    const pointSpy = vi
      .spyOn(visxScale, "scalePoint")
      .mockImplementation((config: Parameters<typeof visxScale.scalePoint>[0]) => {
        const realScale = realScalePoint(config);
        const wrapped = ((value: string) => {
          if (value === "bad-x") {
            return "not-a-number" as unknown as number;
          }
          return realScale(value);
        }) as unknown as ReturnType<typeof visxScale.scalePoint>;
        return wrapped;
      });

    const linearSpy = vi
      .spyOn(visxScale, "scaleLinear")
      .mockImplementation((config: Parameters<typeof visxScale.scaleLinear>[0]) => {
        const realScale = realScaleLinear(config);
        const wrapped = ((value: number) => {
          if (value === 999) {
            return "not-a-number" as unknown as number;
          }
          return realScale(value);
        }) as unknown as ReturnType<typeof visxScale.scaleLinear>;
        return wrapped;
      });

    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, 999], label: "Bad points" }],
      height: HEIGHT,
      labels: ["bad-x", "good-x"],
      options: { title: "Bad scale values", yLabel: "Y" },
      type: "line"
    };

    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();

    pointSpy.mockRestore();
    linearSpy.mockRestore();
  });

  it("skips labels that become undefined after numeric parsing when finding reference line", () => {
    const labels = ["10", "20", "30"];
    let accessCount = 0;
    Object.defineProperty(labels, 1, {
      configurable: true,
      get() {
        accessCount++;
        if (accessCount === 1) {
          return "20";
        }
        return undefined as unknown as string;
      }
    });

    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C], label: "Test" }],
      height: HEIGHT,
      labels,
      options: {
        title: "Test Chart",
        verticalReferenceLine: {
          label: "Ref",
          value: 20
        },
        yLabel: "Y"
      },
      type: "line"
    };

    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should handle missing xLabel option", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B"],
      options: {
        title: "Test Chart",
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should render with vertical lines mode", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], label: "Test", verticalLines: true }],
      height: HEIGHT,
      labels: ["A", "B"],
      options: {
        title: "Test Chart",
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should render with global vertical lines option", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B"],
      options: {
        title: "Test Chart",
        verticalLines: true,
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should render with gradient fill", () => {
    const config: LineChartConfig = {
      datasets: [
        {
          borderColor: "red",
          data: [DATA_A, DATA_B],
          fill: true,
          gradientDirection: "horizontal",
          gradientFrom: "#ff0000",
          gradientTo: "#0000ff",
          label: "Test"
        }
      ],
      height: HEIGHT,
      labels: ["A", "B"],
      options: {
        chartId: "test-chart",
        title: "Test Chart",
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should use smooth curve when smooth option is true", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "red", data: [DATA_A, DATA_B, DATA_C], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B", "C"],
      options: {
        smooth: true,
        title: "Test Chart",
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should use fallback borderColor from palette", () => {
    const config: LineChartConfig = {
      datasets: [{ borderColor: "", data: [DATA_A, DATA_B], label: "Test" }],
      height: HEIGHT,
      labels: ["A", "B"],
      options: {
        title: "Test Chart",
        yLabel: "Y"
      },
      type: "line"
    };
    const { container } = render(<LineChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
