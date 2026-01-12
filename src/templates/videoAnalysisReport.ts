import * as fs from "fs";
import * as path from "path";
import React from "react";

import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { BarChartOptions } from "../models/chart/barChartOptions";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { LineChartDataset } from "../models/chart/lineChartDataset";
import { ReportData, ReportSection } from "../models/report";
import { getBarChartConfig, getLineChartConfig } from "../utils/chart/configBuilders";
import { calculateKde } from "../utils/chart/kde";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";
import { buildBitrateCharts } from "./shared/bitrateCharts";

interface VideoCharts {
  bitrateValues: ChartConfiguration;
  colorSpace: ChartConfiguration;
  duration: ChartConfiguration;
  fps: ChartConfiguration;
  profile: ChartConfiguration;
  level: ChartConfiguration;
  bFrames: ChartConfiguration;
  gopMax: ChartConfiguration;
  gopAverage: ChartConfiguration;
  gopMin: ChartConfiguration;
  gopVariance: ChartConfiguration;
  resolution: ChartConfiguration;
  laplacianMedian: ChartConfiguration;
  laplacianStdDev: ChartConfiguration;
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

function buildVideoCharts(metadataList: ArtifactAnalysis[], avgDuration?: number): VideoCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const initialCount = 0;
  const incrementStep = 1;
  const defaultNumeric = 0;
  const hueRangeMax = 360;
  const hueVarianceMax = 180;
  const saturationRangeMax = 200;
  const saturationVarianceMax = 100;
  const brightnessRangeMax = 260;
  const brightnessVarianceMax = 120;
  const saturationHueDegrees = 210;
  const saturationLightnessPercent = 50;
  const brightnessSaturationPercent = 0;
  const rgbMeanRangeMax = 260;
  const rgbVarianceMax = 80;
  const clippedPercentRangeMax = 20;
  const chartRowGapPx = 4;
  const chartsPerThreeColumnRow = 3;
  const gapCountOffset = 1;
  const gapMultiplier = chartsPerThreeColumnRow - gapCountOffset;
  const totalRowGapWidth = chartRowGapPx * gapMultiplier;
  const bFrameRowChartWidth = Math.floor((layout.PAGE_CONTENT_WIDTH - totalRowGapWidth) / chartsPerThreeColumnRow);

  const collectLaplacianValues = (selector: (meta: ArtifactAnalysis) => number | undefined): number[] => {
    const minSamples = 1;
    return metadataList
      .filter(
        (meta) =>
          typeof meta.laplacianSampleCount === "number" &&
          Number.isFinite(meta.laplacianSampleCount) &&
          meta.laplacianSampleCount >= minSamples
      )
      .map(selector)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  };

  const buildRange = (values: number[], fallbackMax: number): { max: number; min: number } => {
    const paddingRatio = 0.1;
    const minRangeDelta = 0.1;
    if (values.length === noResults) {
      return { max: fallbackMax, min: defaultNumeric };
    }
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    if (maxValue === minValue) {
      const basePadding = Math.max(Math.abs(maxValue), fallbackMax) * paddingRatio;
      const padding = Math.max(basePadding, minRangeDelta);
      const paddedMin = Math.max(defaultNumeric, minValue - padding);
      return { max: maxValue + padding, min: paddedMin };
    }
    const rangePadding = (maxValue - minValue) * paddingRatio;
    return { max: maxValue + rangePadding, min: Math.max(defaultNumeric, minValue - rangePadding) };
  };

  const buildLaplacianChart = (
    values: number[],
    chartId: string,
    xLabel: string,
    color: string
  ): ChartConfiguration => {
    const defaultRangeMax = 5;
    const minRangeDelta = 0.1;
    const laplacianResolution = 200;
    const laplacianDiffThreshold = 0.01;
    const range = buildRange(values, defaultRangeMax);
    const effectiveMax = Math.max(range.max, range.min + minRangeDelta);
    const { kde } = buildDynamicKde(values, range.min, effectiveMax, laplacianResolution, laplacianDiffThreshold);
    return getLineChartConfig(
      kde.labels,
      [
        {
          borderColor: color,
          borderWidth: 2,
          data: kde.values,
          fill: true,
          label: "Density"
        }
      ],
      {
        chartId,
        height: layout.HALF_CHART_HEIGHT,
        smooth: true,
        title: "",
        width: layout.HALF_CHART_WIDTH,
        xLabel,
        yLabel: "Density"
      }
    );
  };

