import React from "react";
import { BadScanHistoryEntry, DiscardReportInput, DiscardedArtifact } from "../models/discardStats";
import { LineChartConfig } from "../models/chart/lineChartConfig";
import { LineChartDataset } from "../models/chart/lineChartDataset";
import { ReportData, ReportSection } from "../models/report";
import { getBarChartConfig } from "../utils/chart/configBuilders";
import { getGlobalDateRange } from "../utils/chart/dateRange";
import { LineChart } from "./components/charts/LineChart";

const ZERO = 0;
const ONE = 1;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSummarySection(input: DiscardReportInput): ReportSection {
  const envs = Object.keys(input.countsByEnv).sort();
  const headers = ["", ...envs, "Total"];
  const tableData: string[][] = [];

  // Helper to build a row
  const buildRow = (label: string, getValue: (env: string) => number): string[] => {
    const row = [label];
    let total = ZERO;
    envs.forEach((env) => {
      const val = getValue(env);
      row.push(val.toString());
      total += val;
    });
    row.push(total.toString());
    return row;
  };

  // Artifacts Processed
  tableData.push(buildRow("Artifacts Processed", (env) => input.countsByEnv[env]?.processed ?? ZERO));

  // Valid header
  tableData.push(
    buildRow(
      "Valid",
      (env) => (input.countsByEnv[env]?.validCached ?? ZERO) + (input.countsByEnv[env]?.validNew ?? ZERO)
    )
  );
  // Valid - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.validCached ?? ZERO));
  // Valid - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.validNew ?? ZERO));

  // Video < X s header
  const videoTooShortLabel = `Video < ${input.minDuration.toString()} s`;
  tableData.push(
    buildRow(
      videoTooShortLabel,
      (env) => (input.countsByEnv[env]?.tooShortCached ?? ZERO) + (input.countsByEnv[env]?.tooShortNew ?? ZERO)
    )
  );
  // Video < X s - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.tooShortCached ?? ZERO));
  // Video < X s - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.tooShortNew ?? ZERO));

  // Not a Bathroom header
  tableData.push(
    buildRow(
      "Not a Bathroom",
      (env) => (input.countsByEnv[env]?.notBathroomCached ?? ZERO) + (input.countsByEnv[env]?.notBathroomNew ?? ZERO)
    )
  );
  // Not a Bathroom - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.notBathroomCached ?? ZERO));
  // Not a Bathroom - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.notBathroomNew ?? ZERO));

  const rowClasses: Record<number, string> = {
    0: "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact", // Artifacts Processed
    1: "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // Valid
    2: "bg-green-50 text-green-800 print:print-color-adjust-exact", // Valid - Cached
    3: "bg-green-50 text-green-800 print:print-color-adjust-exact", // Valid - New
    4: "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // Video < X s
    5: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Video < X s - Cached
    6: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Video < X s - New
    7: "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // Not a Bathroom
    8: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Not a Bathroom - Cached
    9: "bg-red-50 text-red-800 print:print-color-adjust-exact" // Not a Bathroom - New
  };

  return {
    data: tableData,
    options: { headers, rowClasses },
    title: "Processing Summary",
    type: "table"
  };
}

