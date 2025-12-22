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

    it("should replace currentColor in CSS styles", () => {
      const svgContent =
        '<svg viewBox="0 0 100 100"><style>.st0{fill:currentColor;}</style><path class="st0" d="M0,0"/></svg>';
      const color = "#00ff00";
      const svgPath = "src/templates/assets/icons/test.svg";

      vi.spyOn(fs, "readFileSync").mockReturnValue(svgContent);

      const result = loadSvgContent(svgPath, color);

      expect(result).toContain("fill:#00ff00");
      expect(result).toContain('<path class="st0"');
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
  });
});
