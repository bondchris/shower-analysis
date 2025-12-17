import { ChartConfiguration } from "chart.js";
import { sumBy } from "lodash";

import { EnvStats } from "../models/envStats";
import { ReportData, ReportSection } from "../utils/reportGenerator";

export interface ValidationCharts {
  propertyPresence?: ChartConfiguration;
  scanVolume?: ChartConfiguration;
  success?: ChartConfiguration;
  errors?: ChartConfiguration;
  warnings?: ChartConfiguration;
}

export function buildValidationReport(allStats: EnvStats[], charts: ValidationCharts): ReportData {
  const INITIAL_ERROR_COUNT = 0;
  const ZERO = 0;
  const PERCENTAGE_BASE = 100;
  const NO_STATS = 0;
  const DECIMAL_PLACES = 1;
  const LAST_ELEMENT_OFFSET = 1;

  if (allStats.length === NO_STATS) {
    return {
      sections: [{ data: "No environments / no data.", type: "text" }],
      title: "Validation Report"
    };
  }

  const sections: ReportSection[] = [];

  // Standardized Table Logic (Exploded Rows for Errors & Warnings)
  // Columns: [Label, ...Environment Names, All]
  const totalProcessed = sumBy(allStats, "processed");
  const totalErrors = sumBy(allStats, "artifactsWithIssues");
  const totalWarnings = sumBy(allStats, "artifactsWithWarnings");

  const headers = ["", ...allStats.map((s) => s.name), "Total"];
  const tableData: string[][] = [];
  const rowClasses: Record<number, string> = {};

  // 1. Processed Row
  const processedRow = ["Processed Artifacts"];
  allStats.forEach((stat) => {
    const total = stat.totalArtifacts; // Use stat.totalArtifacts as the total for this environment
    if (total > ZERO) {
      const percentage = ((stat.processed / total) * PERCENTAGE_BASE).toFixed(DECIMAL_PLACES);
      // De-emphasize the percentage visually
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

  // 2. Total Errors Row
  const totalErrorsRow = ["Total Errors"];
  allStats.forEach((stat) => {
    totalErrorsRow.push(String(stat.artifactsWithIssues));
  });
  totalErrorsRow.push(`<span style="font-weight:normal;color:#6b7280">${totalErrors.toString()}</span>`);
  tableData.push(totalErrorsRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact";

  // 3. Error Detail Rows
  // Collect all unique error keys across all environments
  const allErrorKeys = new Set<string>();
  allStats.forEach((stat) => {
    Object.keys(stat.missingCounts).forEach((k) => allErrorKeys.add(k));
  });
  Array.from(allErrorKeys)
    .sort()
    .forEach((key) => {
      const row = [key]; // e.g. "Missing rawScan"
      let rowTotal = 0;
      allStats.forEach((stat) => {
        const count = stat.missingCounts[key] ?? INITIAL_ERROR_COUNT;
        row.push(String(count));
        rowTotal += count;
      });
      row.push(`<span style="font-weight:normal;color:#6b7280">${rowTotal.toString()}</span>`);
      tableData.push(row);
      rowClasses[tableData.length - LAST_ELEMENT_OFFSET] = "bg-red-50 text-red-800 print:print-color-adjust-exact";
    });

  // 4. Total Warnings Row
  const totalWarningsRow = ["Total Warnings"];
  allStats.forEach((stat) => {
    totalWarningsRow.push(String(stat.artifactsWithWarnings));
  });
  totalWarningsRow.push(`<span style="font-weight:normal;color:#6b7280">${totalWarnings.toString()}</span>`);
  tableData.push(totalWarningsRow);
  rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
    "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact";

  // 5. Warning Detail Rows
  const allWarningKeys = new Set<string>();
  allStats.forEach((stat) => {
    Object.keys(stat.warningCounts).forEach((k) => allWarningKeys.add(k));
  });
  Array.from(allWarningKeys)
    .sort()
    .forEach((key) => {
      const row = [key]; // e.g. "Missing ProjectId"
      let rowTotal = 0;
      allStats.forEach((stat) => {
        const count = stat.warningCounts[key] ?? INITIAL_ERROR_COUNT;
        row.push(String(count));
        rowTotal += count;
      });
      row.push(`<span style="font-weight:normal;color:#6b7280">${rowTotal.toString()}</span>`);
      tableData.push(row);
      rowClasses[tableData.length - LAST_ELEMENT_OFFSET] =
        "bg-yellow-50 text-yellow-800 print:print-color-adjust-exact";
    });

  sections.push({
    data: tableData,
    options: { headers, rowClasses },
    type: "table"
  });

  // Add Chart Sections if present
  if (charts.propertyPresence) {
    sections.push({
      data: charts.propertyPresence,
      title: "Property Presence",
      type: "chart"
    });
  }

  if (charts.scanVolume) {
    sections.push({
      data: charts.scanVolume,
      title: "Scan Volume (All Environments)",
      type: "chart"
    });
  }

  if (charts.success) {
    sections.push({
      data: charts.success,
      title: "Scan Success Percentage Over Time",
      type: "chart"
    });
  }

  if (charts.errors) {
    sections.push({
      data: charts.errors,
      title: "Errors Over Time",
      type: "chart"
    });
  }

  if (charts.warnings) {
    sections.push({
      data: charts.warnings,
      title: "Warnings Over Time",
      type: "chart"
    });
  }

  return {
    sections,
    title: "Validation Report"
  };
}
