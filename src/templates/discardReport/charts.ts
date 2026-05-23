import React from "react";

import { BadScanHistoryEntry, DateMismatch, DiscardedArtifact } from "../../models/discardStats";
import { LineChartConfig } from "../../models/chart/lineChartConfig";
import { LineChartDataset } from "../../models/chart/lineChartDataset";
import { ReportSection } from "../../models/report";
import { getBarChartConfig } from "../../utils/chart/configBuilders";
import { getGlobalDateRange } from "../../utils/chart/dateRange";
import { LineChart } from "../components/charts/LineChart";
import { isDuplicateEntry, isNotBathroomEntry, isTooShortEntry } from "./utils";

export function buildDistributionSection(newBadScans: DiscardedArtifact[], total: number): ReportSection | null {
  const emptyCount = 0;
  const incrementCount = 1;
  const reasonChartWidth = 400;
  const environmentChartWidth = 290;
  if (newBadScans.length === emptyCount) {
    return null;
  }

  const normalizeReason = (reason: string): string => {
    if (reason.startsWith("Video too short")) {
      return "Video too short";
    }
    if (reason.startsWith("Not a bathroom")) {
      return "Not a bathroom";
    }
    if (reason.startsWith("Duplicate video")) {
      return "Duplicate video";
    }
    if (reason.startsWith("Invalid video")) {
      return "Invalid video";
    }
    return reason;
  };

  const reasonCounts = new Map<string, number>();
  const environmentCounts = new Map<string, number>();

  newBadScans.forEach((entry) => {
    const normalizedReason = normalizeReason(entry.reason);
    const currentReasonCount = reasonCounts.get(normalizedReason) ?? emptyCount;
    const currentEnvironmentCount = environmentCounts.get(entry.environment) ?? emptyCount;
    reasonCounts.set(normalizedReason, currentReasonCount + incrementCount);
    environmentCounts.set(entry.environment, currentEnvironmentCount + incrementCount);
  });

  const sortedReasons = Array.from(reasonCounts.entries()).sort(([, aCount], [, bCount]) => bCount - aCount);
  const reasonLabels = sortedReasons.map(([reason]) => reason);
  const reasonData = sortedReasons.map(([, count]) => count);

  const sortedEnvironments = Array.from(environmentCounts.entries()).sort(([, aCount], [, bCount]) => bCount - aCount);
  const environmentLabels = sortedEnvironments.map(([env]) => env);
  const environmentData = sortedEnvironments.map(([, count]) => count);

  const reasonChart = getBarChartConfig(reasonLabels, reasonData, {
    horizontal: true,
    showCount: true,
    totalForPercentages: total,
    width: reasonChartWidth
  });

  const environmentChart = getBarChartConfig(environmentLabels, environmentData, {
    showCount: true,
    totalForPercentages: total,
    width: environmentChartWidth
  });

  return {
    data: [
      { data: reasonChart, title: "Reasons" },
      { data: environmentChart, title: "Environments" }
    ],
    title: "New Bad Scan Distribution",
    type: "chart-row"
  };
}

