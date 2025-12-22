import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { Text } from "@visx/text";
import React from "react";

import { PieChartConfig } from "../../../utils/chartUtils";

interface PieChartProps {
  config: PieChartConfig;
}

export const PieChart: React.FC<PieChartProps> = ({ config }) => {
  const { labels, data, options, height } = config;

  const defaultWidth = 300;
  const width = options.width ?? defaultWidth;
  const defaultColors = ["#1e40af", "#047857", "#b45309", "#b91c1c", "#6d28d9", "#be185d", "#0891b2", "#65a30d"];
  const colors = options.colors ?? defaultColors;

  const zeroValue = 0;
  const margin = 20;
  const divisorForDimensions = 2;
  const innerRadius = zeroValue;
  const minDimension = Math.min(width, height);
  const halfDimension = minDimension / divisorForDimensions;
  const outerRadius = halfDimension - margin;
  const centerX = width / divisorForDimensions;
  const centerY = height / divisorForDimensions;
  const padAngle = 0.005;

  const total = data.reduce((sum, val) => sum + val, zeroValue);

  if (total === zeroValue) {
    return (
      <svg height={height} width={width}>
        <Text fill="#6b7280" fontSize={14} textAnchor="middle" x={centerX} y={centerY}>
          No data
        </Text>
      </svg>
    );
  }

  const getColor = (index: number): string => {
    return colors[index % colors.length] ?? colors[zeroValue] ?? "#1e40af";
  };

  // Calculate legend dimensions
  const legendBoxSize = 12;
  const legendLabelGap = 8;
  const legendItemGap = 16;
  const legendRowGap = 8;
  const legendFontSize = 11;
  const legendTopMargin = 20;
  const legendMaxWidth = width;

  // Check if any percentage labels will be near the bottom of the chart
  // We need to calculate this before positioning the legend
  // visx Pie starts at -π/2 (top) and goes clockwise
  let hasBottomLabels = false;
  const labelOffset = 15;
  const labelDistance = outerRadius + labelOffset;
  // Check if labels are in the bottom portion (below centerY + some threshold)
  // We'll check bottom 50% to catch labels that might overlap with legend
  const bottomThresholdRatio = 0.5; // Consider bottom 50% of pie as "near bottom"
  const thresholdRadius = outerRadius * bottomThresholdRatio;
  const bottomThreshold = centerY + thresholdRadius;
  const fullCircleMultiplier = 2;
  const fullCircle = fullCircleMultiplier * Math.PI;
  const divisorForAngle = 2;
  // visx Pie starts at -π/2 (top of circle, 12 o'clock)
  const pieStartAngle = -Math.PI / divisorForAngle;

  // Calculate cumulative angles to estimate label positions
  // Start from top (-π/2) and go clockwise
  let cumulativeAngle = pieStartAngle;
  for (const segmentValue of data) {
    const safeSegmentValue = typeof segmentValue === "number" ? segmentValue : zeroValue;
    const segmentAngle = (safeSegmentValue / total) * fullCircle;
    const halfSegmentAngle = segmentAngle / divisorForAngle;
    const midAngle = cumulativeAngle + halfSegmentAngle;

    // Calculate approximate Y position of label
    // sin(angle) gives vertical position: positive = bottom, negative = top
    // In SVG, Y increases downward, so we add sin value to centerY
    const sinValue = Math.sin(midAngle);
    const labelYOffset = sinValue * labelDistance;
    const estimatedLabelY = centerY + labelYOffset;

    // Check if this label would be in the bottom portion of the chart
    if (estimatedLabelY > bottomThreshold) {
      hasBottomLabels = true;
      break;
    }

    cumulativeAngle += segmentAngle;
  }

  // Add extra padding if labels are near bottom
  const extraBottomPaddingValue = 30;
  const extraBottomPadding = hasBottomLabels ? extraBottomPaddingValue : zeroValue;
  const pieBottom = centerY + outerRadius;
  const legendStartY = pieBottom + legendTopMargin + extraBottomPadding;

  // Calculate legend layout - center horizontally
  interface LegendItem {
    color: string;
    label: string;
    x: number;
    y: number;
  }
  const legendItems: LegendItem[] = [];

  // First pass: calculate all item widths to determine total width
  const itemWidths: number[] = [];
  for (const label of labels) {
    const labelText = typeof label === "string" ? label : "";
    // Estimate text width (rough approximation: 6px per character)
    const charWidth = 6;
    const textWidth = labelText.length * charWidth;
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

    for (const itemIndex of row.items) {
      const label = labels[itemIndex] ?? "";
      const rowHeight = Math.max(legendBoxSize, legendFontSize);
      maxRowHeight = Math.max(maxRowHeight, rowHeight);

      legendItems.push({
        color: getColor(itemIndex),
        label,
        x: itemX,
        y: currentY
      });

      const itemWidth = itemWidths[itemIndex] ?? zeroValue;
      itemX += itemWidth + legendItemGap;
    }

    currentY += maxRowHeight + legendRowGap;
    maxRowHeight = initialMaxRowHeight;
  }

  // Adjust SVG height to accommodate legend
  const legendHeightOffset = currentY - legendStartY;
  const legendHeight = legendHeightOffset + maxRowHeight + legendTopMargin;
  const totalHeight = height + legendHeight;

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
            return pie.arcs.map((arc, i) => {
              const arcKey = `arc-${String(i)}`;
              const [centroidX, centroidY] = pie.path.centroid(arc);
              const percentageBase = 100;
              const decimalPlaces = 1;
              const percentage = ((arc.value / total) * percentageBase).toFixed(decimalPlaces);
              const percentageText = `${percentage}%`;

              // Position label outside the pie segment
              // Centroid is relative to pie center (0,0), so we scale it to position outside
              const labelOffset = 15;
              const labelDistance = outerRadius + labelOffset;
              // Normalize centroid to unit vector, then scale by labelDistance
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
              const minAngleForLabel = 0.05;
              const hasSpaceForLabel = arc.endAngle - arc.startAngle >= minAngleForLabel;

              return (
                <g key={arcKey}>
                  <path d={pie.path(arc) ?? undefined} fill={getColor(arc.index)} stroke="#ffffff" strokeWidth={2} />
                  {hasSpaceForLabel && (
                    <Text
                      dominantBaseline="middle"
                      fill="#374151"
                      fontSize={10}
                      fontWeight={500}
                      textAnchor="middle"
                      x={labelX}
                      y={labelY}
                    >
                      {percentageText}
                    </Text>
                  )}
                </g>
              );
            });
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
            stroke="#ffffff"
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
