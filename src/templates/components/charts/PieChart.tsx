import * as fs from "fs";
import * as path from "path";
import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { Text } from "@visx/text";
import opentype from "opentype.js";
import React from "react";

import { PieChartConfig } from "../../../models/chart/pieChartConfig";

// Default color palette (fallback only - colors should be passed from chart config)
const defaultColors = [
  "#1e40af", // Blue
  "#047857", // Green
  "#b45309", // Amber
  "#b91c1c", // Red
  "#6d28d9", // Purple
  "#be185d", // Pink
  "#0891b2", // Cyan
  "#65a30d" // Lime
];

interface PieChartProps {
  config: PieChartConfig;
}

// Load font and calculate label widths synchronously (for server-side rendering)
// Using Roboto font to match what we render in the Text component
const calculateLabelWidths = (labels: (string | React.ReactNode)[], fontSize: number): number[] => {
  try {
    // Load Roboto font file from filesystem (like we do with SVG files)
    const fontPath = path.join(process.cwd(), "src", "templates", "assets", "fonts", "arial.ttf");
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath);
      const font = opentype.parse(fontBuffer.buffer);

      const zeroX = 0;
      const zeroY = 0;
      const widths: number[] = [];
      for (const label of labels) {
        const labelText = typeof label === "string" ? label : "";
        const path = font.getPath(labelText, zeroX, zeroY, fontSize);
        const bbox = path.getBoundingBox();
        const width = bbox.x2 - bbox.x1;
        widths.push(width);
      }
      return widths;
    }
  } catch {
    // Font loading failed, will use fallback
  }

  // Fallback: estimate based on character count
  const charWidthEstimate = 6;
  return labels.map((label) => {
    const labelText = typeof label === "string" ? label : "";
    return labelText.length * charWidthEstimate;
  });
};

