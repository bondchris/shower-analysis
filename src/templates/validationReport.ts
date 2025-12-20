import { sumBy } from "lodash";

import { EnvStats } from "../models/envStats";
import * as ChartUtils from "../utils/chartUtils";
import { ChartConfiguration } from "../utils/chartUtils";
import { logger } from "../utils/logger";
import { ReportData, ReportSection } from "../models/report";

export interface ValidationCharts {
  propertyPresence?: ChartConfiguration;
  scanVolume?: ChartConfiguration;
  success?: ChartConfiguration;
  errors?: ChartConfiguration;
  warnings?: ChartConfiguration;
}

function generateValidationCharts(allStats: EnvStats[]): ValidationCharts {
  const charts: ValidationCharts = {};
  const INITIAL_ERROR_COUNT = 0;
  const MIN_DATA_POINTS = 0;
  const PAGE_VIEWPORT_WIDTH = 794;
  const PAGE_MARGIN = 40;
  const DOUBLE = 2;
  const pageMarginDouble = PAGE_MARGIN * DOUBLE;
  const PAGE_CONTENT_WIDTH = PAGE_VIEWPORT_WIDTH - pageMarginDouble; // A4 width (~794px) minus margins
  const PROPERTY_WIDTH_RATIO = 0.9;
  const CHART_BAR_HEIGHT = 15;
  const MIN_CHART_HEIGHT = 300;
  const HEADER_FOOTER_SPACE = 60;

  const processedTotal = sumBy(allStats, "processed");

  // Aggregate counts across all environments for property chart
  const consolidatedCounts: Record<string, number> = {};
  allStats.forEach((stats) => {
    Object.entries(stats.propertyCounts).forEach(([key, count]) => {
      consolidatedCounts[key] = (consolidatedCounts[key] ?? INITIAL_ERROR_COUNT) + count;
    });
  });

  // Sort by count descending
  const sortedProps = Object.entries(consolidatedCounts)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count > INITIAL_ERROR_COUNT);

  if (sortedProps.length > MIN_DATA_POINTS) {
    try {
      const chartLabels = sortedProps.map(([k]) => k);
      const chartData = sortedProps.map(([, v]) => v);

      const contentHeight = chartLabels.length * CHART_BAR_HEIGHT;
      const dynamicHeight = Math.max(MIN_CHART_HEIGHT, contentHeight + HEADER_FOOTER_SPACE);

      const propertyChartWidth = Math.round(PAGE_CONTENT_WIDTH * PROPERTY_WIDTH_RATIO);
      charts.propertyPresence = ChartUtils.getBarChartConfig(chartLabels, chartData, {
        height: dynamicHeight,
        horizontal: true,
        title: "",
        totalForPercentages: processedTotal,
        width: propertyChartWidth
      });
    } catch (e: unknown) {
      // logger.error not available here, assume caller handles issues or silent fail
      logger.error(`Failed to generate property chart: ${String(e)}`);
    }
  }

  // Generate Graphs
  const allDates = new Set<string>();
  allStats.forEach((s) => {
    Object.keys(s.errorsByDate).forEach((d) => {
      allDates.add(d);
    });
    Object.keys(s.warningsByDate).forEach((d) => {
      allDates.add(d);
    });
    Object.keys(s.totalScansByDate).forEach((d) => {
      allDates.add(d);
    });
  });

  if (allDates.size > MIN_DATA_POINTS) {
    const sortedDates = Array.from(allDates).sort();
    const DEFAULT_SCANS_COUNT = 0;
    const DAY_OFFSET = 1;
    const DECIMAL_PLACES_AVG = 1;
    const CHART_BORDER_WIDTH_NORMAL = 1.5;

    // Calculate Volume-based Sort Order (Largest -> Smallest)
    const envTotalVolume = new Map<string, number>();
    allStats.forEach((stats) => {
      let total = 0;
      sortedDates.forEach((date) => {
        total += stats.totalScansByDate[date] ?? DEFAULT_SCANS_COUNT;
      });
      envTotalVolume.set(stats.name, total);
    });

    const orderedStats = [...allStats].sort(
      (a, b) =>
        (envTotalVolume.get(a.name) ?? DEFAULT_SCANS_COUNT) - (envTotalVolume.get(b.name) ?? DEFAULT_SCANS_COUNT)
    );

    // Environment colors (Shared across all charts)
    const envColors: Record<string, string> = {
      "Bond Demo": "rgba(127, 24, 127, 1)",
      "Bond Production": "rgba(0, 100, 0, 1)",
      "Lowe's Production": "rgba(1, 33, 105, 1)",
      "Lowe's Staging": "rgba(0, 117, 206, 1)"
    };
    const DEFAULT_COLOR = "rgba(0, 0, 0, 1)";

    // --- 1. Aggregated Scan Volume Chart ---
    // Calculate data first
    const aggregatedScansByDate: Record<string, number> = {};
    allStats.forEach((stats) => {
      Object.entries(stats.totalScansByDate).forEach(([date, count]) => {
        aggregatedScansByDate[date] = (aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT) + count;
      });
    });

    let cumulative = 0;
    const cumulativeData: number[] = [];
    const dailyData: number[] = []; // Cumulative Average

    sortedDates.forEach((date, index) => {
      const dailyCount = aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT;
      cumulative += dailyCount;
      cumulativeData.push(cumulative);

      const daysPassed = index + DAY_OFFSET;

      const average = Number((cumulative / daysPassed).toFixed(DECIMAL_PLACES_AVG));
      dailyData.push(average);
    });

    const BASE_LAYER_ORDER = 100;

    const volumeDatasets: ChartUtils.MixedChartDataset[] = [
      {
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        borderColor: "black",
        borderWidth: 2,
        data: cumulativeData,
        fill: true,
        label: "Total",
        order: 200, // Ensure Total is always at the Bottom/Back (High Order = Back)
        type: "line",
        yAxisID: "y"
      }
    ];

    // Add individual environment lines
    // Push in Reverse Order (Large -> Small) so Large draws First (Back) and Small draws Last (Front)
    // Use consistent order for all charts (Largest Volume -> Smallest Volume)
    const descStats = [...orderedStats].reverse();

    descStats.forEach((stats, i) => {
      let envCumulative = 0;
      const envData: number[] = [];
      sortedDates.forEach((date) => {
        const dailyCount = stats.totalScansByDate[date] ?? INITIAL_ERROR_COUNT;
        envCumulative += dailyCount;
        envData.push(envCumulative);
      });

      const borderColor = envColors[stats.name] ?? DEFAULT_COLOR;
      const backgroundColor = borderColor;

      volumeDatasets.push({
        backgroundColor,
        borderColor,
        borderWidth: 1.5,
        data: envData,
        fill: true,
        label: stats.name,
        order: BASE_LAYER_ORDER - i, // Large (i=0) -> 100 (Back). Small (i=N) -> 100-N (Front).
        type: "line",
        yAxisID: "y"
      });
    });

    // Add Average line last
    volumeDatasets.push({
      borderColor: "rgba(255, 99, 132, 1)", // Red
      borderWidth: 1.5,
      data: dailyData,
      fill: false,
      label: "Avg/Day",
      order: 300, // Top/Front
      type: "line",
      yAxisID: "y1"
    });

    try {
      const SCAN_VOLUME_CHART_HEIGHT = 420;
      charts.scanVolume = ChartUtils.getMixedChartConfig(sortedDates, volumeDatasets, {
        height: SCAN_VOLUME_CHART_HEIGHT,
        title: "",
        yLabelLeft: "Total Scans (Cumulative)",
        yLabelRight: "Avg Scans / Day"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate aggregated volume chart: ${String(e)}`);
    }

    // --- 2. Scan Success Percentage Chart ---
    const successDatasets = descStats.map((s) => {
      const color = envColors[s.name] ?? DEFAULT_COLOR;
      const data = sortedDates.map((d) => {
        const PERCENTAGE_BASE = 100;
        const ZERO = 0;
        const total = s.totalScansByDate[d] ?? ZERO;
        if (total === ZERO) {
          return null;
        }
        const clean = s.cleanScansByDate[d] ?? ZERO;
        return Math.round((clean / total) * PERCENTAGE_BASE);
      });
      return {
        borderColor: color,
        borderWidth: CHART_BORDER_WIDTH_NORMAL,
        data,
        label: s.name
      };
    });

    try {
      charts.success = ChartUtils.getLineChartConfig(sortedDates, successDatasets, {
        title: "",
        yLabel: "Success %"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate success chart: ${String(e)}`);
    }

    // --- 3. Error Chart ---
    const errorDatasets = descStats.map((s) => {
      const color = envColors[s.name] ?? DEFAULT_COLOR;
      const data = sortedDates.map((d) => {
        const total = s.totalScansByDate[d] ?? INITIAL_ERROR_COUNT;
        if (total === INITIAL_ERROR_COUNT) {
          return null;
        }
        return s.errorsByDate[d] ?? INITIAL_ERROR_COUNT;
      });
      return {
        borderColor: color,
        borderWidth: 1.5,
        data,
        label: s.name
      };
    });

    try {
      charts.errors = ChartUtils.getLineChartConfig(sortedDates, errorDatasets, {
        title: "",
        yLabel: "Error Count"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate code error chart: ${String(e)}`);
    }

    // --- 4. Warning Chart ---
    const warningDatasets = descStats.map((s) => {
      const color = envColors[s.name] ?? DEFAULT_COLOR;
      const data = sortedDates.map((d) => {
        const total = s.totalScansByDate[d] ?? INITIAL_ERROR_COUNT;
        if (total === INITIAL_ERROR_COUNT) {
          return null;
        }
        return s.warningsByDate[d] ?? INITIAL_ERROR_COUNT;
      });
      return {
        borderColor: color,
        borderWidth: 1.5,
        data,
        label: s.name
      };
    });

    try {
      charts.warnings = ChartUtils.getLineChartConfig(sortedDates, warningDatasets, {
        title: "",
        yLabel: "Warning Count"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate warning chart: ${String(e)}`);
    }
  }

  return charts;
}

export function buildValidationReport(allStats: EnvStats[]): ReportData {
  // Generate charts internally
  const charts = generateValidationCharts(allStats);

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

  // Sort by Total Artifacts (Descending) to match Chart Legend Order
  const sortedStats = [...allStats].sort((a, b) => b.totalArtifacts - a.totalArtifacts);

  const totalProcessed = sumBy(allStats, "processed");
  const totalErrors = sumBy(allStats, "artifactsWithIssues");
  const totalWarnings = sumBy(allStats, "artifactsWithWarnings");

  const headers = ["", ...sortedStats.map((s) => s.name), "Total"];
  const tableData: string[][] = [];
  const rowClasses: Record<number, string> = {};

  // 1. Processed Row
  const processedRow = ["Processed Artifacts"];
  sortedStats.forEach((stat) => {
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
  sortedStats.forEach((stat) => {
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
      sortedStats.forEach((stat) => {
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
  sortedStats.forEach((stat) => {
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
      const displayKey = key === "projectId" ? "Missing projectId" : key; // clarify warning label
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
      title: "Upload Failures Over Time",
      type: "chart"
    });
  }

  if (charts.warnings) {
    sections.push({
      data: charts.warnings,
      title: "Missing Project IDs Over Time",
      type: "chart"
    });
  }

  return {
    sections,
    title: "Validation Report"
  };
}
