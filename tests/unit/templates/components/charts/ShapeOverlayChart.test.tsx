// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShapeOverlayChartConfig } from "../../../../../src/models/chart/shapeOverlayChartConfig";
import { ShapeOverlayChart } from "../../../../../src/templates/components/charts/ShapeOverlayChart";

describe("ShapeOverlayChart", () => {
  const outline = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ];

  const baseConfig: ShapeOverlayChartConfig = {
    height: 200,
    options: {},
    shapes: [outline],
    type: "shape-overlay"
  };

  it("renders outlines as SVG paths", () => {
    const { container } = render(<ShapeOverlayChart config={baseConfig} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(1);
  });

  it("shows fallback text when no shapes are provided", () => {
    const emptyConfig: ShapeOverlayChartConfig = { ...baseConfig, shapes: [] };
    render(<ShapeOverlayChart config={emptyConfig} />);
    expect(screen.getByText("No shapes available")).toBeInTheDocument();
  });
});