  // Duration KDE Chart
  const durations = metadataList.map((m) => m.duration);
  const durationInitialMin = 10;
  const durationInitialMax = 120;
  const durationKdeResolution = 200;
  const { kde: durationKde } = buildDynamicKde(
    durations,
    durationInitialMin,
    durationInitialMax,
    durationKdeResolution
  );

  const durationChartOptions: {
    chartId: string;
    height: number;
    smooth: boolean;
    title: string;
    width: number;
    xLabel: string;
    yLabel: string;
    verticalReferenceLine?: { value: number; label: string };
  } = {
    chartId: "duration",
    height: layout.DURATION_CHART_HEIGHT,
    smooth: true,
    title: "",
    width: layout.DURATION_CHART_WIDTH,
    xLabel: "Seconds",
    yLabel: "Count"
  };

  if (avgDuration !== undefined) {
    const decimalPlacesAvg = 1;
    durationChartOptions.verticalReferenceLine = {
      label: `Avg Duration: ${avgDuration.toFixed(decimalPlacesAvg)}s`,
      value: avgDuration
    };
  }

  const duration = getLineChartConfig(
    durationKde.labels,
    [
      {
        borderColor: "#06b6d4",
        borderWidth: 2,
        data: durationKde.values,
        fill: true,
        label: "Density"
      }
    ],
    durationChartOptions
  );

  const laplacianMedianValues = collectLaplacianValues((meta) => meta.laplacianMedian);
  const laplacianStdDevValues = collectLaplacianValues((meta) => meta.laplacianStdDev);

  const laplacianColor = "rgba(75, 192, 192, 0.9)";
  const laplacianMedian = buildLaplacianChart(
    laplacianMedianValues,
    "laplacian-median",
    "Median Laplacian (per frame)",
    laplacianColor
  );

  const laplacianStdDev = buildLaplacianChart(
    laplacianStdDevValues,
    "laplacian-stddev",
    "Std Dev of Laplacian (per frame)",
    laplacianColor
  );

  const collectColorValues = (selector: (meta: ArtifactAnalysis) => number | undefined): number[] => {
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
  };

  const buildDistributionChart = (
    values: number[],
    chartId: string,
    xLabel: string,
    color: string,
    fallbackMax: number,
    width = layout.HALF_CHART_WIDTH,
    height = layout.HALF_CHART_HEIGHT,
    gradientStopBuilder?: (labels: string[]) => { offset: number; color: string }[]
  ): ChartConfiguration => {
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
  };

  const buildRgbDistributionChart = (
    redValues: number[],
    greenValues: number[],
    blueValues: number[],
    chartId: string,
    xLabel: string,
    fallbackMax: number,
    fixedRange?: { min: number; max: number }
  ): ChartConfiguration => {
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
  };

  const buildHueGradientStops = (labels: string[]): { offset: number; color: string }[] => {
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
  };

  const buildSaturationGradientStops = (labels: string[]): { offset: number; color: string }[] => {
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
  };

  const buildBrightnessGradientStops = (labels: string[]): { offset: number; color: string }[] => {
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
  };

  const hueMeans = collectColorValues((meta) => meta.meanHue);
  const hueVariances = collectColorValues((meta) => meta.hueVariance);
  const saturationMeans = collectColorValues((meta) => meta.meanSaturation);
  const saturationVariances = collectColorValues((meta) => meta.saturationVariance);
  const brightnessMeans = collectColorValues((meta) => meta.meanBrightness);
  const brightnessVariances = collectColorValues((meta) => meta.brightnessVariance);
  const clippedPercentages = collectColorValues((meta) => meta.clippedPixelPercentage);
  const redMeans = collectColorValues((meta) => meta.redMean);
  const greenMeans = collectColorValues((meta) => meta.greenMean);
  const blueMeans = collectColorValues((meta) => meta.blueMean);
  const redVariances = collectColorValues((meta) => meta.redVariance);
  const greenVariances = collectColorValues((meta) => meta.greenVariance);
  const blueVariances = collectColorValues((meta) => meta.blueVariance);

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
    hueVarianceMax
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
    saturationVarianceMax
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
    brightnessVarianceMax
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

