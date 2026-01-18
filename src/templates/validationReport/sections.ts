import { sumBy } from "lodash";

import { EnvStats } from "../../models/envStats";
import { ReportSection } from "../../models/report";
import { ValidationCharts } from "./charts";

export interface SummaryTableResult {
  section: ReportSection;
  sortedStats: EnvStats[];
}

export const buildSummaryTableSection = (allStats: EnvStats[]): SummaryTableResult => {
  const INITIAL_ERROR_COUNT = 0;
  const zeroArtifacts = 0;
  const PERCENTAGE_BASE = 100;
  const DECIMAL_PLACES = 1;
  const LAST_ELEMENT_OFFSET = 1;

  const sortedStats = [...allStats].sort((a, b) => b.totalArtifacts - a.totalArtifacts);
  const totalProcessed = sumBy(allStats, "processed");
  const totalErrors = sumBy(allStats, "artifactsWithIssues");
  const totalWarnings = sumBy(allStats, "artifactsWithWarnings");

  const headers = ["", ...sortedStats.map((s) => s.name), "Total"];
  const tableData: string[][] = [];
  const rowClasses: Record<number, string> = {};

  const processedRow = ["Processed Artifacts"];
  sortedStats.forEach((stat) => {
    const total = stat.totalArtifacts;
    if (total > zeroArtifacts) {
      const percentage = ((stat.processed / total) * PERCENTAGE_BASE).toFixed(DECIMAL_PLACES);
      processedRow.push(
        `${stat.processed.toString()} <span style="font-weight:normal;color:#6b7280;font-size:0.9em">(${percentage}%)</span>`
      );
    } else {
      processedRow.push("0 (0.0%)");
    }
  });
  processedRow.push(`<span style="font-weight:normal;color:#6b7280">${totalProcessed.toString()}</span>`);
  tableData.push(processedRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
    "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact";

  const totalErrorsRow = ["Total Errors"];
  sortedStats.forEach((stat) => {
    totalErrorsRow.push(String(stat.artifactsWithIssues));
  });
  totalErrorsRow.push(`<span style="font-weight:normal;color:#6b7280">${totalErrors.toString()}</span>`);
  tableData.push(totalErrorsRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact";

  const allErrorKeys = new Set<string>();
  allStats.forEach((stat) => {
    Object.keys(stat.missingCounts).forEach((k) => allErrorKeys.add(k));
  });
  Array.from(allErrorKeys)
    .sort()
    .forEach((key) => {
      const row = [key];
      let rowTotal = 0;
      sortedStats.forEach((stat) => {
        const count = stat.missingCounts[key] ?? INITIAL_ERROR_COUNT;
        row.push(String(count));
        rowTotal += count;
      });
      row.push(`<span style="font-weight:normal;color:#6b7280">${rowTotal.toString()}</span>`);
      tableData.push(row);
      rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-red-50 text-red-800 print:print-color-adjust-exact";
    });

  const totalWarningsRow = ["Total Warnings"];
  sortedStats.forEach((stat) => {
    totalWarningsRow.push(String(stat.artifactsWithWarnings));
  });
  totalWarningsRow.push(`<span style="font-weight:normal;color:#6b7280">${totalWarnings.toString()}</span>`);
  tableData.push(totalWarningsRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
    "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact";

  const allWarningKeys = new Set<string>();
  allStats.forEach((stat) => {
    Object.keys(stat.warningCounts).forEach((k) => allWarningKeys.add(k));
  });
  Array.from(allWarningKeys)
    .sort()
    .forEach((key) => {
      const displayKey = key === "projectId" ? "Missing projectId" : key;
      const row = [displayKey];
      let rowTotal = 0;
      sortedStats.forEach((stat) => {
        const count = stat.warningCounts[key] ?? INITIAL_ERROR_COUNT;
        row.push(String(count));
        rowTotal += count;
      });
      row.push(`<span style="font-weight:normal;color:#6b7280">${rowTotal.toString()}</span>`);
      tableData.push(row);
      rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
        "bg-yellow-50 text-yellow-800 print:print-color-adjust-exact";
    });

  return {
    section: {
      data: tableData,
      options: { headers, rowClasses },
      type: "table"
    },
    sortedStats
  };
};

export const buildChartSections = (charts: ValidationCharts): ReportSection[] => {
  const sections: ReportSection[] = [];
  if (charts.propertyPresence) {
    sections.push({ data: charts.propertyPresence, title: "Property Presence", type: "chart" });
  }
  if (charts.propertyPresenceOverTime) {
    sections.push({ data: charts.propertyPresenceOverTime, title: "Property Presence Over Time", type: "chart" });
  }
  if (charts.scanVolume) {
    sections.push({ data: charts.scanVolume, title: "Scan Volume (All Environments)", type: "chart" });
  }
  if (charts.success) {
    sections.push({ data: charts.success, title: "Scan Success Percentage Over Time", type: "chart" });
  }
  if (charts.errors) {
    sections.push({ data: charts.errors, title: "Upload Failures Over Time", type: "chart" });
  }
  if (charts.warnings) {
    sections.push({ data: charts.warnings, title: "Missing Project IDs Over Time", type: "chart" });
  }
  return sections;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatId = (value: string): string => `<span class="font-mono">${escapeHtml(value)}</span>`;

export const buildIdListSections = (sortedStats: EnvStats[]): ReportSection[] => {
  const NO_LIST_ITEMS = 0;
  const sections: ReportSection[] = [];

  const addIdListSection = (title: string, entriesByEnv: { env: string; lines: string[] }[], emptyMessage: string) => {
    sections.push({ title, type: "header" });
    if (entriesByEnv.length === NO_LIST_ITEMS) {
      sections.push({ data: emptyMessage, type: "text" });
      return;
    }

    entriesByEnv.forEach(({ env, lines }) => {
      if (lines.length === NO_LIST_ITEMS) {
        return;
      }
      const listTitle = `${title} - ${env}`;
      sections.push({ data: lines, level: 3, title: listTitle, type: "list" });
    });
  };

  const invalidScanDateEntries = sortedStats
    .map((stat) => ({
      env: stat.name,
      lines: stat.invalidScanDateDetails.map(({ id, scanDate }) => {
        const formattedId = formatId(id);
        const displayDate = scanDate === "" ? "(missing scanDate value)" : escapeHtml(scanDate);
        return `${formattedId} - ${displayDate}`;
      })
    }))
    .filter(({ lines }) => lines.length > NO_LIST_ITEMS);
  addIdListSection("Invalid scanDate", invalidScanDateEntries, "No artifacts have invalid scanDate values.");

  const missingProjectIdEntries = sortedStats
    .map((stat) => ({
      env: stat.name,
      lines: stat.missingProjectIdIds.map((id) => formatId(id))
    }))
    .filter(({ lines }) => lines.length > NO_LIST_ITEMS);
  addIdListSection("Missing projectId", missingProjectIdEntries, "No artifacts are missing projectId.");

  const missingRequiredEntries = sortedStats
    .map((stat) => ({
      env: stat.name,
      lines: stat.missingRequiredArtifacts.map(({ id, missingFields }) => {
        const formattedId = formatId(id);
        const missingList = missingFields.join(", ");
        return `${formattedId} - missing ${missingList}`;
      })
    }))
    .filter(({ lines }) => lines.length > NO_LIST_ITEMS);
  addIdListSection(
    "Missing Required Properties",
    missingRequiredEntries,
    "No artifacts are missing required properties."
  );

  return sections;
};
