import React from "react";
import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { PieChartConfig } from "../../models/chart/pieChartConfig";
import { ReportSection } from "../../models/report";
import { BarChart } from "./charts/BarChart";
import { Histogram } from "./charts/Histogram";
import { LineChart } from "./charts/LineChart";
import { MixedChart } from "./charts/MixedChart";
import { PieChart } from "./charts/PieChart";
import { ScatterChart } from "./charts/ScatterChart";
import { ShapeOverlayChart } from "./charts/ShapeOverlayChart";
import { Table } from "./Table";

interface SectionProps {
  section: ReportSection;
}

export const Section: React.FC<SectionProps> = ({ section }) => {
  const DEFAULT_LEVEL = 2;
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 6;
  const MIN_TITLE_LEN = 0;
  const EMPTY_LIST_LENGTH = 0;
  const chartConfig = section.type === "chart" ? (section.data as ChartConfiguration | undefined) : undefined;
  const chartOptions = chartConfig?.options as { width?: number; sideNotes?: string[] } | undefined;
  const chartWidth = chartOptions?.width;
  const sideNotes = chartOptions?.sideNotes ?? [];
  const hasSideNotes = sideNotes.length > EMPTY_LIST_LENGTH;

  const validLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, section.level ?? DEFAULT_LEVEL));
  const HeaderTag = `h${String(validLevel)}` as React.ElementType;
  const showTitle = section.title !== undefined && section.title.length > MIN_TITLE_LEN;

  const wrapperClass = ["chart", "summary", "chart-row"].includes(section.type) ? "break-inside-avoid" : "";
  const wrapperStyle =
    section.type === "chart" && !hasSideNotes && chartWidth !== undefined
      ? { width: `${String(chartWidth)}px` }
      : undefined;

  const headerClasses: Record<number, string> = {
    1: "text-2xl font-bold text-center mb-2 text-gray-900", // Mostly handled by ReportShell but good fallback
    2: "text-xl font-bold mt-6 mb-3 border-b-2 border-gray-300 pb-2 text-gray-800 break-after-avoid",
    3: "text-base font-semibold mt-4 mb-2 text-gray-700 break-after-avoid",
    4: "text-[13px] font-semibold mt-2 mb-1 text-gray-600 break-after-avoid",
    5: "text-sm font-semibold mb-2 text-gray-700 text-center",
    6: "text-xs font-semibold mb-1 text-gray-500"
  };

  const chartTitleClass = "text-sm font-semibold text-center mb-0 mt-4 text-gray-700";
  const headerStyle =
    section.type === "chart" && chartWidth !== undefined ? { width: `${String(chartWidth)}px` } : undefined;

  const getTitleClassName = () => {
    if (section.type === "header") {
      return headerClasses[validLevel];
    }
    if (section.type === "chart") {
      return chartTitleClass;
    }
    return headerClasses[validLevel];
  };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {showTitle && (
        <HeaderTag className={getTitleClassName()} style={headerStyle}>
          {section.title}
        </HeaderTag>
      )}
      <SectionContent section={section} />
    </div>
  );
};

