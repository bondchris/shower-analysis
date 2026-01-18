import { sumBy } from "lodash";

import { CHART_DATE_RANGE } from "../../../config/config";
import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { MixedChartDataset } from "../../models/chart/mixedChartDataset";
import { EnvStats } from "../../models/envStats";
import { getBarChartConfig, getLineChartConfig, getMixedChartConfig } from "../../utils/chart/configBuilders";
import { logger } from "../../utils/logger";

export interface ValidationCharts {
  propertyPresence?: ChartConfiguration;
  propertyPresenceOverTime?: ChartConfiguration;
  scanVolume?: ChartConfiguration;
  success?: ChartConfiguration;
  errors?: ChartConfiguration;
  warnings?: ChartConfiguration;
}

export function generateValidationCharts(allStats: EnvStats[]): ValidationCharts {
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
      charts.propertyPresence = getBarChartConfig(chartLabels, chartData, {
        height: dynamicHeight,
        horizontal: true,
        title: "",
        totalForPercentages: processedTotal,
        width: propertyChartWidth
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate property chart: ${String(e)}`);
    }
  }

  // Generate Graphs
  // Collect dates that have actual activity (scans, errors, or warnings)
  // Filter to only include dates on or after the config start date
  // Include the config start date so chart starts at the configured date (only if there's data)
  const allDates = new Set<string>();
  allStats.forEach((s) => {
    Object.keys(s.errorsByDate).forEach((d) => allDates.add(d));
    Object.keys(s.warningsByDate).forEach((d) => allDates.add(d));
    Object.keys(s.totalScansByDate).forEach((d) => allDates.add(d));
  });
  const hasActivityDates = allDates.size > MIN_DATA_POINTS;
  if (hasActivityDates) {
    allDates.add(CHART_DATE_RANGE.startDate);
  }
  const sortedDates = Array.from(allDates)
    .filter((d) => d >= CHART_DATE_RANGE.startDate)
    .sort();

  if (sortedDates.length > MIN_DATA_POINTS) {
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

    const volumeDatasets: MixedChartDataset[] = [
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
      charts.scanVolume = getMixedChartConfig(sortedDates, volumeDatasets, {
        height: SCAN_VOLUME_CHART_HEIGHT,
        title: "",
        yLabelLeft: "Total Scans (Cumulative)",
        yLabelRight: "Avg Scans / Day"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate aggregated volume chart: ${String(e)}`);
    }

    // --- 2. Scan Success Percentage Chart ---
    // Aggregate all environments
    const aggregatedTotalScansByDate: Record<string, number> = {};
    const aggregatedCleanScansByDate: Record<string, number> = {};
    allStats.forEach((stats) => {
      Object.entries(stats.totalScansByDate).forEach(([date, count]) => {
        aggregatedTotalScansByDate[date] = (aggregatedTotalScansByDate[date] ?? INITIAL_ERROR_COUNT) + count;
      });
      Object.entries(stats.cleanScansByDate).forEach(([date, count]) => {
        aggregatedCleanScansByDate[date] = (aggregatedCleanScansByDate[date] ?? INITIAL_ERROR_COUNT) + count;
      });
    });

    const PERCENTAGE_BASE = 100;
    const successData = sortedDates.map((d) => {
      const total = aggregatedTotalScansByDate[d] ?? INITIAL_ERROR_COUNT;
      if (total === INITIAL_ERROR_COUNT) {
        return null;
      }
      const clean = aggregatedCleanScansByDate[d] ?? INITIAL_ERROR_COUNT;
      return Math.round((clean / total) * PERCENTAGE_BASE);
    });

    // Calculate cumulative success percentage
    let cumulativeTotalScans = INITIAL_ERROR_COUNT;
    let cumulativeCleanScans = INITIAL_ERROR_COUNT;
    const cumulativeSuccessData = sortedDates.map((d) => {
      const dailyTotal = aggregatedTotalScansByDate[d] ?? INITIAL_ERROR_COUNT;
      const dailyClean = aggregatedCleanScansByDate[d] ?? INITIAL_ERROR_COUNT;
      cumulativeTotalScans += dailyTotal;
      cumulativeCleanScans += dailyClean;
      if (cumulativeTotalScans === INITIAL_ERROR_COUNT) {
        return null;
      }
      return Math.round((cumulativeCleanScans / cumulativeTotalScans) * PERCENTAGE_BASE);
    });

    const successDatasets = [
      {
        borderColor: "rgba(16, 185, 129, 1)",
        borderWidth: CHART_BORDER_WIDTH_NORMAL,
        data: successData,
        label: "All Environments",
        verticalLines: true
      },
      {
        borderColor: "rgba(239, 68, 68, 1)",
        borderWidth: CHART_BORDER_WIDTH_NORMAL,
        data: cumulativeSuccessData,
        label: "Cumulative",
        verticalLines: false
      }
    ];

    try {
      charts.success = getLineChartConfig(sortedDates, successDatasets, {
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
      charts.errors = getLineChartConfig(sortedDates, errorDatasets, {
        title: "",
        verticalLines: true,
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
      charts.warnings = getLineChartConfig(sortedDates, warningDatasets, {
        title: "",
        verticalLines: true,
        yLabel: "Warning Count"
      });
    } catch (e: unknown) {
      logger.error(`Failed to generate warning chart: ${String(e)}`);
    }

    // --- 5. Property Presence Over Time Chart (Cumulative) ---
    const aggregatedPropertyCountsByDate: Record<string, Record<string, number>> = {};
    allStats.forEach((stats) => {
      Object.entries(stats.propertyCountsByDate).forEach(([date, propertyCounts]) => {
        aggregatedPropertyCountsByDate[date] ??= {};
        const dateCounts = aggregatedPropertyCountsByDate[date];
        Object.entries(propertyCounts).forEach(([property, count]) => {
          dateCounts[property] = (dateCounts[property] ?? INITIAL_ERROR_COUNT) + count;
        });
      });
    });

    const allProperties = new Set<string>();
    Object.values(aggregatedPropertyCountsByDate).forEach((propertyCounts) => {
      Object.keys(propertyCounts).forEach((property) => allProperties.add(property));
    });

    const sortedProperties = Array.from(allProperties).sort();
    const PERCENTAGE_MULTIPLIER = 100;
    const FULL_PRESENCE_THRESHOLD = 100;
    const LAST_ELEMENT_OFFSET = 1;

    const propertyColors: string[] = [
      "rgba(1, 33, 105, 1)",
      "rgb(255, 0, 0)",
      "rgb(255, 128, 0)",
      "rgb(255, 208, 0)",
      "rgb(0, 255, 8)",
      "rgb(0, 247, 255)",
      "rgb(21, 0, 255)",
      "rgb(157, 0, 255)",
      "rgb(255, 0, 242)",
      "rgb(112, 3, 3)",
      "rgb(128, 68, 0)",
      "rgb(0, 0, 0)",
      "rgb(115, 130, 0)",
      "rgb(0, 117, 25)",
      "rgb(51, 0, 96)",
      "rgba(80, 0, 220, 1)",
      "rgb(247, 105, 105)",
      "rgba(220, 140, 0, 1)",
      "rgb(43, 207, 163)",
      "rgb(167, 90, 212)"
    ];

    // Calculate cumulative totals for scans and each property
    const cumulativeTotalByDate: Record<string, number> = {};
    const cumulativePropertyByDate: Record<string, Record<string, number>> = {};
    let runningTotal = INITIAL_ERROR_COUNT;
    const runningPropertyTotals: Record<string, number> = {};

    sortedDates.forEach((date) => {
      const dailyScans = aggregatedScansByDate[date] ?? INITIAL_ERROR_COUNT;
      runningTotal += dailyScans;
      cumulativeTotalByDate[date] = runningTotal;

      const dateCumulativeProps: Record<string, number> = {};
      cumulativePropertyByDate[date] = dateCumulativeProps;
      const dailyPropertyCounts = aggregatedPropertyCountsByDate[date];
      sortedProperties.forEach((property) => {
        const dailyCount = dailyPropertyCounts?.[property] ?? INITIAL_ERROR_COUNT;
        runningPropertyTotals[property] = (runningPropertyTotals[property] ?? INITIAL_ERROR_COUNT) + dailyCount;
        dateCumulativeProps[property] = runningPropertyTotals[property];
      });
    });

    // Build datasets with cumulative percentages
    const propertyDatasets = sortedProperties
      .map((property, index) => {
        const colorIndex = index % propertyColors.length;
        const color = propertyColors[colorIndex] ?? "rgba(0, 0, 0, 1)";
        const data = sortedDates.map((date) => {
          const cumulativeTotal = cumulativeTotalByDate[date] ?? INITIAL_ERROR_COUNT;
          if (cumulativeTotal === INITIAL_ERROR_COUNT) {
            return null;
          }
          const cumulativePropertyCount = cumulativePropertyByDate[date]?.[property] ?? INITIAL_ERROR_COUNT;
          return Math.round((cumulativePropertyCount / cumulativeTotal) * PERCENTAGE_MULTIPLIER);
        });
        return {
          borderColor: color,
          borderWidth: CHART_BORDER_WIDTH_NORMAL,
          data,
          label: property
        };
      })
      .filter((dataset) => {
        // Exclude properties with 100% presence throughout
        const lastIndex = dataset.data.length - LAST_ELEMENT_OFFSET;
        const lastValue = dataset.data[lastIndex];
        return lastValue !== FULL_PRESENCE_THRESHOLD;
      });

    if (propertyDatasets.length > INITIAL_ERROR_COUNT) {
      try {
        const PROPERTY_OVER_TIME_CHART_HEIGHT = 400;
        charts.propertyPresenceOverTime = getLineChartConfig(sortedDates, propertyDatasets, {
          height: PROPERTY_OVER_TIME_CHART_HEIGHT,
          title: "",
          yLabel: "Presence %"
        });
      } catch (e: unknown) {
        logger.error(`Failed to generate property presence over time chart: ${String(e)}`);
      }
    }
  }

  return charts;
}
