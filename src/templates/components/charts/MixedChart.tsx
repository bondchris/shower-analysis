import { AxisBottom, AxisLeft, AxisRight } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear, scalePoint } from "@visx/scale";
import { AreaClosed, Bar, LinePath } from "@visx/shape";
import React from "react";

import { MixedChartConfig } from "../../../models/chart/mixedChartConfig";

interface MixedChartProps {
  config: MixedChartConfig;
}

export const MixedChart: React.FC<MixedChartProps> = ({ config }) => {
  const { labels, datasets, options, height } = config;

  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;

  // Margins: extra space at bottom (105px) for rotated date labels and legend
  // Right margin increased to 80px to accommodate longer right Y-axis label
  const topMargin = 30;
  const rightMargin = 80;
  const bottomMargin = 105;
  const leftMargin = 60;

  const margin = { bottom: bottomMargin, left: leftMargin, right: rightMargin, top: topMargin };

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const leftAxisDatasets = datasets.filter((ds) => (ds.yAxisID ?? "y") === "y");
  const rightAxisDatasets = datasets.filter((ds) => ds.yAxisID === "y1");

  const maxLeftValue = Math.max(
    ...leftAxisDatasets.flatMap((ds) => ds.data.filter((v): v is number => v !== null && Number.isFinite(v)))
  );

  const zeroValue = 0;
  const paddingValue = 0.5;
  const maxRightValue =
    rightAxisDatasets.length > zeroValue
      ? Math.max(
          ...rightAxisDatasets.flatMap((ds) => ds.data.filter((v): v is number => v !== null && Number.isFinite(v)))
        )
      : zeroValue;

  const xScale = scalePoint<string>({
    domain: labels,
    padding: paddingValue,
    range: [zeroValue, xMax]
  });

  const yScaleLeft = scaleLinear<number>({
    domain: [zeroValue, maxLeftValue],
    nice: true,
    range: [yMax, zeroValue]
  });

  const yScaleRight = scaleLinear<number>({
    domain: [zeroValue, maxRightValue],
    nice: true,
    range: [yMax, zeroValue]
  });

  const colorPalette = ["#4F46E5", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"];
  const oneDataset = 1;
  const defaultBorderWidth = 2;
  const halfDivisor = 2;
  const barWidthFactor = 0.8;
  const pointPadding = 0.5;
  const oneLabel = 1;
  const legendBottomOffset = 0;
  const maxXTicks = 15; // Limit x-axis ticks to prevent date label crowding
  const legendBoxSize = 10;
  const legendLabelGap = 5;
  const legendItemGap = 18;
  const legendRowGap = 8;
  const legendRowHeight = 16;
  const legendPadMultiplier = 2;
  const legendHorizontalPad = 24;
  const legendHorizontalPadDouble = legendHorizontalPad * legendPadMultiplier;
  const legendRows = oneLabel;
  const legendHeight = legendRows * legendRowHeight;
  const legendYPosition = height - legendBottomOffset - legendHeight;

  return (
    <svg height={height} width={width}>
      <Group left={margin.left} top={margin.top}>
        <GridRows height={yMax} scale={yScaleLeft} stroke="#e5e7eb" width={xMax} />

        {datasets.map((dataset, idx) => {
          const color = dataset.borderColor || colorPalette[idx % colorPalette.length];
          const isRightAxis = dataset.yAxisID === "y1";
          const yScale = isRightAxis ? yScaleRight : yScaleLeft;
          const chartType = dataset.type ?? "line";

          if (chartType === "bar") {
            const pointRangeValue = xScale.range()[oneLabel];
            const pointRange = typeof pointRangeValue === "number" ? pointRangeValue : zeroValue;
            const paddingAdjustment = pointPadding * halfDivisor;
            const step = pointRange / (labels.length - (oneLabel - paddingAdjustment));
            const barWidth = step * barWidthFactor;

            return (
              <Group key={idx}>
                {dataset.data.map((value, i) => {
                  if (value === null || !Number.isFinite(value)) {
                    return null;
                  }
                  const label = labels[i];
                  if (label === undefined) {
                    return null;
                  }
                  const x = xScale(label);
                  const y = yScale(value);
                  const zeroY = yScale(zeroValue);
                  const barHeight = zeroY - y;
                  const barWidthHalf = barWidth / halfDivisor;

                  return (
                    <Bar
                      key={i}
                      fill={dataset.backgroundColor ?? color}
                      height={barHeight}
                      stroke={color}
                      strokeWidth={1}
                      width={barWidth}
                      x={(typeof x === "number" ? x : zeroValue) - barWidthHalf}
                      y={y}
                    />
                  );
                })}
              </Group>
            );
          } else {
            const points = dataset.data
              .map((value, i) => {
                if (value === null || !Number.isFinite(value)) {
                  return null;
                }
                const label = labels[i];
                if (label === undefined) {
                  return null;
                }
                const x = xScale(label);
                const y = yScale(value);
                if (typeof x !== "number" || typeof y !== "number") {
                  return null;
                }
                return { x, y };
              })
              .filter((p): p is { x: number; y: number } => p !== null);

            if (dataset.fill === true) {
              return (
                <Group key={idx}>
                  <AreaClosed<{ x: number; y: number }>
                    data={points}
                    fill={dataset.backgroundColor ?? color}
                    fillOpacity={1}
                    stroke="transparent"
                    x={(d) => d.x}
                    y={(d) => d.y}
                    yScale={yScale}
                  />
                  <LinePath<{ x: number; y: number }>
                    data={points}
                    stroke={color}
                    strokeWidth={dataset.borderWidth ?? defaultBorderWidth}
                    x={(d) => d.x}
                    y={(d) => d.y}
                  />
                </Group>
              );
            } else {
              return (
                <LinePath<{ x: number; y: number }>
                  key={idx}
                  data={points}
                  stroke={color}
                  strokeWidth={dataset.borderWidth ?? defaultBorderWidth}
                  x={(d) => d.x}
                  y={(d) => d.y}
                />
              );
            }
          }
        })}

        <AxisBottom
          numTicks={Math.min(labels.length, maxXTicks)}
          scale={xScale}
          tickLabelProps={() => ({
            angle: -45,
            dx: "-0.5em",
            dy: "0.25em",
            fill: "#374151",
            fontSize: 9,
            textAnchor: "end"
          })}
          top={yMax}
        />

        <AxisLeft
          label={options.yLabelLeft ?? ""}
          labelOffset={40}
          labelProps={{
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
          scale={yScaleLeft}
          tickFormat={(value) => String(Math.round(Number(value)))}
          tickLabelProps={() => ({
            dx: "-0.25em",
            dy: "0.25em",
            fill: "#374151",
            fontSize: 10,
            textAnchor: "end"
          })}
        />

        {rightAxisDatasets.length > zeroValue && (
          <AxisRight
            label={options.yLabelRight ?? ""}
            labelOffset={40}
            labelProps={{
              fill: "#374151",
              fontSize: 12,
              textAnchor: "middle"
            }}
            left={xMax}
            scale={yScaleRight}
            tickFormat={(value) => {
              const num = Number(value);
              const decimalPlaces = 1;
              const moduloDivisor = 1;
              // Show whole numbers without decimals, fractional values with 1 decimal place
              return num % moduloDivisor === zeroValue ? String(Math.round(num)) : num.toFixed(decimalPlaces);
            }}
            tickLabelProps={() => ({
              dx: "0.25em",
              dy: "0.25em",
              fill: "#374151",
              fontSize: 10,
              textAnchor: "start"
            })}
          />
        )}
      </Group>

      {datasets.length > oneDataset && (
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
            {datasets.map((dataset, idx) => {
              const color = dataset.borderColor || colorPalette[idx % colorPalette.length];
              return (
                <div
                  key={idx}
                  style={{
                    alignItems: "center",
                    columnGap: legendLabelGap,
                    display: "inline-flex",
                    flex: "0 0 auto",
                    lineHeight: 1,
                    whiteSpace: "nowrap"
                  }}
                >
                  <div
                    style={{
                      background: color,
                      borderRadius: 2,
                      height: legendBoxSize,
                      width: legendBoxSize
                    }}
                  />
                  <span>{dataset.label}</span>
                </div>
              );
            })}
          </div>
        </foreignObject>
      )}
    </svg>
  );
};
