import React from "react";
import { loadSvgContent } from "./svgLoader";

interface DoorOpenIconProps {
  color: string;
  x: number;
  y: number;
  legendBoxSize: number;
}

export const DoorOpenIcon: React.FC<DoorOpenIconProps> = ({ color, x, y, legendBoxSize }) => {
  // Load SVG content from file
  const svgPath = "src/templates/assets/icons/door-open.svg";
  const svgContent = loadSvgContent(svgPath, color);

  // The SVG has viewBox="-13.22 0 122.88 122.88", scale to fit legendBoxSize
  // The viewBox width is 122.88
  const openDoorViewBoxSize = 122.88;
  const openDoorScale = legendBoxSize / openDoorViewBoxSize;

  return (
    <g transform={`translate(${String(x)}, ${String(y)}) scale(${String(openDoorScale)})`}>
      <g dangerouslySetInnerHTML={{ __html: svgContent }} />
    </g>
  );
};
