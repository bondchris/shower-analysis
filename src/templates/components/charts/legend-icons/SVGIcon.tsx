import React from "react";
import { loadSvgContent } from "./svgLoader";

export interface SVGIconProps {
  color: string;
  x: number;
  y: number;
  legendBoxSize: number;
  svgPath: string;
  viewBoxSize: number;
}

export const SVGIcon: React.FC<SVGIconProps> = ({ color, x, y, legendBoxSize, svgPath, viewBoxSize }) => {
  const svgContent = loadSvgContent(svgPath, color);
  const scale = legendBoxSize / viewBoxSize;
  const defaultStrokeWidth = 1;

  return (
    <>
      {/* Invisible box to maintain consistent spacing */}
      <rect
        fill="transparent"
        height={legendBoxSize}
        stroke="transparent"
        strokeWidth={defaultStrokeWidth}
        width={legendBoxSize}
        x={x}
        y={y}
      />
      <g transform={`translate(${String(x)}, ${String(y)}) scale(${String(scale)})`}>
        <g dangerouslySetInnerHTML={{ __html: svgContent }} />
      </g>
    </>
  );
};
