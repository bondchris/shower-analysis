import { Group } from "@visx/group";
import React from "react";

import { ProtractorChartConfig } from "../../../models/chart/protractorChartConfig";

interface ProtractorChartProps {
  config: ProtractorChartConfig;
}

export const ProtractorChart: React.FC<ProtractorChartProps> = ({ config }) => {
  const { histogram, options, height, leftOverflowCount, rightOverflowCount } = config;
  const defaultWidth = 650;
  const width = options.width ?? defaultWidth;
  const fullCircle = options.fullCircle ?? false;
  const defaultAngleOffsetDegrees = 0;
  const angleOffsetDegrees = options.angleOffsetDegrees ?? defaultAngleOffsetDegrees;

  const topMargin = 40;
  const rightMargin = 60;
  const bottomMargin = 40;
  const leftMargin = 60;

  const margin = { bottom: bottomMargin, left: leftMargin, right: rightMargin, top: topMargin };

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const halfDivisor = 2;
  const centerX = chartWidth / halfDivisor;
  const centerY = fullCircle ? chartHeight / halfDivisor : chartHeight;
  const fullCircleLineLengthRatio = 0.45;
  const semicircleLineLengthRatio = 0.9;
  const lineLengthRatio = fullCircle ? fullCircleLineLengthRatio : semicircleLineLengthRatio;
  const lineLength = (fullCircle ? Math.min(chartWidth, chartHeight) : chartHeight) * lineLengthRatio;

  const defaultLineColor = "#8b5cf6";
  const lineColor = options.lineColor ?? defaultLineColor;

  const binsPerDegree = 10;
  const binToAngle = (binIndex: number): number => binIndex / binsPerDegree;

  const tickAngle30 = 30;
  const tickAngle60 = 60;
  const tickAngle90 = 90;
  const tickAngle120 = 120;
  const tickAngle150 = 150;
  const tickAngle180 = 180;
  const tickAngle210 = 210;
  const tickAngle240 = 240;
  const tickAngle270 = 270;
  const tickAngle300 = 300;
  const tickAngle330 = 330;
  const semicircleTickAngles = [tickAngle30, tickAngle60, tickAngle90, tickAngle120, tickAngle150];
  const fullCircleTickAngles = [
    tickAngle30,
    tickAngle60,
    tickAngle90,
    tickAngle120,
    tickAngle150,
    tickAngle180,
    tickAngle210,
    tickAngle240,
    tickAngle270,
    tickAngle300,
    tickAngle330
  ];
  const tickAngles = fullCircle ? fullCircleTickAngles : semicircleTickAngles;
  const tickLength = 8;
  const tickLabelOffset = 20;

  const degreesInSemicircle = 180;
  const degreesToRadians = (degrees: number): number => {
    const radiansPerDegree = Math.PI / degreesInSemicircle;
    return degrees * radiansPerDegree;
  };

  const degreesToRadiansWithOffset = (degrees: number): number => {
    return degreesToRadians(degrees + angleOffsetDegrees);
  };

  const getLineEndpoint = (angle: number, length: number): { x: number; y: number } => {
    const radians = degreesToRadiansWithOffset(angle);
    const xOffset = length * Math.cos(radians);
    const yOffset = length * Math.sin(radians);
    return {
      x: centerX - xOffset,
      y: centerY - yOffset
    };
  };

  const noCount = 0;
  const overflowLabelOffset = 10;
  const arrowSpacingOffset = 2;
  const percentageTextWidth = 35;
  const fallbackMaxCount = 1;
  const maxCount = Math.max(...histogram, fallbackMaxCount);

  const histogramTotal = histogram.reduce((sum, count) => sum + count, noCount);
  const totalCount = histogramTotal + leftOverflowCount + rightOverflowCount;

  const computeAverageAngle = (): number | null => {
    if (histogramTotal === noCount) {
      return null;
    }
    if (fullCircle) {
      // For full circle, use circular mean to handle wraparound
      let sumSin = 0;
      let sumCos = 0;
      for (let i = 0; i < histogram.length; i++) {
        const count = histogram[i] ?? noCount;
        if (count === noCount) {
          continue;
        }
        const angle = binToAngle(i);
        const radians = degreesToRadians(angle);
        sumSin += count * Math.sin(radians);
        sumCos += count * Math.cos(radians);
      }
      const avgRadians = Math.atan2(sumSin, sumCos);
      const fullCircleDegrees = 360;
      let avgDegrees = avgRadians * (degreesInSemicircle / Math.PI);
      if (avgDegrees < noCount) {
        avgDegrees += fullCircleDegrees;
      }
      return avgDegrees;
    }
    let weightedSum = noCount;
    for (let i = 0; i < histogram.length; i++) {
      const count = histogram[i] ?? noCount;
      const angle = binToAngle(i);
      weightedSum += angle * count;
    }
    return weightedSum / histogramTotal;
  };
  const averageAngle = computeAverageAngle();
  const percentMultiplier = 100;
  const formatPercent = (count: number): string => {
    if (totalCount === noCount) {
      return "0%";
    }
    const percent = (count / totalCount) * percentMultiplier;
    const decimalPlaces = 1;
    return `${percent.toFixed(decimalPlaces)}%`;
  };
  const minOpacity = 0.05;
  const maxOpacity = 0.9;

  const getOpacityForCount = (count: number): number => {
    if (count === noCount) {
      return noCount;
    }
    const normalizedCount = count / maxCount;
    const opacityRange = maxOpacity - minOpacity;
    const scaledOpacity = normalizedCount * opacityRange;
    return minOpacity + scaledOpacity;
  };

  const getStrokeWidthForCount = (count: number): number => {
    if (count === noCount) {
      return noCount;
    }
    const minStrokeWidth = 0.5;
    const maxStrokeWidth = 3;
    const normalizedCount = count / maxCount;
    const strokeWidthRange = maxStrokeWidth - minStrokeWidth;
    const scaledStrokeWidth = normalizedCount * strokeWidthRange;
    return minStrokeWidth + scaledStrokeWidth;
  };

  return (
    <svg height={height} width={width}>
      <Group left={margin.left} top={margin.top}>
        {/* Draw angle lines based on histogram counts */}
        {histogram.map((count, binIndex) => {
          if (count === noCount) {
            return null;
          }
          const angle = binToAngle(binIndex);
          const endpoint = getLineEndpoint(angle, lineLength);
          const opacity = getOpacityForCount(count);
          const strokeWidth = getStrokeWidthForCount(count);
          return (
            <line
              key={binIndex}
              stroke={lineColor}
              strokeOpacity={opacity}
              strokeWidth={strokeWidth}
              x1={centerX}
              x2={endpoint.x}
              y1={centerY}
              y2={endpoint.y}
            />
          );
        })}

        {/* Base horizontal line (only for semicircle mode) */}
        {!fullCircle && <line stroke="#374151" strokeWidth={2} x1={0} x2={chartWidth} y1={centerY} y2={centerY} />}

        {/* Tick marks and labels */}
        {tickAngles.map((angle) => {
          const tickStart = getLineEndpoint(angle, lineLength);
          const tickEnd = getLineEndpoint(angle, lineLength + tickLength);
          const labelPos = getLineEndpoint(angle, lineLength + tickLabelOffset);

          return (
            <g key={angle}>
              <line stroke="#6b7280" strokeWidth={1} x1={tickStart.x} x2={tickEnd.x} y1={tickStart.y} y2={tickEnd.y} />
              <text
                dominantBaseline="middle"
                fill="#374151"
                fontSize={10}
                textAnchor="middle"
                x={labelPos.x}
                y={labelPos.y}
              >
                {`${angle.toString()}°`}
              </text>
            </g>
          );
        })}

        {/* 0° indicator line and label for full circle mode */}
        {fullCircle && (
          <g>
            {/* Red dotted line from center to 0° position */}
            {(() => {
              const zeroAngle = 0;
              const zeroLineEnd = getLineEndpoint(zeroAngle, lineLength);
              const zeroTickEnd = getLineEndpoint(zeroAngle, lineLength + tickLength);
              const zeroLabelPos = getLineEndpoint(zeroAngle, lineLength + tickLabelOffset);
              return (
                <>
                  <line
                    stroke="#ef4444"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                    x1={centerX}
                    x2={zeroLineEnd.x}
                    y1={centerY}
                    y2={zeroLineEnd.y}
                  />
                  {/* Tick mark at 0° */}
                  <line
                    stroke="#6b7280"
                    strokeWidth={1}
                    x1={zeroLineEnd.x}
                    x2={zeroTickEnd.x}
                    y1={zeroLineEnd.y}
                    y2={zeroTickEnd.y}
                  />
                  {/* "Starting Position" label on two lines */}
                  <text
                    dominantBaseline="middle"
                    fill="#374151"
                    fontSize={10}
                    textAnchor="middle"
                    x={zeroLabelPos.x}
                    y={zeroLabelPos.y}
                  >
                    <tspan x={zeroLabelPos.x} dy="-0.5em">
                      Starting
                    </tspan>
                    <tspan x={zeroLabelPos.x} dy="1em">
                      Position
                    </tspan>
                  </text>
                </>
              );
            })()}
          </g>
        )}

        {/* Arc outline for the protractor */}
        {fullCircle ? (
          <circle
            cx={centerX}
            cy={centerY}
            fill="none"
            r={lineLength}
            stroke="#d1d5db"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ) : (
          <path
            d={`M ${String(centerX - lineLength)} ${String(centerY)} A ${String(lineLength)} ${String(lineLength)} 0 0 1 ${String(centerX + lineLength)} ${String(centerY)}`}
            fill="none"
            stroke="#d1d5db"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        )}

        {/* Center indicator (only for semicircle mode) */}
        {!fullCircle && <circle cx={centerX} cy={centerY} fill="#374151" r={4} />}

        {/* Average angle indicator line */}
        {options.showAverage !== false &&
          averageAngle !== null &&
          (() => {
            const avgEndpoint = getLineEndpoint(averageAngle, lineLength);
            const labelOffset = 15;
            const labelPos = getLineEndpoint(averageAngle, lineLength + labelOffset);
            const decimalPlaces = 1;
            return (
              <g>
                <line
                  stroke="#ef4444"
                  strokeWidth={2}
                  x1={centerX}
                  x2={avgEndpoint.x}
                  y1={centerY}
                  y2={avgEndpoint.y}
                />
                <text
                  dominantBaseline="middle"
                  fill="#ef4444"
                  fontSize={9}
                  fontWeight="bold"
                  textAnchor="middle"
                  x={labelPos.x}
                  y={labelPos.y}
                >
                  {`avg: ${averageAngle.toFixed(decimalPlaces)}°`}
                </text>
              </g>
            );
          })()}

        {/* Overflow count labels as percentages with directional arrows (only for semicircle mode) */}
        {!fullCircle && leftOverflowCount > noCount && (
          <g>
            <text
              dominantBaseline="middle"
              fill="#6b7280"
              fontSize={9}
              textAnchor="end"
              x={-overflowLabelOffset}
              y={centerY}
            >
              {`+${formatPercent(leftOverflowCount)}`}
            </text>
            <g
              transform={`translate(${String(-overflowLabelOffset - percentageTextWidth - arrowSpacingOffset)}, ${String(centerY)}) scale(-1, 1)`}
            >
              <text
                dominantBaseline="middle"
                fill="#6b7280"
                fontSize={9}
                fontWeight="bold"
                textAnchor="end"
                x={0}
                y={0}
              >
                ⤵
              </text>
            </g>
          </g>
        )}
        {!fullCircle && rightOverflowCount > noCount && (
          <g>
            <text
              dominantBaseline="middle"
              fill="#6b7280"
              fontSize={9}
              textAnchor="start"
              x={chartWidth + overflowLabelOffset}
              y={centerY}
            >
              {`+${formatPercent(rightOverflowCount)} `}
            </text>
            <text
              dominantBaseline="middle"
              fill="#6b7280"
              fontSize={9}
              fontWeight="bold"
              textAnchor="start"
              x={chartWidth + overflowLabelOffset + percentageTextWidth + arrowSpacingOffset}
              y={centerY}
            >
              ⤵
            </text>
          </g>
        )}
      </Group>
    </svg>
  );
};
