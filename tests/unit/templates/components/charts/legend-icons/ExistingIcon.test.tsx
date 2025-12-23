// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExistingIcon } from "../../../../../../src/templates/components/charts/legend-icons/iconConfig";
import * as svgLoader from "../../../../../../src/templates/components/charts/legend-icons/svgLoader";

vi.mock("../../../../../../src/templates/components/charts/legend-icons/svgLoader", () => ({
  loadSvgContent: vi.fn()
}));

describe("ExistingIcon", () => {
  const TEST_COLOR = "#ff0000";
  const TEST_X = 10;
  const TEST_Y = 20;
  const TEST_LEGEND_BOX_SIZE = 12;
  const MOCK_SVG_CONTENT = '<path fill="#ff0000" d="M122.599,487.308"/>';
  const EXISTING_VIEWBOX_WIDTH = 511.997;

  it("should render with correct transform and scale", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const { container } = render(
      <ExistingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const gElement = container.querySelector("g");
    expect(gElement).not.toBeNull();
    const expectedScale = TEST_LEGEND_BOX_SIZE / EXISTING_VIEWBOX_WIDTH;
    expect(gElement?.getAttribute("transform")).toBe(
      `translate(${String(TEST_X)}, ${String(TEST_Y)}) scale(${String(expectedScale)})`
    );
  });

  it("should call loadSvgContent with correct path and color", () => {
    const loadSvgContentSpy = vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    render(<ExistingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />);

    expect(loadSvgContentSpy).toHaveBeenCalledWith("src/templates/assets/icons/chair-back-existing.svg", TEST_COLOR);
  });

  it("should render SVG content from loadSvgContent", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const { container } = render(
      <ExistingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const pathElement = container.querySelector("path");
    expect(pathElement).not.toBeNull();
    expect(pathElement?.getAttribute("fill")).toBe(TEST_COLOR);
  });

  it("should scale correctly for different legendBoxSize values", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const largeBoxSize = 24;
    const { container } = render(
      <ExistingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={largeBoxSize} />
    );

    const gElement = container.querySelector("g");
    const expectedScale = largeBoxSize / EXISTING_VIEWBOX_WIDTH;
    expect(gElement?.getAttribute("transform")).toContain(`scale(${String(expectedScale)})`);
  });

  it("should handle different color values", () => {
    const differentColor = "#00ff00";
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(`<path fill="${differentColor}" d="M122.599,487.308"/>`);

    const { container } = render(
      <ExistingIcon color={differentColor} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const pathElement = container.querySelector("path");
    expect(pathElement?.getAttribute("fill")).toBe(differentColor);
  });

  it("should handle different x and y positions", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const customX = 50;
    const customY = 100;
    const { container } = render(
      <ExistingIcon color={TEST_COLOR} x={customX} y={customY} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const gElement = container.querySelector("g");
    expect(gElement?.getAttribute("transform")).toContain(`translate(${String(customX)}, ${String(customY)})`);
  });
});
