import { describe, expect, it } from "vitest";
import { brightnessToHex } from "../../../../src/utils/chart/brightnessToRgb";

describe("brightnessToHex", () => {
  it("should return pure black for minimum brightness (-6)", () => {
    const result = brightnessToHex(-6);
    expect(result).toBe("#000000");
  });

  it("should return pure white for maximum brightness (15)", () => {
    const result = brightnessToHex(15);
    expect(result).toBe("#ffffff");
  });

  it("should return middle gray for midpoint brightness", () => {
    // Midpoint of -6 to 15 is 4.5
    const result = brightnessToHex(4.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // Should be around middle gray (127)
    const grayValue = parseInt(result.slice(1, 3), 16);
    expect(grayValue).toBeGreaterThan(100);
    expect(grayValue).toBeLessThan(150);
  });

  it("should return grayscale colors (all RGB components equal)", () => {
    const result = brightnessToHex(5);
    expect(result).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it("should clamp values below minimum brightness", () => {
    const result = brightnessToHex(-10);
    expect(result).toBe("#000000");
  });

  it("should clamp values above maximum brightness", () => {
    const result = brightnessToHex(20);
    expect(result).toBe("#ffffff");
  });

  it("should return darker color for lower brightness values", () => {
    const lowBrightness = brightnessToHex(0);
    const highBrightness = brightnessToHex(10);

    const lowGray = parseInt(lowBrightness.slice(1, 3), 16);
    const highGray = parseInt(highBrightness.slice(1, 3), 16);

    expect(lowGray).toBeLessThan(highGray);
  });

  it("should produce consistent results for overlapping ranges", () => {
    // If min chart shows brightness 2 and avg chart shows brightness 2,
    // they should be the same color
    const fromMinChart = brightnessToHex(2);
    const fromAvgChart = brightnessToHex(2);
    expect(fromMinChart).toBe(fromAvgChart);
  });
});
