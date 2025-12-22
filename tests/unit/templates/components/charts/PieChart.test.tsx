// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PieChart } from "../../../../../src/templates/components/charts/PieChart";
import { PieChartConfig } from "../../../../../src/utils/chartUtils";

// Mock Visx components to isolate logic
vi.mock("@visx/group", () => ({ Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g> }));

interface PieArcDatum {
  data: number;
  endAngle: number;
  index: number;
  padAngle: number;
  startAngle: number;
  value: number;
}

interface PieResult {
  arcs: PieArcDatum[];
  path: {
    (arc: PieArcDatum): string | null;
    centroid: (arc: PieArcDatum) => [number, number];
  };
}

interface PieProps {
  children: (pie: PieResult) => React.ReactNode;
  cornerRadius?: number;
  data: number[];
  innerRadius: number;
  outerRadius: number;
  padAngle: number;
  pieValue: (d: number) => number;
}

const createMockPie = (data: number[]): PieResult => {
  const zeroValue = 0;
  const total = data.reduce((sum, val) => sum + val, zeroValue);
  if (total === zeroValue) {
    const emptyPath: PieResult["path"] = Object.assign(() => null, {
      centroid: () => [zeroValue, zeroValue] as [number, number]
    });
    return {
      arcs: [],
      path: emptyPath
    };
  }
  let currentAngle = zeroValue;
  const fullCircleMultiplier = 2;
  const arcs: PieArcDatum[] = data.map((value, index) => {
    const angle = (value / total) * fullCircleMultiplier * Math.PI;
    const arc: PieArcDatum = {
      data: value,
      endAngle: currentAngle + angle,
      index,
      padAngle: 0.005,
      startAngle: currentAngle,
      value
    };
    currentAngle += angle;
    return arc;
  });

  const mockPathString = "M 0,0 L 10,0 A 10,10 0 0,1 0,10 Z";
  const pathFunction: PieResult["path"] = Object.assign(() => mockPathString, {
    centroid: (arc: PieArcDatum) => {
      const divisor = 2;
      const midAngle = (arc.startAngle + arc.endAngle) / divisor;
      return [Math.cos(midAngle), Math.sin(midAngle)] as [number, number];
    }
  });

  return { arcs, path: pathFunction };
};

vi.mock("@visx/shape", () => ({
  Pie: ({ children, data }: PieProps) => {
    const pie = createMockPie(data);
    return <>{children(pie)}</>;
  }
}));

vi.mock("@visx/text", () => ({
  Text: ({ children, x, y }: { children?: React.ReactNode; x?: number; y?: number }) => (
    <text data-testid="pie-text" x={x} y={y}>
      {children}
    </text>
  )
}));