  // FPS Bar Chart
  const fpsMap: Record<string, number> = {};
  for (const m of metadataList) {
    if (m.fps === noResults) {
      continue;
    }
    const fps = Math.round(m.fps).toString();
    fpsMap[fps] = (fpsMap[fps] ?? initialCount) + incrementStep;
  }
  const fpsLabels = Object.keys(fpsMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((label) => fpsMap[label] ?? initialCount);
  const fps = getBarChartConfig(fpsLabels, fpsCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Resolution Bar Chart
  const resMap: Record<string, number> = {};
  for (const m of metadataList) {
    if (m.width === noResults || m.height === noResults) {
      continue;
    }
    const res = `${m.width.toString()}x${m.height.toString()}`;
    resMap[res] = (resMap[res] ?? initialCount) + incrementStep;
  }
  const resLabels = Object.keys(resMap).sort();
  const resCounts = resLabels.map((label) => resMap[label] ?? initialCount);
  const resolution = getBarChartConfig(resLabels, resCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  const colorSpaceMap: Record<string, number> = {};
  const unknownColorSpaceLabel = "Unknown";
  const emptyColorSpaceLength = 0;
  for (const m of metadataList) {
    const trimmedColorSpace = (m.colorSpace || "").trim();
    const label = trimmedColorSpace.length > emptyColorSpaceLength ? trimmedColorSpace : unknownColorSpaceLabel;
    colorSpaceMap[label] = (colorSpaceMap[label] ?? initialCount) + incrementStep;
  }
  const colorSpaceLabels = Object.keys(colorSpaceMap).sort();
  const colorSpaceCounts = colorSpaceLabels.map((label) => colorSpaceMap[label] ?? initialCount);
  const colorSpace = getBarChartConfig(colorSpaceLabels, colorSpaceCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: bFrameRowChartWidth
  });

  const profileMap: Record<string, number> = {};
  for (const m of metadataList) {
    const profileLabel = (m.videoProfile || "").trim();
    const label = profileLabel.length > emptyColorSpaceLength ? profileLabel : unknownColorSpaceLabel;
    profileMap[label] = (profileMap[label] ?? initialCount) + incrementStep;
  }
  const profileLabels = Object.keys(profileMap).sort();
  const profileCounts = profileLabels.map((label) => profileMap[label] ?? initialCount);
  const profile = getBarChartConfig(profileLabels, profileCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: bFrameRowChartWidth
  });

  const levelMap: Record<string, number> = {};
  const minValidLevel = 0;
  const levelDivisor = 10;
  const levelDecimalPlaces = 1;
  for (const m of metadataList) {
    const levelVal = Number.isFinite(m.videoLevel) ? m.videoLevel : defaultNumeric;
    if (levelVal <= minValidLevel) {
      continue;
    }
    const formattedLevel = (levelVal / levelDivisor).toFixed(levelDecimalPlaces);
    levelMap[formattedLevel] = (levelMap[formattedLevel] ?? initialCount) + incrementStep;
  }
  const levelLabels = Object.keys(levelMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const levelCounts = levelLabels.map((label) => levelMap[label] ?? initialCount);
  const level = getBarChartConfig(levelLabels, levelCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  const bFrameMap: Record<string, number> = {};
  for (const m of metadataList) {
    const bFramesVal = Number.isFinite(m.bFrameCount) ? m.bFrameCount : defaultNumeric;
    const label = bFramesVal.toString();
    bFrameMap[label] = (bFrameMap[label] ?? initialCount) + incrementStep;
  }
  const bFrameLabels = Object.keys(bFrameMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const bFrameCounts = bFrameLabels.map((label) => bFrameMap[label] ?? initialCount);
  const bFrames = getBarChartConfig(bFrameLabels, bFrameCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: bFrameRowChartWidth
  });

  const minValidGopDistance = 1;
  const defaultGopDecimalPlaces = 0;
  const varianceDecimalPlaces = 1;
  const defaultUnitLabel = "frames";
  const varianceUnitLabel = "frames^2";
  const defaultBarColor = "rgba(75, 192, 192, 0.5)";
  const zeroDecimalPlaces = 0;
  const roundingBase = 10;
  const minVarianceValue = Number.EPSILON;
  const emptyLabelLength = 0;
  const maxGopOverflowThreshold = 32;
  const varianceOverflowThreshold = 1;

  const collectGopValues = (
    selector: (meta: ArtifactAnalysis) => number | undefined,
    minValue = minValidGopDistance
  ): number[] => {
    return metadataList.map(selector).filter((value): value is number => {
      const hasValidValue = typeof value === "number" && Number.isFinite(value);
      return hasValidValue && value >= minValue;
    });
  };

  const buildGopBarChart = (
    values: number[],
    decimalPlaces = defaultGopDecimalPlaces,
    unitLabel = defaultUnitLabel,
    width = layout.HALF_CHART_WIDTH,
    legendLabel?: string,
    maxHeight = layout.DURATION_CHART_HEIGHT,
    bucketOverflowThreshold?: number,
    sideNotes: string[] = []
  ): ChartConfiguration => {
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
  };

  const gopMaxValues = collectGopValues((meta) => meta.maxGopDistance);
  const gopAverageValues = collectGopValues((meta) => meta.avgGopDistance);
  const gopMinValues = collectGopValues((meta) => meta.minGopDistance);
  const gopVarianceValues = collectGopValues((meta) => meta.gopVariance, minVarianceValue);

  const buildTailNotes = (values: number[], threshold: number, decimalPlaces: number, label: string): string[] => {
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
  };

  const maxGopSideNotes = buildTailNotes(gopMaxValues, maxGopOverflowThreshold, defaultGopDecimalPlaces, "Max GOP");
  const gopVarianceSideNotes = buildTailNotes(
    gopVarianceValues,
    varianceOverflowThreshold,
    varianceDecimalPlaces,
    "GOP Variance"
  );

  const twoThirdsWidthMultiplier = 2;
  const twoThirdsWidthDivisor = 3;
  const gopChartWidth = Math.round((layout.FULL_CHART_WIDTH * twoThirdsWidthMultiplier) / twoThirdsWidthDivisor);

  const gopMax = buildGopBarChart(
    gopMaxValues,
    defaultGopDecimalPlaces,
    defaultUnitLabel,
    gopChartWidth,
    undefined,
    undefined,
    maxGopOverflowThreshold,
    maxGopSideNotes
  );
  const gopAverage = buildGopBarChart(
    gopAverageValues,
    defaultGopDecimalPlaces,
    defaultUnitLabel,
    layout.FULL_CHART_WIDTH
  );
  const gopMin = buildGopBarChart(gopMinValues, defaultGopDecimalPlaces, "", layout.FULL_CHART_WIDTH);
  const gopVariance = buildGopBarChart(
    gopVarianceValues,
    varianceDecimalPlaces,
    varianceUnitLabel,
    gopChartWidth,
    "frames^2",
    undefined,
    varianceOverflowThreshold,
    gopVarianceSideNotes
  );

  const { bitrateValues: sharedBitrateValues } = buildBitrateCharts(metadataList, layout);
  const bitrateValues: ChartConfiguration =
    sharedBitrateValues.type === "bar"
      ? {
          ...sharedBitrateValues,
          options: { ...sharedBitrateValues.options, width: layout.HALF_CHART_WIDTH }
        }
      : sharedBitrateValues;

  return {
    bFrames,
    bitrateValues,
    brightnessVariance,
    clippedPixels,
    colorSpace,
    duration,
    fps,
    gopAverage,
    gopMax,
    gopMin,
    gopVariance,
    hueVariance,
    laplacianMedian,
    laplacianStdDev,
    level,
    meanBrightness,
    meanHue,
    meanSaturation,
    profile,
    resolution,
    rgbMeans,
    rgbVariance,
    saturationVariance
  };
}

function loadLaplacianImageBase64(fileName: string): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "laplacian", fileName);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Prefix = "data:image/png;base64,";
  return `${base64Prefix}${imageBuffer.toString("base64")}`;
}

function buildLaplacianExamplesSection(): ReportSection {
  const layout = computeLayoutConstants();
  const examples = [
    { fileName: "0.4.png", label: "0.4" },
    { fileName: "2.png", label: "2" },
    { fileName: "3.png", label: "3" },
    { fileName: "844.png", label: "844" }
  ];
  const gapPixels = 12;
  const minColumnWidth = 140;
  const columnCount = examples.length.toString();
  const gridTemplateColumns = `repeat(${columnCount}, minmax(${minColumnWidth.toString()}px, 1fr))`;
  const imageHeight = 180;
  const cardStyle = {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  } as const;

  const Component = (): React.ReactElement =>
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gap: `${gapPixels.toString()}px`,
          gridTemplateColumns,
          margin: "0 auto",
          maxWidth: `${layout.PAGE_CONTENT_WIDTH.toString()}px`,
          width: "100%"
        }
      },
      ...examples.map((example) =>
        React.createElement(
          "div",
          { key: example.label, style: cardStyle },
          React.createElement("img", {
            alt: `Laplacian example ${example.label}`,
            src: loadLaplacianImageBase64(example.fileName),
            style: {
              height: `${imageHeight.toString()}px`,
              maxWidth: "100%",
              objectFit: "contain",
              width: "100%"
            }
          }),
          React.createElement(
            "div",
            {
              style: {
                color: "#374151",
                fontSize: "12px",
                fontWeight: 600,
                textAlign: "center"
              }
            },
            `Laplacian ${example.label}`
          )
        )
      )
    );

  return {
    component: Component,
    level: 3,
    title: "Laplacian examples",
    type: "react-component"
  };
}

