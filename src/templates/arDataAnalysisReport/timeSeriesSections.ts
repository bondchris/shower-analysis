import React from "react";

import { ArtifactAnalysis } from "../../models/artifactAnalysis";
import { LineChartConfig } from "../../models/chart/lineChartConfig";
import { ReportSection } from "../../models/report";
import { getGlobalDateRange } from "../../utils/chart/dateRange";
import { LineChart } from "../components/charts/LineChart";

function parseScanDate(artifact: ArtifactAnalysis): string | null {
  const datePartIndex = 0;
  if (artifact.scanDateTime === "") {
    return null;
  }
  // Parse EXIF date format "YYYY:MM:DD HH:MM:SS" to extract date
  const datePart = artifact.scanDateTime.split(" ")[datePartIndex];
  if (datePart === undefined || datePart === "") {
    return null;
  }
  // Convert "YYYY:MM:DD" to "YYYY-MM-DD" for consistency
  const dateKey = datePart.replace(/:/g, "-");
  if (dateKey.startsWith("0001")) {
    return null;
  }
  return dateKey;
}

export function buildDroppedFramesOverTimeSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const noEntries = 0;
  const minDatesForChart = 2;
  const defaultCount = 0;
  const countIncrement = 1;

  // Group artifacts by scan date and count dropped frames
  const dateDroppedCounts = new Map<string, number>();
  const dateTotalCounts = new Map<string, number>();
  const datesToCount = new Set<string>();

  for (const artifact of metadataList) {
    const dateKey = parseScanDate(artifact);
    if (dateKey === null) {
      continue;
    }
    datesToCount.add(dateKey);

    dateTotalCounts.set(dateKey, (dateTotalCounts.get(dateKey) ?? defaultCount) + countIncrement);
    if (artifact.hasDroppedArFrames) {
      dateDroppedCounts.set(dateKey, (dateDroppedCounts.get(dateKey) ?? defaultCount) + countIncrement);
    }
  }

  const sortedDataDates = Array.from(datesToCount).sort();
  if (sortedDataDates.length < minDatesForChart) {
    return null;
  }

  // Use global date range for consistent x-axis
  const sortedDates = getGlobalDateRange();

  // Calculate percentage of dropped frames per date
  const percentageMultiplier = 100;
  const data = sortedDates.map((date) => {
    const total = dateTotalCounts.get(date) ?? noEntries;
    const dropped = dateDroppedCounts.get(date) ?? noEntries;
    if (total === noEntries) {
      return noEntries;
    }
    return (dropped / total) * percentageMultiplier;
  });

  const chartConfig: LineChartConfig = {
    datasets: [
      {
        borderColor: "#ef4444",
        data,
        label: "Dropped Frames %",
        verticalLines: true
      }
    ],
    height: 300,
    labels: sortedDates,
    options: {
      title: "Artifacts with Dropped Frames Over Time",
      yLabel: "% of Scans"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Artifacts with Dropped Frames Over Time",
    type: "react-component"
  };
}

export function buildAvgDroppedFramePercentageOverTimeSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const noEntries = 0;
  const minDatesForChart = 2;
  const defaultCount = 0;
  const countIncrement = 1;

  // Group artifacts by scan date and sum dropped frame percentages
  const dateDroppedPercentageSums = new Map<string, number>();
  const dateTotalCounts = new Map<string, number>();
  const datesToCount = new Set<string>();

  for (const artifact of metadataList) {
    const dateKey = parseScanDate(artifact);
    if (dateKey === null) {
      continue;
    }
    datesToCount.add(dateKey);

    dateTotalCounts.set(dateKey, (dateTotalCounts.get(dateKey) ?? defaultCount) + countIncrement);
    const currentSum = dateDroppedPercentageSums.get(dateKey) ?? defaultCount;
    dateDroppedPercentageSums.set(dateKey, currentSum + artifact.droppedArFramePercentage);
  }

  const sortedDataDates = Array.from(datesToCount).sort();
  if (sortedDataDates.length < minDatesForChart) {
    return null;
  }

  // Use global date range for consistent x-axis
  const sortedDates = getGlobalDateRange();

  // Calculate average dropped frame percentage per date
  const data = sortedDates.map((date) => {
    const total = dateTotalCounts.get(date) ?? noEntries;
    const sumPercentage = dateDroppedPercentageSums.get(date) ?? noEntries;
    if (total === noEntries) {
      return noEntries;
    }
    return sumPercentage / total;
  });

  const chartConfig: LineChartConfig = {
    datasets: [
      {
        borderColor: "#f97316",
        data,
        label: "Avg Dropped Frame %",
        verticalLines: true
      }
    ],
    height: 300,
    labels: sortedDates,
    options: {
      title: "Average Dropped Frame Percentage Over Time",
      yDecimalPlaces: 1,
      yLabel: "% of Frames Dropped",
      yTickSuffix: "%"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Average Dropped Frame Percentage Over Time",
    type: "react-component"
  };
}
