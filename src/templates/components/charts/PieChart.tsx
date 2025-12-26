import * as fs from "fs";
import * as path from "path";
import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
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
        <text fill="#6b7280" fontSize={14} textAnchor="middle" x={centerX} y={centerY}>
          No data
        </text>
      </svg>
    );
  }

  // Ensure every non-zero value gets at least a minimum slice size for visibility
  // Store original values for percentage calculations
  const originalData = [...data];
  const adjustedData = [...data];
  const minimumSlicePercentage = 0.015; // 1.5% of total for minimum visibility
  const minimumValue = total * minimumSlicePercentage;

  // Boost values that are too small to be visible
  let hasSmallValues = false;
  for (let i = 0; i < adjustedData.length; i++) {
    const value = adjustedData[i];
    if (value !== undefined && value > zeroValue && value < minimumValue) {
      adjustedData[i] = minimumValue;
      hasSmallValues = true;
    }
  }

  // If we boosted any small values, scale down the larger values proportionally
  // to maintain visual proportions while ensuring all values are visible
  if (hasSmallValues) {
    const adjustedTotal = adjustedData.reduce((sum, val) => sum + val, zeroValue);
    const totalIncrease = adjustedTotal - total;

    // Find values that weren't boosted (they're >= minimumValue originally)
    const nonBoostedIndices: number[] = [];
    let nonBoostedSum = zeroValue;
    for (let i = 0; i < adjustedData.length; i++) {
      const originalVal = originalData[i];
      if (originalVal !== undefined && originalVal >= minimumValue) {
        nonBoostedIndices.push(i);
        const adjustedVal = adjustedData[i];
        if (adjustedVal !== undefined) {
          nonBoostedSum += adjustedVal;
        }
      }
    }

    // Scale down non-boosted values to compensate for the boost
    // This maintains relative proportions among large values
    if (nonBoostedSum > zeroValue && totalIncrease > zeroValue) {
      const scaleFactor = (nonBoostedSum - totalIncrease) / nonBoostedSum;
      for (const index of nonBoostedIndices) {
        const currentValue = adjustedData[index];
        if (currentValue !== undefined) {
          adjustedData[index] = currentValue * scaleFactor;
        }
      }
    }
  }

  // Use adjusted data for rendering, but original data for percentage calculations
  const renderData = adjustedData;

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
  const legendRowGap = 12;
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

  // Create sorted indices array sorted by label value (numerically if possible, otherwise alphabetically)
  // This ensures legend shows labels in a logical order (0, 1, 2, 3) rather than by data value
  const sortedIndices = labels
    .map((label, index) => {
      const labelText = typeof label === "string" ? label : "";
      const numericValue = Number.parseFloat(labelText);
      const isNumeric = !Number.isNaN(numericValue);
      return { index, isNumeric, label: labelText, numericValue };
    })
    .sort((a, b) => {
      if (a.isNumeric && b.isNumeric) {
        return a.numericValue - b.numericValue;
      }
      return a.label.localeCompare(b.label);
    })
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
  const legendEndY = legendStartY + legendHeight;
  const shrinkToLegend = options.shrinkToLegend ?? false;
  const totalHeight = shrinkToLegend ? legendEndY : Math.max(legendEndY, height);

  return (
    <svg height={totalHeight} width={width}>
      <Group left={centerX} top={centerY}>
        <Pie
          cornerRadius={3}
          data={renderData}
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
              originalIndex: number;
              labelText: string;
            }

            const labelInfos: LabelInfo[] = [];
            const minAngleForLabel = 0.05;
            const labelDistance = outerRadius + labelOffset;
            const percentageBase = 100;
            const decimalPlaces = 1;

            // Create mapping from renderData value to original index to get correct label
            // Since pieSortValues sorts arcs, arc.index is the sorted position in renderData, not original
            // We need to map arc.data (the adjusted value) back to the original index
            // For duplicate values, we need to track all occurrences
            // Since renderData[i] corresponds to originalData[i], we track original indices by renderData value
            const valueToIndexMap = new Map<number, number[]>();
            for (let i = 0; i < renderData.length; i++) {
              const renderValue = renderData[i];
              if (renderValue !== undefined) {
                const existing = valueToIndexMap.get(renderValue);
                if (existing === undefined) {
                  valueToIndexMap.set(renderValue, [i]);
                } else {
                  existing.push(i);
                }
              }
            }

            // Track which indices we've used for duplicate values
            const usedIndices = new Set<number>();

            // Build labelInfos in visual order (sorted by startAngle) to match slice rendering order
            // Overlap detection compares all pairs, so order doesn't matter for detection
            // But building in visual order ensures positions match visual slice order
            // Store this sorted array to reuse for rendering
            const arcsInVisualOrder = [...pie.arcs].sort((a, b) => a.startAngle - b.startAngle);
            const arcsForRendering = arcsInVisualOrder;

            for (const arc of arcsInVisualOrder) {
              const hasSpaceForLabel = arc.endAngle - arc.startAngle >= minAngleForLabel;
              if (!hasSpaceForLabel) {
                continue;
              }

              const [centroidX, centroidY] = pie.path.centroid(arc);

              // Map arc value back to original index to get the correct label text
              // For duplicate values, use the first unused index
              const indicesForValue = valueToIndexMap.get(arc.data);
              const firstIndexFallback = 0;
              let originalIndex: number | undefined = undefined;
              if (indicesForValue !== undefined) {
                // Find first unused index for this value
                originalIndex = indicesForValue.find((idx) => !usedIndices.has(idx));
                if (originalIndex !== undefined) {
                  usedIndices.add(originalIndex);
                } else {
                  // Fallback to first index if all are used (shouldn't happen)
                  originalIndex = indicesForValue[firstIndexFallback];
                }
              }

              // Calculate percentage based on original data, not adjusted render data
              const originalValue =
                originalIndex !== undefined ? (originalData[originalIndex] ?? zeroValue) : arc.value;
              const percentage = ((originalValue / total) * percentageBase).toFixed(decimalPlaces);
              const percentageText = `${percentage}%`;

              const labelText = originalIndex !== undefined ? labels[originalIndex] : undefined;
              const displayLabel = typeof labelText === "string" ? labelText : "";

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
                labelText: displayLabel,
                labelX,
                labelY,
                normalizedX,
                normalizedY,
                originalIndex: originalIndex ?? arc.index,
                percentageText
              });
            }

            // Detect overlaps and adjust positions by moving labels around the circle
            // Labels maintain a constant distance from the center (same radius)
            // When overlapping, labels are offset angularly (tangentially) while preserving visual order
            // Calculate minimum angular spacing based on label width and distance from center
            // Arc length = radius * angle, so angle = arc_length / radius
            // For labels ~35px wide at ~77px distance: 35/77 ≈ 0.45 radians
            const estimatedLabelWidth = 35;
            const minAngularSpacing = estimatedLabelWidth / labelDistance;

            // Calculate the angle for each label based on its centroid position
            // and store as adjustedAngle which we'll modify to resolve overlaps
            const adjustedLabels = labelInfos.map((info) => {
              const angle = Math.atan2(info.labelY, info.labelX);
              return {
                ...info,
                adjustedAngle: angle,
                adjustedX: info.labelX,
                adjustedY: info.labelY,
                needsLine: false,
                originalAngle: angle
              };
            });

            // Sort labels by their arc's startAngle to process them in visual order
            type AdjustedLabelInfo = (typeof adjustedLabels)[number];
            const sortedLabels: AdjustedLabelInfo[] = adjustedLabels
              .slice()
              .sort((a, b) => a.arc.startAngle - b.arc.startAngle);

            // Resolve overlaps by ensuring minimum angular spacing between consecutive labels
            // When labels overlap, spread them apart symmetrically:
            // - First label moves counterclockwise (decreasing angle)
            // - Second label moves clockwise (increasing angle)
            const startIndex = 1;
            const divisorForHalf = 2;
            const zeroAngle = 0;
            const fullCircleMultiplier = 2;
            const twoPi = fullCircleMultiplier * Math.PI;
            for (let i = startIndex; i < sortedLabels.length; i++) {
              const prev = sortedLabels[i - startIndex];
              const curr = sortedLabels[i];
              if (prev !== undefined && curr !== undefined) {
                // Calculate angular difference (curr - prev, should be positive in clockwise order)
                let angleDiff = curr.adjustedAngle - prev.adjustedAngle;

                // Normalize angle difference to handle wrap-around
                while (angleDiff < zeroAngle) {
                  angleDiff += twoPi;
                }
                while (angleDiff > twoPi) {
                  angleDiff -= twoPi;
                }

                // If labels are too close angularly, spread them apart symmetrically
                if (angleDiff < minAngularSpacing) {
                  // Calculate how much total adjustment is needed
                  const totalAdjustment = minAngularSpacing - angleDiff;
                  const halfAdjustment = totalAdjustment / divisorForHalf;

                  // Move first label counterclockwise (decrease angle)
                  prev.adjustedAngle -= halfAdjustment;
                  prev.needsLine = true;

                  // Move second label clockwise (increase angle)
                  curr.adjustedAngle += halfAdjustment;
                  curr.needsLine = true;
                }
              }
            }

            // Convert adjusted angles back to X, Y positions
            // Use the same radius (labelDistance) for all labels
            for (const label of adjustedLabels) {
              if (label.adjustedAngle !== label.originalAngle) {
                label.adjustedX = Math.cos(label.adjustedAngle) * labelDistance;
                label.adjustedY = Math.sin(label.adjustedAngle) * labelDistance;
                label.needsLine = true;
              }
            }

            return (
              <>
                {arcsForRendering.map((arc, i) => {
                  const arcKey = `arc-${String(i)}-${String(arc.data)}-${String(arc.index)}`;
                  // Map arc value back to original index for correct color
                  // For duplicate values, we need to find the matching index
                  const indicesForValue = valueToIndexMap.get(arc.data);
                  const firstColorIndex = 0;
                  let originalIndexForColor: number | undefined = undefined;
                  if (indicesForValue !== undefined) {
                    // Use the first index for this value (colors should match the first occurrence)
                    originalIndexForColor = indicesForValue[firstColorIndex];
                  }
                  const colorIndex = originalIndexForColor ?? arc.index;
                  return (
                    <path
                      key={arcKey}
                      d={pie.path(arc) ?? undefined}
                      fill={getColor(colorIndex)}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                })}
                {/* Render labels in the same visual order as slices */}
                {(() => {
                  // Use the same sorted arcs as used for rendering slices
                  const sortedArcs = arcsForRendering;

                  // Create a map from arc (data+index) to labelInfo for O(1) lookup
                  // We can't use index matching because some arcs are skipped when building labelInfos
                  // (arcs that are too small don't get labels)
                  type LabelInfoType = (typeof adjustedLabels)[number];
                  const arcToLabelMap = new Map<string, LabelInfoType>();
                  for (const labelInfo of adjustedLabels) {
                    const arcKey = `${String(labelInfo.arc.data)}-${String(labelInfo.arc.index)}`;
                    arcToLabelMap.set(arcKey, labelInfo);
                  }

                  return sortedArcs.map((arc) => {
                    // Match using the map by arc data and index
                    // This handles cases where some arcs are skipped (too small for labels)
                    const arcKey = `${String(arc.data)}-${String(arc.index)}`;
                    const labelInfo = arcToLabelMap.get(arcKey);
                    if (labelInfo === undefined) {
                      // Arc doesn't have a label (probably too small), skip it
                      return null;
                    }

                    const finalLabelInfo = labelInfo;

                    const labelKey = `label-${String(finalLabelInfo.originalIndex)}-${String(arc.index)}`;
                    // Recalculate centroid from the current arc to ensure it matches
                    // This ensures the line starts from the correct slice position
                    const [currentCentroidX, currentCentroidY] = pie.path.centroid(arc);
                    const xSquared = currentCentroidX * currentCentroidX;
                    const ySquared = currentCentroidY * currentCentroidY;
                    const currentCentroidLength = Math.sqrt(xSquared + ySquared);
                    const currentNormalizedX =
                      currentCentroidLength > zeroValue ? currentCentroidX / currentCentroidLength : zeroValue;
                    const currentNormalizedY =
                      currentCentroidLength > zeroValue ? currentCentroidY / currentCentroidLength : zeroValue;
                    const lineStartX = currentNormalizedX * outerRadius;
                    const lineStartY = currentNormalizedY * outerRadius;

                    // Calculate text dimensions to position line end at text edge
                    const textFontSize = 10;
                    const estimatedCharWidth = 6; // Approximate character width
                    const textWidth = finalLabelInfo.percentageText.length * estimatedCharWidth;
                    const halfTextWidth = textWidth / divisorForDimensions;

                    // Calculate direction from pie center to label
                    const directionX = finalLabelInfo.adjustedX - lineStartX;
                    const directionY = finalLabelInfo.adjustedY - lineStartY;
                    const directionXSquared = directionX * directionX;
                    const directionYSquared = directionY * directionY;
                    const directionLength = Math.sqrt(directionXSquared + directionYSquared);

                    // Normalize direction and extend to text edge
                    const normalizedDirX = directionLength > zeroValue ? directionX / directionLength : zeroValue;
                    const normalizedDirY = directionLength > zeroValue ? directionY / directionLength : zeroValue;

                    // Line ends at the edge of the text (half text width from center)
                    const offsetX = normalizedDirX * halfTextWidth;
                    const offsetY = normalizedDirY * halfTextWidth;
                    const lineEndX = finalLabelInfo.adjustedX - offsetX;
                    const lineEndY = finalLabelInfo.adjustedY - offsetY;

                    return (
                      <g key={labelKey}>
                        {finalLabelInfo.needsLine && (
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
                        <text
                          dominantBaseline="middle"
                          fill="#374151"
                          fontSize={textFontSize}
                          fontWeight={500}
                          textAnchor="middle"
                          x={finalLabelInfo.adjustedX}
                          y={finalLabelInfo.adjustedY}
                        >
                          {finalLabelInfo.percentageText}
                        </text>
                      </g>
                    );
                  });
                })()}
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
            <text
              dominantBaseline="middle"
              fill="#374151"
              fontFamily="Roboto, Arial, sans-serif"
              fontSize={legendFontSize}
              fontWeight={400}
              x={textX}
              y={textY}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