function buildOverTimeChart(
  history: BadScanHistoryEntry[],
  filterFn: (entry: BadScanHistoryEntry) => boolean,
  title: string
): ReportSection | null {
  const noEntries = 0;
  const minDatesForChart = 2;
  const filteredHistory = history.filter(filterFn);

  if (filteredHistory.length === noEntries) {
    return null;
  }

  // Aggregate by date (YYYY-MM-DD) and environment
  const defaultCount = 0;
  const countIncrement = 1;
  const dateEnvCounts = new Map<string, Record<string, number>>();
  const datesToCount = new Set<string>();
  const allEnvs = new Set<string>();
  const datePartIndex = 0;

  filteredHistory.forEach((entry) => {
    if (entry.scanDate === undefined || entry.scanDate === "") {
      return;
    }
    const dateKey = entry.scanDate.split("T")[datePartIndex]; // YYYY-MM-DD
    if (dateKey === undefined || dateKey === "" || dateKey.startsWith("0001")) {
      return;
    }
    datesToCount.add(dateKey);
    allEnvs.add(entry.environment);

    const dateData = dateEnvCounts.get(dateKey) ?? {};
    dateData[entry.environment] = (dateData[entry.environment] ?? defaultCount) + countIncrement;
    dateEnvCounts.set(dateKey, dateData);
  });

  const sortedDataDates = Array.from(datesToCount).sort();
  // Require at least 2 dates of data for a meaningful trend chart
  if (sortedDataDates.length < minDatesForChart) {
    return null;
  }

  // Use global date range from first artifact to current date
  const sortedDates = getGlobalDateRange();

  const sortedEnvs = Array.from(allEnvs).sort();

  const envColors: Record<string, string> = {
    "Bond Demo": "rgba(127, 24, 127, 1)",
    "Bond Production": "rgba(0, 100, 0, 1)",
    "Lowe's Production": "rgba(1, 33, 105, 1)",
    "Lowe's Staging": "rgba(0, 117, 206, 1)"
  };
  const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

  const datasets: LineChartDataset[] = sortedEnvs.map((env, index) => {
    const data = sortedDates.map((date) => {
      const count = dateEnvCounts.get(date)?.[env] ?? defaultCount;
      return count;
    });

    const colorIndex = index % defaultColors.length;
    const defaultColor = defaultColors[colorIndex] ?? "#000000";
    const borderColor = envColors[env] ?? defaultColor;

    return {
      borderColor,
      data,
      label: env,
      verticalLines: true
    } satisfies LineChartDataset;
  });

  const chartConfig: LineChartConfig = {
    datasets,
    height: 350,
    labels: sortedDates,
    options: {
      title,
      yLabel: "Count"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title,
    type: "react-component"
  };
}

export function buildShortVideosOverTimeSection(
  history: BadScanHistoryEntry[],
  minDuration: number
): ReportSection | null {
  return buildOverTimeChart(history, isTooShortEntry, `Short Videos (< ${minDuration.toString()} s) Over Time`);
}

export function buildNonBathroomOverTimeSection(history: BadScanHistoryEntry[]): ReportSection | null {
  return buildOverTimeChart(history, isNotBathroomEntry, "Non-Bathroom Videos Over Time");
}

export function buildDuplicatesOverTimeSection(history: BadScanHistoryEntry[]): ReportSection | null {
  return buildOverTimeChart(history, isDuplicateEntry, "Duplicate Videos Over Time");
}

export function buildMismatchOverTimeSection(mismatches: DateMismatch[]): ReportSection | null {
  const noMismatches = 0;
  const minDatesForChart = 2;

  if (mismatches.length === noMismatches) {
    return null;
  }

  const defaultCount = 0;
  const countIncrement = 1;
  const dateEnvCounts = new Map<string, Record<string, number>>();
  const datesToCount = new Set<string>();
  const allEnvs = new Set<string>();
  const datePartIndex = 0;

  mismatches.forEach((m) => {
    if (m.scanDate === "") {
      return;
    }
    const dateKey = m.scanDate.split("T")[datePartIndex];
    if (dateKey === undefined || dateKey === "" || dateKey.startsWith("0001")) {
      return;
    }
    datesToCount.add(dateKey);
    allEnvs.add(m.environment);

    const dateData = dateEnvCounts.get(dateKey) ?? {};
    dateData[m.environment] = (dateData[m.environment] ?? defaultCount) + countIncrement;
    dateEnvCounts.set(dateKey, dateData);
  });

  const sortedDataDates = Array.from(datesToCount).sort();
  if (sortedDataDates.length < minDatesForChart) {
    return null;
  }

  const sortedDates = getGlobalDateRange();
  const sortedEnvs = Array.from(allEnvs).sort();

  const envColors: Record<string, string> = {
    "Bond Demo": "rgba(127, 24, 127, 1)",
    "Bond Production": "rgba(0, 100, 0, 1)",
    "Lowe's Production": "rgba(1, 33, 105, 1)",
    "Lowe's Staging": "rgba(0, 117, 206, 1)"
  };
  const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

  const datasets: LineChartDataset[] = sortedEnvs.map((env, index) => {
    const data = sortedDates.map((date) => {
      const count = dateEnvCounts.get(date)?.[env] ?? defaultCount;
      return count;
    });

    const colorIndex = index % defaultColors.length;
    const defaultColor = defaultColors[colorIndex] ?? "#000000";
    const borderColor = envColors[env] ?? defaultColor;

    return {
      borderColor,
      data,
      label: env,
      verticalLines: true
    } satisfies LineChartDataset;
  });

  const chartConfig: LineChartConfig = {
    datasets,
    height: 350,
    labels: sortedDates,
    options: {
      title: "Date Mismatches Over Time",
      yLabel: "Count"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Date Mismatches Over Time",
    type: "react-component"
  };
}
