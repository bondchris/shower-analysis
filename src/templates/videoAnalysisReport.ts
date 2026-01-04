import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { BarChartOptions } from "../models/chart/barChartOptions";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { ReportData, ReportSection } from "../models/report";
import { getBarChartConfig, getLineChartConfig } from "../utils/chart/configBuilders";
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
}

function buildVideoCharts(metadataList: ArtifactAnalysis[], avgDuration?: number): VideoCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const initialCount = 0;
  const incrementStep = 1;
  const defaultNumeric = 0;

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
  const fpsCounts = fpsLabels.map((l) => fpsMap[l] ?? initialCount);
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
  const resCounts = resLabels.map((l) => resMap[l] ?? initialCount);
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
    width: layout.HALF_CHART_WIDTH
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
    width: layout.HALF_CHART_WIDTH
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
    width: layout.HALF_CHART_WIDTH
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
    includeUnitInLabel = true,
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
    const gopLabels = sortedValues.map((value) => {
      const baseLabel = value.toFixed(decimalPlaces);
      return includeUnitInLabel && unitLabel.length > emptyLabelLength ? `${baseLabel} ${unitLabel}` : baseLabel;
    });
    const gopCounts = sortedValues.map((value) => counts.get(value) ?? initialCount);
    if (overflowCount > initialCount && typeof bucketOverflowThreshold === "number") {
      const labelIncrement = roundingBase ** -decimalPlaces;
      const overflowValue =
        Math.round((bucketOverflowThreshold + labelIncrement) * roundingMultiplier) / roundingMultiplier;
      const overflowBaseLabel = `${overflowValue.toFixed(decimalPlaces)}+`;
      const overflowLabel =
        includeUnitInLabel && unitLabel.length > emptyLabelLength
          ? `${overflowBaseLabel} ${unitLabel}`
          : overflowBaseLabel;
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
    const useLegend = !includeUnitInLabel && hasLegendText;
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
    false,
    undefined,
    undefined,
    maxGopOverflowThreshold,
    maxGopSideNotes
  );
  const gopAverage = buildGopBarChart(
    gopAverageValues,
    defaultGopDecimalPlaces,
    defaultUnitLabel,
    layout.HALF_CHART_WIDTH,
    false
  );
  const gopMin = buildGopBarChart(
    gopMinValues,
    defaultGopDecimalPlaces,
    defaultUnitLabel,
    layout.HALF_CHART_WIDTH,
    false
  );
  const gopVariance = buildGopBarChart(
    gopVarianceValues,
    varianceDecimalPlaces,
    varianceUnitLabel,
    gopChartWidth,
    false,
    "frames^2",
    undefined,
    varianceOverflowThreshold,
    gopVarianceSideNotes
  );

  const { bitrateValues } = buildBitrateCharts(metadataList, layout);

  return {
    bFrames,
    bitrateValues,
    colorSpace,
    duration,
    fps,
    gopAverage,
    gopMax,
    gopMin,
    gopVariance,
    level,
    profile,
    resolution
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
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: [
      {
        data: charts.profile,
        title: "Profile"
      },
      {
        data: charts.level,
        title: "Level"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.bitrateValues,
    title: "Bitrate",
    type: "chart"
  });

  sections.push({
    data: charts.gopMax,
    title: "Max GOP",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.gopAverage,
        title: "Average GOP"
      },
      {
        data: charts.gopMin,
        title: "Min GOP"
      }
    ],
    type: "chart-row"
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
