import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridColumns, GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, Line } from "@visx/shape";
import React from "react";

import { BarChartConfig } from "../../../models/chart/barChartConfig";

interface BarChartProps {
  config: BarChartConfig;
}

export const BarChart: React.FC<BarChartProps> = ({ config }) => {
  const { labels, data, options, height } = config;

  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;
  const {
    horizontal = false,
    totalForPercentages,
    showCount,
    stacked = false,
    stackColors,
    stackLabels,
    artifactCountsPerLabel
  } = options;

  // Normalize data: convert single array to array of arrays for consistent handling
  const arrayIndexZero = 0;
  const isStacked = stacked && Array.isArray(data[arrayIndexZero]);
  const normalizedData: number[][] = isStacked ? (data as number[][]) : (data as number[]).map((val) => [val]);

  // Default colors for confidence levels: high (green), medium (yellow), low (red)
  const defaultStackColors = ["#10b981", "#f59e0b", "#ef4444"]; // green-500, amber-500, red-500
  const colors = stackColors ?? defaultStackColors;

  const topMargin = 30;
  const bottomMarginMin = 50;
  const bottomMarginRatio = 0.1;
  // Legend constants
  const legendBottomOffset = 0;
  const legendBoxSize = 10;
  const legendLabelGap = 5;
  const legendItemGap = 18;
  const legendRowGap = 8;
  const legendRowHeight = 16;
  const legendPadMultiplier = 2;
  const legendHorizontalPad = 24;
  const legendHorizontalPadDouble = legendHorizontalPad * legendPadMultiplier;
  const singleLegendRow = 1;
  const legendRows = isStacked && stackLabels !== undefined ? stackLabels.length : singleLegendRow;
  const legendHeight = legendRows * legendRowHeight;
  const legendYPosition = height - legendBottomOffset - legendHeight;
  const rightMarginDefaultMin = 30;
  const rightMarginDefaultRatio = 0.06;
  const rightMarginPercentageMin = 65;
  const rightMarginPercentageRatio = 0.05;
  const leftMarginHorizontalMin = 30;
  const leftMarginHorizontalRatio = 0.04;
  const tickFontSizeHorizontal = 8;
  const leftMarginDefault = 60;
  const labelCharWidthEstimate = 4.5;
  const labelPadding = 10;
  const zeroValue = 0;
  const paddingValue = 0.2;

  const rightMarginDefault = Math.max(rightMarginDefaultMin, width * rightMarginDefaultRatio);
  const rightMarginWithPercentage = Math.max(rightMarginPercentageMin, width * rightMarginPercentageRatio);
  // Add extra bottom margin for legend when stacked
  const legendBottomPadding = 10;
  const noLegendMargin = 0;
  const bottomMarginForLegend =
    isStacked && stackLabels !== undefined ? legendHeight + legendBottomPadding : noLegendMargin;
  const bottomMargin = Math.max(bottomMarginMin, height * bottomMarginRatio) + bottomMarginForLegend;
  const longestLabelLength = labels.reduce((max, label) => Math.max(max, label.length), zeroValue);
  const labelWidthWithoutPadding = longestLabelLength * labelCharWidthEstimate;
  const estimatedLabelWidth = labelWidthWithoutPadding + labelPadding;
  const leftMarginHorizontal = Math.max(
    leftMarginHorizontalMin,
    width * leftMarginHorizontalRatio,
    estimatedLabelWidth
  );
  // Cap the left margin to prevent it from squashing the chart
  const MAX_LEFT_MARGIN = 300;
  const clampedLeftMargin = Math.min(leftMarginHorizontal, MAX_LEFT_MARGIN);

  const margin = {
    bottom: bottomMargin,
    left: horizontal ? clampedLeftMargin : leftMarginDefault,
    right: horizontal && totalForPercentages !== undefined ? rightMarginWithPercentage : rightMarginDefault,
    top: topMargin
  };

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;
  const initialSum = 0;

  // Calculate max value from all stacks
  const stackTotals = normalizedData.map((stack) => stack.reduce((sum, val) => sum + val, initialSum));
  const defaultMaxValue = 1;
  const maxValue = stackTotals.length > initialSum ? Math.max(...stackTotals) : defaultMaxValue;

  const barColor = "rgba(75, 192, 192, 0.5)";
  const barBorderColor = "rgba(75, 192, 192, 1)";
  const percentageBase = 100;
  const decimalPlaces = 2;
  const halfDivisor = 2;
  const textOffset = 5;

  if (horizontal) {
    const xScaleLinear = scaleLinear<number>({
      domain: [zeroValue, maxValue],
      nice: true,
      range: [zeroValue, xMax]
    });
    const yScaleBand = scaleBand<string>({
      domain: labels,
      padding: paddingValue,
      range: [zeroValue, yMax]
    });

    return (
      <svg height={height} width={width}>
        <Group left={margin.left} top={margin.top}>
          <GridColumns height={yMax} scale={xScaleLinear} stroke="#e5e7eb" />

          {normalizedData.map((stack, i) => {
            const label = labels[i];
            if (label === undefined) {
              return null;
            }

            const yBand = yScaleBand(label);
            const barHeight = yScaleBand.bandwidth();
            const halfBarHeight = barHeight / halfDivisor;
            const labelY = (yBand ?? zeroValue) + halfBarHeight;
            const totalValue = stack.reduce((sum, val) => sum + val, initialSum);
            const xValue = xScaleLinear(totalValue);
            const labelX = xValue + textOffset;

            return (
              <Group key={i}>
                {isStacked ? (
                  // Render stacked bars
                  stack.map((segmentValue, segmentIdx) => {
                    const sliceStart = initialSum;
                    const previousSum = stack
                      .slice(sliceStart, segmentIdx)
                      .reduce((sum: number, val: number) => sum + val, initialSum);
                    const segmentX = xScaleLinear(previousSum);
                    const segmentWidth = xScaleLinear(previousSum + segmentValue) - segmentX;
                    const segmentColor = colors[segmentIdx % colors.length] ?? barColor;

                    return (
                      <Bar
                        key={segmentIdx}
                        fill={segmentColor}
                        height={barHeight}
                        stroke={segmentColor}
                        strokeWidth={1}
                        width={segmentWidth}
                        x={segmentX}
                        y={yBand}
                      />
                    );
                  })
                ) : (
                  // Render single bar
                  <Bar
                    fill={barColor}
                    height={barHeight}
                    stroke={barBorderColor}
                    strokeWidth={1}
                    width={xValue}
                    x={zeroValue}
                    y={yBand}
                  />
                )}
                {(() => {
                  const hasPercentage = totalForPercentages !== undefined && totalForPercentages > zeroValue;

                  // Skip text for separator label
                  if (
                    options.separatorLabel !== undefined &&
                    options.separatorLabel !== "" &&
                    labels[i] === options.separatorLabel
                  ) {
                    return null;
                  }

                  const hasCount = showCount === true;
                  const PERCENTAGE_BASE = 100;
                  // For stacked bars, use artifact count for percentage if available
                  // Otherwise use totalValue (for non-stacked or when artifact counts not provided)
                  const percentageNumerator =
                    isStacked && artifactCountsPerLabel !== undefined && labels[i] !== undefined
                      ? (artifactCountsPerLabel[labels[i]] ?? zeroValue)
                      : totalValue;
                  const percentageVal = hasPercentage
                    ? parseFloat(((percentageNumerator / totalForPercentages) * PERCENTAGE_BASE).toFixed(decimalPlaces))
                    : zeroValue;

                  let labelText = "";
                  if (hasCount && hasPercentage) {
                    labelText = `${String(totalValue)} (${String(percentageVal)}%)`;
                  } else if (hasPercentage) {
                    labelText = `${String(percentageVal)}%`;
                  } else if (hasCount) {
                    labelText = String(totalValue);
                  }

                  if (labelText) {
                    return (
                      <text
                        fill="#000"
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="start"
                        dominantBaseline="middle"
                        x={labelX}
                        y={labelY}
                      >
                        {labelText}
                      </text>
                    );
                  }
                  return null;
                })()}
              </Group>
            );
          })}
          {options.separatorLabel !== undefined &&
            labels.includes(options.separatorLabel) &&
            (() => {
              const idx = labels.indexOf(options.separatorLabel);
              const label = labels[idx];
              if (label === undefined) {
                return null;
              }
              // Calculate Y position: center of the separator band
              const yStart = yScaleBand(label) ?? zeroValue;
              const bandHeight = yScaleBand.bandwidth();
              const DIVISOR = 2;
              const halfBandHeight = bandHeight / DIVISOR;
              const lineY = yStart + halfBandHeight;

              return (
                <Line
                  from={{ x: -margin.left, y: lineY }}
                  to={{ x: xMax, y: lineY }}
                  stroke="#000"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              );
            })()}

          <AxisLeft
            scale={yScaleBand}
            tickValues={labels}
            tickFormat={(v) => {
              if (v === options.separatorLabel) {
                return "";
              }
              const MAX_LABEL_LENGTH = 50;
              return v.length > MAX_LABEL_LENGTH ? `${v.substring(zeroValue, MAX_LABEL_LENGTH)}...` : v;
            }}
            tickLabelProps={() => ({
              dx: "-0.25em",
              dy: "0.25em",
              fill: "#374151",
              fontSize: tickFontSizeHorizontal,
              textAnchor: "end"
            })}
          />
          <AxisBottom
            scale={xScaleLinear}
            tickFormat={(value) => String(Math.round(Number(value)))}
            tickLabelProps={() => ({
              dy: "0.25em",
              fill: "#374151",
              fontSize: 10,
              textAnchor: "middle"
            })}
            top={yMax}
          />
        </Group>

        {/* Legend for stacked bars */}
        {isStacked && stackLabels !== undefined && stackLabels.length > initialSum && (
          <foreignObject
            height={legendHeight}
            width={xMax + legendHorizontalPadDouble}
            x={margin.left - legendHorizontalPad}
            y={legendYPosition}
          >
            <div
              style={{
                alignItems: "center",
                color: "#374151",
                columnGap: legendItemGap,
                display: "flex",
                flexWrap: "nowrap",
                fontSize: 10,
                justifyContent: "center",
                overflow: "visible",
                paddingLeft: 8,
                paddingRight: 8,
                rowGap: legendRowGap,
                userSelect: "none",
                whiteSpace: "nowrap"
              }}
            >
              {stackLabels.map((label, idx) => {
                const color = colors[idx % colors.length] ?? barColor;
                return (
                  <div key={idx} style={{ alignItems: "center", columnGap: legendLabelGap, display: "flex" }}>
                    <div
                      style={{
                        backgroundColor: color,
                        border: `1px solid ${color}`,
                        height: legendBoxSize,
                        width: legendBoxSize
                      }}
                    />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </foreignObject>
        )}
      </svg>
    );
  } else {
    const xScaleBand = scaleBand<string>({
      domain: labels,
      padding: paddingValue,
      range: [zeroValue, xMax]
    });
    const yScaleLinear = scaleLinear<number>({
      domain: [zeroValue, maxValue],
      nice: true,
      range: [yMax, zeroValue]
    });

    return (
      <svg height={height} width={width}>
        <Group left={margin.left} top={margin.top}>
          <GridRows height={yMax} scale={yScaleLinear} stroke="#e5e7eb" width={xMax} />

          {normalizedData.map((stack, i) => {
            const label = labels[i];
            if (label === undefined) {
              return null;
            }

            const xBand = xScaleBand(label);
            const totalValue = stack.reduce((sum, val) => sum + val, initialSum);
            const zeroY = yScaleLinear(zeroValue);
            const barWidth = xScaleBand.bandwidth();
            const halfBarWidth = barWidth / halfDivisor;
            const labelX = (xBand ?? zeroValue) + halfBarWidth;

            return (
              <Group key={i}>
                {isStacked
                  ? // Render stacked bars
                    stack.map((segmentValue, segmentIdx) => {
                      const sliceStart = initialSum;
                      const previousSum = stack
                        .slice(sliceStart, segmentIdx)
                        .reduce((sum: number, val: number) => sum + val, initialSum);
                      const segmentY = yScaleLinear(previousSum + segmentValue);
                      const segmentHeight = zeroY - segmentY;
                      const segmentColor = colors[segmentIdx % colors.length] ?? barColor;

                      return (
                        <Bar
                          key={segmentIdx}
                          fill={segmentColor}
                          height={segmentHeight}
                          stroke={segmentColor}
                          strokeWidth={1}
                          width={barWidth}
                          x={xBand}
                          y={segmentY}
                        />
                      );
                    })
                  : // Render single bar
                    (() => {
                      const yValue = yScaleLinear(totalValue);
                      const barHeight = zeroY - yValue;

                      return (
                        <Bar
                          fill={barColor}
                          height={barHeight}
                          stroke={barBorderColor}
                          strokeWidth={1}
                          width={barWidth}
                          x={xBand}
                          y={yValue}
                        />
                      );
                    })()}
                {totalForPercentages !== undefined && totalForPercentages > zeroValue && (
                  <text
                    fill="#000"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="middle"
                    x={labelX}
                    y={yScaleLinear(totalValue) - textOffset}
                  >
                    {parseFloat(((totalValue / totalForPercentages) * percentageBase).toFixed(decimalPlaces))}%
                  </text>
                )}
                {showCount === true && (
                  <text
                    fill="#000"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="middle"
                    x={labelX}
                    y={yScaleLinear(totalValue) - textOffset}
                  >
                    {totalValue}
                  </text>
                )}
              </Group>
            );
          })}

          <AxisBottom
            scale={xScaleBand}
            tickLabelProps={() => ({
              dy: "0.25em",
              fill: "#374151",
              fontSize: 10,
              textAnchor: "middle"
            })}
            top={yMax}
          />
          <AxisLeft
            scale={yScaleLinear}
            tickFormat={(value) => String(Math.round(Number(value)))}
            tickLabelProps={() => ({
              dx: "-0.25em",
              dy: "0.25em",
              fill: "#374151",
              fontSize: 10,
              textAnchor: "end"
            })}
          />
        </Group>

        {/* Legend for stacked bars */}
        {isStacked && stackLabels !== undefined && stackLabels.length > initialSum && (
          <foreignObject
            height={legendHeight}
            width={xMax + legendHorizontalPadDouble}
            x={margin.left - legendHorizontalPad}
            y={legendYPosition}
          >
            <div
              style={{
                alignItems: "center",
                color: "#374151",
                columnGap: legendItemGap,
                display: "flex",
                flexWrap: "nowrap",
                fontSize: 10,
                justifyContent: "center",
                overflow: "visible",
                paddingLeft: 8,
                paddingRight: 8,
                rowGap: legendRowGap,
                userSelect: "none",
                whiteSpace: "nowrap"
              }}
            >
              {stackLabels.map((label, idx) => {
                const color = colors[idx % colors.length] ?? barColor;
                return (
                  <div key={idx} style={{ alignItems: "center", columnGap: legendLabelGap, display: "flex" }}>
                    <div
                      style={{
                        backgroundColor: color,
                        border: `1px solid ${color}`,
                        height: legendBoxSize,
                        width: legendBoxSize
                      }}
                    />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </foreignObject>
        )}
      </svg>
    );
  }
};
