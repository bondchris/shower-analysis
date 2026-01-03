import { AxisBottom, AxisLeft, AxisRight, AxisTop } from "@visx/axis";
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

  const zoomBox = options.zoomBox;
  const hasZoom = zoomBox !== undefined;

  const zeroValue = 0;
  const zoomGap = 50;
  const zoomScale = 0.8;
  const zoomXMax = xMax * zoomScale;
  const zoomYMax = yMax * zoomScale;
  const zoomBottomPadding = 50;
  const totalHeight = hasZoom ? height - margin.bottom + zoomGap + zoomYMax + zoomBottomPadding : height;
  const defaultMaxValue = 10;
  const paddingMultiplier = 0.1;
  const defaultPadding = 1;
  const decimalPrecision = 10;

  const allPoints = datasets.flatMap((ds) => ds.data);
  const allXValues = allPoints.map((p) => p.x).filter((v) => Number.isFinite(v));
  const allYValues = allPoints.map((p) => p.y).filter((v) => Number.isFinite(v));

  const useIndependentAxes = options.independentAxes === true;

  const computeDomains = (): { xDomainMin: number; xDomainMax: number; yDomainMin: number; yDomainMax: number } => {
    if (useIndependentAxes) {
      const hasXData = allXValues.length > zeroValue;
      const hasYData = allYValues.length > zeroValue;

      const xMinVal = hasXData ? Math.min(...allXValues) : zeroValue;
      const xMaxVal = hasXData ? Math.max(...allXValues) : defaultMaxValue;
      const yMinVal = hasYData ? Math.min(...allYValues) : zeroValue;
      const yMaxVal = hasYData ? Math.max(...allYValues) : defaultMaxValue;

      const xPadding = hasXData ? (xMaxVal - xMinVal) * paddingMultiplier : defaultPadding;
      const yPadding = hasYData ? (yMaxVal - yMinVal) * paddingMultiplier : defaultPadding;

      return {
        xDomainMax: xMaxVal + xPadding,
        xDomainMin: Math.max(zeroValue, xMinVal - xPadding),
        yDomainMax: yMaxVal + yPadding,
        yDomainMin: Math.max(zeroValue, yMinVal - yPadding)
      };
    }

    const allValues = [...allXValues, ...allYValues];
    const hasData = allValues.length > zeroValue;
    const minValue = hasData ? Math.min(...allValues) : zeroValue;
    const maxValue = hasData ? Math.max(...allValues) : defaultMaxValue;

    const padding = hasData ? (maxValue - minValue) * paddingMultiplier : defaultPadding;
    const domainMin = Math.max(zeroValue, minValue - padding);
    const domainMax = maxValue + padding;

    return {
      xDomainMax: domainMax,
      xDomainMin: domainMin,
      yDomainMax: domainMax,
      yDomainMin: domainMin
    };
  };

  const { xDomainMax, xDomainMin, yDomainMax, yDomainMin } = computeDomains();

  const xScale = scaleLinear<number>({
    domain: [xDomainMin, xDomainMax],
    nice: true,
    range: [zeroValue, xMax]
  });

  const yScale = scaleLinear<number>({
    domain: [yDomainMin, yDomainMax],
    nice: true,
    range: [yMax, zeroValue]
  });

  const zoomXScale = hasZoom
    ? scaleLinear<number>({
        domain: [zoomBox.xMin, zoomBox.xMax],
        nice: true,
        range: [zeroValue, zoomXMax]
      })
    : null;

  const zoomYScale = hasZoom
    ? scaleLinear<number>({
        domain: [zoomBox.yMin, zoomBox.yMax],
        nice: true,
        range: [zoomYMax, zeroValue]
      })
    : null;

  const zoomTopOffset = height - margin.bottom + zoomGap;
  const halfDivisor = 2;
  const zoomCenteringOffset = (xMax - zoomXMax) / halfDivisor;
  const zoomLeftOffset = margin.left + zoomCenteringOffset;

  const defaultPointColor = "#3b82f6";
  const defaultPointRadius = 1;

  const renderPoints = (
    xScaleFn: (val: number) => number,
    yScaleFn: (val: number) => number,
    clipId?: string
  ): React.ReactNode => {
    return datasets.map((dataset, datasetIdx) => {
      const pointColor = dataset.pointColor ?? defaultPointColor;
      const pointRadius = dataset.pointRadius ?? defaultPointRadius;

      return (
        <g key={datasetIdx} clipPath={clipId !== undefined ? `url(#${clipId})` : undefined}>
          {dataset.data.map((point, pointIdx) => {
            const x = xScaleFn(point.x);
            const y = yScaleFn(point.y);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
              return null;
            }

            const fullOpacity = 1;
            const opacity = point.opacity ?? fullOpacity;
            return <circle key={pointIdx} cx={x} cy={y} fill={pointColor} fillOpacity={opacity} r={pointRadius} />;
          })}
        </g>
      );
    });
  };

  return (
    <svg height={totalHeight} width={width}>
      {/* Clip path for zoomed area */}
      {hasZoom && (
        <defs>
          <clipPath id="zoom-clip">
            <rect height={zoomYMax} width={zoomXMax} x={0} y={0} />
          </clipPath>
        </defs>
      )}

      {/* Main chart */}
      <Group left={margin.left} top={margin.top}>
        <GridRows height={yMax} scale={yScale} stroke="#e5e7eb" width={xMax} />

        {/* Diagonal line (y=x) for reference - only shown when axes use same scale */}
        {!useIndependentAxes && (
          <line
            stroke="#d1d5db"
            strokeDasharray="4 4"
            strokeWidth={1}
            x1={zeroValue}
            x2={xMax}
            y1={yMax}
            y2={zeroValue}
          />
        )}

        {/* Zoom box rectangle - drawn before points so it appears behind them */}
        {hasZoom && (
          <rect
            fill="none"
            height={yScale(zoomBox.yMin) - yScale(zoomBox.yMax)}
            stroke="#000000"
            strokeWidth={1}
            width={xScale(zoomBox.xMax) - xScale(zoomBox.xMin)}
            x={xScale(zoomBox.xMin)}
            y={yScale(zoomBox.yMax)}
          />
        )}

        {renderPoints(xScale, yScale)}

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

      {/* Shaded area connecting zoom box to zoomed chart */}
      {hasZoom &&
        (() => {
          const mainChartBottom = margin.top + yMax;
          const zoomedChartTop = zoomTopOffset;

          const topLeftLineX1 = margin.left + xScale(zoomBox.xMin);
          const topLeftLineY1 = margin.top + yScale(zoomBox.yMax);
          const topLeftLineX2 = zoomLeftOffset;
          const topLeftLineY2 = zoomTopOffset;
          const topLeftT = (mainChartBottom - topLeftLineY1) / (topLeftLineY2 - topLeftLineY1);
          const topLeftXDelta = topLeftT * (topLeftLineX2 - topLeftLineX1);
          const point1X = topLeftLineX1 + topLeftXDelta;
          const point1Y = mainChartBottom;

          const point2X = margin.left + xScale(zoomBox.xMax);
          const point2Y = margin.top + yScale(zoomBox.yMin);

          const bottomRightLineX1 = margin.left + xScale(zoomBox.xMax);
          const bottomRightLineY1 = margin.top + yScale(zoomBox.yMin);
          const bottomRightLineX2 = zoomLeftOffset + zoomXMax;
          const bottomRightLineY2 = zoomTopOffset + zoomYMax;
          const bottomRightT = (zoomedChartTop - bottomRightLineY1) / (bottomRightLineY2 - bottomRightLineY1);
          const bottomRightXDelta = bottomRightT * (bottomRightLineX2 - bottomRightLineX1);
          const point3X = bottomRightLineX1 + bottomRightXDelta;
          const point3Y = zoomedChartTop;

          const point4X = zoomLeftOffset;
          const point4Y = zoomTopOffset;

          return (
            <polygon
              fill="#f3f4f6"
              points={[
                `${String(point1X)},${String(point1Y)}`,
                `${String(point2X)},${String(point2Y)}`,
                `${String(point3X)},${String(point3Y)}`,
                `${String(point4X)},${String(point4Y)}`
              ].join(" ")}
              stroke="none"
            />
          );
        })()}

      {/* Connector lines between main chart and zoomed area */}
      {hasZoom && (
        <Group left={0} top={0}>
          {/* Top-left connector line - from top-left of zoom box to top-left of zoomed chart */}
          <line
            stroke="#9ca3af"
            strokeWidth={1}
            x1={margin.left + xScale(zoomBox.xMin)}
            x2={zoomLeftOffset}
            y1={margin.top + yScale(zoomBox.yMax)}
            y2={zoomTopOffset}
          />
          {/* Top-right connector line - from top-right of zoom box to top-right of zoomed chart */}
          <line
            stroke="#9ca3af"
            strokeWidth={1}
            x1={margin.left + xScale(zoomBox.xMax)}
            x2={zoomLeftOffset + zoomXMax}
            y1={margin.top + yScale(zoomBox.yMax)}
            y2={zoomTopOffset}
          />
          {/* Bottom-left connector line - from bottom-left of zoom box to bottom-left of zoomed chart */}
          <line
            stroke="#9ca3af"
            strokeWidth={1}
            x1={margin.left + xScale(zoomBox.xMin)}
            x2={zoomLeftOffset}
            y1={margin.top + yScale(zoomBox.yMin)}
            y2={zoomTopOffset + zoomYMax}
          />
          {/* Bottom-right connector line - from bottom-right of zoom box to bottom-right of zoomed chart */}
          <line
            stroke="#9ca3af"
            strokeWidth={1}
            x1={margin.left + xScale(zoomBox.xMax)}
            x2={zoomLeftOffset + zoomXMax}
            y1={margin.top + yScale(zoomBox.yMin)}
            y2={zoomTopOffset + zoomYMax}
          />
        </Group>
      )}

      {/* Zoomed detail area */}
      {hasZoom && zoomXScale !== null && zoomYScale !== null && (
        <Group left={zoomLeftOffset} top={zoomTopOffset}>
          {/* White background to hide connector lines behind the chart */}
          <rect fill="white" height={zoomYMax} stroke="none" width={zoomXMax} x={0} y={0} />
          {/* Border around zoomed area */}
          <rect fill="none" height={zoomYMax} stroke="#000000" strokeWidth={1} width={zoomXMax} x={0} y={0} />

          <GridRows height={zoomYMax} scale={zoomYScale} stroke="#e5e7eb" width={zoomXMax} />

          {renderPoints(zoomXScale, zoomYScale, "zoom-clip")}

          {/* X-axis at the bottom of zoomed area */}
          <AxisBottom
            label={options.xLabel ?? ""}
            labelProps={{
              dy: 30,
              fill: "#374151",
              fontSize: 12,
              textAnchor: "middle"
            }}
            scale={zoomXScale}
            tickFormat={(value) => String(Math.round(Number(value) * decimalPrecision) / decimalPrecision)}
            tickLabelProps={() => ({
              dy: "0.25em",
              fill: "#374151",
              fontSize: 9,
              textAnchor: "middle"
            })}
            top={zoomYMax}
          />

          {/* Y-axis on the right of zoomed area */}
          <AxisRight
            left={zoomXMax}
            scale={zoomYScale}
            tickFormat={(value) => String(Math.round(Number(value) * decimalPrecision) / decimalPrecision)}
            tickLabelProps={() => ({
              dx: "0.25em",
              dy: "0.25em",
              fill: "#374151",
              fontSize: 10,
              textAnchor: "start"
            })}
          />

          {/* Top axis line for zoomed area */}
          <line stroke="#000000" strokeWidth={1} x1={0} x2={zoomXMax} y1={0} y2={0} />
        </Group>
      )}
    </svg>
  );
};
