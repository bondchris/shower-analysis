import React from "react";

import { ShapeOverlayChartConfig } from "../../../models/chart/shapeOverlayChartConfig";
import { SurfaceOutline } from "../../../models/shapeOutline";
import { normalizeOutlines } from "../../../utils/chart/shapeOverlay";

interface ShapeOverlayChartProps {
  config: ShapeOverlayChartConfig;
}

const buildPath = (outline: SurfaceOutline, centerX: number, centerY: number, drawableSize: number): string => {
  const firstPointIndex = 0;
  const moveCommand = "M";
  const lineCommand = "L";
  return outline
    .map((point, index) => {
      const scaledX = drawableSize * point.x;
      const scaledY = drawableSize * point.y;
      const x = centerX + scaledX;
      const y = centerY - scaledY;
      const command = index === firstPointIndex ? moveCommand : lineCommand;
      return `${command}${String(x)},${String(y)}`;
    })
    .join(" ")
    .concat(" Z");
};

export const ShapeOverlayChart: React.FC<ShapeOverlayChartProps> = ({ config }) => {
  const { shapes, height, options } = config;
  const defaultWidth = 650;
  const padding = 16;
  const paddingMultiplier = 2;
  const halfDivisor = 2;
  const zeroValue = 0;
  const frameRadius = 8;
  const outlineStrokeWidth = 1.2;
  const defaultStrokeOpacity = 0.15;
  const fallbackFontSize = 12;
  const width = options.width ?? defaultWidth;

  const paddingOffset = paddingMultiplier * padding;
  const effectiveWidth = Math.max(width, paddingOffset);
  const effectiveHeight = Math.max(height, paddingOffset);
  const centerX = effectiveWidth / halfDivisor;
  const centerY = effectiveHeight / halfDivisor;
  const drawableLimit = Math.min(effectiveWidth, effectiveHeight);
  const drawableSize = Math.max(drawableLimit - paddingOffset, zeroValue);
  const insetWidth = effectiveWidth - paddingOffset;
  const insetHeight = effectiveHeight - paddingOffset;
  const insetRadius = frameRadius / halfDivisor;

  const strokeColor = options.strokeColor ?? "#2563eb";
  const strokeOpacity = options.strokeOpacity ?? defaultStrokeOpacity;
  const canvasFill = options.backgroundColor ?? "#ffffff";

  const normalizedOutlines = normalizeOutlines(shapes);
  const outlineCount = normalizedOutlines.length;
  const hasOutlines = outlineCount > zeroValue;

  return (
    <svg data-testid="shape-overlay-chart" height={effectiveHeight} width={effectiveWidth}>
      <rect
        fill={canvasFill}
        height={insetHeight}
        rx={insetRadius}
        stroke="none"
        width={insetWidth}
        x={padding}
        y={padding}
      />

      {hasOutlines ? (
        normalizedOutlines.map((outline, index) => (
          <path
            key={`${options.chartId ?? "shape"}-${index.toString()}`}
            d={buildPath(outline, centerX, centerY, drawableSize)}
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={strokeOpacity}
            strokeWidth={outlineStrokeWidth}
          />
        ))
      ) : (
        <text fill="#6b7280" fontSize={fallbackFontSize} textAnchor="middle" x={centerX} y={centerY}>
          No shapes available
        </text>
      )}
    </svg>
  );
};
