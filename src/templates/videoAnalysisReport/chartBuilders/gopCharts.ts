import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { BarChartOptions } from "../../../models/chart/barChartOptions";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getBarChartConfig } from "../../../utils/chart/configBuilders";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

interface GopCharts {
  gopMax: ChartConfiguration;
  gopAverage: ChartConfiguration;
  gopMin: ChartConfiguration;
  gopVariance: ChartConfiguration;
}

function collectGopValues(
  metadataList: ArtifactAnalysis[],
  selector: (meta: ArtifactAnalysis) => number | undefined,
  minValue: number
): number[] {
  return metadataList.map(selector).filter((value): value is number => {
    const hasValidValue = typeof value === "number" && Number.isFinite(value);
    return hasValidValue && value >= minValue;
  });
}

function buildGopBarChart(
  values: number[],
  decimalPlaces: number,
  unitLabel: string,
  width: number,
  legendLabel: string | undefined,
  maxHeight: number,
  bucketOverflowThreshold: number | undefined,
  sideNotes: string[]
): ChartConfiguration {
  const layout = computeLayoutConstants();
  const initialCount = 0;
  const incrementStep = 1;
  const zeroDecimalPlaces = 0;
  const roundingBase = 10;
  const emptyLabelLength = 0;
  const defaultBarColor = "rgba(75, 192, 192, 0.5)";

  const roundingMultiplier = roundingBase ** decimalPlaces;
  const isWholeNumberRounding = decimalPlaces === zeroDecimalPlaces;
  let overflowCount = 0;
  const counts = new Map<number, number>();
  for (const value of values) {
    const shouldBucketOverflow = typeof bucketOverflowThreshold === "number" && value > bucketOverflowThreshold;
    const rounded = isWholeNumberRounding
      ? Math.round(value)
      : Math.round(value * roundingMultiplier) / roundingMultiplier;
    if (shouldBucketOverflow) {
      overflowCount += incrementStep;
      continue;
    }
    const currentCount = counts.get(rounded) ?? initialCount;
    counts.set(rounded, currentCount + incrementStep);
  }
  const sortedValues = [...counts.keys()].sort((a, b) => a - b);
  const labelUnitLength = emptyLabelLength;
  const unitSuffix = unitLabel.trim();
  const buildLabel = (value: number) => {
    const baseLabel = value.toFixed(decimalPlaces);
    const parts = unitSuffix.length > labelUnitLength ? [baseLabel, unitSuffix] : [baseLabel];
    return parts.join(" ");
  };
  const gopLabels = sortedValues.map((value) => buildLabel(value));
  const gopCounts = sortedValues.map((value) => Number(counts.get(value)));
  if (overflowCount > initialCount && typeof bucketOverflowThreshold === "number") {
    const labelIncrement = roundingBase ** -decimalPlaces;
    const overflowValue =
      Math.round((bucketOverflowThreshold + labelIncrement) * roundingMultiplier) / roundingMultiplier;
    const baseOverflowLabel = buildLabel(overflowValue);
    const overflowLabel = `${baseOverflowLabel}+`;
    gopLabels.push(overflowLabel);
    gopCounts.push(overflowCount);
  }
  const gopBarHeight = 12;
  const gopHeaderSpace = 48;
  const minGopHeight = layout.MIN_DYNAMIC_HEIGHT;
  const gopContentHeight = gopLabels.length * gopBarHeight;
  const dynamicHeight = Math.max(minGopHeight, gopContentHeight + gopHeaderSpace);
  const chartHeight = Math.min(maxHeight, Math.max(layout.HALF_CHART_HEIGHT, dynamicHeight));
  const legendText = (legendLabel ?? "").trim();
  const hasLegendText = legendText.length > labelUnitLength;
  const useLegend = hasLegendText;
  const baseOptions: BarChartOptions = {
    height: chartHeight,
    showCount: true,
    title: "",
    width
  };
  if (sideNotes.length > labelUnitLength) {
    baseOptions.sideNotes = sideNotes;
  }

  if (useLegend) {
    const stackedCounts = gopCounts.map((count) => [count]);
    return getBarChartConfig(gopLabels, stackedCounts, {
      ...baseOptions,
      stackColors: [defaultBarColor],
      stackLabels: [legendText],
      stacked: true
    });
  }

  return getBarChartConfig(gopLabels, gopCounts, baseOptions);
}

