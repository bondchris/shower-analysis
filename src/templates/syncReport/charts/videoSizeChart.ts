import React from "react";
import convert from "convert-units";
import { SyncStats } from "../../../models/syncStats";
import { ReportSection } from "../../../models/report";
import { MixedChart } from "../../components/charts/MixedChart";
import { MixedChartConfig } from "../../../models/chart/mixedChartConfig";
import { MixedChartDataset } from "../../../models/chart/mixedChartDataset";
import { getMixedChartConfig } from "../../../utils/chart/configBuilders";
import { getGlobalDateRange } from "../../../utils/chart/dateRange";

/**
 * Build the video size over time chart section.
 * Returns null if there are no dates to display.
 */
export function buildVideoSizeChartSection(allStats: SyncStats[]): ReportSection | null {
  const sortedDates = getGlobalDateRange();
  const minDatesRequired = 0;

  if (sortedDates.length === minDatesRequired) {
    return null;
  }

  const bytesToMb = 1048576; // 1024 * 1024
  const initialValue = 0;
  const noDataCount = 0;

  // Aggregate video sizes across all environments
  const aggregatedTotalSizeByDate: Record<string, number> = {};
  const aggregatedCountByDate: Record<string, number> = {};
  allStats.forEach((stats) => {
    Object.entries(stats.videoHistory).forEach(([date, history]) => {
      aggregatedTotalSizeByDate[date] = (aggregatedTotalSizeByDate[date] ?? initialValue) + history.totalSize;
      aggregatedCountByDate[date] = (aggregatedCountByDate[date] ?? initialValue) + history.count;
    });
  });

  // Calculate average video size per day
  const averageData = sortedDates.map((date) => {
    const totalSize = aggregatedTotalSizeByDate[date] ?? initialValue;
    const count = aggregatedCountByDate[date] ?? noDataCount;
    if (count > noDataCount) {
      return totalSize / count / bytesToMb; // MB
    }
    return null;
  });

  // Calculate cumulative average
  let cumulativeTotalSize = initialValue;
  let cumulativeCount = noDataCount;
  const cumulativeAverageData = sortedDates.map((date) => {
    const dateTotalSize = aggregatedTotalSizeByDate[date] ?? initialValue;
    const dateCount = aggregatedCountByDate[date] ?? noDataCount;
    cumulativeTotalSize += dateTotalSize;
    cumulativeCount += dateCount;
    if (cumulativeCount > noDataCount) {
      return cumulativeTotalSize / cumulativeCount / bytesToMb; // MB
    }
    return null;
  });

  // Calculate cumulative total size (for area chart) in GB
  let cumulativeTotalSizeRunning = initialValue;
  const cumulativeTotalSizeData = sortedDates.map((date) => {
    const dateTotalSize = aggregatedTotalSizeByDate[date] ?? initialValue;
    cumulativeTotalSizeRunning += dateTotalSize;
    if (cumulativeTotalSizeRunning === initialValue) {
      return null;
    }
    return convert(cumulativeTotalSizeRunning).from("B").to("GB");
  });

  const backgroundOrder = 0;
  const dailyAverageOrder = 100;
  const allTimeAverageOrder = 200;

  const datasets: MixedChartDataset[] = [
    {
      backgroundColor: "rgba(59, 130, 246, 0.3)",
      borderColor: "rgba(59, 130, 246, 0.5)",
      borderWidth: 1,
      data: cumulativeTotalSizeData,
      fill: true,
      label: "Cumulative Size",
      order: backgroundOrder,
      type: "line",
      yAxisID: "y1"
    },
    {
      borderColor: "rgba(16, 185, 129, 1)",
      borderWidth: 1.5,
      data: averageData,
      label: "Daily Average",
      order: dailyAverageOrder,
      type: "line",
      yAxisID: "y"
    },
    {
      borderColor: "rgba(239, 68, 68, 1)",
      borderWidth: 1.5,
      data: cumulativeAverageData,
      label: "All Time Average",
      order: allTimeAverageOrder,
      type: "line",
      yAxisID: "y"
    }
  ];

  const chartConfig = getMixedChartConfig(sortedDates, datasets, {
    height: 350,
    title: "Average Video Size Over Time (MB)",
    yLabelLeft: "Size per Video (MB)",
    yLabelRight: "Cumulative Size (GB)"
  });

  const ChartComponent = (): React.ReactElement =>
    React.createElement(MixedChart, { config: chartConfig as MixedChartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Average Video Size Over Time",
    type: "react-component"
  };
}
