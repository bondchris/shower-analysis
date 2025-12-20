import { SyncError, SyncStats } from "../models/syncStats";
import { SyncFailureDatabase } from "../utils/data/syncFailures";
import React from "react";
import { ReportData, ReportSection } from "../models/report";
import { LineChart } from "./components/charts/LineChart";
import { LineChartConfig } from "../utils/chartUtils";

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

        if (!errorHistory.has(month)) {
          errorHistory.set(month, {});
        }
        const monthData = errorHistory.get(month);
        if (monthData !== undefined) {
          monthData[stats.env] = (monthData[stats.env] ?? ZERO) + ONE;
        }
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
    const defaultColors = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

    const errorDatasets = sortedStats.map((stats, index) => {
      const data = sortedErrorMonths.map((month) => {
        const count = errorHistory.get(month)?.[stats.env] ?? ZERO;
        return count;
      });

      const borderColor = envColors[stats.env] ?? defaultColors[index % defaultColors.length] ?? "#000000";

      return {
        borderColor,
        data,
        label: stats.env
      };
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
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const DIGITS = 2;
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(DIGITS)).toString()} ${sizes[i] ?? ""}`;
  };

  const totalVideoSize = allStats.reduce((sum, s) => sum + s.videoSize, ZERO);
  const totalNewVideoSize = allStats.reduce((sum, s) => sum + s.newVideoSize, ZERO);
  const totalArDataSize = allStats.reduce((sum, s) => sum + s.arDataSize, ZERO);
  const totalNewArDataSize = allStats.reduce((sum, s) => sum + s.newArDataSize, ZERO);
  const totalRawScanSize = allStats.reduce((sum, s) => sum + s.rawScanSize, ZERO);
  const totalNewRawScanSize = allStats.reduce((sum, s) => sum + s.newRawScanSize, ZERO);

  // Calculate Averages Helper
  const safeAvg = (total: number, count: number) => {
    const ZERO_COUNT = 0;
    if (count === ZERO_COUNT) {
      return ZERO_COUNT;
    }
    return total / count;
  };

  const usageTableData: string[][] = [
    // Video
    [
      "Video (Total)",
      ...allStats.map((s) => formatBytes(s.videoSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalVideoSize)}</span>`
    ],
    [
      "Video (Avg)",
      ...allStats.map((s) => formatBytes(safeAvg(s.videoSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalVideoSize, totalFound))}</span>`
    ],
    [
      "Video (New)",
      ...allStats.map((s) => formatBytes(s.newVideoSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewVideoSize)}</span>`
    ],
    // ArData
    [
      "AR Data (Total)",
      ...allStats.map((s) => formatBytes(s.arDataSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalArDataSize)}</span>`
    ],
    [
      "AR Data (Avg)",
      ...allStats.map((s) => formatBytes(safeAvg(s.arDataSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalArDataSize, totalFound))}</span>`
    ],
    [
      "AR Data (New)",
      ...allStats.map((s) => formatBytes(s.newArDataSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewArDataSize)}</span>`
    ],
    // RawScan
    [
      "RawScan (Total)",
      ...allStats.map((s) => formatBytes(s.rawScanSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalRawScanSize)}</span>`
    ],
    [
      "RawScan (Avg)",
      ...allStats.map((s) => formatBytes(safeAvg(s.rawScanSize, s.found))),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(safeAvg(totalRawScanSize, totalFound))}</span>`
    ],
    [
      "RawScan (New)",
      ...allStats.map((s) => formatBytes(s.newRawScanSize)),
      `<span style="font-weight:normal;color:#6b7280">${formatBytes(totalNewRawScanSize)}</span>`
    ]
  ];

  const diskUsageRowClasses: Record<number, string> = {
    0: "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // Video Total
    1: "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // Video Avg
    2: "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // Video New
    3: "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // ArData Total
    4: "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // ArData Avg
    5: "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // ArData New
    6: "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // RawScan Total
    7: "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // RawScan Avg
    8: "bg-blue-50 text-blue-800 print:print-color-adjust-exact" // RawScan New
  };

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
    const defaultColors = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

    const datasets = descStats.map((stats, index) => {
      const data = sortedMonths.map((month) => {
        const history = stats.videoHistory[month];
        const ZERO_COUNT = 0;
        if (history && history.count > ZERO_COUNT) {
          return history.totalSize / history.count / BYTES_TO_MB; // MB
        }
        return null;
      });

      const borderColor = envColors[stats.env] ?? defaultColors[index % defaultColors.length] ?? "#000000";

      return {
        borderColor,
        data,
        label: stats.env
      };
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

          if (!mismatchHistory.has(month)) {
            mismatchHistory.set(month, {});
          }
          const monthData = mismatchHistory.get(month);
          if (monthData !== undefined) {
            monthData[stats.env] = (monthData[stats.env] ?? ZERO) + ONE;
          }
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
      const defaultColors = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];

      const mismatchDatasets = sortedStats.map((stats, index) => {
        const data = sortedMismatchMonths.map((month) => {
          const count = mismatchHistory.get(month)?.[stats.env] ?? ZERO;
          return count;
        });

        const borderColor = envColors[stats.env] ?? defaultColors[index % defaultColors.length] ?? "#000000";

        return {
          borderColor,
          data,
          label: stats.env
        };
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
          const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(d);
          const find = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
          return `${find("year")}-${find("month")}-${find("day")} ${find("hour")}:${find("minute")}`;
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
      if (stats.errors.length > ZERO_FAILURES) {
        // Classify errors
        const newErrors: SyncError[] = [];
        const knownErrors: SyncError[] = [];

        stats.errors.forEach((err) => {
          if (Object.prototype.hasOwnProperty.call(knownFailures, err.id)) {
            knownErrors.push(err);
          } else {
            newErrors.push(err);
          }
        });

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
                const MATCH_TYPE_INDEX = 1;
                const MATCH_STATUS_INDEX = 2;
                const type = match[MATCH_TYPE_INDEX];
                const status = match[MATCH_STATUS_INDEX];
                if (type !== undefined && status !== undefined) {
                  if (!groupedFailures.has(status)) {
                    groupedFailures.set(status, []);
                  }
                  groupedFailures.get(status)?.push(type);
                }
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
              const FIRST_ITEM = 0;
              const SECOND_ITEM = 1;

              if (sortedTypes.length === ONE_ITEM) {
                typeStr = sortedTypes[FIRST_ITEM] ?? "";
              } else if (sortedTypes.length === TWO_ITEMS) {
                typeStr = `${sortedTypes[FIRST_ITEM] ?? ""} and ${sortedTypes[SECOND_ITEM] ?? ""}`;
              } else {
                const last = sortedTypes.pop();
                typeStr = `${sortedTypes.join(", ")}, and ${String(last)}`;
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
              errorLines.push(`${monoId} - ${currentArtifactErrors[FIRST_ERROR] ?? ""}`);
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

        if (newErrors.length > ZERO_FAILURES || knownErrors.length > ZERO_FAILURES) {
          sections.push({ level: 3, title: `Environment: ${stats.env}`, type: "header" });
          renderErrorList(newErrors, "New Inaccessible");
          renderErrorList(knownErrors, "Known Inaccessible");
        }
      }
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
