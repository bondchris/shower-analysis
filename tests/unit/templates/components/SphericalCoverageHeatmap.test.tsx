// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SphericalCoverageHeatmap } from "../../../../src/templates/components/SphericalCoverageHeatmap";

const calculateExpectedPixelColor = (value: number, maxSeconds: number) => {
  const emptyCount = 0;
  const fallbackMaxSeconds = 1;
  const colorExponent = 0.55;
  const hueStart = 195;
  const hueEnd = 10;
  const lightStart = 92;
  const lightEnd = 45;
  const saturation = 88;
  const fullCoverage = 1;
  const safeMaxSeconds = maxSeconds > emptyCount ? maxSeconds : fallbackMaxSeconds;

  const clampedValue = Math.min(Math.max(value / safeMaxSeconds, emptyCount), fullCoverage);
  const normalized = Math.pow(clampedValue, colorExponent);
  const hueRange = hueEnd - hueStart;
  const lightRange = lightEnd - lightStart;
  const hueAdjustment = hueRange * normalized;
  const lightAdjustment = lightRange * normalized;
  const hue = hueStart + hueAdjustment;
  const lightness = lightStart + lightAdjustment;

  return hslToRgbTest(hue, saturation, lightness);
};

const hslToRgbTest = (hue: number, saturationPercent: number, lightnessPercent: number) => {
  const doubleUnit = 2;
  const unity = 1;
  const sixtyDegrees = 60;
  const maxColorValue = 255;
  const lightnessNormalizer = 100;
  const saturationNormalizer = 100;
  const minLightContribution = 0;

  const normalizedSaturation = saturationPercent / saturationNormalizer;
  const normalizedLightness = lightnessPercent / lightnessNormalizer;
  const scaledLightness = doubleUnit * normalizedLightness;
  const lightnessDelta = scaledLightness - unity;
  const chromaBase = unity - Math.abs(lightnessDelta);
  const chroma = chromaBase * normalizedSaturation;
  const huePrime = hue / sixtyDegrees;
  const huePhase = huePrime % doubleUnit;
  const secondComponent = chroma * (unity - Math.abs(huePhase - unity));
  const preliminaryComponents: [number, number, number][] = [
    [chroma, secondComponent, minLightContribution],
    [secondComponent, chroma, minLightContribution],
    [minLightContribution, chroma, secondComponent],
    [minLightContribution, secondComponent, chroma],
    [secondComponent, minLightContribution, chroma],
    [chroma, minLightContribution, secondComponent]
  ];
  const hueSegmentCount = preliminaryComponents.length;
  const hueSegment = ((Math.floor(huePrime) % hueSegmentCount) + hueSegmentCount) % hueSegmentCount;
  const defaultComponents: [number, number, number] = [
    minLightContribution,
    minLightContribution,
    minLightContribution
  ];
  const [preliminaryRed, preliminaryGreen, preliminaryBlue] =
    preliminaryComponents[hueSegment] ?? preliminaryComponents[0] ?? defaultComponents;
  const chromaHalf = chroma / doubleUnit;
  const matchLightness = normalizedLightness - chromaHalf;

  return {
    blue: Math.round((preliminaryBlue + matchLightness) * maxColorValue),
    green: Math.round((preliminaryGreen + matchLightness) * maxColorValue),
    red: Math.round((preliminaryRed + matchLightness) * maxColorValue)
  };
};

