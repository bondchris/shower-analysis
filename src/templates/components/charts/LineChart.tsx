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
  const xAxisLabelFontSize = 12;
  const xAxisLabelPadding = 0;
  // Estimate vertical space needed for rotated tick labels
  const rotatedLabelVerticalSpace = maxTickLength * charWidthEstimate * rotationSin;
  const xAxisLabelSpace =
    options.xLabel !== undefined && options.xLabel !== ""
      ? xLabelDyPx + xAxisLabelFontSize + xAxisLabelPadding
      : zeroValue;
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
  const maxYTicks = 10;
  // Scale x-axis ticks based on chart width (fewer ticks for narrower charts)
  const fullWidthTicks = 15;
  const fullWidthReference = 650;
  const ticksPerPixel = fullWidthTicks / fullWidthReference;
  const minXTicks = 5;
  const maxXTicks = Math.max(minXTicks, Math.round(width * ticksPerPixel));

  // Calculate tick values that always include first and last labels
  const getTickValues = (): string[] => {
    const numLabels = labels.length;
    if (numLabels <= maxXTicks) {
      return labels;
    }

    const tickValues: string[] = [];
    const firstLabel = labels[zeroValue];
    const singleElementOffset = 1;
    const lastIdx = numLabels - singleElementOffset;
    const lastLabel = labels[lastIdx];

    if (firstLabel === undefined || lastLabel === undefined) {
      return labels;
    }

    // Always include first label
    tickValues.push(firstLabel);

    // Calculate interior ticks (excluding first and last)
    const firstAndLastCount = 2;
    const interiorTicks = maxXTicks - firstAndLastCount;
    if (interiorTicks > zeroValue) {
      const step = lastIdx / (interiorTicks + singleElementOffset);
      for (let i = singleElementOffset; i <= interiorTicks; i++) {
        const idx = Math.round(step * i);
        const label = labels[idx];
        if (label !== undefined && label !== firstLabel && label !== lastLabel) {
          tickValues.push(label);
        }
      }
    }

    // Always include last label
    tickValues.push(lastLabel);

    return tickValues;
  };

  const tickValues = getTickValues();
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
          const defaultColor = "#000";
          const emptyStringLength = 0;
          const paletteColor = colorPalette[idx % colorPalette.length] ?? defaultColor;
          const color = dataset.borderColor.length > emptyStringLength ? dataset.borderColor : paletteColor;
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
          const gradientStops = dataset.gradientStops ?? [];
          const emptyGradientStopLength = 0;
          const percentMultiplier = 100;
          const percentPrecision = 2;
          const hasGradientStops = gradientStops.length > emptyGradientStopLength;
          const hasTwoColorGradient =
            typeof dataset.gradientFrom === "string" || typeof dataset.gradientTo === "string";
          const hasGradient = hasGradientStops || hasTwoColorGradient;
          const gradientOpacity = 0.6;
          const fillOpacityStart = 0.6;
          const fillOpacityEnd = 0.1;
          const solidOpacity = 0.2;
          const fullOpacity = 1;
          const strokeOpacity = 1;
          const useVerticalLines = dataset.verticalLines ?? options.verticalLines === true;
          const baselineY = yMax;

          // Determine fill color: backgroundColor > gradient > solid color
          const datasetBgColor = dataset.backgroundColor ?? "";
          const emptyLength = 0;
          const hasBackgroundColor = datasetBgColor.length > emptyLength;
          const getAreaFillColor = (): string => {
            if (hasBackgroundColor) {
              return datasetBgColor;
            }
            if (hasGradient) {
              return `url(#${fillGradientId})`;
            }
            return color;
          };
          const areaFillColor = getAreaFillColor();
          const areaFillOpacity = hasBackgroundColor || hasGradient ? fullOpacity : solidOpacity;

          return (
            <React.Fragment key={idx}>
              {hasGradient && !useVerticalLines && (
                <>
                  {hasGradientStops ? (
                    <defs>
                      {/* Gradient for fill area */}
                      <linearGradient
                        id={fillGradientId}
                        x1="0%"
                        x2={dataset.gradientDirection === "vertical" ? "0%" : "100%"}
                        y1="0%"
                        y2={dataset.gradientDirection === "vertical" ? "100%" : "0%"}
                      >
                        {gradientStops.map((stop, stopIdx) => (
                          <stop
                            key={stopIdx}
                            offset={`${(stop.offset * percentMultiplier).toFixed(percentPrecision)}%`}
                            stopColor={stop.color}
                            stopOpacity={gradientOpacity}
                          />
                        ))}
                      </linearGradient>
                      {/* Gradient for stroke (line) - always horizontal for temperature scale */}
                      <linearGradient id={strokeGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
                        {gradientStops.map((stop, stopIdx) => (
                          <stop
                            key={stopIdx}
                            offset={`${(stop.offset * percentMultiplier).toFixed(percentPrecision)}%`}
                            stopColor={stop.color}
                            stopOpacity={strokeOpacity}
                          />
                        ))}
                      </linearGradient>
                    </defs>
                  ) : (
                    <>
                      {/* Gradient for fill area */}
                      <LinearGradient
                        from={dataset.gradientFrom ?? color}
                        fromOpacity={gradientOpacity}
                        id={fillGradientId}
                        to={dataset.gradientTo ?? color}
                        toOpacity={dataset.gradientDirection === "horizontal" ? fillOpacityStart : fillOpacityEnd}
                        vertical={dataset.gradientDirection !== "horizontal"}
                      />
                      {/* Gradient for stroke (line) - always horizontal for temperature scale */}
                      <LinearGradient
                        from={dataset.gradientFrom ?? color}
                        fromOpacity={strokeOpacity}
                        id={strokeGradientId}
                        to={dataset.gradientTo ?? color}
                        toOpacity={strokeOpacity}
                        vertical={false}
                      />
                    </>
                  )}
                </>
              )}
              {useVerticalLines ? (
                // Render vertical lines (like very thin bars) instead of connected lines
                <>
                  {points.map((point, pointIdx) => (
                    <line
                      key={pointIdx}
                      stroke={color}
                      strokeWidth={dataset.borderWidth ?? defaultBorderWidth}
                      x1={point.x}
                      x2={point.x}
                      y1={baselineY}
                      y2={point.y}
                    />
                  ))}
                </>
              ) : (
                <>
                  {dataset.fill === true && (
                    <AreaClosed<{ x: number; y: number }>
                      curve={curveType}
                      data={points}
                      fill={areaFillColor}
                      fillOpacity={areaFillOpacity}
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
                </>
              )}
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
          labelOffset={xLabelDyPx}
          labelProps={{
            fill: "#374151",
            fontSize: 12,
            textAnchor: "middle"
          }}
          scale={xScale}
          tickLabelProps={() => ({
            angle: -45,
            dx: "-0.5em",
            dy: "0.25em",
            fill: "#374151",
            fontSize: 9,
            textAnchor: "end"
          })}
          tickValues={tickValues}
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
          numTicks={Math.min(Math.ceil(maxDataValue), maxYTicks)}
          scale={yScale}
          tickFormat={(value) => {
            const decimalPlaces = options.yDecimalPlaces ?? zeroValue;
            const formatted = Number(value).toFixed(decimalPlaces);
            const suffix = options.yTickSuffix ?? "";
            return `${formatted}${suffix}`;
          }}
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
