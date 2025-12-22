import React from "react";
import { loadSvgContent } from "./svgLoader";

export interface DoorIconProps {
  color: string;
  x: number;
  y: number;
  legendBoxSize: number;
}

interface DoorClosedIconProps {
  color: string;
  x: number;
  y: number;
  legendBoxSize: number;
}

export const DoorClosedIcon: React.FC<DoorClosedIconProps> = ({ color, x, y, legendBoxSize }) => {
  // Load SVG content from file
  const svgPath = "src/templates/assets/icons/door-closed.svg";
  const svgContent = loadSvgContent(svgPath, color);

  // The SVG has viewBox="0 0 16 16", scale to fit legendBoxSize
  // The viewBox width is 16
  const closedDoorViewBoxSize = 16;
  const closedDoorScale = legendBoxSize / closedDoorViewBoxSize;

  return (
    <g transform={`translate(${String(x)}, ${String(y)}) scale(${String(closedDoorScale)})`}>
      <g dangerouslySetInnerHTML={{ __html: svgContent }} />
    </g>
  );
};