export const PieChart: React.FC<PieChartProps> = ({ config }) => {
  const { labels, data, options, height } = config;

  // Calculate all label widths synchronously using opentype.js
  const fontSizeForCalculation = 11;
  const effectiveLabelWidths = calculateLabelWidths(labels, fontSizeForCalculation);

  const defaultWidth = 300;
  const baseWidth = options.width ?? defaultWidth;
  const colors = options.colors ?? defaultColors;

  const zeroValue = 0;
  const margin = 20;
  const divisorForDimensions = 2;
  const innerRadius = zeroValue;
  const minDimension = Math.min(baseWidth, height);
  const halfDimension = minDimension / divisorForDimensions;
  const outerRadius = halfDimension - margin;

  // Calculate padding needed for labels that extend beyond the pie chart
  // Labels are positioned at (outerRadius + labelOffset) from center
  // Labels are centered (textAnchor="middle"), so we need half label width on each side
  const labelOffset = 15;
  const maxLabelDistance = outerRadius + labelOffset;
  const estimatedLabelWidth = 40; // Estimate for percentage text like "50.0%"
  const halfLabelWidth = estimatedLabelWidth / divisorForDimensions;
  const maxLabelExtension = maxLabelDistance + halfLabelWidth;
  const paddingMultiplier = 2;

  // Ensure SVG is wide enough: center + maxLabelExtension must be <= width/2
  // So: width >= 2 * (centerX + maxLabelExtension) where centerX = width/2
  // This simplifies to: width >= 2 * maxLabelExtension
  const minWidth = maxLabelExtension * paddingMultiplier;

  // Always ensure minimum width, but if base width is larger, use that
  // This ensures labels never clip while preserving larger chart sizes
  const width = Math.max(baseWidth, minWidth);

  // Calculate how much padding was added to width
  const widthPadding = width - baseWidth;

  // Position the pie chart center close to the top to minimize gap with title
  // Add minimal top padding just for label text that extends upward
  const topMargin = 5;
  const topLabelPadding = halfLabelWidth; // Just enough for label text, not full extension
  const sidePadding = widthPadding / divisorForDimensions;
  const baseCenterX = baseWidth / divisorForDimensions;
  const centerX = baseCenterX + sidePadding;
  const centerY = outerRadius + topMargin + topLabelPadding;

  // Don't expand height - use the base height and let legend height be calculated separately
  // This prevents extra whitespace at the bottom
  const paddedHeight = height;
  const padAngle = 0.005;

  const total = data.reduce((sum, val) => sum + val, zeroValue);

  if (total === zeroValue) {
    return (
      <svg height={paddedHeight} width={width}>
        <Text fill="#6b7280" fontSize={14} textAnchor="middle" x={centerX} y={centerY}>
          No data
        </Text>
      </svg>
    );
  }

  const getColor = (index: number): string => {
    // Colors are passed in the config and should match the label order
    const firstColorIndex = 0;
    const defaultFallbackColor = "#1e40af";
    const colorIndex = index % colors.length;
    const color = colors[colorIndex];
    if (color !== undefined) {
      return color;
    }
    return defaultColors[firstColorIndex] ?? defaultFallbackColor;
  };

  // Calculate legend dimensions
  const legendBoxSize = 12;
  const legendLabelGap = 4;
  const legendItemGap = 8;
  const legendRowGap = 4;
  const legendFontSize = 11;
  const legendTopMargin = 20;
  const legendMaxWidth = width;

  // Always use consistent spacing between pie chart and legend
  // Use standardized padding for all charts to ensure labels never clip and spacing is uniform
  const standardizedBottomPadding = 25;
  const pieBottom = centerY + outerRadius;
  const legendStartY = pieBottom + legendTopMargin + standardizedBottomPadding;

  // Calculate legend layout - center horizontally
  interface LegendItem {
    color: string;
    label: string;
    originalIndex: number;
    x: number;
    y: number;
  }
  const legendItems: LegendItem[] = [];

  // Create sorted indices array for alphabetical ordering
  const sortedIndices = labels
    .map((label, index) => ({ index, label: typeof label === "string" ? label : "" }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => item.index);

  // Use pre-calculated label widths from opentype.js (or fallback estimates)
  const itemWidths: number[] = [];
  for (const sortedIndex of sortedIndices) {
    const textWidth = effectiveLabelWidths[sortedIndex] ?? zeroValue;
    const itemWidth = legendBoxSize + legendLabelGap + textWidth;
    itemWidths.push(itemWidth);
  }

  // Calculate rows and center them
  let currentY = legendStartY;
  const initialMaxRowHeight = 0;
  let maxRowHeight = initialMaxRowHeight;
  interface LegendRow {
    items: number[];
    width: number;
  }
  const rows: LegendRow[] = [];
  let currentRow: number[] = [];
  const initialRowWidth = 0;
  let currentRowWidth = initialRowWidth;

  for (let i = 0; i < itemWidths.length; i++) {
    const itemWidth = itemWidths[i] ?? zeroValue;
    const wouldExceedWidth = currentRowWidth + itemWidth > legendMaxWidth;
    const minRowLength = 0;

    if (wouldExceedWidth && currentRow.length > minRowLength) {
      rows.push({ items: [...currentRow], width: currentRowWidth - legendItemGap });
      currentRow = [i];
      currentRowWidth = itemWidth;
    } else {
      currentRow.push(i);
      currentRowWidth += itemWidth + legendItemGap;
    }
  }
  const minRowLength = 0;
  if (currentRow.length > minRowLength) {
    rows.push({ items: currentRow, width: currentRowWidth - legendItemGap });
  }

  // Second pass: position items centered in rows
  for (const row of rows) {
    const divisor = 2;
    const rowStartX = (width - row.width) / divisor; // Center the row
    let itemX = rowStartX;

    for (const sortedIndex of row.items) {
      const originalIndex = sortedIndices[sortedIndex];
      if (originalIndex === undefined) {
        continue;
      }
      const label = labels[originalIndex];
      const labelText = typeof label === "string" ? label : "";
      const rowHeight = Math.max(legendBoxSize, legendFontSize);
      maxRowHeight = Math.max(maxRowHeight, rowHeight);

      const legendColor = getColor(originalIndex);
      legendItems.push({
        color: legendColor,
        label: labelText,
        originalIndex,
        x: itemX,
        y: currentY
      });

      const itemWidth = itemWidths[sortedIndex] ?? zeroValue;
      itemX += itemWidth + legendItemGap;
    }

    currentY += maxRowHeight + legendRowGap;
    maxRowHeight = initialMaxRowHeight;
  }

  // Adjust SVG height to accommodate legend
  // Calculate the actual height needed: from legend start to end of last row
  const legendHeightOffset = currentY - legendStartY;
  const legendHeight = legendHeightOffset + maxRowHeight;
  // Total height is the legend start position plus legend height
  // This gives us the exact height needed without extra padding
  // But ensure it's at least the base height to prevent clipping
  const totalHeight = Math.max(paddedHeight, legendStartY + legendHeight);

  return (
    <svg height={totalHeight} width={width}>
      <Group left={centerX} top={centerY}>
        <Pie
          cornerRadius={3}
          data={data}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          padAngle={padAngle}
          pieSortValues={(a, b) => a - b}
          pieValue={(d) => d}
        >
          {(pie) => {
            // First pass: collect all label positions
            interface LabelInfo {
              arc: (typeof pie.arcs)[number];
              centroidX: number;
              centroidY: number;
              normalizedX: number;
              normalizedY: number;
              labelX: number;
              labelY: number;
              percentageText: string;
            }

            const labelInfos: LabelInfo[] = [];
            const minAngleForLabel = 0.05;
            const labelDistance = outerRadius + labelOffset;
            const percentageBase = 100;
            const decimalPlaces = 1;

            for (const arc of pie.arcs) {
              const hasSpaceForLabel = arc.endAngle - arc.startAngle >= minAngleForLabel;
              if (!hasSpaceForLabel) {
                continue;
              }

              const [centroidX, centroidY] = pie.path.centroid(arc);
              const percentage = ((arc.value / total) * percentageBase).toFixed(decimalPlaces);
              const percentageText = `${percentage}%`;

              // Normalize centroid to unit vector
              const centroidXSquared = centroidX * centroidX;
              const centroidYSquared = centroidY * centroidY;
              const centroidLength = Math.sqrt(centroidXSquared + centroidYSquared);
              const zeroValueForNormalize = 0;
              const normalizedX =
                centroidLength > zeroValueForNormalize ? centroidX / centroidLength : zeroValueForNormalize;
              const normalizedY =
                centroidLength > zeroValueForNormalize ? centroidY / centroidLength : zeroValueForNormalize;

              const labelX = normalizedX * labelDistance;
              const labelY = normalizedY * labelDistance;

              labelInfos.push({
                arc,
                centroidX,
                centroidY,
                labelX,
                labelY,
                normalizedX,
                normalizedY,
                percentageText
              });
            }

            // Detect overlaps and adjust positions
            const minLabelSpacing = 25; // Minimum distance between labels to avoid overlap
            const perpendicularOffset = 15; // Offset perpendicular to radius to avoid overlap
            const evenIndexModulo = 2;
            const evenIndexRemainder = 0;
            const adjustedLabels = labelInfos.map((info, index) => {
              let adjustedX = info.labelX;
              let adjustedY = info.labelY;
              let needsLine = false;

              // Check for overlaps with other labels
              for (const other of labelInfos) {
                if (other === info) {
                  continue;
                }

                const dx = info.labelX - other.labelX;
                const dy = info.labelY - other.labelY;
                const dxSquared = dx * dx;
                const dySquared = dy * dy;
                const distance = Math.sqrt(dxSquared + dySquared);

                if (distance < minLabelSpacing) {
                  // Labels overlap, offset them in opposite directions
                  // Alternate direction based on index: even indices go clockwise, odd go counterclockwise
                  // The perpendicular vector rotated 90 degrees clockwise is (y, -x)
                  // For counterclockwise it would be (-y, x)
                  const useClockwise = index % evenIndexModulo === evenIndexRemainder;
                  const perpendicularX = useClockwise
                    ? info.normalizedY * perpendicularOffset
                    : -info.normalizedY * perpendicularOffset;
                  const perpendicularY = useClockwise
                    ? -info.normalizedX * perpendicularOffset
                    : info.normalizedX * perpendicularOffset;
                  adjustedX = info.labelX + perpendicularX;
                  adjustedY = info.labelY + perpendicularY;
                  needsLine = true;
                  break; // Only offset once per label
                }
              }

              return {
                ...info,
                adjustedX,
                adjustedY,
                needsLine
              };
            });

            // Render arcs and labels
            return (
              <>
                {pie.arcs.map((arc, i) => {
                  const arcKey = `arc-${String(i)}`;
                  return (
                    <path
                      key={arcKey}
                      d={pie.path(arc) ?? undefined}
                      fill={getColor(arc.index)}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                })}
                {adjustedLabels.map((labelInfo, i) => {
                  const labelKey = `label-${String(i)}`;
                  const lineStartX = labelInfo.normalizedX * outerRadius;
                  const lineStartY = labelInfo.normalizedY * outerRadius;

                  // Calculate text dimensions to position line end at text edge
                  const textFontSize = 10;
                  const estimatedCharWidth = 6; // Approximate character width
                  const textWidth = labelInfo.percentageText.length * estimatedCharWidth;
                  const halfTextWidth = textWidth / divisorForDimensions;

                  // Calculate direction from pie center to label
                  const directionX = labelInfo.adjustedX - lineStartX;
                  const directionY = labelInfo.adjustedY - lineStartY;
                  const directionXSquared = directionX * directionX;
                  const directionYSquared = directionY * directionY;
                  const directionLength = Math.sqrt(directionXSquared + directionYSquared);

                  // Normalize direction and extend to text edge
                  const normalizedDirX = directionLength > zeroValue ? directionX / directionLength : zeroValue;
                  const normalizedDirY = directionLength > zeroValue ? directionY / directionLength : zeroValue;

                  // Line ends at the edge of the text (half text width from center)
                  const offsetX = normalizedDirX * halfTextWidth;
                  const offsetY = normalizedDirY * halfTextWidth;
                  const lineEndX = labelInfo.adjustedX - offsetX;
                  const lineEndY = labelInfo.adjustedY - offsetY;

                  return (
                    <g key={labelKey}>
                      {labelInfo.needsLine && (
                        <line
                          stroke="#9ca3af"
                          strokeDasharray="2,2"
                          strokeWidth={1}
                          x1={lineStartX}
                          x2={lineEndX}
                          y1={lineStartY}
                          y2={lineEndY}
                        />
                      )}
                      <Text
                        dominantBaseline="middle"
                        fill="#374151"
                        fontSize={textFontSize}
                        fontWeight={500}
                        textAnchor="middle"
                        x={labelInfo.adjustedX}
                        y={labelInfo.adjustedY}
                      >
                        {labelInfo.percentageText}
                      </Text>
                    </g>
                  );
                })}
              </>
            );
          }}
        </Pie>
      </Group>
      {/* Legend */}
      {legendItems.map((item, i) => {
        const divisor = 2;
        const halfBoxSize = legendBoxSize / divisor;
        const boxY = item.y - halfBoxSize;
        const textX = item.x + legendBoxSize + legendLabelGap;
        const legendKey = `legend-${String(i)}`;
        // Center text vertically with box - item.y is the center of the box
        const textY = item.y;

        // Render custom icon if provided, otherwise use default colored box
        const IconComponent = options.legendIconComponents?.[item.label];
        const defaultStrokeWidth = 1;

        // Default colored box - will be overridden if icon component is provided
        let iconElement: React.ReactNode = (
          <rect
            fill={item.color}
            height={legendBoxSize}
            stroke="transparent"
            strokeWidth={defaultStrokeWidth}
            width={legendBoxSize}
            x={item.x}
            y={boxY}
          />
        );

        // Use provided icon component if available
        if (IconComponent !== undefined) {
          iconElement = <IconComponent color={item.color} legendBoxSize={legendBoxSize} x={item.x} y={boxY} />;
        }

        return (
          <g key={legendKey}>
            {iconElement}
            <Text
              dominantBaseline="middle"
              fill="#374151"
              fontFamily="Roboto, Arial, sans-serif"
              fontSize={legendFontSize}
              fontWeight={400}
              x={textX}
              y={textY}
            >
              {item.label}
            </Text>
          </g>
        );
      })}
    </svg>
  );
};
