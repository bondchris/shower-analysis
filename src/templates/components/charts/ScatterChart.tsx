import { AxisLeft, AxisTop } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import React from "react";

import { ScatterChartConfig } from "../../../models/chart/scatterChartConfig";

interface ScatterChartProps {
  config: ScatterChartConfig;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({ config }) => {
  const { datasets, options, height } = config;
  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;

  const topMargin = 75;
  const rightMargin = 40;
  const bottomMargin = 15;
  const leftMargin = 60;

  const margin = { bottom: bottomMargin, left: leftMargin, right: rightMargin, top: topMargin };

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const zeroValue = 0;
  const defaultMaxValue = 10;
  const paddingMultiplier = 0.1;
  const defaultPadding = 1;
  const decimalPrecision = 10;

  // Collect all points to determine domain - use same range for x and y
  const allPoints = datasets.flatMap((ds) => ds.data);
  const allXValues = allPoints.map((p) => p.x).filter((v) => Number.isFinite(v));
  const allYValues = allPoints.map((p) => p.y).filter((v) => Number.isFinite(v));
  const allValues = [...allXValues, ...allYValues];

  const hasData = allValues.length > zeroValue;
  const minValue = hasData ? Math.min(...allValues) : zeroValue;
  const maxValue = hasData ? Math.max(...allValues) : defaultMaxValue;

  const padding = hasData ? (maxValue - minValue) * paddingMultiplier : defaultPadding;
  const domainMin = Math.max(zeroValue, minValue - padding);
  const domainMax = maxValue + padding;

  const xScale = scaleLinear<number>({
    domain: [domainMin, domainMax],
    nice: true,
    range: [zeroValue, xMax]
  });

  const yScale = scaleLinear<number>({
    domain: [domainMin, domainMax],
    nice: true,
    range: [yMax, zeroValue]
  });

  const defaultPointColor = "#3b82f6";
  const defaultPointRadius = 2;

  return (
    <svg height={height} width={width}>
      <Group left={margin.left} top={margin.top}>
        <GridRows height={yMax} scale={yScale} stroke="#e5e7eb" width={xMax} />

        {/* Diagonal line (y=x) for reference */}
        <line
          stroke="#d1d5db"
          strokeDasharray="4 4"
          strokeWidth={1}
          x1={zeroValue}
          x2={xMax}
          y1={yMax}
          y2={zeroValue}
        />

        {datasets.map((dataset, datasetIdx) => {
          const pointColor = dataset.pointColor ?? defaultPointColor;
          const pointRadius = dataset.pointRadius ?? defaultPointRadius;

          return (
            <React.Fragment key={datasetIdx}>
              {dataset.data.map((point, pointIdx) => {
                const x = xScale(point.x);
                const y = yScale(point.y);

                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                  return null;
                }

                const fullOpacity = 1;
                const opacity = point.opacity ?? fullOpacity;
                return <circle key={pointIdx} cx={x} cy={y} fill={pointColor} fillOpacity={opacity} r={pointRadius} />;
              })}
            </React.Fragment>
          );
        })}

        {/* X-axis at the top */}
        <AxisTop
          label={options.xLabel ?? ""}
          labelProps={{
            dy: -10,
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
          scale={xScale}
          tickFormat={(value) => String(Math.round(Number(value) * decimalPrecision) / decimalPrecision)}
          tickLabelProps={() => ({
            dy: "-0.25em",
            fill: "#374151",
            fontSize: 9,
            textAnchor: "middle"
          })}
          top={0}
        />

        {/* Y-axis on the left */}
        <AxisLeft
          label={options.yLabel ?? ""}
          labelOffset={40}
          labelProps={{
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
          scale={yScale}
          tickFormat={(value) => String(Math.round(Number(value) * decimalPrecision) / decimalPrecision)}
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
};
