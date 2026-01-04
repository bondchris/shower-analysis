import React from "react";
import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { PieChartConfig } from "../../models/chart/pieChartConfig";
import { ReportSection } from "../../models/report";
import { BarChart, Histogram, LineChart, MixedChart, PieChart, ScatterChart } from "./charts";
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
      const shouldCenter = chartConfig.type === "scatter" || chartConfig.type === "pie";
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
      const totalWidth = charts.reduce((sum: number, chart) => sum + getChartWidth(chart), defaultWidth);
      const hasCustomWidths = totalWidth > defaultWidth;

      // Account for gap between charts (gap-1 = 0.25rem = 4px)
      // Using gap-1 instead of gap-5 to reduce space between charts
      const gapPixels = 4;
      const numGaps = charts.length >= minChartsForGap ? charts.length - gapCountOffset : defaultGapCount;
      const totalGap = gapPixels * numGaps;

      // Calculate scale factor to make widths fit within available space minus gaps
      // This ensures combined chart widths + gaps don't exceed container
      const defaultScaleFactor = 1;
      const scaleFactor =
        hasCustomWidths && totalWidth > defaultWidth ? (totalWidth - totalGap) / totalWidth : defaultScaleFactor;

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

      // Precompute adjusted widths so layout logic is consistent between padding and item sizing
      const adjustedWidths = charts.map((chart) => {
        const chartWidth = getEffectiveWidth(chart);
        if (!hasCustomWidths || chartWidth === defaultWidth) {
          return chartWidth;
        }
        return Math.floor(chartWidth * scaleFactor);
      });

      // Default layout for rows
      let rowJustifyClass = "justify-between";
      let rowGapClass = "gap-1";
      const rowStyle: React.CSSProperties | undefined = undefined;
      const useTwoColumnGrid = hasCustomWidths && chartCount === TWO_CHART_COUNT;

      // Center rows with a single chart
      if (hasCustomWidths && chartCount === SINGLE_CHART_COUNT) {
        rowJustifyClass = "justify-start";
        rowGapClass = "gap-0";
      }

      // For two fixed-width charts, place centers at 1/3 and 2/3 of the row width
      if (useTwoColumnGrid) {
        rowJustifyClass = "justify-center";
        rowGapClass = "gap-0";
      }

      const rowClass = useTwoColumnGrid ? "grid grid-cols-2" : `flex ${rowJustifyClass} ${rowGapClass}`;

      return (
        <div className={`mb-2 ${rowClass} break-inside-avoid [&_svg]:block`} style={rowStyle}>
          {charts.map((chart, i) => {
            const chartWidth = getChartWidth(chart);
            // Scale down the width to account for gaps
            const adjustedWidth = adjustedWidths[i] ?? chartWidth;
            const chartOptions = chart.data.options as { sideNotes?: string[]; width?: number } | undefined;
            const sideNotes = chartOptions?.sideNotes ?? [];
            const EMPTY_SIDE_NOTES_LENGTH = 0;
            const hasSideNotes = sideNotes.length > EMPTY_SIDE_NOTES_LENGTH;
            const flexStyle =
              !hasSideNotes && !useTwoColumnGrid && hasCustomWidths && adjustedWidth > defaultWidth
                ? { flex: `0 0 ${String(adjustedWidth)}px` }
                : undefined;
            const chartWidthStyle =
              chartOptions?.width !== undefined ? { width: `${String(chartOptions.width)}px` } : undefined;
            const titleStyle =
              hasSideNotes && chartWidthStyle !== undefined
                ? { ...chartWidthStyle, marginLeft: "auto", marginRight: "auto" }
                : undefined;
            const containerClass =
              useTwoColumnGrid || !hasCustomWidths
                ? "text-center min-w-0 overflow-visible"
                : "flex-1 text-center min-w-0 overflow-visible";
            return (
              <div key={i} className={containerClass} style={flexStyle}>
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
                      <div className="[&>svg]:block">
                        {chart.data.type === "line" && <LineChart config={chart.data} />}
                        {chart.data.type === "histogram" && <Histogram config={chart.data} />}
                        {chart.data.type === "bar" && <BarChart config={chart.data} />}
                        {chart.data.type === "mixed" && <MixedChart config={chart.data} />}
                        {chart.data.type === "pie" && <PieChart config={chart.data} />}
                        {chart.data.type === "scatter" && <ScatterChart config={chart.data} />}
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
                    <div className="[&>svg]:block" style={chartWidthStyle}>
                      {chart.data.type === "line" && <LineChart config={chart.data} />}
                      {chart.data.type === "histogram" && <Histogram config={chart.data} />}
                      {chart.data.type === "bar" && <BarChart config={chart.data} />}
                      {chart.data.type === "mixed" && <MixedChart config={chart.data} />}
                      {chart.data.type === "pie" && <PieChart config={chart.data} />}
                      {chart.data.type === "scatter" && <ScatterChart config={chart.data} />}
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
