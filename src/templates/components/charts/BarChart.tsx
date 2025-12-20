import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridColumns, GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import React from "react";

import { BarChartConfig } from "../../../utils/chartUtils";

interface BarChartProps {
  config: BarChartConfig;
}

export const BarChart: React.FC<BarChartProps> = ({ config }) => {
  const { labels, data, options, height } = config;

  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;
  const { horizontal = false, totalForPercentages, showCount } = options;

  const topMargin = 30;
  const bottomMarginMin = 50;
  const bottomMarginRatio = 0.1;
  const rightMarginDefaultMin = 30;
  const rightMarginDefaultRatio = 0.06;
  const rightMarginPercentageMin = 60;
  const rightMarginPercentageRatio = 0.1;
  const leftMarginHorizontalMin = 60;
  const leftMarginHorizontalRatio = 0.04;
  const tickFontSizeHorizontal = 8;
  const leftMarginDefault = 60;
  const labelCharWidthEstimate = 4.5;
  const labelPadding = 6;
  const zeroValue = 0;
  const paddingValue = 0.2;

  const rightMarginDefault = Math.max(rightMarginDefaultMin, width * rightMarginDefaultRatio);
  const rightMarginWithPercentage = Math.max(rightMarginPercentageMin, width * rightMarginPercentageRatio);
  const bottomMargin = Math.max(bottomMarginMin, height * bottomMarginRatio);
  const longestLabelLength = labels.reduce((max, label) => Math.max(max, label.length), zeroValue);
  const labelWidthWithoutPadding = longestLabelLength * labelCharWidthEstimate;
  const estimatedLabelWidth = labelWidthWithoutPadding + labelPadding;
  const leftMarginHorizontal = Math.max(
    leftMarginHorizontalMin,
    width * leftMarginHorizontalRatio,
    estimatedLabelWidth
  );

  const margin = {
    bottom: bottomMargin,
    left: horizontal ? leftMarginHorizontal : leftMarginDefault,
    right: horizontal && totalForPercentages !== undefined ? rightMarginWithPercentage : rightMarginDefault,
    top: topMargin
  };

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const maxValue = Math.max(...data);

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

          {data.map((value, i) => {
            const label = labels[i];
            if (label === undefined) {
              return null;
            }

            const yBand = yScaleBand(label);
            const xValue = xScaleLinear(value);
            const barHeight = yScaleBand.bandwidth();
            const halfBarHeight = barHeight / halfDivisor;
            const labelY = (yBand ?? zeroValue) + halfBarHeight;
            const labelX = Math.min(xValue + textOffset, xMax - textOffset);

            return (
              <Group key={i}>
                <Bar
                  fill={barColor}
                  height={barHeight}
                  stroke={barBorderColor}
                  strokeWidth={1}
                  width={xValue}
                  x={zeroValue}
                  y={yBand}
                />
                {totalForPercentages !== undefined && totalForPercentages > zeroValue && (
                  <text
                    fill="#000"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="start"
                    dominantBaseline="middle"
                    x={labelX}
                    y={labelY}
                  >
                    {parseFloat(((value / totalForPercentages) * percentageBase).toFixed(decimalPlaces))}%
                  </text>
                )}
                {showCount === true && (
                  <text
                    fill="#000"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="start"
                    dominantBaseline="middle"
                    x={labelX}
                    y={labelY}
                  >
                    {value}
                  </text>
                )}
              </Group>
            );
          })}

          <AxisLeft
            scale={yScaleBand}
            tickValues={labels}
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

          {data.map((value, i) => {
            const label = labels[i];
            if (label === undefined) {
              return null;
            }

            const xBand = xScaleBand(label);
            const yValue = yScaleLinear(value);
            const zeroY = yScaleLinear(zeroValue);
            const barWidth = xScaleBand.bandwidth();
            const barHeight = zeroY - yValue;
            const halfBarWidth = barWidth / halfDivisor;
            const labelX = (xBand ?? zeroValue) + halfBarWidth;

            return (
              <Group key={i}>
                <Bar
                  fill={barColor}
                  height={barHeight}
                  stroke={barBorderColor}
                  strokeWidth={1}
                  width={barWidth}
                  x={xBand}
                  y={yValue}
                />
                {totalForPercentages !== undefined && totalForPercentages > zeroValue && (
                  <text
                    fill="#000"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="middle"
                    x={labelX}
                    y={yValue - textOffset}
                  >
                    {parseFloat(((value / totalForPercentages) * percentageBase).toFixed(decimalPlaces))}%
                  </text>
                )}
                {showCount === true && (
                  <text
                    fill="#000"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="middle"
                    x={labelX}
                    y={yValue - textOffset}
                  >
                    {value}
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
      </svg>
    );
  }
};
