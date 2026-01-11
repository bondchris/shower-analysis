import React from "react";

interface SphericalCoverageHeatmapProps {
  grid: number[][];
  maxSeconds: number;
}

export const SphericalCoverageHeatmap: React.FC<SphericalCoverageHeatmapProps> = ({ grid, maxSeconds }) => {
  const emptyCount = 0;
  const fallbackMaxSeconds = 1;
  const colorExponent = 0.55;
  const hueStart = 195;
  const hueEnd = 10;
  const lightStart = 92;
  const lightEnd = 45;
  const saturation = 88;
  const fullCoverage = 1;
  const defaultWidthPx = 620;
  const defaultHeightPx = 310;
  const gradientStartPercent = 0;
  const gradientMidPercent = 50;
  const gradientEndPercent = 100;
  const gradientMidDivisor = 2;
  const minCellSizePx = 1;
  const lastIndexOffset = 1;

  const rows = grid.length;
  const firstRow = grid.find(Array.isArray);
  const cols = firstRow !== undefined ? firstRow.length : emptyCount;
  if (rows === emptyCount || cols === emptyCount) {
    return <div className="text-xs text-gray-600">No coverage data available.</div>;
  }

  const safeMaxSeconds = maxSeconds > emptyCount ? maxSeconds : fallbackMaxSeconds;

  const computeColor = React.useCallback(
    (value: number) => {
      const clampedValue = Math.min(Math.max(value / safeMaxSeconds, emptyCount), fullCoverage);
      const normalized = Math.pow(clampedValue, colorExponent);
      const hueRange = hueEnd - hueStart;
      const lightRange = lightEnd - lightStart;
      const hueAdjustment = hueRange * normalized;
      const lightAdjustment = lightRange * normalized;
      const hue = hueStart + hueAdjustment;
      const lightness = lightStart + lightAdjustment;
      return { hue, lightness };
    },
    [colorExponent, fullCoverage, hueEnd, hueStart, lightEnd, lightStart, safeMaxSeconds]
  );

  const colorForValue = React.useCallback(
    (value: number): string => {
      const { hue, lightness } = computeColor(value);
      return `hsl(${hue.toString()}, ${saturation.toString()}%, ${lightness.toString()}%)`;
    },
    [computeColor, saturation]
  );

  const gradientStyle = {
    background: `linear-gradient(90deg, ${colorForValue(gradientStartPercent)} ${gradientStartPercent.toString()}%, ${colorForValue(
      safeMaxSeconds / gradientMidDivisor
    )} ${gradientMidPercent.toString()}%, ${colorForValue(safeMaxSeconds)} ${gradientEndPercent.toString()}%)`
  };

  // Use whole-pixel sizing to avoid visible gaps between cells from subpixel rounding
  const cellSizePx = Math.max(minCellSizePx, Math.floor(Math.min(defaultWidthPx / cols, defaultHeightPx / rows)));
  const heatmapWidthPx = cellSizePx * cols;
  const heatmapHeightPx = cellSizePx * rows;

  const heatmapDataUrl = React.useMemo(() => {
    const bytesPerPixel = 4;
    const alphaOpaque = 255;
    const blueIndex = 0;
    const greenIndex = 1;
    const redIndex = 2;
    const alphaIndex = 3;
    const maxColorValue = 255;
    const sixtyDegrees = 60;
    const doubleUnit = 2;
    const unity = 1;
    const lightnessNormalizer = 100;
    const saturationNormalizer = 100;
    const minLightContribution = 0;
    const bmpSignature = "BM";
    const bmpFileHeaderSize = 14;
    const dibHeaderSize = 40;
    const bitsPerPixel = 32;
    const colorPlaneCount = 1;
    const compressionNone = 0;
    const pixelsPerMeter = 2835;

    const hslToRgb = (hue: number, saturationPercent: number, lightnessPercent: number): [number, number, number] => {
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
      const firstSegmentIndex = 0;
      const defaultComponents: [number, number, number] = [
        minLightContribution,
        minLightContribution,
        minLightContribution
      ];
      const selectedComponents =
        preliminaryComponents[hueSegment] ?? preliminaryComponents[firstSegmentIndex] ?? defaultComponents;
      const [preliminaryRed, preliminaryGreen, preliminaryBlue] = selectedComponents;

      const chromaHalf = chroma / doubleUnit;
      const matchLightness = normalizedLightness - chromaHalf;

      return [
        Math.round((preliminaryRed + matchLightness) * maxColorValue),
        Math.round((preliminaryGreen + matchLightness) * maxColorValue),
        Math.round((preliminaryBlue + matchLightness) * maxColorValue)
      ];
    };

    const sampleToRgb = (value: number): [number, number, number] => {
      const { hue, lightness } = computeColor(value);
      return hslToRgb(hue, saturation, lightness);
    };

    const rowStride = heatmapWidthPx * bytesPerPixel;
    const pixelDataSize = rowStride * heatmapHeightPx;
    const bmpHeaderSize = bmpFileHeaderSize + dibHeaderSize;
    const fileSize = bmpHeaderSize + pixelDataSize;
    const dataOffset = bmpHeaderSize;
    const bufferFillValue = 0;
    const rowEndOffset = 1;
    const headerSignatureOffset = 0;
    const fileSizeOffset = 2;
    const dataOffsetOffset = 10;
    const dibSizeOffset = 14;
    const widthOffset = 18;
    const heightOffset = 22;
    const planesOffset = 26;
    const bitsPerPixelOffset = 28;
    const compressionOffset = 30;
    const imageSizeOffset = 34;
    const xPixelsOffset = 38;
    const yPixelsOffset = 42;
    const colorsUsedOffset = 46;
    const colorsImportantOffset = 50;
    const noPaletteColors = 0;
    const raw = Buffer.alloc(pixelDataSize, bufferFillValue);

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const row = grid[rowIndex];
      if (!Array.isArray(row)) {
        continue;
      }
      const colsInRow = row.length;
      for (let colIndex = 0; colIndex < colsInRow; colIndex++) {
        const displayColIndex = colsInRow - lastIndexOffset - colIndex;
        const value = row[displayColIndex] ?? emptyCount;
        const [red, green, blue] = sampleToRgb(value);
        const startX = colIndex * cellSizePx;
        const startY = rowIndex * cellSizePx;
        const endX = startX + cellSizePx;
        const endY = startY + cellSizePx;

        for (let pixelY = startY; pixelY < endY; pixelY++) {
          const bmpRow = heatmapHeightPx - pixelY - rowEndOffset;
          const rowStart = bmpRow * rowStride;
          const pixelRowOffset = startX * bytesPerPixel;
          const pixelRowBase = rowStart + pixelRowOffset;
          for (let pixelX = startX; pixelX < endX; pixelX++) {
            const pixelOffsetDelta = (pixelX - startX) * bytesPerPixel;
            const pixelOffset = pixelRowBase + pixelOffsetDelta;
            raw[pixelOffset + blueIndex] = blue;
            raw[pixelOffset + greenIndex] = green;
            raw[pixelOffset + redIndex] = red;
            raw[pixelOffset + alphaIndex] = alphaOpaque;
          }
        }
      }
    }

    const header = Buffer.alloc(bmpHeaderSize, bufferFillValue);
    header.write(bmpSignature, headerSignatureOffset, bmpFileHeaderSize, "ascii");
    header.writeUInt32LE(fileSize, fileSizeOffset);
    header.writeUInt32LE(dataOffset, dataOffsetOffset);
    header.writeUInt32LE(dibHeaderSize, dibSizeOffset);
    header.writeInt32LE(heatmapWidthPx, widthOffset);
    header.writeInt32LE(heatmapHeightPx, heightOffset);
    header.writeUInt16LE(colorPlaneCount, planesOffset);
    header.writeUInt16LE(bitsPerPixel, bitsPerPixelOffset);
    header.writeUInt32LE(compressionNone, compressionOffset);
    header.writeUInt32LE(pixelDataSize, imageSizeOffset);
    header.writeInt32LE(pixelsPerMeter, xPixelsOffset);
    header.writeInt32LE(pixelsPerMeter, yPixelsOffset);
    header.writeUInt32LE(noPaletteColors, colorsUsedOffset);
    header.writeUInt32LE(noPaletteColors, colorsImportantOffset);

    const bmpBuffer = Buffer.concat([header, raw]);
    return `data:image/bmp;base64,${bmpBuffer.toString("base64")}`;
  }, [cellSizePx, computeColor, emptyCount, grid, heatmapHeightPx, heatmapWidthPx, lastIndexOffset, rows, saturation]);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="text-sm font-semibold text-gray-800">
        Aggregated Spherical Coverage (6 ft radius; 2.5° resolution)
      </div>
      <div className="flex flex-col gap-2" style={{ width: heatmapWidthPx }}>
        <div
          className="overflow-hidden rounded border border-gray-200 shadow-sm"
          style={{ height: heatmapHeightPx, width: heatmapWidthPx }}
        >
          <img
            aria-label="Aggregated spherical coverage heatmap"
            height={heatmapHeightPx}
            src={heatmapDataUrl}
            style={{ imageRendering: "pixelated" }}
            width={heatmapWidthPx}
          />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <span>Less time</span>
          <div className="h-2 flex-1 rounded-full" style={gradientStyle} />
          <span>More time</span>
        </div>
      </div>
    </div>
  );
};
