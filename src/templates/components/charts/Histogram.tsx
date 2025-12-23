import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import React from "react";

import { HistogramConfig } from "../../../models/chart/histogramConfig";

interface HistogramProps {
  config: HistogramConfig;
}

export const Histogram: React.FC<HistogramProps> = ({ config }) => {
  const { labels, buckets, colors, options, height } = config;

  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;

  const topMargin = 30;
  const rightMarginMin = 50;
  const rightMarginRatio = 0.1;
  const bottomMarginMin = 80;
  const bottomMarginRatio = 0.14;
  const leftMarginMin = 60;
  const leftMarginRatio = 0.12;
  const xTickLabelAngle = -45;
  const xTickDx = "-0.35em";
  const xTickDy = "0.35em";
  const xLabelDyMin = 36;
  const xLabelDyScale = 1;
  const xLabelDyBase = 16;
  const rightMargin = Math.max(rightMarginMin, width * rightMarginRatio);
  const bottomMargin = Math.max(bottomMarginMin, height * bottomMarginRatio);
  const leftMargin = Math.max(leftMarginMin, width * leftMarginRatio);

  const margin = { bottom: bottomMargin, left: leftMargin, right: rightMargin, top: topMargin };

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const maxBucket = Math.max(...buckets);
  const zeroValue = 0;
  const paddingValue = 0.1;
  const labelFontSizeMin = 7;
  const labelFontSizeMax = 9;
  const labelFontSizeBase = 6;
  const labelFontSizeScaleDivisor = 14;
  const labelFontWeight = 500;
  const labelOffset = 5;
  const tickFontSize = 10;
  const maxTickLength = labels.reduce((max, label) => Math.max(max, label.length), zeroValue);
  const xLabelDyScaled = maxTickLength * xLabelDyScale;
  const xLabelDyCandidate = xLabelDyScaled + xLabelDyBase;
  const xLabelDyPx = Math.max(xLabelDyMin, xLabelDyCandidate);

  const xScale = scaleBand<string>({
    domain: labels,
    padding: paddingValue,
    range: [zeroValue, xMax]
  });

  const yScale = scaleLinear<number>({
    domain: [zeroValue, maxBucket],
    nice: true,
    range: [yMax, zeroValue]
  });

  const borderColor = "rgba(54, 162, 235, 1)";
  const halfDivisor = 2;

  return (
    <svg height={height} width={width}>
      <Group left={margin.left} top={margin.top}>
        <GridRows height={yMax} scale={yScale} stroke="#e5e7eb" width={xMax} />

        {buckets.map((value, i) => {
          const label = labels[i];
          if (label === undefined) {
            return null;
          }

          const xBand = xScale(label);
          const yValue = yScale(value);
          const zeroY = yScale(zeroValue);
          const barWidth = xScale.bandwidth();
          const barHeight = zeroY - yValue;
          const halfBarWidth = barWidth / halfDivisor;
          const labelX = (xBand ?? zeroValue) + halfBarWidth;
          const labelFontSizeScaled = barWidth / labelFontSizeScaleDivisor;
          const labelFontSizeUnclamped = labelFontSizeScaled + labelFontSizeBase;
          const labelFontSize = Math.min(labelFontSizeMax, Math.max(labelFontSizeMin, labelFontSizeUnclamped));
          const labelY = yValue - labelOffset;
          const labelBaseline = "alphabetic";

          const fillColor = Array.isArray(colors) ? colors[i] : colors;

          return (
            <Group key={i}>
              <Bar
                fill={fillColor}
                height={barHeight}
                stroke={borderColor}
                strokeWidth={1}
                width={barWidth}
                x={xBand}
                y={yValue}
              />
              <text
                dominantBaseline={labelBaseline}
                fill="#000"
                fontSize={labelFontSize}
                fontWeight={labelFontWeight}
                textAnchor="middle"
                x={labelX}
                y={labelY}
              >
                {value}
              </text>
            </Group>
          );
        })}

        <AxisBottom
          label={options.xLabel ?? ""}
          labelProps={{
            dy: xLabelDyPx,
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
          scale={xScale}
          tickValues={labels}
          tickLabelProps={() => ({
            angle: xTickLabelAngle,
            dx: xTickDx,
            dy: xTickDy,
            fill: "#374151",
            fontSize: tickFontSize,
            textAnchor: "end"
          })}
          top={yMax}
        />

        <AxisLeft
          label="Count"
          labelProps={{
            dx: "-2em",
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
          scale={yScale}
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
};