function buildDistributionSection(newBadScans: DiscardedArtifact[], total: number): ReportSection | null {
  const emptyCount = 0;
  const incrementCount = 1;
  if (newBadScans.length === emptyCount) {
    return null;
  }

  const reasonCounts = new Map<string, number>();
  const environmentCounts = new Map<string, number>();

  newBadScans.forEach((entry) => {
    const currentReasonCount = reasonCounts.get(entry.reason) ?? emptyCount;
    const currentEnvironmentCount = environmentCounts.get(entry.environment) ?? emptyCount;
    reasonCounts.set(entry.reason, currentReasonCount + incrementCount);
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
    totalForPercentages: total
  });

  const environmentChart = getBarChartConfig(environmentLabels, environmentData, {
    showCount: true,
    totalForPercentages: total
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

function buildNewBadScansSection(newBadScans: DiscardedArtifact[]): ReportSection | null {
  const emptyCount = 0;
  if (newBadScans.length === emptyCount) {
    return null;
  }

  const sortedEntries = [...newBadScans].sort((a, b) => {
    if (a.stage !== b.stage) {
      return a.stage.localeCompare(b.stage);
    }
    if (a.environment !== b.environment) {
      return a.environment.localeCompare(b.environment);
    }
    return a.id.localeCompare(b.id);
  });

  const rows = sortedEntries.map((entry) => [
    `<span class="font-mono">${escapeHtml(entry.id)}</span>`,
    escapeHtml(entry.environment),
    escapeHtml(entry.reason),
    entry.stage === "clean" ? "Clean" : "Filter"
  ]);

  return {
    data: rows,
    options: { headers: ["Artifact ID", "Environment", "Reason", "Stage"] },
    title: "New Bad Scans",
    type: "table"
  };
}

function buildFailedMovesSection(failedIds: string[]): ReportSection | null {
  const emptyCount = 0;
  if (failedIds.length === emptyCount) {
    return null;
  }

  const listItems = failedIds.map((id) => `<span class="font-mono">${escapeHtml(id)}</span>`);
  return {
    data: listItems,
    title: "Failed Moves (Clean Stage)",
    type: "list"
  };
}

function isTooShortEntry(entry: BadScanHistoryEntry): boolean {
  return entry.reason.includes("Video too short") || entry.reason.includes("duration");
}

function isNotBathroomEntry(entry: BadScanHistoryEntry): boolean {
  return entry.reason.includes("Not a bathroom");
}

function buildOverTimeChart(
  history: BadScanHistoryEntry[],
  filterFn: (entry: BadScanHistoryEntry) => boolean,
  title: string
): ReportSection | null {
  const minDatesForChart = 2;
  const filteredHistory = history.filter(filterFn);

  if (filteredHistory.length === ZERO) {
    return null;
  }

  // Aggregate by date (YYYY-MM-DD) and environment
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
    dateData[entry.environment] = (dateData[entry.environment] ?? ZERO) + ONE;
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
      const count = dateEnvCounts.get(date)?.[env] ?? ZERO;
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

function buildShortVideosOverTimeSection(history: BadScanHistoryEntry[], minDuration: number): ReportSection | null {
  return buildOverTimeChart(history, isTooShortEntry, `Short Videos (< ${minDuration.toString()} s) Over Time`);
}

function buildNonBathroomOverTimeSection(history: BadScanHistoryEntry[]): ReportSection | null {
  return buildOverTimeChart(history, isNotBathroomEntry, "Non-Bathroom Videos Over Time");
}

export function buildDiscardReport(input: DiscardReportInput): ReportData {
  const newBadScanCount = input.newBadScans.length;
  const sections: ReportSection[] = [];

  sections.push(buildSummarySection(input));

  // Over Time charts
  const shortVideosOverTimeSection = buildShortVideosOverTimeSection(input.badScanHistory, input.minDuration);
  if (shortVideosOverTimeSection !== null) {
    sections.push(shortVideosOverTimeSection);
  }

  const nonBathroomOverTimeSection = buildNonBathroomOverTimeSection(input.badScanHistory);
  if (nonBathroomOverTimeSection !== null) {
    sections.push(nonBathroomOverTimeSection);
  }

  const distributionSection = buildDistributionSection(input.newBadScans, newBadScanCount);
  if (distributionSection !== null) {
    sections.push(distributionSection);
  }

  const newBadScansSection = buildNewBadScansSection(input.newBadScans);
  if (newBadScansSection !== null) {
    sections.push(newBadScansSection);
  }

  const failedMovesSection = buildFailedMovesSection(input.cleanStats.failedDeletes);
  if (failedMovesSection !== null) {
    sections.push(failedMovesSection);
  }

  if (input.dryRun) {
    sections.push({
      data: "Dry run enabled: artifacts were not moved, but counts reflect what would have changed.",
      title: "Dry Run",
      type: "text"
    });
  }

  const discardedTotal = input.cleanStats.removedCount + input.cleanStats.quarantinedCount + input.filterStats.removed;
  const discardedCount = input.discardedOnDiskCount ?? discardedTotal;
  const subtitleParts = [
    `${input.artifactCount.toString()} artifacts scanned`,
    `${input.artifactsAfterClean.toString()} passed`,
    `${discardedCount.toString()} discarded`,
    `${newBadScanCount.toString()} new`
  ];

  if (input.dryRun) {
    subtitleParts.push("dry run");
  }

  return {
    sections,
    subtitle: subtitleParts.join(" • "),
    title: "Discard Report"
  };
}
