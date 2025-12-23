import * as fs from "fs";
import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import { loadSvgContent } from "../../../../../../src/templates/components/charts/legend-icons/svgLoader";

vi.mock("fs");

describe("svgLoader", () => {
  describe("loadSvgContent", () => {
    it("should extract inner content from SVG and replace currentColor", () => {
      const svgContent = '<svg fill="currentColor" viewBox="0 0 16 16"><path fill="currentColor" d="M12 1"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      expect(result).toBe('<path fill="#ff0000" d="M12 1"/>');
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "src/templates/assets/icons/test.svg"),
        "utf-8"
      );
    });

    it("should replace currentColor in CSS styles and inline fill attribute", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.st0{fill:currentColor;}</style><path class="st0" d="M0,0"/></svg>';
      const color = "#00ff00";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Style tags are removed and fill is inlined on elements with the class
      expect(result).toContain('fill="#00ff00"');
      expect(result).toContain('class="st0"');
      expect(result).not.toContain("<style>");
      expect(result).not.toContain("</style>");
    });

    it("should handle case-insensitive currentColor replacement", () => {
      const svgContent = '<svg viewBox="0 0 16 16"><path fill="CURRENTCOLOR" d="M12 1"/></svg>';
      const color = "#0000ff";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      expect(result).toBe('<path fill="#0000ff" d="M12 1"/>');
    });

    it("should handle SVG with multiple currentColor instances", () => {
      const svgContent =
        '<svg viewBox="0 0 16 16"><g><path fill="currentColor" d="M1 1"/><circle fill="currentColor" cx="8" cy="8"/></g></svg>';
      const color = "#ffff00";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      expect(result).toContain('fill="#ffff00"');
      expect(result).not.toContain("currentColor");
    });

    it("should throw error for invalid SVG file without svg tags", () => {
      const invalidContent = "<div>Not an SVG</div>";
      const svgPath = "src/templates/assets/icons/invalid.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(invalidContent);

      expect(() => {
        loadSvgContent(svgPath, "#000000");
      }).toThrow("Invalid SVG file");
    });

    it("should handle SVG with nested groups and preserve structure", () => {
      const svgContent =
        '<svg viewBox="0 0 16 16"><g id="outer"><g id="inner"><path fill="currentColor" d="M1 1"/></g></g></svg>';
      const color = "#123456";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      expect(result).toContain('<g id="outer">');
      expect(result).toContain('<g id="inner">');
      expect(result).toContain('fill="#123456"');
      expect(result).not.toContain("currentColor");
    });

    it("should handle SVG with whitespace and newlines", () => {
      const svgContent = `<svg viewBox="0 0 16 16">
        <path fill="currentColor" d="M12 1"/>
      </svg>`;
      const color = "#abcdef";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      expect(result).toContain('fill="#abcdef"');
      expect(result).not.toContain("currentColor");
    });

    it("should handle stroke attributes in CSS styles", () => {
      const svgContent =
        '<svg viewBox="0 0 24 24"><style>.cls-1{fill:none;stroke:currentColor;stroke-width:1.91px;}</style><path class="cls-1" d="M7.22,13h9.57"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Style tags are removed and stroke is inlined on elements with the class
      expect(result).toContain('stroke="#ff0000"');
      expect(result).toContain('class="cls-1"');
      expect(result).not.toContain("<style>");
      expect(result).not.toContain("</style>");
    });

    it("should handle both fill and stroke in CSS styles", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.st0{fill:currentColor;stroke:currentColor;}</style><path class="st0" d="M0,0"/></svg>';
      const color = "#00ffff";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Both fill and stroke should be inlined
      expect(result).toContain('fill="#00ffff"');
      expect(result).toContain('stroke="#00ffff"');
      expect(result).toContain('class="st0"');
      expect(result).not.toContain("<style>");
    });

    it("should handle CSS class with only fill (no stroke)", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.fillOnly{fill:currentColor;}</style><path class="fillOnly" d="M0,0"/></svg>';
      const color = "#ff00ff";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Only fill should be inlined, not stroke
      expect(result).toContain('fill="#ff00ff"');
      expect(result).toContain('class="fillOnly"');
      expect(result).not.toContain("stroke=");
      expect(result).not.toContain("<style>");
    });

    it("should handle CSS class with only stroke (no fill)", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.strokeOnly{stroke:currentColor;}</style><path class="strokeOnly" d="M0,0"/></svg>';
      const color = "#ffff00";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Only stroke should be inlined, not fill
      expect(result).toContain('stroke="#ffff00"');
      expect(result).toContain('class="strokeOnly"');
      expect(result).not.toContain("fill=");
      expect(result).not.toContain("<style>");
    });

    it("should not inline attributes if they already exist before class attribute", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.existing{fill:currentColor;stroke:currentColor;}</style><path fill="#123456" stroke="#654321" class="existing" d="M0,0"/></svg>';
      const color = "#00ffff";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should not add fill/stroke if they already exist before class attribute
      // The code checks only the part before class, so existing attributes there prevent inlining
      expect(result).toContain('fill="#123456"');
      expect(result).toContain('stroke="#654321"');
      expect(result).toContain('class="existing"');
      expect(result).not.toContain("<style>");
    });

    it("should handle empty style tag content", () => {
      const svgContent = '<svg viewBox="0 0 100 100"><style></style><path d="M0,0"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should handle empty style tags gracefully
      expect(result).not.toContain("<style>");
      expect(result).toContain('<path d="M0,0"/>');
    });

    it("should handle CSS class without fill or stroke properties", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.noColor{width:100px;height:100px;}</style><path class="noColor" d="M0,0"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should not add fill or stroke attributes if they're not in the CSS
      expect(result).toContain('class="noColor"');
      expect(result).not.toContain("fill=");
      expect(result).not.toContain("stroke=");
      expect(result).not.toContain("<style>");
    });

    it("should handle CSS class with fill:none", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.noneFill{fill:none;stroke:currentColor;}</style><path class="noneFill" d="M0,0"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should inline fill:none and stroke
      expect(result).toContain('fill="none"');
      expect(result).toContain('stroke="#ff0000"');
      expect(result).toContain('class="noneFill"');
      expect(result).not.toContain("<style>");
    });

    it("should handle multiple style tags", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.first{fill:currentColor;}</style><path class="first" d="M0,0"/><style>.second{stroke:currentColor;}</style><path class="second" d="M10,10"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should process both style tags
      expect(result).toContain('fill="#ff0000"');
      expect(result).toContain('stroke="#ff0000"');
      expect(result).toContain('class="first"');
      expect(result).toContain('class="second"');
      expect(result).not.toContain("<style>");
    });

    it("should handle class name with special characters that need escaping", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.test-class{fill:currentColor;}</style><path class="test-class" d="M0,0"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should handle class names with hyphens
      expect(result).toContain('fill="#ff0000"');
      expect(result).toContain('class="test-class"');
      expect(result).not.toContain("<style>");
    });

    it("should handle fill with whitespace in CSS property value", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.spaced{fill: currentColor ;}</style><path class="spaced" d="M0,0"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should handle fill values with whitespace (though regex excludes spaces, this tests trimming)
      expect(result).toContain('class="spaced"');
      expect(result).not.toContain("<style>");
    });

    it("should handle stroke with whitespace in CSS property value", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.spaced{stroke: currentColor ;}</style><path class="spaced" d="M0,0"/></svg>';
      const color = "#ff0000";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      // Should handle stroke values with whitespace
      expect(result).toContain('class="spaced"');
      expect(result).not.toContain("<style>");
    });
  });
});
