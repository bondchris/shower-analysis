import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear, scalePoint } from "@visx/scale";
import { LinearGradient } from "@visx/gradient";
import { curveLinear, curveMonotoneX } from "@visx/curve";
import { AreaClosed, LinePath } from "@visx/shape";
import React from "react";

import { LineChartConfig } from "../../../models/chart/lineChartConfig";

interface LineChartProps {
  config: LineChartConfig;
}

export const LineChart: React.FC<LineChartProps> = ({ config }) => {
  const { labels, datasets, options, height } = config;
  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;

  const zeroValue = 0;
  const paddingValue = 0.5;

  // Calculate dynamic x-axis label offset based on tick label length and rotation
  const xLabelDyMin = 36;
  const xLabelDyScale = 1;
  const xLabelDyBase = 16;
  // Account for -45 degree rotation: sin(45°) ≈ 0.707, but we also need space for the label itself
  const rotationFactor = 0.7;
  const maxTickLength = labels.reduce((max, label) => Math.max(max, label.length), zeroValue);
  const xLabelDyScaled = maxTickLength * xLabelDyScale * rotationFactor;
  const xLabelDyCandidate = xLabelDyScaled + xLabelDyBase;
  const xLabelDyPx = Math.max(xLabelDyMin, xLabelDyCandidate);

  // Margins: space for axis labels and tick marks
  const topMargin = 15;
  const rightMargin = 40;
  const textOffsetFromLine = 8;
  // Calculate bottom margin for rotated tick labels at -45 degrees
  const charWidthEstimate = 4.5;
  const rotationSin = 0.707; // sin(45°)
  const tickLabelFontSize = 9;
  const axisLineAndTickSpace = 20;
  const xAxisLabelHeight = 16;
  // Estimate vertical space needed for rotated tick labels
  const rotatedLabelVerticalSpace = maxTickLength * charWidthEstimate * rotationSin;
  const xAxisLabelSpace = options.xLabel !== undefined && options.xLabel !== "" ? xAxisLabelHeight : zeroValue;
  const bottomMargin = axisLineAndTickSpace + rotatedLabelVerticalSpace + tickLabelFontSize + xAxisLabelSpace;
  const leftMargin = 60;

  const margin = { bottom: bottomMargin, left: leftMargin, right: rightMargin, top: topMargin };

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const maxDataValue = Math.max(
    ...datasets.flatMap((ds) => ds.data.filter((v): v is number => v !== null && Number.isFinite(v)))
  );

  const xScale = scalePoint<string>({
    domain: labels,
    padding: paddingValue,
    range: [zeroValue, xMax]
  });

  const yScale = scaleLinear<number>({
    domain: [zeroValue, maxDataValue],
    nice: true,
    range: [yMax, zeroValue]
  });

  const colorPalette = ["#4F46E5", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"];
  const oneDataset = 1;
  const defaultBorderWidth = 2;
  const maxXTicks = 15; // Limit x-axis ticks to prevent date label crowding
  const legendBoxSize = 10;
  const legendLabelGap = 5;
  const legendItemGap = 18;
  const legendRowGap = 8;
  const legendRowHeight = 16;
  const legendPadMultiplier = 2;
  const legendHorizontalPad = 24;
  const legendHorizontalPadDouble = legendHorizontalPad * legendPadMultiplier;
  const legendTopPadding = 8;

  const charWidth = 6;
  const itemPaddingEstimate = legendBoxSize + legendLabelGap + legendItemGap;
  const totalLabelChars = datasets.reduce((sum, ds) => sum + ds.label.length, zeroValue);
  const avgItemWidth = totalLabelChars / Math.max(datasets.length, oneDataset);
  const avgItemLabelWidth = avgItemWidth * charWidth;
  const estimatedItemWidth = avgItemLabelWidth + itemPaddingEstimate;
  const availableLegendWidth = xMax + legendHorizontalPadDouble;
  const itemsPerRow = Math.max(oneDataset, Math.floor(availableLegendWidth / estimatedItemWidth));
  const legendRows = Math.ceil(datasets.length / itemsPerRow);
  const rowsAboveFirst = legendRows - oneDataset;
  const baseRowsHeight = legendRows * legendRowHeight;
  const gapHeight = rowsAboveFirst * legendRowGap;
  const legendHeight = baseRowsHeight + gapHeight;
  const hasLegend = datasets.length > oneDataset;
  const legendSpace = hasLegend ? legendHeight + legendTopPadding : zeroValue;
  const totalSvgHeight = height + legendSpace;
  const legendYPosition = height + legendTopPadding;

  const curveType = options.smooth === true ? curveMonotoneX : curveLinear;

  // Calculate vertical reference line position if provided
  let referenceLineX: number | null = null;
  if (options.verticalReferenceLine !== undefined) {
    const refValue = options.verticalReferenceLine.value;
    // Find the closest label to the reference value
    const numericLabels = labels.map((label: string) => {
      const num = Number.parseFloat(label);
      return Number.isNaN(num) ? null : num;
    });

    let bestLabelString: string | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    const startIndex = 0;
    const incrementStep = 1;
    for (let i = startIndex; i < labels.length; i += incrementStep) {
      const numericValue = numericLabels[i];
      if (numericValue === null || numericValue === undefined) {
        continue;
      }
      const labelValue = labels[i];
      if (labelValue === undefined) {
        continue;
      }
      const diff = Math.abs(numericValue - refValue);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestLabelString = labelValue;
      }
    }
    if (bestLabelString !== null) {
      const xPos = xScale(bestLabelString);
      if (typeof xPos === "number") {
        referenceLineX = xPos;
      }
    }
  }

  return (
    <svg height={totalSvgHeight} width={width}>
      <Group left={margin.left} top={margin.top}>
        <GridRows height={yMax} scale={yScale} stroke="#e5e7eb" width={xMax} />

        {datasets.map((dataset, idx) => {
          const color = dataset.borderColor || colorPalette[idx % colorPalette.length];
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

          const fallback = "chart";
          const fillGradientId = `gradient-fill-${options.chartId ?? fallback}-${String(idx)}`;
          const strokeGradientId = `gradient-stroke-${options.chartId ?? fallback}-${String(idx)}`;
          const hasGradient = typeof dataset.gradientFrom === "string" || typeof dataset.gradientTo === "string";
          const gradientOpacity = 0.6;
          const fillOpacityStart = 0.6;
          const fillOpacityEnd = 0.1;
          const solidOpacity = 0.2;
          const fullOpacity = 1;
          const strokeOpacity = 1;
          const fallbackColor = "#000";

          return (
            <React.Fragment key={idx}>
              {hasGradient && (
                <>
                  {/* Gradient for fill area */}
                  <LinearGradient
                    from={dataset.gradientFrom ?? color ?? fallbackColor}
                    fromOpacity={gradientOpacity}
                    id={fillGradientId}
                    to={dataset.gradientTo ?? color ?? fallbackColor}
                    toOpacity={dataset.gradientDirection === "horizontal" ? fillOpacityStart : fillOpacityEnd}
                    vertical={dataset.gradientDirection !== "horizontal"}
                  />
                  {/* Gradient for stroke (line) - always horizontal for temperature scale */}
                  <LinearGradient
                    from={dataset.gradientFrom ?? color ?? fallbackColor}
                    fromOpacity={strokeOpacity}
                    id={strokeGradientId}
                    to={dataset.gradientTo ?? color ?? fallbackColor}
                    toOpacity={strokeOpacity}
                    vertical={false}
                  />
                </>
              )}
              {dataset.fill === true && (
                <AreaClosed<{ x: number; y: number }>
                  curve={curveType}
                  data={points}
                  fill={hasGradient ? `url(#${fillGradientId})` : color}
                  fillOpacity={hasGradient ? fullOpacity : solidOpacity}
                  x={(d) => d.x}
                  y={(d) => d.y}
                  yScale={yScale}
                />
              )}
              <LinePath<{ x: number; y: number }>
                curve={curveType}
                data={points}
                stroke={hasGradient ? `url(#${strokeGradientId})` : color}
                strokeWidth={dataset.borderWidth ?? defaultBorderWidth}
                x={(d) => d.x}
                y={(d) => d.y}
              />
            </React.Fragment>
          );
        })}

        {referenceLineX !== null && options.verticalReferenceLine !== undefined && (
          <>
            <line
              stroke="#6b7280"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              x1={referenceLineX}
              x2={referenceLineX}
              y1={zeroValue}
              y2={yMax}
            />
            <text fill="#374151" fontSize={10} fontWeight="500" x={referenceLineX + textOffsetFromLine} y={12}>
              {options.verticalReferenceLine.label}
            </text>
          </>
        )}

        <AxisBottom
          label={options.xLabel ?? ""}
          labelProps={{
            dy: xLabelDyPx,
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
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
          label={options.yLabel ?? "Error Count"}
          labelOffset={40}
          labelProps={{
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
              flexWrap: "wrap",
              fontSize: 10,
              justifyContent: "center",
              overflow: "visible",
              paddingLeft: 8,
              paddingRight: 8,
              rowGap: legendRowGap,
              userSelect: "none"
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
                    lineHeight: 1
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
