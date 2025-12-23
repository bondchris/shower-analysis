// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChairArmMissingIcon } from "../../../../../../src/templates/components/charts/legend-icons/iconConfig";
import * as svgLoader from "../../../../../../src/templates/components/charts/legend-icons/svgLoader";

vi.mock("../../../../../../src/templates/components/charts/legend-icons/svgLoader", () => ({
  loadSvgContent: vi.fn()
}));

describe("ChairArmMissingIcon", () => {
  const TEST_COLOR = "#ff0000";
  const TEST_X = 10;
  const TEST_Y = 20;
  const TEST_LEGEND_BOX_SIZE = 12;
  const MOCK_SVG_CONTENT = '<path class="cls-1" stroke="#ff0000" d="M7.22,13h9.57"/>';
  const CHAIR_ARM_MISSING_VIEWBOX_WIDTH = 24;

  it("should render with correct transform and scale", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const { container } = render(
      <ChairArmMissingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const gElement = container.querySelector("g");
    expect(gElement).not.toBeNull();
    const expectedScale = TEST_LEGEND_BOX_SIZE / CHAIR_ARM_MISSING_VIEWBOX_WIDTH;
    expect(gElement?.getAttribute("transform")).toBe(
      `translate(${String(TEST_X)}, ${String(TEST_Y)}) scale(${String(expectedScale)})`
    );
  });

  it("should call loadSvgContent with correct path and color", () => {
    const loadSvgContentSpy = vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    render(<ChairArmMissingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />);

    expect(loadSvgContentSpy).toHaveBeenCalledWith("src/templates/assets/icons/chair-arm-missing.svg", TEST_COLOR);
  });

  it("should render SVG content from loadSvgContent", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const { container } = render(
      <ChairArmMissingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const pathElement = container.querySelector("path");
    expect(pathElement).not.toBeNull();
    expect(pathElement?.getAttribute("stroke")).toBe(TEST_COLOR);
  });

  it("should scale correctly for different legendBoxSize values", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const largeBoxSize = 24;
    const { container } = render(
      <ChairArmMissingIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={largeBoxSize} />
    );

    const gElement = container.querySelector("g");
    const expectedScale = largeBoxSize / CHAIR_ARM_MISSING_VIEWBOX_WIDTH;
    expect(gElement?.getAttribute("transform")).toContain(`scale(${String(expectedScale)})`);
  });

  it("should handle different color values", () => {
    const differentColor = "#00ff00";
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(
      `<path class="cls-1" stroke="${differentColor}" d="M7.22,13h9.57"/>`
    );

    const { container } = render(
      <ChairArmMissingIcon color={differentColor} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const pathElement = container.querySelector("path");
    expect(pathElement?.getAttribute("stroke")).toBe(differentColor);
  });

  it("should handle different x and y positions", () => {
    vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

    const customX = 50;
    const customY = 100;
    const { container } = render(
      <ChairArmMissingIcon color={TEST_COLOR} x={customX} y={customY} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
    );

    const gElement = container.querySelector("g");
    expect(gElement?.getAttribute("transform")).toContain(`translate(${String(customX)}, ${String(customY)})`);
  });
});
