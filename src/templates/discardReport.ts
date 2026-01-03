import React from "react";
import { BadScanHistoryEntry, DateMismatch, DiscardReportInput, DiscardedArtifact } from "../models/discardStats";
import { LineChartConfig } from "../models/chart/lineChartConfig";
import { LineChartDataset } from "../models/chart/lineChartDataset";
import { ReportData, ReportSection } from "../models/report";
import { getBarChartConfig } from "../utils/chart/configBuilders";
import { getGlobalDateRange } from "../utils/chart/dateRange";
import { LineChart } from "./components/charts/LineChart";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSummarySection(input: DiscardReportInput): ReportSection {
  const defaultCount = 0;
  const incrementCount = 1;
  const envs = Object.keys(input.countsByEnv).sort();
  const headers = ["", ...envs, "Total"];
  const tableData: string[][] = [];

  // Helper to build a row
  const buildRow = (label: string, getValue: (env: string) => number): string[] => {
    const row = [label];
    let total = defaultCount;
    envs.forEach((env) => {
      const val = getValue(env);
      row.push(val.toString());
      total += val;
    });
    row.push(total.toString());
    return row;
  };

  // Artifacts Processed
  tableData.push(buildRow("Artifacts Processed", (env) => input.countsByEnv[env]?.processed ?? defaultCount));

  // Valid header
  tableData.push(
    buildRow(
      "Valid",
      (env) =>
        (input.countsByEnv[env]?.validCached ?? defaultCount) + (input.countsByEnv[env]?.validNew ?? defaultCount)
    )
  );
  // Valid - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.validCached ?? defaultCount));
  // Valid - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.validNew ?? defaultCount));

  // Video < X s header
  const videoTooShortLabel = `Video < ${input.minDuration.toString()} s`;
  tableData.push(
    buildRow(
      videoTooShortLabel,
      (env) =>
        (input.countsByEnv[env]?.tooShortCached ?? defaultCount) + (input.countsByEnv[env]?.tooShortNew ?? defaultCount)
    )
  );
  // Video < X s - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.tooShortCached ?? defaultCount));
  // Video < X s - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.tooShortNew ?? defaultCount));

  // Not a Bathroom header
  tableData.push(
    buildRow(
      "Not a Bathroom",
      (env) =>
        (input.countsByEnv[env]?.notBathroomCached ?? defaultCount) +
        (input.countsByEnv[env]?.notBathroomNew ?? defaultCount)
    )
  );
  // Not a Bathroom - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.notBathroomCached ?? defaultCount));
  // Not a Bathroom - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.notBathroomNew ?? defaultCount));

  // Duplicate Video header
  tableData.push(
    buildRow(
      "Duplicate Video",
      (env) =>
        (input.countsByEnv[env]?.duplicateCached ?? defaultCount) +
        (input.countsByEnv[env]?.duplicateNew ?? defaultCount)
    )
  );
  // Duplicate Video - Cached
  tableData.push(buildRow("    Cached", (env) => input.countsByEnv[env]?.duplicateCached ?? defaultCount));
  // Duplicate Video - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.duplicateNew ?? defaultCount));

  // Date Mismatch rows (counts by environment from dateMismatches array)
  const totalMismatchByEnv: Record<string, number> = {};
  const newMismatchByEnv: Record<string, number> = {};
  input.dateMismatches.forEach((m) => {
    totalMismatchByEnv[m.environment] = (totalMismatchByEnv[m.environment] ?? defaultCount) + incrementCount;
    if (m.isNew === true) {
      newMismatchByEnv[m.environment] = (newMismatchByEnv[m.environment] ?? defaultCount) + incrementCount;
    }
  });

  tableData.push(buildRow("Date Mismatch", (env) => totalMismatchByEnv[env] ?? defaultCount));
  tableData.push(buildRow("    New", (env) => newMismatchByEnv[env] ?? defaultCount));

  const rowClassArray = [
    "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact", // 0: Artifacts Processed
    "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // 1: Valid
    "bg-green-50 text-green-800 print:print-color-adjust-exact", // 2: Valid - Cached
    "bg-green-50 text-green-800 print:print-color-adjust-exact", // 3: Valid - New
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // 4: Video < X s
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 5: Video < X s - Cached
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 6: Video < X s - New
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // 7: Not a Bathroom
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 8: Not a Bathroom - Cached
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 9: Not a Bathroom - New
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // 10: Duplicate Video
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 11: Duplicate Video - Cached
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 12: Duplicate Video - New
    "bg-orange-100 font-semibold text-orange-800 print:print-color-adjust-exact", // 13: Date Mismatch
    "bg-orange-50 text-orange-800 print:print-color-adjust-exact" // 14: Date Mismatch - New
  ];
  const rowClasses: Record<number, string> = Object.fromEntries(
    rowClassArray.map((className, index) => [index, className])
  ) as Record<number, string>;

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

  const stageDisplayName = (stage: string): string => {
    if (stage === "clean") {
      return "Clean";
    }
    if (stage === "duplicates") {
      return "Duplicates";
    }
    return "Filter";
  };

  const rows = sortedEntries.map((entry) => [
    `<span class="font-mono">${escapeHtml(entry.id)}</span>`,
    escapeHtml(entry.environment),
    escapeHtml(entry.reason),
    stageDisplayName(entry.stage)
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

function buildShortVideosOverTimeSection(history: BadScanHistoryEntry[], minDuration: number): ReportSection | null {
  return buildOverTimeChart(history, isTooShortEntry, `Short Videos (< ${minDuration.toString()} s) Over Time`);
}

function buildNonBathroomOverTimeSection(history: BadScanHistoryEntry[]): ReportSection | null {
  return buildOverTimeChart(history, isNotBathroomEntry, "Non-Bathroom Videos Over Time");
}

function isDuplicateEntry(entry: BadScanHistoryEntry): boolean {
  return entry.reason.includes("Duplicate video");
}

function buildDuplicatesOverTimeSection(history: BadScanHistoryEntry[]): ReportSection | null {
  return buildOverTimeChart(history, isDuplicateEntry, "Duplicate Videos Over Time");
}

function buildDuplicatesDetailSection(badScanHistory: BadScanHistoryEntry[]): ReportSection[] {
  const sections: ReportSection[] = [];
  const duplicatePrefix = "Duplicate video";

  const duplicateEntries = badScanHistory.filter((entry) => entry.reason.startsWith(duplicatePrefix));
  const noDuplicates = 0;

  if (duplicateEntries.length === noDuplicates) {
    return sections;
  }

  sections.push({ title: "Duplicate Videos", type: "header" });
  sections.push({
    data: "Videos with identical content (same hash) across the dataset.",
    type: "text"
  });

  // Extract hash from reason and group by hash
  const hashPattern = /\(hash ([a-f0-9]+)\)/;
  const hashCaptureGroup = 1;
  const duplicatesByHash = new Map<string, { artifactId: string; environment: string }[]>();

  duplicateEntries.forEach((entry) => {
    const hashMatch = hashPattern.exec(entry.reason);
    const hash = hashMatch !== null ? (hashMatch[hashCaptureGroup] ?? "unknown") : "unknown";

    const hashGroup = duplicatesByHash.get(hash) ?? [];
    if (!hashGroup.some((a) => a.artifactId === entry.id)) {
      hashGroup.push({ artifactId: entry.id, environment: entry.environment });
    }
    duplicatesByHash.set(hash, hashGroup);
  });

  // Sort hashes by number of artifacts (descending)
  const arrayValueIndex = 1;
  const sortedHashes = Array.from(duplicatesByHash.entries()).sort(
    (a, b) => b[arrayValueIndex].length - a[arrayValueIndex].length
  );

  const duplicateLines: string[] = [];

  sortedHashes.forEach(([hash, artifacts]) => {
    const monoHash = `<span class="font-mono">${escapeHtml(hash)}</span>`;

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
        const monoId = `<span class="font-mono">${escapeHtml(artifact.artifactId)}</span>`;
        return `<li>${monoId} (${escapeHtml(artifact.environment)})</li>`;
      })
      .join("");

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

  return sections;
}

function buildShortVideosDetailSection(badScanHistory: BadScanHistoryEntry[]): ReportSection[] {
  const sections: ReportSection[] = [];
  const shortVideoPrefix = "Video too short";

  const shortVideos = badScanHistory.filter((entry) => entry.reason.startsWith(shortVideoPrefix));
  const noShortVideos = 0;

  if (shortVideos.length === noShortVideos) {
    return sections;
  }

  sections.push({ title: "Short Videos", type: "header" });
  sections.push({
    data: "Videos shorter than the minimum duration threshold.",
    type: "text"
  });

  const envSet = new Set(badScanHistory.map((entry) => entry.environment));
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envShortVideos = shortVideos.filter((entry) => entry.environment === env);
    if (envShortVideos.length === noShortVideos) {
      return;
    }

    // Extract duration from reason and sort by duration
    const durationPattern = /\(([\d.]+)s\)/;
    const durationCaptureGroup = 1;
    const decimalPlaces = 2;
    const withDuration = envShortVideos.map((entry) => {
      const match = durationPattern.exec(entry.reason);
      const durationStr = match !== null ? (match[durationCaptureGroup] ?? "0") : "0";
      const duration = parseFloat(durationStr);
      return { ...entry, duration };
    });
    const sortedVideos = withDuration.sort((a, b) => a.duration - b.duration);

    const videoLines: string[] = [];
    sortedVideos.forEach((entry) => {
      const monoId = `<span class="font-mono">${escapeHtml(entry.id)}</span>`;
      const durationStr = `<span class="font-mono">${entry.duration.toFixed(decimalPlaces)}s</span>`;
      videoLines.push(`${monoId} - ${durationStr}`);
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: videoLines,
      level: 4,
      title: "Short Videos",
      type: "list"
    });
  });

  return sections;
}

function buildNonBathroomDetailSection(badScanHistory: BadScanHistoryEntry[]): ReportSection[] {
  const sections: ReportSection[] = [];
  const nonBathroomPrefix = "Not a bathroom";

  const nonBathrooms = badScanHistory.filter((entry) => entry.reason.startsWith(nonBathroomPrefix));
  const noNonBathrooms = 0;

  if (nonBathrooms.length === noNonBathrooms) {
    return sections;
  }

  sections.push({ title: "Non-Bathroom Videos", type: "header" });
  sections.push({
    data: "Videos identified as not showing a bathroom.",
    type: "text"
  });

  const envSet = new Set(badScanHistory.map((entry) => entry.environment));
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envNonBathrooms = nonBathrooms.filter((entry) => entry.environment === env);
    if (envNonBathrooms.length === noNonBathrooms) {
      return;
    }

    // Sort by ID for consistent ordering
    const sortedVideos = [...envNonBathrooms].sort((a, b) => a.id.localeCompare(b.id));

    const videoLines: string[] = [];
    const modelPattern = /\(Gemini ([^)]+)\)/;
    const modelCaptureGroup = 1;
    sortedVideos.forEach((entry) => {
      const monoId = `<span class="font-mono">${escapeHtml(entry.id)}</span>`;
      // Extract model name if present
      const modelMatch = modelPattern.exec(entry.reason);
      const modelName = modelMatch !== null ? (modelMatch[modelCaptureGroup] ?? "") : "";
      const modelInfo = modelName !== "" ? ` (${modelName})` : "";
      videoLines.push(`${monoId}${modelInfo}`);
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: videoLines,
      level: 4,
      title: "Non-Bathrooms",
      type: "list"
    });
  });

  return sections;
}

