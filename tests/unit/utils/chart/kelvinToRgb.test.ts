import { describe, expect, it } from "vitest";
import { kelvinToHex } from "../../../../src/utils/chart/kelvinToRgb";

describe("kelvinToHex", () => {
  it("should return warm color for low Kelvin (candlelight ~2000K)", () => {
    const result = kelvinToHex(2000);
    // Should be warm orange/red color
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // Red component should be high (ff)
    expect(result.slice(1, 3)).toBe("ff");
  });

  it("should return neutral white for daylight (~6500K)", () => {
    const result = kelvinToHex(6500);
    // Should be close to white
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // All components should be high (white-ish)
    const red = parseInt(result.slice(1, 3), 16);
    const green = parseInt(result.slice(3, 5), 16);
    const blue = parseInt(result.slice(5, 7), 16);
    expect(red).toBe(255);
    expect(green).toBeGreaterThan(200);
    // Blue is close to 255 but not quite at 6500K (becomes 255 at 6600K+)
    expect(blue).toBeGreaterThan(240);
  });

  it("should return cooler blue-ish color for high Kelvin (10000K)", () => {
    const result = kelvinToHex(10000);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    // Blue component should be 255
    const blue = parseInt(result.slice(5, 7), 16);
    expect(blue).toBe(255);
  });

  it("should clamp values below minimum Kelvin", () => {
    const result = kelvinToHex(500);
    // Should clamp to 1000K and return warm color
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.slice(1, 3)).toBe("ff"); // Red should be max
  });

  it("should clamp values above maximum Kelvin", () => {
    const result = kelvinToHex(50000);
    // Should clamp to 40000K
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    const blue = parseInt(result.slice(5, 7), 16);
    expect(blue).toBe(255);
  });

  it("should return consistent results for typical color temperatures", () => {
    // Warm indoor lighting (~3000K) should be warmer than daylight
    const warmLight = kelvinToHex(3000);
    const daylight = kelvinToHex(6500);

    const warmBlue = parseInt(warmLight.slice(5, 7), 16);
    const daylightBlue = parseInt(daylight.slice(5, 7), 16);

    expect(warmBlue).toBeLessThan(daylightBlue);
  });
});