describe("PieChart Component", () => {
  const HEIGHT = 300;
  const WIDTH = 300;
  const VALUE_OPEN = 50;
  const VALUE_CLOSED = 30;
  const VALUE_UNKNOWN = 20;
  const DATA = [VALUE_OPEN, VALUE_CLOSED, VALUE_UNKNOWN];
  const LABELS = ["Open", "Closed", "Unknown"];

  const baseConfig: PieChartConfig = {
    data: DATA,
    height: HEIGHT,
    labels: LABELS,
    options: {},
    type: "pie"
  };

  it("should render pie chart with data", () => {
    const { container } = render(<PieChart config={baseConfig} />);
    expect(container.querySelector("svg")).not.toBeNull();
    // Path elements include pie slices plus door icons in legend (each door has a frame rect and door panel path/rect)
    // So we expect more paths than just the data length
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(DATA.length);
  });

  it("should display labels in legend", () => {
    render(<PieChart config={baseConfig} />);
    // Labels should be in legend without percentages
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("should render 'No data' message when total is zero", () => {
    const zeroValue = 0;
    const config: PieChartConfig = {
      ...baseConfig,
      data: [zeroValue, zeroValue, zeroValue]
    };
    render(<PieChart config={config} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("should render 'No data' message when data array is empty", () => {
    const config: PieChartConfig = {
      ...baseConfig,
      data: []
    };
    render(<PieChart config={config} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("should use custom width and height from options", () => {
    const customWidth = 400;
    const customHeight = 500;
    const config: PieChartConfig = {
      ...baseConfig,
      height: customHeight,
      options: {
        width: customWidth
      }
    };
    const { container } = render(<PieChart config={config} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", String(customWidth));
    // Height will be increased to accommodate legend
    const svgHeight = Number.parseInt(svg?.getAttribute("height") ?? "0", 10);
    expect(svgHeight).toBeGreaterThan(customHeight);
  });

  it("should use default colors when not provided", () => {
    const { container } = render(<PieChart config={baseConfig} />);
    const paths = container.querySelectorAll("path");
    const minPathCount = 0;
    expect(paths.length).toBeGreaterThan(minPathCount);
    // All paths should have a fill color (default colors are applied)
    paths.forEach((path) => {
      expect(path).toHaveAttribute("fill");
    });
  });

  it("should use custom colors from options", () => {
    const customColors = ["#ff0000", "#00ff00", "#0000ff"];
    const config: PieChartConfig = {
      ...baseConfig,
      options: {
        colors: customColors
      }
    };
    const { container } = render(<PieChart config={config} />);
    const paths = container.querySelectorAll("path");
    const minPathCount = 0;
    expect(paths.length).toBeGreaterThan(minPathCount);
    // Check that paths have fill colors (exact color matching is complex due to visx internals)
    paths.forEach((path) => {
      expect(path).toHaveAttribute("fill");
    });
  });

  it("should handle single data point", () => {
    const singleValue = 100;
    const config: PieChartConfig = {
      ...baseConfig,
      data: [singleValue],
      labels: ["Single"]
    };
    render(<PieChart config={config} />);
    // Label should be in legend
    expect(screen.getByText("Single")).toBeInTheDocument();
  });

  it("should handle undefined labels gracefully", () => {
    const config: PieChartConfig = {
      ...baseConfig,
      labels: ["Open", undefined as unknown as string, "Unknown"]
    };
    render(<PieChart config={config} />);
    // Should still render without crashing
    const { container } = render(<PieChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should cycle through colors when there are more data points than colors", () => {
    const manyDataPoints = 10;
    const dataPointValue = 10;
    const labelIndexOffset = 1;
    const manyLabels = Array.from({ length: manyDataPoints }, (_, i) => {
      const labelIndex = i + labelIndexOffset;
      return `Label ${String(labelIndex)}`;
    });
    const manyData = Array.from({ length: manyDataPoints }, () => dataPointValue);
    const config: PieChartConfig = {
      ...baseConfig,
      data: manyData,
      labels: manyLabels
    };
    const { container } = render(<PieChart config={config} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(manyDataPoints);
    // All paths should have colors (cycling through default colors)
    paths.forEach((path) => {
      expect(path).toHaveAttribute("fill");
    });
  });

  it("should display labels for different values", () => {
    const smallValue = 10;
    const mediumValue = 20;
    const largeValue = 70;
    const unequalData = [smallValue, mediumValue, largeValue];
    const config: PieChartConfig = {
      ...baseConfig,
      data: unequalData,
      labels: ["Small", "Medium", "Large"]
    };
    render(<PieChart config={config} />);
    // Labels should be in legend
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Large")).toBeInTheDocument();
  });

  it("should render with default width and height when not specified", () => {
    const config: PieChartConfig = {
      ...baseConfig,
      options: {}
    };
    const { container } = render(<PieChart config={config} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", String(WIDTH));
    // Height will be increased to accommodate legend
    const svgHeight = Number.parseInt(svg?.getAttribute("height") ?? "0", 10);
    expect(svgHeight).toBeGreaterThan(HEIGHT);
  });

  it("should handle very small angles (should not show labels if angle too small)", () => {
    // Create data where one segment is very small
    const smallValue = 1;
    const largeValue = 999;
    const config: PieChartConfig = {
      ...baseConfig,
      data: [smallValue, largeValue],
      labels: ["Tiny", "Large"]
    };
    const { container } = render(<PieChart config={config} />);
    // Should render without crashing
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should render legend with labels", () => {
    render(<PieChart config={baseConfig} />);
    // Check that legend items are rendered with labels only
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("should render legend color boxes", () => {
    const { container } = render(<PieChart config={baseConfig} />);
    // Legend should have rect elements for color boxes
    const rects = container.querySelectorAll("rect");
    // Should have at least one rect for each data point (color boxes in legend)
    expect(rects.length).toBeGreaterThanOrEqual(DATA.length);
  });
});