function formatMismatchDate(dateStr: string): string {
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
}

function buildMismatchOverTimeSection(mismatches: DateMismatch[]): ReportSection | null {
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

function buildMismatchDetailSections(mismatches: DateMismatch[], environments: string[] = []): ReportSection[] {
  const sections: ReportSection[] = [];
  const noMismatches = 0;

  if (mismatches.length === noMismatches) {
    return sections;
  }

  sections.push({ title: "Date Mismatches (> 1 Day)", type: "header" });
  sections.push({
    data: "Format: ID - [Days] (Video Date vs API Date in ET)",
    type: "text"
  });

  const envSet = new Set([...mismatches.map((m) => m.environment), ...environments]);
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envMismatches = mismatches.filter((m) => m.environment === env);
    if (envMismatches.length === noMismatches) {
      return;
    }

    const sortedMismatches = [...envMismatches].sort((a, b) => b.diffHours - a.diffHours);
    const mismatchLines: string[] = [];
    const hoursPerDay = 24;
    const digitThreshold = 10;
    const decimalPlaces = 1;

    sortedMismatches.forEach((m) => {
      const monoId = `<span class="font-mono">${escapeHtml(m.id)}</span>`;
      const diffDays = m.diffHours / hoursPerDay;
      const diffVal = diffDays.toFixed(decimalPlaces);
      const paddedDiffVal = diffDays < digitThreshold ? `&nbsp;${diffVal}` : diffVal;
      const diff = `<span class="font-mono">${paddedDiffVal} days</span>`;
      const dates = `(${formatMismatchDate(m.videoDate)} vs ${formatMismatchDate(m.scanDate)})`;
      mismatchLines.push(`${monoId} - ${diff} ${dates}`);
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: mismatchLines,
      level: 4,
      title: "Mismatches",
      type: "list"
    });
  });

  return sections;
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

  const duplicatesOverTimeSection = buildDuplicatesOverTimeSection(input.badScanHistory);
  if (duplicatesOverTimeSection !== null) {
    sections.push(duplicatesOverTimeSection);
  }

  const mismatchOverTimeSection = buildMismatchOverTimeSection(input.dateMismatches);
  if (mismatchOverTimeSection !== null) {
    sections.push(mismatchOverTimeSection);
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

  const shortVideosDetailSections = buildShortVideosDetailSection(input.badScanHistory);
  sections.push(...shortVideosDetailSections);

  const nonBathroomDetailSections = buildNonBathroomDetailSection(input.badScanHistory);
  sections.push(...nonBathroomDetailSections);

  const duplicatesDetailSections = buildDuplicatesDetailSection(input.badScanHistory);
  sections.push(...duplicatesDetailSections);

  const mismatchDetailSections = buildMismatchDetailSections(input.dateMismatches, Object.keys(input.countsByEnv));
  sections.push(...mismatchDetailSections);

  if (input.dryRun) {
    sections.push({
      data: "Dry run enabled: artifacts were not moved, but counts reflect what would have changed.",
      title: "Dry Run",
      type: "text"
    });
  }

  return {
    sections,
    title: "Discard Report"
  };
}