describe("SphericalCoverageHeatmap", () => {
  it("shows an empty state when no coverage data is provided", () => {
    render(<SphericalCoverageHeatmap grid={[]} maxSeconds={0} />);

    expect(screen.getByText("No coverage data available.")).toBeInTheDocument();
  });

  it("renders the heatmap grid and gradient", () => {
    const grid = [
      [0, 0.5],
      [1, 2]
    ];

    render(<SphericalCoverageHeatmap grid={grid} maxSeconds={0} />);

    expect(screen.getByText("Aggregated Spherical Coverage (6 ft radius; 2.5° resolution)")).toBeInTheDocument();
    expect(screen.getByText("Less time")).toBeInTheDocument();
    expect(screen.getByText("More time")).toBeInTheDocument();

    const heatmap = screen.getByLabelText("Aggregated spherical coverage heatmap");
    expect(heatmap).toBeInTheDocument();
    expect(heatmap.tagName.toLowerCase()).toBe("img");
  });

  it("renders a cell per grid value with colors applied", () => {
    const grid = [
      [0, 1],
      [2, 3]
    ];
    const defaultWidthPx = 620;
    const defaultHeightPx = 310;
    const firstRow = grid[0] ?? [];
    const safeColCount = firstRow.length > 0 ? firstRow.length : 1;
    const safeRowCount = grid.length > 0 ? grid.length : 1;
    const cellSizePx = Math.max(1, Math.floor(Math.min(defaultWidthPx / safeColCount, defaultHeightPx / safeRowCount)));
    const heatmapWidthPx = cellSizePx * safeColCount;
    const heatmapHeightPx = cellSizePx * safeRowCount;
    render(<SphericalCoverageHeatmap grid={grid} maxSeconds={3} />);

    const heatmap = screen.getByLabelText("Aggregated spherical coverage heatmap");
    expect(heatmap).toBeInTheDocument();
    expect(heatmap.tagName.toLowerCase()).toBe("img");

    expect(heatmap.getAttribute("width")).toBe(heatmapWidthPx.toString());
    expect(heatmap.getAttribute("height")).toBe(heatmapHeightPx.toString());

    expect(heatmap.getAttribute("src")).toContain("data:image/bmp;base64");
  });

  it("skips non-array rows while still rendering coverage", () => {
    const grid = [null, [0.08]] as unknown as number[][];

    render(<SphericalCoverageHeatmap grid={grid} maxSeconds={1} />);

    const heatmap = screen.getByLabelText("Aggregated spherical coverage heatmap");
    expect(heatmap).toBeInTheDocument();
    expect(heatmap.getAttribute("src")).toContain("data:image/bmp;base64,");
  });

  it("maps small non-zero coverage values to the expected hue band", () => {
    const grid = [[0.08]];
    const maxSeconds = 1;
    const dataOffsetLocation = 10;

    render(<SphericalCoverageHeatmap grid={grid} maxSeconds={maxSeconds} />);

    const heatmap = screen.getByLabelText("Aggregated spherical coverage heatmap");
    expect(heatmap).toBeInTheDocument();

    const heatmapSrc = heatmap.getAttribute("src") ?? "";
    const base64Data = heatmapSrc.split(",")[1] ?? "";
    const bmpBuffer = Buffer.from(base64Data, "base64");
    const pixelDataOffset = bmpBuffer.readUInt32LE(dataOffsetLocation);
    const blue = bmpBuffer.readUInt8(pixelDataOffset);
    const green = bmpBuffer.readUInt8(pixelDataOffset + 1);
    const red = bmpBuffer.readUInt8(pixelDataOffset + 2);
    const alpha = bmpBuffer.readUInt8(pixelDataOffset + 3);

    const expectedColor = calculateExpectedPixelColor(grid[0]?.[0] ?? 0, maxSeconds);

    expect({ alpha, blue, green, red }).toEqual({
      alpha: 255,
      blue: expectedColor.blue,
      green: expectedColor.green,
      red: expectedColor.red
    });
  });

  it("treats undefined cell values as zero coverage", () => {
    const grid = [[undefined, 0.08]] as unknown as number[][];
    const maxSeconds = 1;
    const dataOffsetLocation = 10;
    const bytesPerPixel = 4;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const defaultWidthPx = 620;
    const defaultHeightPx = 310;
    const cellSizePx = Math.max(1, Math.floor(Math.min(defaultWidthPx / cols, defaultHeightPx / rows)));
    const heatmapWidthPx = cellSizePx * cols;
    const heatmapHeightPx = cellSizePx * rows;
    const rowStride = heatmapWidthPx * bytesPerPixel;
    const sampleX = cellSizePx + 1;
    const sampleY = 0;

    render(<SphericalCoverageHeatmap grid={grid} maxSeconds={maxSeconds} />);

    const heatmap = screen.getByLabelText("Aggregated spherical coverage heatmap");
    expect(heatmap).toBeInTheDocument();

    const heatmapSrc = heatmap.getAttribute("src") ?? "";
    const base64Data = heatmapSrc.split(",")[1] ?? "";
    const bmpBuffer = Buffer.from(base64Data, "base64");
    const pixelDataOffset = bmpBuffer.readUInt32LE(dataOffsetLocation);
    const bmpRow = heatmapHeightPx - sampleY - 1;
    const rowStart = bmpRow * rowStride;
    const sampleOffset = sampleX * bytesPerPixel;
    const pixelOffset = pixelDataOffset + rowStart + sampleOffset;

    const blue = bmpBuffer.readUInt8(pixelOffset);
    const green = bmpBuffer.readUInt8(pixelOffset + 1);
    const red = bmpBuffer.readUInt8(pixelOffset + 2);
    const alpha = bmpBuffer.readUInt8(pixelOffset + 3);

    const expectedColor = calculateExpectedPixelColor(0, maxSeconds);

    expect({ alpha, blue, green, red }).toEqual({
      alpha: 255,
      blue: expectedColor.blue,
      green: expectedColor.green,
      red: expectedColor.red
    });
  });
});
