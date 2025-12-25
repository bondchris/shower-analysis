import { getPieChartConfig } from "../../../utils/chart/configBuilders";
import { getSinkCounts, getVanityTypes } from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";

export function buildVanityAttributesCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "sinkCount" | "vanityType">> {
  const charts: Partial<Pick<CaptureCharts, "sinkCount" | "vanityType">> = {};

  const distinctColors = [
    "#4E79A7", // Blue
    "#F28E2B", // Orange
    "#E15759", // Red
    "#76B7B2", // Cyan/Teal
    "#59A14F", // Green
    "#EDC948", // Yellow
    "#B07AA1", // Purple
    "#BAB0AC", // Gray
    "#FF9DA7", // Light Pink/Red
    "#9C755F" // Brown
  ];

  // Sink Count Chart
  const sinkCounts = getSinkCounts(artifactDirs);
  const baseParseInt = 10;
  const sinkCountEntries = Object.entries(sinkCounts).sort(([a], [b]) => {
    const numA = parseInt(a, baseParseInt);
    const numB = parseInt(b, baseParseInt);
    if (isNaN(numA) || isNaN(numB)) {
      return a.localeCompare(b);
    }
    return numA - numB;
  });
  const sinkCountLabels = sinkCountEntries.map(([label]) => label);
  const sinkCountData = sinkCountEntries.map(([, value]) => value);

  const defaultFallbackColor = "#4E79A7";
  const minDataPoints = 1;
  const initialCount = 0;
  if (sinkCountData.length >= minDataPoints) {
    const sinkCountColors = sinkCountLabels.map((_, index) => {
      const colorIndex = index % distinctColors.length;
      return distinctColors[colorIndex] ?? defaultFallbackColor;
    });

    charts.sinkCount = getPieChartConfig(sinkCountLabels, sinkCountData, {
      colors: sinkCountColors,
      height: layout.HALF_CHART_HEIGHT,
      shrinkToLegend: true,
      title: "",
      width: layout.THIRD_CHART_WIDTH
    });
  }

  // Vanity Type Chart
  const vanityTypes = getVanityTypes(artifactDirs);
  const vanityTypeOrder = ["normal", "sink only", "storage only", "no vanity"];
  const notFoundIndex = -1;
  const afterNotFoundIndex = 1;
  const beforeNotFoundIndex = -1;
  const vanityTypeEntries = Object.entries(vanityTypes).sort(([a], [b]) => {
    const indexA = vanityTypeOrder.indexOf(a);
    const indexB = vanityTypeOrder.indexOf(b);
    if (indexA === notFoundIndex && indexB === notFoundIndex) {
      return a.localeCompare(b);
    }
    if (indexA === notFoundIndex) {
      return afterNotFoundIndex;
    }
    if (indexB === notFoundIndex) {
      return beforeNotFoundIndex;
    }
    return indexA - indexB;
  });
  const vanityTypeLabels = vanityTypeEntries.map(([label]) => label);
  const vanityTypeData = vanityTypeEntries.map(([, value]) => value);

  if (vanityTypeData.length > initialCount) {
    const vanityTypeColors = vanityTypeLabels.map((_, index) => {
      const colorIndex = index % distinctColors.length;
      return distinctColors[colorIndex] ?? defaultFallbackColor;
    });

    charts.vanityType = getPieChartConfig(vanityTypeLabels, vanityTypeData, {
      colors: vanityTypeColors,
      height: layout.HALF_CHART_HEIGHT,
      shrinkToLegend: true,
      title: "",
      width: layout.THIRD_CHART_WIDTH
    });
  }

  return charts;
}
