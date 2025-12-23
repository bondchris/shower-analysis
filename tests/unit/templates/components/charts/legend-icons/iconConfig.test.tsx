// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createIconComponent,
  iconConfig
} from "../../../../../../src/templates/components/charts/legend-icons/iconConfig";
import * as svgLoader from "../../../../../../src/templates/components/charts/legend-icons/svgLoader";

vi.mock("../../../../../../src/templates/components/charts/legend-icons/svgLoader", () => ({
  loadSvgContent: vi.fn()
}));

describe("iconConfig", () => {
  const TEST_COLOR = "#ff0000";
  const TEST_X = 10;
  const TEST_Y = 20;
  const TEST_LEGEND_BOX_SIZE = 12;
  const MOCK_SVG_CONTENT = '<path fill="#ff0000" d="M0,0"/>';

  describe("iconConfig object", () => {
    it("should contain all expected icon configurations", () => {
      const expectedIcons = [
        "cabinet",
        "chairArmExisting",
        "chairArmMissing",
        "chairBackMissing",
        "circularElliptic",
        "dining",
        "doorClosed",
        "doorOpen",
        "existing",
        "four",
        "rectangular",
        "shelf",
        "singleSeat",
        "star",
        "stool",
        "unidentified"
      ];

      for (const iconName of expectedIcons) {
        expect(iconConfig[iconName]).toBeDefined();
        expect(iconConfig[iconName]?.svgPath).toBeDefined();
        expect(iconConfig[iconName]?.viewBoxSize).toBeDefined();
      }
    });
  });

  describe("createIconComponent", () => {
    it("should create a component for a valid icon name", () => {
      vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

      const TestIcon = createIconComponent("cabinet");
      const { container } = render(
        <TestIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
      );

      expect(container.querySelector("g")).not.toBeNull();
      expect(svgLoader.loadSvgContent).toHaveBeenCalledWith("src/templates/assets/icons/cabinet.svg", TEST_COLOR);
    });

    it("should throw an error for an invalid icon name", () => {
      const invalidIconName = "nonexistentIcon";

      expect(() => {
        createIconComponent(invalidIconName);
      }).toThrow(`Icon configuration not found for: ${invalidIconName}`);
    });

    it("should set displayName on created component", () => {
      vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

      const TestIcon = createIconComponent("cabinet");
      expect(TestIcon.displayName).toBe("CabinetIcon");
    });

    it("should set displayName correctly for camelCase icon names", () => {
      vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

      const TestIcon = createIconComponent("chairArmExisting");
      expect(TestIcon.displayName).toBe("ChairArmExistingIcon");
    });

    it("should create component that uses correct svgPath and viewBoxSize", () => {
      vi.spyOn(svgLoader, "loadSvgContent").mockReturnValue(MOCK_SVG_CONTENT);

      const TestIcon = createIconComponent("dining");
      const { container } = render(
        <TestIcon color={TEST_COLOR} x={TEST_X} y={TEST_Y} legendBoxSize={TEST_LEGEND_BOX_SIZE} />
      );

      const diningConfig = iconConfig["dining"];
      if (diningConfig === undefined) {
        throw new Error("dining config not found");
      }
      const expectedScale = TEST_LEGEND_BOX_SIZE / diningConfig.viewBoxSize;
      const gElement = container.querySelector("g");
      expect(gElement?.getAttribute("transform")).toContain(`scale(${String(expectedScale)})`);
      expect(svgLoader.loadSvgContent).toHaveBeenCalledWith(diningConfig.svgPath, TEST_COLOR);
    });
  });
});
