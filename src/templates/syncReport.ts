import { SyncError, SyncStats } from "../models/syncStats";
import { SyncFailureDatabase } from "../utils/data/syncFailures";
import React from "react";
import { ReportData, ReportSection } from "../models/report";
import { LineChart } from "./components/charts/LineChart";
import { LineChartConfig } from "../models/chart/lineChartConfig";
import { LineChartDataset } from "../models/chart/lineChartDataset";
import { MixedChart } from "./components/charts/MixedChart";
import { MixedChartConfig } from "../models/chart/mixedChartConfig";
import { MixedChartDataset } from "../models/chart/mixedChartDataset";
import { getMixedChartConfig } from "../utils/chart/configBuilders";
import { getGlobalDateRange } from "../utils/chart/dateRange";
import { CHART_DATE_RANGE } from "../../config/config";
import convert from "convert-units";

export function buildSyncReport(allStats: SyncStats[], knownFailures: SyncFailureDatabase): ReportData {
  const sections: ReportSection[] = [];
  const ZERO = 0;
  const ONE = 1;

  // Sort by volume found (Largest -> Smallest) to match charts
  const sortedStats = [...allStats].sort((a, b) => b.found - a.found);

  // Summary Table
  // Calculate Totals using original array (order doesn't matter for sum)
  const totalFound = allStats.reduce((sum, s) => sum + s.found, ZERO);
  const totalNew = allStats.reduce((sum, s) => sum + s.new, ZERO);
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, ZERO);
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, ZERO);
  const totalKnownFailures = allStats.reduce((sum, s) => sum + s.knownFailures, ZERO);
  const totalNewFailures = allStats.reduce((sum, s) => sum + s.newFailures, ZERO);
  const totalSavedToDisk = totalFound - totalFailed - totalSkipped;
  const totalAlreadyPresent = totalSavedToDisk - totalNew;

  const headers = ["", ...sortedStats.map((s) => s.env), "Total"];
  const tableData: string[][] = [
    [
      "Found",
      ...sortedStats.map((s) => s.found.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFound.toString()}</span>`
    ],
    [
      "Total Saved to Disk",
      ...sortedStats.map((s) => (s.found - s.failed - s.skipped).toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalSavedToDisk.toString()}</span>`
    ],
    [
      "Already Present",
      ...sortedStats.map((s) => (s.found - s.failed - s.skipped - s.new).toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalAlreadyPresent.toString()}</span>`
    ],
    [
      "New",
      ...sortedStats.map((s) => s.new.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalNew.toString()}</span>`
    ],
    [
      "Inaccessible",
      ...sortedStats.map((s) => s.failed.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFailed.toString()}</span>`
    ],
    [
      "New Inaccessible",
      ...sortedStats.map((s) => s.newFailures.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalNewFailures.toString()}</span>`
    ],
    [
      "Known Inaccessible",
      ...sortedStats.map((s) => s.knownFailures.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalKnownFailures.toString()}</span>`
    ],
    [
      "Skipped",
      ...sortedStats.map((s) => s.skipped.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalSkipped.toString()}</span>`
    ]
  ];

  const rowClasses: Record<number, string> = {
    0: "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact", // Found
    1: "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // Total Saved to Disk
    2: "bg-green-50 text-green-800 print:print-color-adjust-exact", // Already Present
    3: "bg-green-50 text-green-800 print:print-color-adjust-exact", // New
    4: "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // Inaccessible
    5: "bg-red-50 text-red-800 print:print-color-adjust-exact", // New Inaccessible (lighter red)
    6: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Known Inaccessible (lighter red)
    7: "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact" // Skipped
  };

  sections.push({
    data: tableData,
    options: { headers, rowClasses },
    title: "Sync Summary",
    type: "table"
  });

  // Inaccessible Artifacts Chart - uses global date range starting at config date
  const errorHistory = new Map<string, Record<string, number>>(); // Date -> Env -> Count

  sortedStats.forEach((stats) => {
    stats.errors.forEach((err) => {
      if (err.date !== undefined && err.date !== "") {
        const dateSubstringLength = 10;
        const dateKey = err.date.substring(ZERO, dateSubstringLength); // YYYY-MM-DD
        if (!dateKey.startsWith("0001")) {
          const dateData = errorHistory.get(dateKey) ?? {};
          dateData[stats.env] = (dateData[stats.env] ?? ZERO) + ONE;
          errorHistory.set(dateKey, dateData);
        }
      }
    });
  });

  // Use global date range starting at config date
  const sortedErrorDates = getGlobalDateRange();
  const MIN_ERROR_DATES = 0;

  if (sortedErrorDates.length > MIN_ERROR_DATES) {
    const envColors: Record<string, string> = {
      "Bond Demo": "rgba(127, 24, 127, 1)",
      "Bond Production": "rgba(0, 100, 0, 1)",
      "Lowe's Production": "rgba(1, 33, 105, 1)",
      "Lowe's Staging": "rgba(0, 117, 206, 1)"
    };
    const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

    const errorDatasets: LineChartDataset[] = sortedStats.map((stats, index) => {
      const data = sortedErrorDates.map((date) => {
        const count = errorHistory.get(date)?.[stats.env] ?? ZERO;
        return count;
      });

      const colorIndex = index % defaultColors.length;
      const defaultColor = defaultColors[colorIndex] ?? "#000000";
      const borderColor = envColors[stats.env] ?? defaultColor;

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

    sections.push({
      component: ErrorChartComponent,
      data: errorChartConfig,
      title: "Inaccessible Artifacts Over Time",
      type: "react-component"
    });
  }

  // Disk Usage Summary Table
  const formatBytes = (bytes: number) => {
    const BYTES_ZERO = 0;
    if (bytes === BYTES_ZERO) {
      return "0 B";
    }
    const k = 1024;
    const sizes: [string, string, string, string, string] = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.floor(Math.log(bytes) / Math.log(k));
    const SIZE_INDEX_OFFSET = 1;
    const lastSizeIndex = sizes.length - SIZE_INDEX_OFFSET;
    const index = Math.min(lastSizeIndex, exponent);
    const DIGITS = 2;
    const value = parseFloat((bytes / Math.pow(k, index)).toFixed(DIGITS)).toString();
    const unit = sizes[index];
    return `${value} ${String(unit)}`;
  };

  const totalVideoSize = allStats.reduce((sum, s) => sum + s.videoSize, ZERO);
  const totalNewVideoSize = allStats.reduce((sum, s) => sum + s.newVideoSize, ZERO);
  const totalArDataSize = allStats.reduce((sum, s) => sum + s.arDataSize, ZERO);
  const totalNewArDataSize = allStats.reduce((sum, s) => sum + s.newArDataSize, ZERO);
  const totalRawScanSize = allStats.reduce((sum, s) => sum + s.rawScanSize, ZERO);
  const totalNewRawScanSize = allStats.reduce((sum, s) => sum + s.newRawScanSize, ZERO);
  const totalPointCloudSize = allStats.reduce((sum, s) => sum + s.pointCloudSize, ZERO);
  const totalNewPointCloudSize = allStats.reduce((sum, s) => sum + s.newPointCloudSize, ZERO);
  const totalInitialLayoutSize = allStats.reduce((sum, s) => sum + s.initialLayoutSize, ZERO);
  const totalNewInitialLayoutSize = allStats.reduce((sum, s) => sum + s.newInitialLayoutSize, ZERO);
  const totalArtifactSize =
    totalVideoSize + totalArDataSize + totalRawScanSize + totalPointCloudSize + totalInitialLayoutSize;

  // Calculate Averages Helper
  const safeAvg = (total: number, count: number) => {
    const ZERO_COUNT = 0;
    if (count === ZERO_COUNT) {
      return ZERO_COUNT;
    }
    return total / count;
  };

  const usageTableData: string[][] = [
    [
      "All Artifacts (Total)",
      ...sortedStats.map((s) =>
        formatBytes(s.videoSize + s.arDataSize + s.rawScanSize + s.pointCloudSize + s.initialLayoutSize)
      ),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalArtifactSize)}</span>`
    ],
    // Video
    [
      "Video (Total)",
      ...sortedStats.map((s) => formatBytes(s.videoSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalVideoSize)}</span>`
    ],
    [
      "Video (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.videoSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalVideoSize, totalFound))}</span>`
    ],
    [
      "Video (New)",
      ...sortedStats.map((s) => formatBytes(s.newVideoSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewVideoSize)}</span>`
    ],
    // ArData
    [
      "AR Data (Total)",
      ...sortedStats.map((s) => formatBytes(s.arDataSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalArDataSize)}</span>`
    ],
    [
      "AR Data (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.arDataSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalArDataSize, totalFound))}</span>`
    ],
    [
      "AR Data (New)",
      ...sortedStats.map((s) => formatBytes(s.newArDataSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewArDataSize)}</span>`
    ],
    // RawScan
    [
      "RawScan (Total)",
      ...sortedStats.map((s) => formatBytes(s.rawScanSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalRawScanSize)}</span>`
    ],
    [
      "RawScan (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.rawScanSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalRawScanSize, totalFound))}</span>`
    ],
    [
      "RawScan (New)",
      ...sortedStats.map((s) => formatBytes(s.newRawScanSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewRawScanSize)}</span>`
    ],
    // PointCloud
    [
      "PointCloud (Total)",
      ...sortedStats.map((s) => formatBytes(s.pointCloudSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalPointCloudSize)}</span>`
    ],
    [
      "PointCloud (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.pointCloudSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalPointCloudSize, totalFound))}</span>`
    ],
    [
      "PointCloud (New)",
      ...sortedStats.map((s) => formatBytes(s.newPointCloudSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewPointCloudSize)}</span>`
    ],
    // InitialLayout
    [
      "InitialLayout (Total)",
      ...sortedStats.map((s) => formatBytes(s.initialLayoutSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalInitialLayoutSize)}</span>`
    ],
    [
      "InitialLayout (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.initialLayoutSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalInitialLayoutSize, totalFound))}</span>`
    ],
    [
      "InitialLayout (New)",
      ...sortedStats.map((s) => formatBytes(s.newInitialLayoutSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewInitialLayoutSize)}</span>`
    ]
  ];

  const diskUsageRowClassArray = [
    "bg-indigo-100 font-semibold text-indigo-800 print:print-color-adjust-exact", // All artifacts total
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // Video Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // Video Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // Video New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // ArData Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // ArData Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // ArData New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // RawScan Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // RawScan Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // RawScan New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // PointCloud Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // PointCloud Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // PointCloud New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // InitialLayout Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // InitialLayout Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact" // InitialLayout New
  ];
  const diskUsageRowClasses: Record<number, string> = Object.fromEntries(
    diskUsageRowClassArray.map((className, index) => [index, className])
  ) as Record<number, string>;

  sections.push({
    data: usageTableData,
    options: { headers, rowClasses: diskUsageRowClasses },
    title: "Disk Usage Summary",
    type: "table"
  });

  // Video Size Chart
  // Use global date range from first artifact to current date
  const sortedDates = getGlobalDateRange();

  const MIN_DATES = 0;
  if (sortedDates.length > MIN_DATES) {
    const BYTES_TO_MB = 1048576; // 1024 * 1024

    // Aggregate video sizes across all environments
    const aggregatedTotalSizeByDate: Record<string, number> = {};
    const aggregatedCountByDate: Record<string, number> = {};
    allStats.forEach((stats) => {
      Object.entries(stats.videoHistory).forEach(([date, history]) => {
        aggregatedTotalSizeByDate[date] = (aggregatedTotalSizeByDate[date] ?? ZERO) + history.totalSize;
        aggregatedCountByDate[date] = (aggregatedCountByDate[date] ?? ZERO) + history.count;
      });
    });

    // Calculate average video size per day
    const ZERO_COUNT = 0;
    const averageData = sortedDates.map((date) => {
      const totalSize = aggregatedTotalSizeByDate[date] ?? ZERO;
      const count = aggregatedCountByDate[date] ?? ZERO_COUNT;
      if (count > ZERO_COUNT) {
        return totalSize / count / BYTES_TO_MB; // MB
      }
      return null;
    });

    // Calculate cumulative average
    let cumulativeTotalSize = ZERO;
    let cumulativeCount = ZERO_COUNT;
    const cumulativeAverageData = sortedDates.map((date) => {
      const dateTotalSize = aggregatedTotalSizeByDate[date] ?? ZERO;
      const dateCount = aggregatedCountByDate[date] ?? ZERO_COUNT;
      cumulativeTotalSize += dateTotalSize;
      cumulativeCount += dateCount;
      if (cumulativeCount > ZERO_COUNT) {
        return cumulativeTotalSize / cumulativeCount / BYTES_TO_MB; // MB
      }
      return null;
    });

    // Calculate cumulative total size (for area chart) in GB
    let cumulativeTotalSizeRunning = ZERO;
    const cumulativeTotalSizeData = sortedDates.map((date) => {
      const dateTotalSize = aggregatedTotalSizeByDate[date] ?? ZERO;
      cumulativeTotalSizeRunning += dateTotalSize;
      if (cumulativeTotalSizeRunning === ZERO) {
        return null;
      }
      return convert(cumulativeTotalSizeRunning).from("B").to("GB");
    });

    const BACKGROUND_ORDER = 0;
    const datasets: MixedChartDataset[] = [
      {
        backgroundColor: "rgba(59, 130, 246, 0.3)",
        borderColor: "rgba(59, 130, 246, 0.5)",
        borderWidth: 1,
        data: cumulativeTotalSizeData,
        fill: true,
        label: "Cumulative Size",
        order: BACKGROUND_ORDER,
        type: "line",
        yAxisID: "y1"
      },
      {
        borderColor: "rgba(16, 185, 129, 1)",
        borderWidth: 1.5,
        data: averageData,
        label: "Daily Average",
        order: 100,
        type: "line",
        yAxisID: "y"
      },
      {
        borderColor: "rgba(239, 68, 68, 1)",
        borderWidth: 1.5,
        data: cumulativeAverageData,
        label: "All Time Average",
        order: 200,
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

    sections.push({
      component: ChartComponent,
      data: chartConfig,
      title: "Average Video Size Over Time",
      type: "react-component"
    });
  }

  // Collect all dates from all artifact history types for consistent x-axis
  // Filter to only include dates on or after the config start date
  // Include the config start date so chart starts at the configured date (only if there's data)
  const historyKeys: (keyof SyncStats)[] = [
    "arDataHistory",
    "rawScanHistory",
    "pointCloudHistory",
    "initialLayoutHistory"
  ];
  const allArtifactDates = new Set<string>();
  historyKeys.forEach((historyKey) => {
    allStats.forEach((stats) => {
      const history = stats[historyKey] as Record<string, { totalSize: number; count: number }> | undefined;
      if (history !== undefined) {
        Object.keys(history).forEach((date) => allArtifactDates.add(date));
      }
    });
  });
  const hasArtifactDates = allArtifactDates.size > ZERO;
  if (hasArtifactDates) {
    allArtifactDates.add(CHART_DATE_RANGE.startDate);
  }
  const sharedArtifactDates = Array.from(allArtifactDates)
    .filter((date) => date >= CHART_DATE_RANGE.startDate)
    .sort();

  // Helper function to create average size over time chart for artifact types
  interface SizeChartOptions {
    leftUnit?: "KB" | "MB";
    rightUnit?: "MB" | "GB";
  }
  const createAverageSizeChart = (
    historyKey: keyof SyncStats,
    title: string,
    yLabelLeft: string,
    options: SizeChartOptions = {}
  ) => {
    const { leftUnit = "MB", rightUnit = "GB" } = options;
    const BYTES_TO_KB = 1024;
    const BYTES_TO_MB = 1048576; // 1024 * 1024
    const leftDivisor = leftUnit === "KB" ? BYTES_TO_KB : BYTES_TO_MB;

    // Use shared dates for consistent x-axis across all artifact charts
    const sortedChartDates = sharedArtifactDates;

    const MIN_CHART_DATES = 0;
    if (sortedChartDates.length > MIN_CHART_DATES) {
      // Aggregate sizes across all environments
      const aggregatedTotalSizeByDate: Record<string, number> = {};
      const aggregatedCountByDate: Record<string, number> = {};
      allStats.forEach((stats) => {
        const history = stats[historyKey] as Record<string, { totalSize: number; count: number }> | undefined;
        if (history !== undefined) {
          Object.entries(history).forEach(([date, historyEntry]) => {
            aggregatedTotalSizeByDate[date] = (aggregatedTotalSizeByDate[date] ?? ZERO) + historyEntry.totalSize;
            aggregatedCountByDate[date] = (aggregatedCountByDate[date] ?? ZERO) + historyEntry.count;
          });
        }
      });

      // Calculate average size per day
      const ZERO_COUNT = 0;
      const averageData = sortedChartDates.map((date) => {
        const totalSize = aggregatedTotalSizeByDate[date] ?? ZERO;
        const count = aggregatedCountByDate[date] ?? ZERO_COUNT;
        if (count > ZERO_COUNT) {
          return totalSize / count / leftDivisor;
        }
        return null;
      });

      // Calculate cumulative average
      let cumulativeTotalSize = ZERO;
      let cumulativeCount = ZERO_COUNT;
      const cumulativeAverageData = sortedChartDates.map((date) => {
        const dateTotalSize = aggregatedTotalSizeByDate[date] ?? ZERO;
        const dateCount = aggregatedCountByDate[date] ?? ZERO_COUNT;
        cumulativeTotalSize += dateTotalSize;
        cumulativeCount += dateCount;
        if (cumulativeCount > ZERO_COUNT) {
          return cumulativeTotalSize / cumulativeCount / leftDivisor;
        }
        return null;
      });

      // Calculate cumulative total size (for area chart)
      let cumulativeTotalSizeRunning = ZERO;
      const cumulativeTotalSizeData = sortedChartDates.map((date) => {
        const dateTotalSize = aggregatedTotalSizeByDate[date] ?? ZERO;
        cumulativeTotalSizeRunning += dateTotalSize;
        if (cumulativeTotalSizeRunning === ZERO) {
          return null;
        }
        return convert(cumulativeTotalSizeRunning).from("B").to(rightUnit);
      });

      const BACKGROUND_ORDER = 0;
      const chartDatasets: MixedChartDataset[] = [
        {
          backgroundColor: "rgba(59, 130, 246, 0.3)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderWidth: 1,
          data: cumulativeTotalSizeData,
          fill: true,
          label: "Cumulative Size",
          order: BACKGROUND_ORDER,
          type: "line",
          yAxisID: "y1"
        },
        {
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1.5,
          data: averageData,
          label: "Daily Average",
          order: 100,
          type: "line",
          yAxisID: "y"
        },
        {
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1.5,
          data: cumulativeAverageData,
          label: "All Time Average",
          order: 200,
          type: "line",
          yAxisID: "y"
        }
      ];

      const artifactChartConfig = getMixedChartConfig(sortedChartDates, chartDatasets, {
        height: 350,
        title: `${title} (${leftUnit})`,
        yLabelLeft,
        yLabelRight: `Cumulative Size (${rightUnit})`
      });

      const ArtifactChartComponent = (): React.ReactElement =>
        React.createElement(MixedChart, { config: artifactChartConfig as MixedChartConfig });

      sections.push({
        component: ArtifactChartComponent,
        data: artifactChartConfig,
        title,
        type: "react-component"
      });
    }
  };

  // AR Data Size Chart
  createAverageSizeChart("arDataHistory", "Average AR Data Size Over Time", "Size per AR Data (MB)");

  // RawScan Size Chart
  createAverageSizeChart("rawScanHistory", "Average RawScan Size Over Time", "Size per RawScan (KB)", {
    leftUnit: "KB",
    rightUnit: "MB"
  });

  // PointCloud Size Chart
  createAverageSizeChart("pointCloudHistory", "Average PointCloud Size Over Time", "Size per PointCloud (MB)");

  // InitialLayout Size Chart
  createAverageSizeChart(
    "initialLayoutHistory",
    "Average InitialLayout Size Over Time",
    "Size per InitialLayout (KB)",
    {
      leftUnit: "KB",
      rightUnit: "MB"
    }
  );

  // Failures Section
  const ZERO_FAILURES = 0;
  const failedStats = allStats.filter((s) => s.errors.length > ZERO_FAILURES);

  if (failedStats.length > ZERO_FAILURES) {
    sections.push({ title: "Inaccessible Artifacts", type: "header" });

    failedStats.forEach((stats) => {
      // Classify errors
      const newErrors: SyncError[] = [];
      const knownErrors: SyncError[] = [];

      stats.errors.forEach((err) => {
        if (Object.prototype.hasOwnProperty.call(knownFailures, err.id)) {
          // Filter out initialLayout failures from known inaccessible section
          const isInitialLayoutFailure = /^initialLayout download failed/i.test(err.reason);
          if (!isInitialLayoutFailure) {
            knownErrors.push(err);
          }
        } else {
          newErrors.push(err);
        }
      });

      // Skip environments with no remaining errors
      if (newErrors.length === ZERO_FAILURES && knownErrors.length === ZERO_FAILURES) {
        return;
      }

      // Helper to render error list
      const renderErrorList = (errors: SyncError[], title: string) => {
        if (errors.length === ZERO_FAILURES) {
          return;
        }

        // Group errors by ID and deduplicate reasons
        const errorsById = new Map<string, Set<string>>();
        errors.forEach((err) => {
          if (!errorsById.has(err.id)) {
            errorsById.set(err.id, new Set());
          }
          errorsById.get(err.id)?.add(err.reason);
        });

        // Print grouped errors
        const errorLines: string[] = [];
        errorsById.forEach((reasons, id) => {
          const currentArtifactErrors: string[] = [];

          // Group failures logic
          const groupedFailures = new Map<string, string[]>(); // status -> types[]
          const miscFailures: string[] = [];

          reasons.forEach((reason) => {
            // Match "type download failed (status)" or "type download failed" without status
            const regexWithStatus = /^(.+) download failed \((.+)\)$/;
            const regexWithoutStatus = /^(.+) download failed$/;
            const matchWithStatus = regexWithStatus.exec(reason);
            const matchWithoutStatus = regexWithoutStatus.exec(reason);

            if (matchWithStatus !== null) {
              const [, type = "", status = ""] = matchWithStatus;
              if (!groupedFailures.has(status)) {
                groupedFailures.set(status, []);
              }
              groupedFailures.get(status)?.push(type);
            } else if (matchWithoutStatus !== null) {
              const [, type = ""] = matchWithoutStatus;
              const unknownStatus = "unknown";
              if (!groupedFailures.has(unknownStatus)) {
                groupedFailures.set(unknownStatus, []);
              }
              groupedFailures.get(unknownStatus)?.push(type);
            } else {
              miscFailures.push(reason);
            }
          });

          // Collect grouped failures
          groupedFailures.forEach((types, status) => {
            const sortedTypes = types.sort();
            let typeStr = "";
            const ONE_ITEM = 1;
            const TWO_ITEMS = 2;
            const [firstType = "", secondType = ""] = sortedTypes;

            if (sortedTypes.length === ONE_ITEM) {
              typeStr = firstType;
            } else if (sortedTypes.length === TWO_ITEMS) {
              typeStr = `${firstType} and ${secondType}`;
            } else {
              const last = sortedTypes.pop() ?? "";
              typeStr = `${sortedTypes.join(", ")}, and ${last}`;
            }
            currentArtifactErrors.push(`Download failed (${status}) for ${typeStr}`);
          });

          // Collect misc failures
          miscFailures.forEach((reason) => {
            currentArtifactErrors.push(reason);
          });

          // Print to errorLines based on count
          const SINGLE_FAILURE = 1;
          const FIRST_ERROR = 0;
          const monoId = `<span class="font-mono">${id}</span>`;
          if (currentArtifactErrors.length === SINGLE_FAILURE) {
            const firstError = String(currentArtifactErrors[FIRST_ERROR]);
            errorLines.push(`${monoId} - ${firstError}`);
          } else {
            errorLines.push(monoId);
            currentArtifactErrors.forEach((err) => {
              errorLines.push(`  - ${err}`);
            });
          }
        });

        sections.push({
          data: errorLines,
          level: 4,
          title: title,
          type: "list"
        });
      };

      sections.push({ level: 3, title: `Environment: ${stats.env}`, type: "header" });
      renderErrorList(newErrors, "New Inaccessible");
      renderErrorList(knownErrors, "Known Inaccessible");
    });
  } else {
    sections.push({
      data: "No failures occurred during sync.",
      type: "text"
    });
  }

  return {
    sections,
    title: "Data Sync Report"
  };
}
