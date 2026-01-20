import React from "react";
import convert from "convert-units";
import { SyncStats } from "../../../models/syncStats";
import { ReportSection } from "../../../models/report";
import { MixedChart } from "../../components/charts/MixedChart";
import { MixedChartConfig } from "../../../models/chart/mixedChartConfig";
import { MixedChartDataset } from "../../../models/chart/mixedChartDataset";
import { getMixedChartConfig } from "../../../utils/chart/configBuilders";
import { CHART_DATE_RANGE } from "../../../../config/config";

export interface ArtifactSizeChartOptions {
  leftUnit?: "KB" | "MB";
  rightUnit?: "MB" | "GB";
}

/**
 * Collect all dates from artifact history types and compute shared date range.
 */
export function computeSharedArtifactDates(allStats: SyncStats[]): string[] {
  const historyKeys: (keyof SyncStats)[] = [
    "arDataHistory",
    "rawScanHistory",
    "pointCloudHistory",
    "initialLayoutHistory"
  ];

  const allArtifactDates = new Set<string>();
  const noDates = 0;
  historyKeys.forEach((historyKey) => {
    allStats.forEach((stats) => {
      const history = stats[historyKey] as Record<string, { totalSize: number; count: number }> | undefined;
      if (history !== undefined) {
        Object.keys(history).forEach((date) => allArtifactDates.add(date));
      }
    });
  });

  const hasArtifactDates = allArtifactDates.size > noDates;
  if (hasArtifactDates) {
    allArtifactDates.add(CHART_DATE_RANGE.startDate);
  }

  return Array.from(allArtifactDates)
    .filter((date) => date >= CHART_DATE_RANGE.startDate)
    .sort();
}

/**
 * Build an average size over time chart for a specific artifact type.
 * Returns null if there are no dates to display.
 */
export function buildArtifactSizeChartSection(
  allStats: SyncStats[],
  sharedDates: string[],
  historyKey: keyof SyncStats,
  title: string,
  yLabelLeft: string,
  options: ArtifactSizeChartOptions = {}
): ReportSection | null {
  const { leftUnit = "MB", rightUnit = "GB" } = options;
  const bytesToKb = 1024;
  const bytesToMb = 1048576; // 1024 * 1024
  const leftDivisor = leftUnit === "KB" ? bytesToKb : bytesToMb;
  const minDatesRequired = 0;
  const initialValue = 0;
  const noDataCount = 0;

  if (sharedDates.length === minDatesRequired) {
    return null;
  }

  // Aggregate sizes across all environments
  const aggregatedTotalSizeByDate: Record<string, number> = {};
  const aggregatedCountByDate: Record<string, number> = {};
  allStats.forEach((stats) => {
    const history = stats[historyKey] as Record<string, { totalSize: number; count: number }> | undefined;
    if (history !== undefined) {
      Object.entries(history).forEach(([date, historyEntry]) => {
        aggregatedTotalSizeByDate[date] = (aggregatedTotalSizeByDate[date] ?? initialValue) + historyEntry.totalSize;
        aggregatedCountByDate[date] = (aggregatedCountByDate[date] ?? initialValue) + historyEntry.count;
      });
    }
  });

  // Calculate average size per day
  const averageData = sharedDates.map((date) => {
    const totalSize = aggregatedTotalSizeByDate[date] ?? initialValue;
    const count = aggregatedCountByDate[date] ?? noDataCount;
    if (count > noDataCount) {
      return totalSize / count / leftDivisor;
    }
    return null;
  });

  // Calculate cumulative average
  let cumulativeTotalSize = initialValue;
  let cumulativeCount = noDataCount;
  const cumulativeAverageData = sharedDates.map((date) => {
    const dateTotalSize = aggregatedTotalSizeByDate[date] ?? initialValue;
    const dateCount = aggregatedCountByDate[date] ?? noDataCount;
    cumulativeTotalSize += dateTotalSize;
    cumulativeCount += dateCount;
    if (cumulativeCount > noDataCount) {
      return cumulativeTotalSize / cumulativeCount / leftDivisor;
    }
    return null;
  });

  // Calculate cumulative total size (for area chart)
  let cumulativeTotalSizeRunning = initialValue;
  const cumulativeTotalSizeData = sharedDates.map((date) => {
    const dateTotalSize = aggregatedTotalSizeByDate[date] ?? initialValue;
    cumulativeTotalSizeRunning += dateTotalSize;
    if (cumulativeTotalSizeRunning === initialValue) {
      return null;
    }
    return convert(cumulativeTotalSizeRunning).from("B").to(rightUnit);
  });

  const backgroundOrder = 0;
  const dailyAverageOrder = 100;
  const allTimeAverageOrder = 200;

  const chartDatasets: MixedChartDataset[] = [
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

  const artifactChartConfig = getMixedChartConfig(sharedDates, chartDatasets, {
    height: 350,
    title: `${title} (${leftUnit})`,
    yLabelLeft,
    yLabelRight: `Cumulative Size (${rightUnit})`
  });

  const ArtifactChartComponent = (): React.ReactElement =>
    React.createElement(MixedChart, { config: artifactChartConfig as MixedChartConfig });

  return {
    component: ArtifactChartComponent,
    data: artifactChartConfig,
    title,
    type: "react-component"
  };
}