function buildEncodingSummarySections(metadataList: ArtifactAnalysis[]): ReportSection[] {
  const emptyMetadataCount = 0;
  const emptySetCount = 0;
  const emptyLength = 0;

  if (metadataList.length === emptyMetadataCount) {
    return [];
  }

  const defaultLabel = "Unknown";
  const listFormatter = (values: string[]): string => values.join(", ");

  const collectStringValues = (selector: (meta: ArtifactAnalysis) => string | undefined): string[] => {
    const values = new Set<string>();
    metadataList.forEach((meta) => {
      const rawValue = selector(meta);
      const value = (rawValue ?? "").trim();
      if (value.length > emptyLength) {
        values.add(value);
      }
    });
    if (values.size === emptySetCount) {
      values.add(defaultLabel);
    }
    return [...values];
  };

  const collectBitDepthValues = (): string[] => {
    const values = new Set<string>();
    const minValidBitDepth = 0;
    metadataList.forEach((meta) => {
      if (typeof meta.bitDepth === "number" && !Number.isNaN(meta.bitDepth) && meta.bitDepth > minValidBitDepth) {
        values.add(`${meta.bitDepth.toString()}-bit`);
      }
    });
    if (values.size === emptySetCount) {
      values.add(defaultLabel);
    }
    return [...values];
  };

  const topLineParts = [
    { label: "Codec", values: collectStringValues((meta) => meta.codecName) },
    { label: "Color transfer", values: collectStringValues((meta) => meta.colorTransfer) },
    { label: "Color range", values: collectStringValues((meta) => meta.colorRange) },
    { label: "Pixel format", values: collectStringValues((meta) => meta.pixelFormat) }
  ];

  const bottomLineParts = [
    { label: "Bit depth", values: collectBitDepthValues() },
    { label: "Entropy coding", values: collectStringValues((meta) => meta.entropyCoding) }
  ];

  const summaryLineTop = topLineParts.map((part) => `${part.label}: ${listFormatter(part.values)}`).join(" | ");
  const summaryLineBottom = bottomLineParts.map((part) => `${part.label}: ${listFormatter(part.values)}`).join(" | ");

  return [
    {
      data: summaryLineTop,
      options: { className: "text-[11px] text-gray-700 text-center" },
      type: "text"
    },
    {
      data: summaryLineBottom,
      options: { className: "text-[11px] text-gray-700 text-center mb-8" },
      type: "text"
    }
  ];
}

