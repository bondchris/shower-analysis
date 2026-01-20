import React from "react";
import { SyncStats } from "../../../models/syncStats";
import { ReportSection } from "../../../models/report";
import { LineChart } from "../../components/charts/LineChart";
import { LineChartConfig } from "../../../models/chart/lineChartConfig";
import { LineChartDataset } from "../../../models/chart/lineChartDataset";
import { getGlobalDateRange } from "../../../utils/chart/dateRange";
import { DEFAULT_CHART_COLORS, ENV_COLORS } from "../utils";

/**
 * Build the error history data from sync stats, mapping dates to environment error counts.
 */
function buildErrorHistory(sortedStats: SyncStats[]): Map<string, Record<string, number>> {
  const errorHistory = new Map<string, Record<string, number>>();
  const dateSubstringLength = 10;
  const dateStartIndex = 0;
  const initialCount = 0;
  const incrementValue = 1;

  sortedStats.forEach((stats) => {
    stats.errors.forEach((err) => {
      if (err.date !== undefined && err.date !== "") {
        const dateKey = err.date.substring(dateStartIndex, dateSubstringLength); // YYYY-MM-DD
        if (!dateKey.startsWith("0001")) {
          const dateData = errorHistory.get(dateKey) ?? {};
          dateData[stats.env] = (dateData[stats.env] ?? initialCount) + incrementValue;
          errorHistory.set(dateKey, dateData);
        }
      }
    });
  });

  return errorHistory;
}

/**
 * Build the inaccessible artifacts over time chart section.
 * Returns null if there are no dates to display.
 */
export function buildErrorHistoryChartSection(sortedStats: SyncStats[]): ReportSection | null {
  const errorHistory = buildErrorHistory(sortedStats);
  const sortedErrorDates = getGlobalDateRange();
  const minDatesRequired = 0;

  if (sortedErrorDates.length === minDatesRequired) {
    return null;
  }

  const noErrorsCount = 0;
  const errorDatasets: LineChartDataset[] = sortedStats.map((stats, index) => {
    const data = sortedErrorDates.map((date) => {
      const count = errorHistory.get(date)?.[stats.env] ?? noErrorsCount;
      return count;
    });

    const colorIndex = index % DEFAULT_CHART_COLORS.length;
    const defaultColor = DEFAULT_CHART_COLORS[colorIndex] ?? "#000000";
    const borderColor = ENV_COLORS[stats.env] ?? defaultColor;

    return {
      borderColor,
      data,
      label: stats.env,
      verticalLines: true
    } satisfies LineChartDataset;
  });

  const errorChartConfig: LineChartConfig = {
    datasets: errorDatasets,
    height: 350,
    labels: sortedErrorDates,
    options: {
      title: "Inaccessible Artifacts Over Time",
      yLabel: "Count"
    },
    type: "line"
  };

  const ErrorChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: errorChartConfig });

  return {
    component: ErrorChartComponent,
    data: errorChartConfig,
    title: "Inaccessible Artifacts Over Time",
    type: "react-component"
  };
}