const SectionContent: React.FC<SectionProps> = ({ section }) => {
  const textOptions = (section.options as { className?: string } | undefined) ?? {};

  switch (section.type) {
    case "text":
      return <p className={textOptions.className}>{(section.data as string | undefined) ?? ""}</p>;

    case "summary":
      return <p className={textOptions.className}>{(section.data as string | undefined) ?? ""}</p>;

    case "table":
      return (
        <Table
          data={section.data as string[][]}
          options={section.options as { headers?: string[]; rowClasses?: Record<number, string> }}
        />
      );

    case "list":
      if (!Array.isArray(section.data)) {
        return null;
      }
      return (
        <div>
          {(section.data as string[]).map((item, i) => (
            <div
              key={i}
              className="mb-1 pl-4 relative text-xs before:content-['•'] before:absolute before:left-0 before:text-gray-400"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          ))}
        </div>
      );

    case "chart": {
      const chartConfig = section.data as ChartConfiguration;
      const shouldCenter =
        chartConfig.type === "scatter" || chartConfig.type === "pie" || chartConfig.type === "shape-overlay";
      const justifyClass = shouldCenter ? "justify-center" : "justify-start";
      const chartOptions = chartConfig.options as { sideNotes?: string[]; width?: number } | undefined;
      const sideNotes = chartOptions?.sideNotes ?? [];
      const EMPTY_SIDE_NOTES_LENGTH = 0;
      const hasSideNotes = sideNotes.length > EMPTY_SIDE_NOTES_LENGTH;
      const chartWidthStyle =
        chartOptions?.width !== undefined ? { width: `${String(chartOptions.width)}px` } : undefined;

      const renderChart = () => (
        <>
          {chartConfig.type === "line" && <LineChart config={chartConfig} />}
          {chartConfig.type === "histogram" && <Histogram config={chartConfig} />}
          {chartConfig.type === "bar" && <BarChart config={chartConfig} />}
          {chartConfig.type === "mixed" && <MixedChart config={chartConfig} />}
          {chartConfig.type === "pie" && <PieChart config={chartConfig} />}
          {chartConfig.type === "scatter" && <ScatterChart config={chartConfig} />}
          {chartConfig.type === "shape-overlay" && <ShapeOverlayChart config={chartConfig} />}
        </>
      );

      if (hasSideNotes) {
        return (
          <div className="mb-4 mt-0 flex w-full items-center justify-start gap-4 break-inside-avoid">
            <div className="flex-shrink-0 [&>svg]:block" style={chartWidthStyle}>
              {renderChart()}
            </div>
            <div className="flex-1 text-center text-[9px] text-gray-700 leading-snug space-y-1">
              {sideNotes.map((note, index) => (
                <div key={index}>{note}</div>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div
          className={`mb-4 mt-0 flex w-full ${justifyClass} break-inside-avoid [&>svg]:block`}
          style={chartWidthStyle}
        >
          {renderChart()}
        </div>
      );
    }

    case "chart-row": {
      if (!Array.isArray(section.data)) {
        return null;
      }
      const charts = section.data as { title?: string; data: ChartConfiguration }[];
      const chartCount = charts.length;
      const SINGLE_CHART_COUNT = 1;
      const TWO_CHART_COUNT = 2;
      const defaultWidth = 0;
      const minChartsForGap = 2;
      const gapCountOffset = 1;
      const defaultGapCount = 0;
      const getChartWidth = (chart: { data: ChartConfiguration }): number => {
        const options = chart.data.options as { width?: number } | undefined;
        return options?.width ?? defaultWidth;
      };

      // Account for gap between charts (gap-1 = 0.25rem = 4px)
      // Using gap-1 instead of gap-5 to reduce space between charts
      const gapPixels = 4;
      const numGaps = charts.length >= minChartsForGap ? charts.length - gapCountOffset : defaultGapCount;
      const totalGap = gapPixels * numGaps;

      const estimatePieChartMinWidth = (pieConfig: PieChartConfig): number => {
        const fallbackBaseWidth = 300;
        const baseWidth = pieConfig.options.width ?? fallbackBaseWidth;
        const chartHeight = pieConfig.height;
        const divisorForDimensions = 2;
        const margin = 20;
        const minDimension = Math.min(baseWidth, chartHeight);
        const halfDimension = minDimension / divisorForDimensions;
        const outerRadius = halfDimension - margin;

        const labelOffset = 15;
        const estimatedLabelTextWidth = 40;
        const labelCharWidthEstimate = 6;
        const maxLabelDistance = outerRadius + labelOffset;
        const halfLabelWidth = estimatedLabelTextWidth / divisorForDimensions;
        const maxLabelExtension = maxLabelDistance + halfLabelWidth;
        const paddingMultiplier = 2;
        const minWidthForPieLabels = maxLabelExtension * paddingMultiplier;

        const legendBoxSize = 12;
        const legendLabelGap = 4;
        const legendWidthBuffer = 10;
        let maxLegendItemWidth = 0;
        for (const label of pieConfig.labels) {
          const textWidth = label.length * labelCharWidthEstimate;
          const itemWidth = legendBoxSize + legendLabelGap + textWidth;
          if (itemWidth > maxLegendItemWidth) {
            maxLegendItemWidth = itemWidth;
          }
        }
        const minWidthForLegend = maxLegendItemWidth + legendWidthBuffer;

        return Math.max(baseWidth, minWidthForPieLabels, minWidthForLegend);
      };

      const isPieChartConfig = (config: ChartConfiguration): config is PieChartConfig => config.type === "pie";

      const getEffectiveWidth = (chart: { data: ChartConfiguration }): number => {
        if (isPieChartConfig(chart.data)) {
          return estimatePieChartMinWidth(chart.data);
        }
        return getChartWidth(chart);
      };

      const chartWidths = charts.map((chart) => getEffectiveWidth(chart));
      const totalWidth = chartWidths.reduce((sum: number, chartWidth: number) => sum + chartWidth, defaultWidth);
      const hasCustomWidths = totalWidth > defaultWidth;

      // Calculate scale factor to make widths fit within available space minus gaps
      // This ensures combined chart widths + gaps don't exceed container
      const defaultScaleFactor = 1;
      const scaleFactor =
        hasCustomWidths && totalWidth > defaultWidth ? (totalWidth - totalGap) / totalWidth : defaultScaleFactor;

      // Precompute adjusted widths so layout logic is consistent between padding and item sizing
      const adjustedWidths = chartWidths.map((chartWidth: number) => {
        if (!hasCustomWidths || chartWidth === defaultWidth) {
          return chartWidth;
        }
        return Math.floor(chartWidth * scaleFactor);
      });

      // Default layout for rows
      let rowJustifyClass = "justify-between";
      let rowGapClass = "gap-1";
      let rowStyle: React.CSSProperties | undefined = undefined;
      const evenSplitWidth = chartCount > defaultWidth ? totalWidth / chartCount : defaultWidth;
      const evenSplitBuffer = 4;
      const widthsFitEvenSplit =
        hasCustomWidths && chartWidths.length === chartCount
          ? chartWidths.every((width) => width <= evenSplitWidth + evenSplitBuffer)
          : false;
      const useTwoColumnGrid = hasCustomWidths && chartCount === TWO_CHART_COUNT && widthsFitEvenSplit;

      // Center rows with a single chart
      if (hasCustomWidths && chartCount === SINGLE_CHART_COUNT) {
        rowJustifyClass = "justify-start";
        rowGapClass = "gap-0";
      }

      // For balanced widths, keep a grid layout; otherwise fall back to flex to avoid overflow
      if (useTwoColumnGrid) {
        rowJustifyClass = "justify-center";
        rowGapClass = "gap-0";
        rowStyle = {
          columnGap: `${String(gapPixels)}px`,
          gridTemplateColumns: adjustedWidths.map((width) => `${String(width)}px`).join(" "),
          justifyContent: "center"
        };
      }

      const rowClass = useTwoColumnGrid ? "grid items-start" : `flex ${rowJustifyClass} ${rowGapClass} items-start`;

      return (
        <div className={`mb-2 ${rowClass} break-inside-avoid [&_svg]:block`} style={rowStyle}>
          {charts.map((chart, i) => {
            const chartWidth = chartWidths[i] ?? getChartWidth(chart);
            // Scale down the width to account for gaps
            const adjustedWidth = adjustedWidths[i] ?? chartWidth;
            const chartOptions = (chart.data as { options?: unknown }).options;
            const normalizedOptions = (chartOptions ?? {}) as Record<string, unknown>;
            const sideNotes = (normalizedOptions as { sideNotes?: string[] }).sideNotes ?? [];
            const EMPTY_SIDE_NOTES_LENGTH = 0;
            const hasSideNotes = sideNotes.length > EMPTY_SIDE_NOTES_LENGTH;
            const flexStyle =
              !hasSideNotes && !useTwoColumnGrid && hasCustomWidths && adjustedWidth > defaultWidth
                ? { flex: `0 0 ${String(adjustedWidth)}px` }
                : undefined;
            const widthOption = (normalizedOptions as { width?: number }).width;
            const chartWidthStyle =
              widthOption !== undefined && adjustedWidth > defaultWidth
                ? { width: `${String(adjustedWidth)}px` }
                : undefined;
            const chartConfig =
              widthOption !== undefined && adjustedWidth !== widthOption
                ? ({ ...chart.data, options: { ...normalizedOptions, width: adjustedWidth } } as ChartConfiguration)
                : chart.data;
            const titleStyle =
              hasSideNotes && chartWidthStyle !== undefined
                ? { ...chartWidthStyle, marginLeft: "auto", marginRight: "auto" }
                : undefined;
            const containerClass =
              useTwoColumnGrid || !hasCustomWidths
                ? "text-center min-w-0 overflow-visible"
                : "flex-1 text-center min-w-0 overflow-visible";
            // Offset to align shape overlay content with the scatter plot's y-axis start
            const SCATTER_CHART_TOP_MARGIN = 75;
            const SHAPE_OVERLAY_PADDING = 16;
            const SHAPE_ALIGNMENT_TWEAK = 15;
            const shapeContentTopOffset = SCATTER_CHART_TOP_MARGIN - SHAPE_OVERLAY_PADDING - SHAPE_ALIGNMENT_TWEAK;
            const shouldOffsetShapeChart = chart.data.type === "shape-overlay";
            const shapeOffsetStyle = shouldOffsetShapeChart
              ? { marginTop: `${String(shapeContentTopOffset)}px` }
              : undefined;
            const chartContentStyle =
              shapeOffsetStyle !== undefined || chartWidthStyle !== undefined
                ? { ...(chartWidthStyle ?? {}), ...(shapeOffsetStyle ?? {}) }
                : undefined;
            const containerStyle = flexStyle;
            return (
              <div key={i} className={containerClass} style={containerStyle}>
                {chart.title !== undefined && !hasSideNotes && (
                  <h5 className="mb-2 mt-4 text-center text-sm font-semibold text-gray-700" style={titleStyle}>
                    {chart.title}
                  </h5>
                )}
                {hasSideNotes ? (
                  <div className="flex w-full items-center justify-start gap-4 overflow-visible">
                    <div className="flex-shrink-0" style={chartWidthStyle}>
                      {chart.title !== undefined && (
                        <h5 className="mb-2 mt-4 text-center text-sm font-semibold text-gray-700">{chart.title}</h5>
                      )}
                      <div className="[&>svg]:block" style={chartContentStyle}>
                        {chartConfig.type === "line" && <LineChart config={chartConfig} />}
                        {chartConfig.type === "histogram" && <Histogram config={chartConfig} />}
                        {chartConfig.type === "bar" && <BarChart config={chartConfig} />}
                        {chartConfig.type === "mixed" && <MixedChart config={chartConfig} />}
                        {chartConfig.type === "pie" && <PieChart config={chartConfig} />}
                        {chartConfig.type === "scatter" && <ScatterChart config={chartConfig} />}
                        {chartConfig.type === "shape-overlay" && <ShapeOverlayChart config={chartConfig} />}
                      </div>
                    </div>
                    <div className="flex-1 text-center text-[9px] text-gray-700 leading-snug space-y-1">
                      {sideNotes.map((note, noteIndex) => (
                        <div key={noteIndex}>{note}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full justify-center overflow-visible">
                    <div className="[&>svg]:block" style={chartContentStyle}>
                      {chartConfig.type === "line" && <LineChart config={chartConfig} />}
                      {chartConfig.type === "histogram" && <Histogram config={chartConfig} />}
                      {chartConfig.type === "bar" && <BarChart config={chartConfig} />}
                      {chartConfig.type === "mixed" && <MixedChart config={chartConfig} />}
                      {chartConfig.type === "pie" && <PieChart config={chartConfig} />}
                      {chartConfig.type === "scatter" && <ScatterChart config={chartConfig} />}
                      {chartConfig.type === "shape-overlay" && <ShapeOverlayChart config={chartConfig} />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "header":
      return null;

    case "page-break":
      return <div style={{ breakBefore: "page" }} />;

    case "react-component": {
      const Component = section.component;
      if (!Component) {
        return null;
      }
      return (
        <div className="mb-2 flex w-full justify-start break-inside-avoid">
          <Component />
        </div>
      );
    }

    default:
      if (section.data !== undefined) {
        return <p>{(section.data as string | undefined) ?? ""}</p>;
      }
      return null;
  }
};
