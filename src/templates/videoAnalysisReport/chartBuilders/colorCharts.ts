import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { LineChartDataset } from "../../../models/chart/lineChartDataset";
import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import { calculateKde } from "../../../utils/chart/kde";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";
import { buildDynamicKde } from "../../dataAnalysisReport/kdeBounds";
import { buildRange } from "./laplacianCharts";

interface ColorCharts {
  meanHue: ChartConfiguration;
  hueVariance: ChartConfiguration;
  meanSaturation: ChartConfiguration;
  saturationVariance: ChartConfiguration;
  meanBrightness: ChartConfiguration;
  brightnessVariance: ChartConfiguration;
  rgbMeans: ChartConfiguration;
  rgbVariance: ChartConfiguration;
  clippedPixels: ChartConfiguration;
}

function collectColorValues(
  metadataList: ArtifactAnalysis[],
  selector: (meta: ArtifactAnalysis) => number | undefined
): number[] {
  const minSamples = 1;
  return metadataList
    .filter(
      (meta) =>
        typeof meta.colorSampleCount === "number" &&
        Number.isFinite(meta.colorSampleCount) &&
        meta.colorSampleCount >= minSamples
    )
    .map(selector)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function buildDistributionChart(
  values: number[],
  chartId: string,
  xLabel: string,
  color: string,
  fallbackMax: number,
  width: number,
  height: number,
  gradientStopBuilder?: (labels: string[]) => { offset: number; color: string }[]
): ChartConfiguration {
  const noResults = 0;
  const resolution = 200;
  const diffThreshold = 0.01;
  const range = buildRange(values, fallbackMax);
  const effectiveMax = Math.max(range.max, range.min + diffThreshold);
  const { kde } = buildDynamicKde(values, range.min, effectiveMax, resolution, diffThreshold);
  const gradientStops = gradientStopBuilder?.(kde.labels);
  const hasGradientStops = (gradientStops?.length ?? noResults) > noResults;
  const dataset: LineChartDataset = {
    borderColor: color,
    borderWidth: 2,
    data: kde.values,
    fill: true,
    label: "Density"
  };
  if (hasGradientStops && gradientStops !== undefined) {
    dataset.gradientDirection = "horizontal";
    dataset.gradientStops = gradientStops;
  }
  return getLineChartConfig(kde.labels, [dataset], {
    chartId,
    height,
    smooth: true,
    title: "",
    width,
    xLabel,
    yLabel: "Density"
  });
}

function buildHueGradientStops(labels: string[]): { offset: number; color: string }[] {
  const noResults = 0;
  const defaultNumeric = 0;
  const hueRangeMax = 360;
  const numericLabels = labels.map((label) => Number.parseFloat(label)).filter((value) => Number.isFinite(value));
  if (numericLabels.length === noResults) {
    return [];
  }
  const normalizeHue = (hue: number): number => {
    const normalized = hue % hueRangeMax;
    return (normalized + hueRangeMax) % hueRangeMax;
  };
  const hueToColor = (hue: number): string => {
    const saturationPercent = 85;
    const lightnessPercent = 55;
    return `hsl(${normalizeHue(hue).toString()}, ${saturationPercent.toString()}%, ${lightnessPercent.toString()}%)`;
  };
  const minHue = Math.min(...numericLabels);
  const maxHue = Math.max(...numericLabels);
  const range = maxHue - minHue;
  const minStops = 2;
  const maxOffset = 1;
  const hueStops: { offset: number; color: string }[] = [];
  if (range === defaultNumeric) {
    const staticColor = hueToColor(minHue);
    return [
      { color: staticColor, offset: defaultNumeric },
      { color: staticColor, offset: maxOffset }
    ];
  }
  const seen = new Set<number>();
  const roundingPrecision = 1;
  for (const hue of numericLabels) {
    const roundedHue = Number.parseFloat(hue.toFixed(roundingPrecision));
    if (seen.has(roundedHue)) {
      continue;
    }
    seen.add(roundedHue);
    const offset = Math.max(defaultNumeric, Math.min(maxOffset, (hue - minHue) / range));
    hueStops.push({ color: hueToColor(hue), offset });
  }
  if (hueStops.length < minStops) {
    hueStops.push({ color: hueToColor(maxHue), offset: maxOffset });
  }
  hueStops.sort((a, b) => a.offset - b.offset);
  return hueStops;
}

function buildSaturationGradientStops(labels: string[]): { offset: number; color: string }[] {
  const noResults = 0;
  const defaultNumeric = 0;
  const saturationRangeMax = 200;
  const saturationHueDegrees = 210;
  const saturationLightnessPercent = 50;
  const numericLabels = labels.map((label) => Number.parseFloat(label)).filter((value) => Number.isFinite(value));
  if (numericLabels.length === noResults) {
    return [];
  }
  const minValue = Math.min(...numericLabels);
  const maxValue = Math.max(...numericLabels);
  const range = maxValue - minValue;
  const minStops = 2;
  const maxOffset = 1;
  const minPercent = 0;
  const maxPercent = 100;
  const saturationStops: { offset: number; color: string }[] = [];
  const toSaturationPercent = (value: number): number => {
    const scaled = (value / saturationRangeMax) * maxPercent;
    return Math.max(minPercent, Math.min(maxPercent, scaled));
  };
  const saturationToColor = (value: number): string => {
    const saturationPercent = toSaturationPercent(value);
    return `hsl(${saturationHueDegrees.toString()}, ${saturationPercent.toString()}%, ${saturationLightnessPercent.toString()}%)`;
  };
  if (range === defaultNumeric) {
    const staticColor = saturationToColor(minValue);
    return [
      { color: staticColor, offset: defaultNumeric },
      { color: staticColor, offset: maxOffset }
    ];
  }
  const seen = new Set<number>();
  const roundingPrecision = 1;
  for (const value of numericLabels) {
    const roundedValue = Number.parseFloat(value.toFixed(roundingPrecision));
    if (seen.has(roundedValue)) {
      continue;
    }
    seen.add(roundedValue);
    const offset = Math.max(defaultNumeric, Math.min(maxOffset, (value - minValue) / range));
    saturationStops.push({ color: saturationToColor(value), offset });
  }
  if (saturationStops.length < minStops) {
    saturationStops.push({ color: saturationToColor(maxValue), offset: maxOffset });
  }
  saturationStops.sort((a, b) => a.offset - b.offset);
  return saturationStops;
}

function buildBrightnessGradientStops(labels: string[]): { offset: number; color: string }[] {
  const noResults = 0;
  const defaultNumeric = 0;
  const brightnessRangeMax = 260;
  const brightnessSaturationPercent = 0;
  const numericLabels = labels.map((label) => Number.parseFloat(label)).filter((value) => Number.isFinite(value));
  if (numericLabels.length === noResults) {
    return [];
  }
  const minValue = Math.min(...numericLabels);
  const maxValue = Math.max(...numericLabels);
  const range = maxValue - minValue;
  const minStops = 2;
  const maxOffset = 1;
  const minPercent = 0;
  const maxPercent = 100;
  const brightnessStops: { offset: number; color: string }[] = [];
  const toLightnessPercent = (value: number): number => {
    const scaled = (value / brightnessRangeMax) * maxPercent;
    return Math.max(minPercent, Math.min(maxPercent, scaled));
  };
  const brightnessToColor = (value: number): string => {
    const lightnessPercent = toLightnessPercent(value);
    return `hsl(${defaultNumeric.toString()}, ${brightnessSaturationPercent.toString()}%, ${lightnessPercent.toString()}%)`;
  };
  if (range === defaultNumeric) {
    const staticColor = brightnessToColor(minValue);
    return [
      { color: staticColor, offset: defaultNumeric },
      { color: staticColor, offset: maxOffset }
    ];
  }
  const seen = new Set<number>();
  const roundingPrecision = 1;
  for (const value of numericLabels) {
    const roundedValue = Number.parseFloat(value.toFixed(roundingPrecision));
    if (seen.has(roundedValue)) {
      continue;
    }
    seen.add(roundedValue);
    const offset = Math.max(defaultNumeric, Math.min(maxOffset, (value - minValue) / range));
    brightnessStops.push({ color: brightnessToColor(value), offset });
  }
  if (brightnessStops.length < minStops) {
    brightnessStops.push({ color: brightnessToColor(maxValue), offset: maxOffset });
  }
  brightnessStops.sort((a, b) => a.offset - b.offset);
  return brightnessStops;
}

function buildRgbDistributionChart(
  redValues: number[],
  greenValues: number[],
  blueValues: number[],
  chartId: string,
  xLabel: string,
  fallbackMax: number,
  fixedRange?: { min: number; max: number }
): ChartConfiguration {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const defaultNumeric = 0;
  const resolution = 200;
  const minBound = fixedRange?.min ?? defaultNumeric;
  const combined = [...redValues, ...greenValues, ...blueValues].filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
  const hasValues = combined.length > noResults;
  const maxValue = hasValues ? Math.max(...combined) : fallbackMax;
  const rangePaddingRatio = 0.1;
  const padding = maxValue * rangePaddingRatio;
  const dynamicMaxBound = Math.max(minBound + rangePaddingRatio, maxValue + padding);
  const maxBound = fixedRange?.max ?? dynamicMaxBound;
  const redKde = calculateKde(redValues, { max: maxBound, min: minBound, resolution });
  const greenKde = calculateKde(greenValues, { max: maxBound, min: minBound, resolution });
  const blueKde = calculateKde(blueValues, { max: maxBound, min: minBound, resolution });

  return getLineChartConfig(
    redKde.labels,
    [
      {
        borderColor: "#ef4444",
        borderWidth: 2,
        data: redKde.values,
        fill: true,
        label: "Red"
      },
      {
        borderColor: "#22c55e",
        borderWidth: 2,
        data: greenKde.values,
        fill: true,
        label: "Green"
      },
      {
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: blueKde.values,
        fill: true,
        label: "Blue"
      }
    ],
    {
      chartId,
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel,
      yLabel: "Density"
    }
  );
}

export function buildColorCharts(metadataList: ArtifactAnalysis[]): ColorCharts {
  const layout = computeLayoutConstants();
  const hueRangeMax = 360;
  const hueVarianceMax = 180;
  const saturationRangeMax = 200;
  const saturationVarianceMax = 100;
  const brightnessRangeMax = 260;
  const brightnessVarianceMax = 120;
  const rgbMeanRangeMax = 260;
  const rgbVarianceMax = 80;
  const clippedPercentRangeMax = 20;

  const hueMeans = collectColorValues(metadataList, (meta) => meta.meanHue);
  const hueVariances = collectColorValues(metadataList, (meta) => meta.hueVariance);
  const saturationMeans = collectColorValues(metadataList, (meta) => meta.meanSaturation);
  const saturationVariances = collectColorValues(metadataList, (meta) => meta.saturationVariance);
  const brightnessMeans = collectColorValues(metadataList, (meta) => meta.meanBrightness);
  const brightnessVariances = collectColorValues(metadataList, (meta) => meta.brightnessVariance);
  const clippedPercentages = collectColorValues(metadataList, (meta) => meta.clippedPixelPercentage);
  const redMeans = collectColorValues(metadataList, (meta) => meta.redMean);
  const greenMeans = collectColorValues(metadataList, (meta) => meta.greenMean);
  const blueMeans = collectColorValues(metadataList, (meta) => meta.blueMean);
  const redVariances = collectColorValues(metadataList, (meta) => meta.redVariance);
  const greenVariances = collectColorValues(metadataList, (meta) => meta.greenVariance);
  const blueVariances = collectColorValues(metadataList, (meta) => meta.blueVariance);

  const hueColor = "#0ea5e9";
  const meanHue = buildDistributionChart(
    hueMeans,
    "mean-hue",
    "Degrees",
    hueColor,
    hueRangeMax,
    layout.HALF_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT,
    buildHueGradientStops
  );
  const hueVariance = buildDistributionChart(
    hueVariances,
    "hue-variance",
    "Variance (degrees^2)",
    hueColor,
    hueVarianceMax,
    layout.HALF_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT
  );

  const saturationColor = "#f97316";
  const meanSaturation = buildDistributionChart(
    saturationMeans,
    "mean-saturation",
    "Saturation",
    saturationColor,
    saturationRangeMax,
    layout.HALF_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT,
    buildSaturationGradientStops
  );
  const saturationVariance = buildDistributionChart(
    saturationVariances,
    "saturation-variance",
    "Variance",
    saturationColor,
    saturationVarianceMax,
    layout.HALF_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT
  );

  const brightnessColor = "#22c55e";
  const meanBrightness = buildDistributionChart(
    brightnessMeans,
    "mean-brightness",
    "Brightness (Y)",
    brightnessColor,
    brightnessRangeMax,
    layout.HALF_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT,
    buildBrightnessGradientStops
  );
  const brightnessVariance = buildDistributionChart(
    brightnessVariances,
    "brightness-variance",
    "Variance",
    brightnessColor,
    brightnessVarianceMax,
    layout.HALF_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT
  );

  const rgbMeans = buildRgbDistributionChart(
    redMeans,
    greenMeans,
    blueMeans,
    "rgb-mean",
    "Channel Mean",
    rgbMeanRangeMax,
    { max: 255, min: 0 }
  );
  const rgbVariance = buildRgbDistributionChart(
    redVariances,
    greenVariances,
    blueVariances,
    "rgb-variance",
    "Channel Variance",
    rgbVarianceMax
  );

  const clippedPixels = buildDistributionChart(
    clippedPercentages,
    "clipped-pixels",
    "Clipped Pixels (%)",
    "#6b7280",
    clippedPercentRangeMax,
    layout.FULL_CHART_WIDTH,
    layout.HALF_CHART_HEIGHT
  );

  return {
    brightnessVariance,
    clippedPixels,
    hueVariance,
    meanBrightness,
    meanHue,
    meanSaturation,
    rgbMeans,
    rgbVariance,
    saturationVariance
  };
}