function buildTailNotes(values: number[], threshold: number, decimalPlaces: number, label: string): string[] {
  const emptyLabelLength = 0;
  const tailValues = values.filter((value) => value > threshold);
  const hasTail = tailValues.length > emptyLabelLength;
  if (!hasTail) {
    return [];
  }
  const uniqueTailValues = new Set(tailValues.map((value) => value.toFixed(decimalPlaces)));
  const maxTailValue = Math.max(...tailValues);
  const thresholdLabel = threshold.toFixed(decimalPlaces);

  return [
    `There is a long tail of ${label} values.`,
    `${uniqueTailValues.size.toString()} unique values greater than ${thresholdLabel}`,
    `With a maximum value of ${maxTailValue.toFixed(decimalPlaces)}`
  ];
}

export function buildGopCharts(metadataList: ArtifactAnalysis[]): GopCharts {
  const layout = computeLayoutConstants();
  const minValidGopDistance = 1;
  const defaultGopDecimalPlaces = 0;
  const varianceDecimalPlaces = 1;
  const defaultUnitLabel = "frames";
  const minVarianceValue = Number.EPSILON;
  const maxGopOverflowThreshold = 32;
  const varianceOverflowThreshold = 1;
  const twoThirdsWidthMultiplier = 2;
  const twoThirdsWidthDivisor = 3;
  const gopChartWidth = Math.round((layout.FULL_CHART_WIDTH * twoThirdsWidthMultiplier) / twoThirdsWidthDivisor);

  const gopMaxValues = collectGopValues(metadataList, (meta) => meta.maxGopDistance, minValidGopDistance);
  const gopAverageValues = collectGopValues(metadataList, (meta) => meta.avgGopDistance, minValidGopDistance);
  const gopMinValues = collectGopValues(metadataList, (meta) => meta.minGopDistance, minValidGopDistance);
  const gopVarianceValues = collectGopValues(metadataList, (meta) => meta.gopVariance, minVarianceValue);

  const maxGopSideNotes = buildTailNotes(gopMaxValues, maxGopOverflowThreshold, defaultGopDecimalPlaces, "Max GOP");
  const gopVarianceSideNotes = buildTailNotes(
    gopVarianceValues,
    varianceOverflowThreshold,
    varianceDecimalPlaces,
    "GOP Variance"
  );

  const gopMax = buildGopBarChart(
    gopMaxValues,
    defaultGopDecimalPlaces,
    defaultUnitLabel,
    gopChartWidth,
    undefined,
    layout.DURATION_CHART_HEIGHT,
    maxGopOverflowThreshold,
    maxGopSideNotes
  );
  const gopAverage = buildGopBarChart(
    gopAverageValues,
    defaultGopDecimalPlaces,
    "",
    layout.FULL_CHART_WIDTH,
    undefined,
    layout.DURATION_CHART_HEIGHT,
    undefined,
    []
  );
  const gopMin = buildGopBarChart(
    gopMinValues,
    defaultGopDecimalPlaces,
    "",
    layout.FULL_CHART_WIDTH,
    undefined,
    layout.DURATION_CHART_HEIGHT,
    undefined,
    []
  );
  const gopVariance = buildGopBarChart(
    gopVarianceValues,
    varianceDecimalPlaces,
    "",
    gopChartWidth,
    "frames^2",
    layout.DURATION_CHART_HEIGHT,
    varianceOverflowThreshold,
    gopVarianceSideNotes
  );

  return {
    gopAverage,
    gopMax,
    gopMin,
    gopVariance
  };
}
