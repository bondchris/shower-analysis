import { SyncError, SyncStats } from "../models/syncStats";
import { SyncFailureDatabase } from "../utils/data/syncFailures";
import React from "react";
import { ReportData, ReportSection } from "../models/report";
import { LineChart } from "./components/charts/LineChart";
import { LineChartConfig } from "../models/chart/lineChartConfig";
import { LineChartDataset } from "../models/chart/lineChartDataset";

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

  const headers = ["", ...sortedStats.map((s) => s.env), "Total"];
  const tableData: string[][] = [
    [
      "Found",
      ...sortedStats.map((s) => s.found.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFound.toString()}</span>`
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
    1: "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // New
    2: "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // Inaccessible
    3: "bg-red-50 text-red-800 print:print-color-adjust-exact", // New Inaccessible (lighter red)
    4: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Known Inaccessible (lighter red)
    5: "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact" // Skipped
  };

  sections.push({
    data: tableData,
    options: { headers, rowClasses },
    title: "Sync Summary",
    type: "table"
  });

  // Inaccessible Artifacts Chart
  const errorHistory = new Map<string, Record<string, number>>(); // Month -> Env -> Count
  const allErrorMonths = new Set<string>();

  sortedStats.forEach((stats) => {
    // Add months from video history (successful scans)
    Object.keys(stats.videoHistory).forEach((month) => allErrorMonths.add(month));

    stats.errors.forEach((err) => {
      if (err.date !== undefined && err.date !== "") {
        const DATE_SUBSTRING_LENGTH = 7;
        const month = err.date.substring(ZERO, DATE_SUBSTRING_LENGTH); // YYYY-MM
        allErrorMonths.add(month);

        const monthData = errorHistory.get(month) ?? {};
        monthData[stats.env] = (monthData[stats.env] ?? ZERO) + ONE;
        errorHistory.set(month, monthData);
      }
    });
  });

  const sortedErrorMonths = Array.from(allErrorMonths).sort();
  const MIN_ERROR_MONTHS = 0;

  if (sortedErrorMonths.length > MIN_ERROR_MONTHS) {
    const envColors: Record<string, string> = {
      "Bond Demo": "rgba(127, 24, 127, 1)",
      "Bond Production": "rgba(0, 100, 0, 1)",
      "Lowe's Production": "rgba(1, 33, 105, 1)",
      "Lowe's Staging": "rgba(0, 117, 206, 1)"
    };
    const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

    const errorDatasets: LineChartDataset[] = sortedStats.map((stats, index) => {
      const data = sortedErrorMonths.map((month) => {
        const count = errorHistory.get(month)?.[stats.env] ?? ZERO;
        return count;
      });

      const colorIndex = index % defaultColors.length;
      const defaultColor = defaultColors[colorIndex] ?? "#000000";
      const borderColor = envColors[stats.env] ?? defaultColor;

      return {
        borderColor,
        data,
        label: stats.env
      } satisfies LineChartDataset;
    });

    const errorChartConfig: LineChartConfig = {
      datasets: errorDatasets,
      height: 350,
      labels: sortedErrorMonths,
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
      title: "Inaccessible Artifacts Trend",
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
  // Collect all unique dates (months) sorted
  const allMonths = new Set<string>();
  allStats.forEach((stats) => {
    Object.keys(stats.videoHistory).forEach((month) => allMonths.add(month));
  });
  const sortedMonths = Array.from(allMonths).sort();

  const MIN_MONTHS = 0;
  if (sortedMonths.length > MIN_MONTHS) {
    const BYTES_TO_MB = 1048576; // 1024 * 1024
    // Sort by volume found (Largest -> Smallest)
    const descStats = [...allStats].sort((a, b) => b.found - a.found);

    const envColors: Record<string, string> = {
      "Bond Demo": "rgba(127, 24, 127, 1)",
      "Bond Production": "rgba(0, 100, 0, 1)",
      "Lowe's Production": "rgba(1, 33, 105, 1)",
      "Lowe's Staging": "rgba(0, 117, 206, 1)"
    };
    const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

    const datasets: LineChartDataset[] = descStats.map((stats, index) => {
      const data = sortedMonths.map((month) => {
        const history = stats.videoHistory[month];
        const ZERO_COUNT = 0;
        if (history && history.count > ZERO_COUNT) {
          return history.totalSize / history.count / BYTES_TO_MB; // MB
        }
        return null;
      });

      const colorIndex = index % defaultColors.length;
      const defaultColor = defaultColors[colorIndex] ?? "#000000";
      const borderColor = envColors[stats.env] ?? defaultColor;

      return {
        borderColor,
        data,
        label: stats.env
      } satisfies LineChartDataset;
    });

    const chartConfig: LineChartConfig = {
      datasets,
      height: 350,
      labels: sortedMonths,
      options: {
        title: "Average Video Size Over Time (MB)",
        yLabel: "Size (MB)"
      },
      type: "line"
    };

    const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

    sections.push({
      component: ChartComponent,
      data: chartConfig,
      title: "Average Video Size Trend",
      type: "react-component"
    });
  }

  // Date Mismatch Summary Table
  const totalMismatches = sortedStats.reduce((sum, s) => sum + s.dateMismatches.length, ZERO);

  if (totalMismatches > ZERO) {
    const totalNewMismatches = sortedStats.reduce(
      (sum, s) => sum + s.dateMismatches.filter((m) => m.isNew === true).length,
      ZERO
    );

    const mismatchHeaders = ["", ...sortedStats.map((s) => s.env), "Total"];
    const mismatchTableData = [
      [
        "Total Mismatches",
        ...sortedStats.map((s) => s.dateMismatches.length.toString()),
        `<span style="font-weight:normal;color:#6b7280">${totalMismatches.toString()}</span>`
      ],
      [
        "New Mismatches",
        ...sortedStats.map((s) => s.dateMismatches.filter((m) => m.isNew === true).length.toString()),
        `<span style="font-weight:normal;color:#6b7280">${totalNewMismatches.toString()}</span>`
      ]
    ];

    const mismatchRowClasses: Record<number, string> = {
      0: "bg-orange-100 font-semibold text-orange-800 print:print-color-adjust-exact",
      1: "bg-orange-50 text-orange-800 print:print-color-adjust-exact"
    };

    sections.push({
      data: mismatchTableData,
      options: { headers: mismatchHeaders, rowClasses: mismatchRowClasses },
      title: "Date Mismatch Summary",
      type: "table"
    });

    // Date Mismatch Chart
    const mismatchHistory = new Map<string, Record<string, number>>(); // Month -> Env -> Count
    const allMismatchMonths = new Set<string>();

    sortedStats.forEach((stats) => {
      // Add months from video history for full timeline context
      Object.keys(stats.videoHistory).forEach((month) => allMismatchMonths.add(month));

      stats.dateMismatches.forEach((m) => {
        if (m.scanDate !== "") {
          const DATE_SUBSTRING_LENGTH = 7;
          const month = m.scanDate.substring(ZERO, DATE_SUBSTRING_LENGTH); // YYYY-MM
          allMismatchMonths.add(month);

          const monthData = mismatchHistory.get(month) ?? {};
          monthData[stats.env] = (monthData[stats.env] ?? ZERO) + ONE;
          mismatchHistory.set(month, monthData);
        }
      });
    });

    const sortedMismatchMonths = Array.from(allMismatchMonths).sort();
    const MIN_MISMATCH_MONTHS = 0;

    if (sortedMismatchMonths.length > MIN_MISMATCH_MONTHS) {
      const envColors: Record<string, string> = {
        "Bond Demo": "rgba(127, 24, 127, 1)",
        "Bond Production": "rgba(0, 100, 0, 1)",
        "Lowe's Production": "rgba(1, 33, 105, 1)",
        "Lowe's Staging": "rgba(0, 117, 206, 1)"
      };
      const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

      const mismatchDatasets: LineChartDataset[] = sortedStats.map((stats, index) => {
        const data = sortedMismatchMonths.map((month) => {
          const count = mismatchHistory.get(month)?.[stats.env] ?? ZERO;
          return count;
        });

        const colorIndex = index % defaultColors.length;
        const defaultColor = defaultColors[colorIndex] ?? "#000000";
        const borderColor = envColors[stats.env] ?? defaultColor;

        return {
          borderColor,
          data,
          label: stats.env
        } satisfies LineChartDataset;
      });

      const mismatchChartConfig: LineChartConfig = {
        datasets: mismatchDatasets,
        height: 350,
        labels: sortedMismatchMonths,
        options: {
          title: "Date Mismatches Over Time",
          yLabel: "Count"
        },
        type: "line"
      };

      const MismatchChartComponent = (): React.ReactElement =>
        React.createElement(LineChart, { config: mismatchChartConfig });

      sections.push({
        component: MismatchChartComponent,
        data: mismatchChartConfig,
        title: "Date Mismatches Trend",
        type: "react-component"
      });
    }
  }

  // Duplicate Videos Section
  const ZERO_DUPLICATES = 0;
  const totalDuplicates = allStats.reduce((sum, s) => sum + s.duplicateCount, ZERO);

  if (totalDuplicates > ZERO_DUPLICATES) {
    const duplicateHeaders = ["", ...sortedStats.map((s) => s.env), "Total"];
    const totalNewDuplicatesForTable = allStats.reduce((sum, s) => sum + s.newDuplicateCount, ZERO);
    const duplicateTableData = [
      [
        "Total Duplicates",
        ...sortedStats.map((s) => s.duplicateCount.toString()),
        `<span style="font-weight:normal;color:#6b7280">${totalDuplicates.toString()}</span>`
      ],
      [
        "New Duplicates",
        ...sortedStats.map((s) => s.newDuplicateCount.toString()),
        `<span style="font-weight:normal;color:#6b7280">${totalNewDuplicatesForTable.toString()}</span>`
      ]
    ];

    const duplicateRowClasses: Record<number, string> = {
      0: "bg-purple-100 font-semibold text-purple-800 print:print-color-adjust-exact",
      1: "bg-purple-50 text-purple-800 print:print-color-adjust-exact"
    };

    sections.push({
      data: duplicateTableData,
      options: { headers: duplicateHeaders, rowClasses: duplicateRowClasses },
      title: "Duplicate Videos Summary",
      type: "table"
    });

    // Duplicate Videos Trend Chart
    const duplicateHistory = new Map<string, Record<string, number>>(); // Month -> Env -> Count
    const allDuplicateMonths = new Set<string>();

    sortedStats.forEach((stats) => {
      // Add months from video history for full timeline context
      Object.keys(stats.videoHistory).forEach((month) => allDuplicateMonths.add(month));

      stats.duplicates.forEach((dup) => {
        if (dup.scanDate !== undefined && dup.scanDate !== "") {
          const DATE_SUBSTRING_LENGTH = 7;
          const month = dup.scanDate.substring(ZERO, DATE_SUBSTRING_LENGTH); // YYYY-MM
          allDuplicateMonths.add(month);

          const monthData = duplicateHistory.get(month) ?? {};
          monthData[stats.env] = (monthData[stats.env] ?? ZERO) + ONE;
          duplicateHistory.set(month, monthData);
        }
      });
    });

    const sortedDuplicateMonths = Array.from(allDuplicateMonths).sort();
    const MIN_DUPLICATE_MONTHS = 0;

    if (sortedDuplicateMonths.length > MIN_DUPLICATE_MONTHS) {
      const envColors: Record<string, string> = {
        "Bond Demo": "rgba(127, 24, 127, 1)",
        "Bond Production": "rgba(0, 100, 0, 1)",
        "Lowe's Production": "rgba(1, 33, 105, 1)",
        "Lowe's Staging": "rgba(0, 117, 206, 1)"
      };
      const defaultColors: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

      const duplicateDatasets: LineChartDataset[] = sortedStats.map((stats, index) => {
        const data = sortedDuplicateMonths.map((month) => {
          const count = duplicateHistory.get(month)?.[stats.env] ?? ZERO;
          return count;
        });

        const colorIndex = index % defaultColors.length;
        const defaultColor = defaultColors[colorIndex] ?? "#000000";
        const borderColor = envColors[stats.env] ?? defaultColor;

        return {
          borderColor,
          data,
          label: stats.env
        } satisfies LineChartDataset;
      });

      const duplicateChartConfig: LineChartConfig = {
        datasets: duplicateDatasets,
        height: 350,
        labels: sortedDuplicateMonths,
        options: {
          title: "Duplicate Videos Over Time",
          yLabel: "Count"
        },
        type: "line"
      };

      const DuplicateChartComponent = (): React.ReactElement =>
        React.createElement(LineChart, { config: duplicateChartConfig });

      sections.push({
        component: DuplicateChartComponent,
        data: duplicateChartConfig,
        title: "Duplicate Videos Trend",
        type: "react-component"
      });
    }

    // Detailed Duplicates List
    // Group duplicates by hash (since videos can be duplicated across environments)
    const duplicatesByHash = new Map<string, { artifactId: string; environment: string }[]>();
    const artifactToEnvironment = new Map<string, string>();

    // First pass: build a map of artifact ID to environment by looking through all duplicate entries
    allStats.forEach((stats) => {
      stats.duplicates.forEach((dup) => {
        // The artifactId always has a known environment
        artifactToEnvironment.set(dup.artifactId, dup.environment);
        // For duplicateIds, try to find their environment by looking for them as artifactIds in other entries
        dup.duplicateIds.forEach((id) => {
          if (!artifactToEnvironment.has(id)) {
            // Try to find this ID as an artifactId in any duplicate entry
            let foundEnv: string | undefined = undefined;
            for (const s of allStats) {
              const found = s.duplicates.find((d) => d.artifactId === id);
              if (found !== undefined) {
                foundEnv = found.environment;
                break;
              }
            }
            if (foundEnv !== undefined) {
              artifactToEnvironment.set(id, foundEnv);
            }
          }
        });
      });
    });

    // Second pass: group by hash and collect all artifact IDs
    allStats.forEach((stats) => {
      stats.duplicates.forEach((dup) => {
        const hashGroup = duplicatesByHash.get(dup.hash) ?? [];

        if (!hashGroup.some((a) => a.artifactId === dup.artifactId)) {
          hashGroup.push({ artifactId: dup.artifactId, environment: dup.environment });
        }

        dup.duplicateIds.forEach((id) => {
          if (!hashGroup.some((a) => a.artifactId === id)) {
            const env = artifactToEnvironment.get(id) ?? dup.environment;
            artifactToEnvironment.set(id, env);
            hashGroup.push({ artifactId: id, environment: env });
          }
        });

        duplicatesByHash.set(dup.hash, hashGroup);
      });
    });

    if (duplicatesByHash.size > ZERO_DUPLICATES) {
      sections.push({ title: "Duplicate Videos", type: "header" });
      sections.push({
        data: "Format: Video Hash → Artifact IDs (sub-bullets with environment in parentheses)",
        type: "text"
      });

      // Sort hashes by number of artifacts (descending)
      const ARRAY_VALUE_INDEX = 1;
      const sortedHashes = Array.from(duplicatesByHash.entries()).sort(
        (a, b) => b[ARRAY_VALUE_INDEX].length - a[ARRAY_VALUE_INDEX].length
      );

      const duplicateLines: string[] = [];

      sortedHashes.forEach(([hash, artifacts]) => {
        const monoHash = `<span class="font-mono">${hash}</span>`;

        // Sort artifacts by environment, then by ID for consistent ordering
        const sortedArtifacts = [...artifacts].sort((a, b) => {
          if (a.environment !== b.environment) {
            return a.environment.localeCompare(b.environment);
          }
          return a.artifactId.localeCompare(b.artifactId);
        });

        // Build nested HTML list structure
        const subItems = sortedArtifacts
          .map((artifact) => {
            const monoId = `<span class="font-mono">${artifact.artifactId}</span>`;
            return `<li>${monoId} (${artifact.environment})</li>`;
          })
          .join("");

        // Create main list item with nested sub-list
        // Ensure the ul has proper list styling with bullets and indentation
        // list-style-type: disc shows bullets, padding-left creates space for them
        // margin-left indents the list, but we keep it minimal for proper nesting
        duplicateLines.push(
          `${monoHash}<ul style="list-style-type: disc; margin-top: 0.25rem; margin-bottom: 0.25rem; margin-left: 0.25rem; padding-left: 1rem;">${subItems}</ul>`
        );
      });

      sections.push({
        data: duplicateLines,
        level: 4,
        title: "Duplicates",
        type: "list"
      });
    }
  }

  // Date Mismatches Section
  const ZERO_MISMATCHES = 0;
  const statsWithMismatches = allStats.filter((s) => s.dateMismatches.length > ZERO_MISMATCHES);

  if (statsWithMismatches.length > ZERO_MISMATCHES) {
    sections.push({ title: "Date Mismatches (> 1 Day)", type: "header" });
    sections.push({
      data: "Format: ID - [Days] (Video Date vs API Date in ET)",
      type: "text"
    });

    statsWithMismatches.forEach((stats) => {
      // Sort by difference descending
      const sortedMismatches = [...stats.dateMismatches].sort((a, b) => b.diffHours - a.diffHours);
      const mismatchLines: string[] = [];
      const formatDate = (dateStr: string) => {
        try {
          const d = new Date(dateStr);
          const options: Intl.DateTimeFormatOptions = {
            day: "2-digit",
            hour: "2-digit",
            hour12: false,
            minute: "2-digit",
            month: "2-digit",
            timeZone: "America/New_York",
            year: "2-digit"
          };
          interface DateParts {
            day: string;
            hour: string;
            minute: string;
            month: string;
            year: string;
          }
          const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(d);
          const partLookup: DateParts = { day: "00", hour: "00", minute: "00", month: "00", year: "00" };
          const datePartKeys: (keyof DateParts)[] = ["day", "hour", "minute", "month", "year"];
          parts.forEach((part) => {
            if (datePartKeys.includes(part.type as keyof DateParts)) {
              const key = part.type as keyof DateParts;
              partLookup[key] = part.value;
            }
          });
          return `${partLookup.year}-${partLookup.month}-${partLookup.day} ${partLookup.hour}:${partLookup.minute}`;
        } catch {
          return dateStr;
        }
      };

      sortedMismatches.forEach((m) => {
        const monoId = `<span class="font-mono">${m.id}</span>`;
        const HOURS_PER_DAY = 24;
        const diffDays = m.diffHours / HOURS_PER_DAY;
        const DIGIT_THRESHOLD = 10;
        const diffVal = diffDays.toFixed(ONE);
        const paddedDiffVal = diffDays < DIGIT_THRESHOLD ? `&nbsp;${diffVal}` : diffVal;
        const diff = `<span class="font-mono">${paddedDiffVal} days</span>`;
        const dates = `(${formatDate(m.videoDate)} vs ${formatDate(m.scanDate)})`;
        mismatchLines.push(`${monoId} - ${diff} ${dates}`);
      });

      sections.push({ level: 3, title: `Environment: ${stats.env}`, type: "header" });
      sections.push({
        data: mismatchLines,
        level: 4,
        title: "Mismatches",
        type: "list"
      });
    });
  }

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
            const regex = /^(.+) download failed \((.+)\)$/;
            const match = regex.exec(reason);
            if (match !== null) {
              const [, type = "", status = ""] = match;
              if (!groupedFailures.has(status)) {
                groupedFailures.set(status, []);
              }
              groupedFailures.get(status)?.push(type);
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