function buildVideoReportSections(
  charts: VideoCharts,
  videoCount: number,
  metadataList: ArtifactAnalysis[]
): ReportData {
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];
  const laplacianExamplesSection = buildLaplacianExamplesSection();

  const encodingSummarySections = buildEncodingSummarySections(metadataList);
  sections.push(...encodingSummarySections);

  sections.push({
    data: charts.duration,
    title: "Duration",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.fps,
        title: "Framerate"
      },
      {
        data: charts.resolution,
        title: "Resolution"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.bFrames,
        title: "B-Frames"
      },
      {
        data: charts.colorSpace,
        title: "Color Space"
      },
      {
        data: charts.profile,
        title: "Profile"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.level,
        title: "Level"
      },
      {
        data: charts.bitrateValues,
        title: "Bitrate (Mbps)"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.gopMin,
    title: "Min GOP",
    type: "chart"
  });

  sections.push({
    data: charts.gopMax,
    title: "Max GOP",
    type: "chart"
  });

  sections.push({
    data: charts.gopAverage,
    title: "Average GOP",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.gopVariance,
        title: "GOP Variance"
      }
    ],
    type: "chart-row"
  });

  sections.push(laplacianExamplesSection);

  sections.push({
    data: [
      {
        data: charts.laplacianMedian,
        title: "Median Blurriness"
      },
      {
        data: charts.laplacianStdDev,
        title: "Shakiness"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.meanHue,
        title: "Mean Hue"
      },
      {
        data: charts.hueVariance,
        title: "Hue Variance"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.meanSaturation,
        title: "Mean Saturation"
      },
      {
        data: charts.saturationVariance,
        title: "Saturation Variance"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.meanBrightness,
        title: "Mean Brightness"
      },
      {
        data: charts.brightnessVariance,
        title: "Brightness Variance"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.rgbMeans,
        title: "RGB Channel Means"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.rgbVariance,
        title: "RGB Channel Variance"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.clippedPixels,
    title: "Clipped Pixels",
    type: "chart"
  });

  return {
    sections,
    subtitle,
    title: "Video Analysis"
  };
}

export function buildVideoAnalysisReport(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number
): ReportData {
  const charts = buildVideoCharts(metadataList, avgDuration);
  return buildVideoReportSections(charts, videoCount, metadataList);
}
