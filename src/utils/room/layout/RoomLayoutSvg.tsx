import React from "react";

import { Point } from "../../../models/point";
import { LayoutElement, RoomLayoutOptions } from "./roomLayoutGenerator";

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface RoomLayoutSvgProps {
  elements: LayoutElement[];
  bounds: BoundingBox;
  width: number;
  height: number;
  padding: number;
  options: RoomLayoutOptions;
}

const defaultObjectColors: Record<string, string> = {
  bathtub: "#0ea5e9",
  bed: "#ec4899",
  chair: "#22c55e",
  dishwasher: "#14b8a6",
  fireplace: "#b91c1c",
  oven: "#dc2626",
  refrigerator: "#3b82f6",
  sink: "#06b6d4",
  sofa: "#f97316",
  stairs: "#6b7280",
  storage: "#f59e0b",
  stove: "#ef4444",
  table: "#84cc16",
  television: "#1f2937",
  toilet: "#7c3aed",
  unknown: "#9ca3af",
  washerDryer: "#8b5cf6"
};

function transformToSvgCoords(
  point: Point,
  bounds: BoundingBox,
  width: number,
  height: number,
  padding: number
): { x: number; y: number } {
  const paddingMultiplier = 2;
  const halfDivisor = 2;
  const paddingTotal = padding * paddingMultiplier;
  const availableWidth = width - paddingTotal;
  const availableHeight = height - paddingTotal;

  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  const minDimension = 0.001;
  const safeWidth = Math.max(boundsWidth, minDimension);
  const safeHeight = Math.max(boundsHeight, minDimension);

  const scaleX = availableWidth / safeWidth;
  const scaleY = availableHeight / safeHeight;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = safeWidth * scale;
  const scaledHeight = safeHeight * scale;
  const widthDiff = availableWidth - scaledWidth;
  const heightDiff = availableHeight - scaledHeight;
  const halfWidthDiff = widthDiff / halfDivisor;
  const halfHeightDiff = heightDiff / halfDivisor;
  const offsetX = padding + halfWidthDiff;
  const offsetY = padding + halfHeightDiff;

  const normalizedX = point.x - bounds.minX;
  const normalizedY = point.y - bounds.minY;
  const scaledNormalizedX = normalizedX * scale;
  const scaledNormalizedY = normalizedY * scale;

  return {
    x: offsetX + scaledNormalizedX,
    y: offsetY + scaledNormalizedY
  };
}

function buildPolygonPath(
  points: Point[],
  bounds: BoundingBox,
  width: number,
  height: number,
  padding: number
): string {
  const firstPointIndex = 0;
  const moveCommand = "M";
  const lineCommand = "L";

  return points
    .map((point, index) => {
      const { x, y } = transformToSvgCoords(point, bounds, width, height, padding);
      const command = index === firstPointIndex ? moveCommand : lineCommand;
      return `${command}${String(x)},${String(y)}`;
    })
    .join(" ")
    .concat(" Z");
}

function buildLinePath(points: Point[], bounds: BoundingBox, width: number, height: number, padding: number): string {
  const startIndex = 0;
  const endIndex = 1;

  const start = points[startIndex];
  const end = points[endIndex];

  if (!start || !end) {
    return "";
  }

  const startCoords = transformToSvgCoords(start, bounds, width, height, padding);
  const endCoords = transformToSvgCoords(end, bounds, width, height, padding);

  return `M${String(startCoords.x)},${String(startCoords.y)} L${String(endCoords.x)},${String(endCoords.y)}`;
}

function getElementCenter(
  points: Point[],
  bounds: BoundingBox,
  width: number,
  height: number,
  padding: number
): { x: number; y: number } {
  const emptyLength = 0;
  const defaultCoord = 0;

  if (points.length === emptyLength) {
    return { x: defaultCoord, y: defaultCoord };
  }

  let sumX = 0;
  let sumY = 0;

  for (const point of points) {
    const { x, y } = transformToSvgCoords(point, bounds, width, height, padding);
    sumX += x;
    sumY += y;
  }

  return {
    x: sumX / points.length,
    y: sumY / points.length
  };
}

export const RoomLayoutSvg: React.FC<RoomLayoutSvgProps> = ({ elements, bounds, width, height, padding, options }) => {
  const wallColor = options.wallColor ?? "#1f2937";
  const floorColor = options.floorColor ?? "#f3f4f6";
  const doorColor = options.doorColor ?? "#22c55e";
  const windowColor = options.windowColor ?? "#3b82f6";
  const backgroundColor = options.backgroundColor ?? "#ffffff";
  const objectColors = options.objectColors ?? defaultObjectColors;
  const showLabels = options.showLabels ?? true;

  const wallStrokeWidth = 4;
  const doorStrokeWidth = 6;
  const windowStrokeWidth = 6;
  const objectStrokeWidth = 2;
  const objectFillOpacity = 0.3;
  const labelFontSize = 10;
  const labelOffset = 4;

  const floors = elements.filter((el) => el.type === "floor");
  const walls = elements.filter((el) => el.type === "wall");
  const objects = elements.filter((el) => el.type === "object");
  const doors = elements.filter((el) => el.type === "door");
  const windows = elements.filter((el) => el.type === "window");

  return (
    <svg
      data-testid="room-layout-svg"
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect fill={backgroundColor} height={height} width={width} x={0} y={0} />

      {/* Floors - rendered first as background */}
      {floors.map((floor, index) => (
        <path
          key={`floor-${index.toString()}`}
          d={buildPolygonPath(floor.points, bounds, width, height, padding)}
          fill={floorColor}
          stroke="#d1d5db"
          strokeWidth={1}
        />
      ))}

      {/* Objects */}
      {objects.map((obj, index) => {
        const color = objectColors[obj.objectType ?? "unknown"] ?? objectColors["unknown"];
        const center = getElementCenter(obj.points, bounds, width, height, padding);
        return (
          <g key={`object-${index.toString()}`}>
            <path
              d={buildPolygonPath(obj.points, bounds, width, height, padding)}
              fill={color}
              fillOpacity={objectFillOpacity}
              stroke={color}
              strokeWidth={objectStrokeWidth}
            />
            {showLabels && obj.label !== undefined && obj.label !== "" && (
              <text fill="#374151" fontSize={labelFontSize} textAnchor="middle" x={center.x} y={center.y + labelOffset}>
                {obj.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Walls */}
      {walls.map((wall, index) => (
        <path
          key={`wall-${index.toString()}`}
          d={buildLinePath(wall.points, bounds, width, height, padding)}
          fill="none"
          stroke={wallColor}
          strokeLinecap="round"
          strokeWidth={wallStrokeWidth}
        />
      ))}

      {/* Doors */}
      {doors.map((door, index) => (
        <path
          key={`door-${index.toString()}`}
          d={buildLinePath(door.points, bounds, width, height, padding)}
          fill="none"
          stroke={doorColor}
          strokeDasharray="8,4"
          strokeLinecap="round"
          strokeWidth={doorStrokeWidth}
        />
      ))}

      {/* Windows */}
      {windows.map((window, index) => (
        <path
          key={`window-${index.toString()}`}
          d={buildLinePath(window.points, bounds, width, height, padding)}
          fill="none"
          stroke={windowColor}
          strokeDasharray="4,2"
          strokeLinecap="round"
          strokeWidth={windowStrokeWidth}
        />
      ))}
    </svg>
  );
};
