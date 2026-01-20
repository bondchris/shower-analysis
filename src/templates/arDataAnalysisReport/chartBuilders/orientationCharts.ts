import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getLineChartConfig, getPieChartConfig } from "../../../utils/chart/configBuilders";
import { buildDynamicKde } from "../../dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

export interface OrientationCharts {
  fastPanTiming: ChartConfiguration;
  fastPans: ChartConfiguration;
  fastRollTiming: ChartConfiguration;
  fastRolls: ChartConfiguration;
  fastTiltTiming: ChartConfiguration;
  fastTilts: ChartConfiguration;
  fullRotation: ChartConfiguration;
  maxPanSpeed: ChartConfiguration;
  maxRollSpeed: ChartConfiguration;
  maxTiltSpeed: ChartConfiguration;
  partialRotationCoverage: ChartConfiguration;
}

// Shared constants for fast movement timing charts
const percentBins = 1001;
const binsPerPercent = 10;
const firstBinIdx = 0;
const lastBinIdx = 1000;

function buildFastMovementTimingLabels(): string[] {
  const labels: string[] = [];
  for (let i = 0; i < percentBins; i++) {
    if (i === firstBinIdx) {
      labels.push("Scan Start");
    } else if (i === lastBinIdx) {
      labels.push("Scan End");
    } else {
      const percentValue = i / binsPerPercent;
      labels.push(`${String(percentValue)}%`);
    }
  }
  return labels;
}

function buildFastMovementTimingCounts(
  metadataList: ArtifactAnalysis[],
  timingsKey: "fastTiltTimings" | "fastRollTimings" | "fastPanTimings"
): number[] {
  const initialCount = 0;
  const incrementStep = 1;
  const counts: number[] = new Array<number>(percentBins).fill(initialCount);

  for (const artifact of metadataList) {
    const timings = artifact[timingsKey];
    if (!Array.isArray(timings)) {
      continue;
    }
    // Track which bins this artifact contributes to (each artifact counts at most once per bin)
    const binsForThisArtifact = new Set<number>();
    for (const percentage of timings) {
      const binIdx = Math.min(Math.max(Math.round(percentage * binsPerPercent), firstBinIdx), lastBinIdx);
      binsForThisArtifact.add(binIdx);
    }
    // Increment each bin that this artifact contributed to
    for (const binIdx of binsForThisArtifact) {
      const currentVal = counts[binIdx] ?? initialCount;
      counts[binIdx] = currentVal + incrementStep;
    }
  }

  return counts;
}

// Count how many sectors have coverage in a histogram
function countSectorsCovered(histogram: number[]): number {
  const initialCount = 0;
  const sectorCount = 36;
  const binsPerSector = 100;
  const panHistogramLength = 3601;

  if (!Array.isArray(histogram) || histogram.length !== panHistogramLength) {
    return initialCount;
  }
  let coveredCount = initialCount;
  for (let sector = 0; sector < sectorCount; sector++) {
    const sectorStart = sector * binsPerSector;
    const sectorEnd = sectorStart + binsPerSector;
    for (let bin = sectorStart; bin < sectorEnd; bin++) {
      const binCount = histogram[bin] ?? initialCount;
      if (binCount > initialCount) {
        coveredCount++;
        break;
      }
    }
  }
  return coveredCount;
}

export function buildOrientationCharts(metadataList: ArtifactAnalysis[]): OrientationCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const initialCount = 0;
  const pieChartHeight = 180;
  const twoPartsOfThree = 2;
  const threePartsTotal = 3;
  const twoThirdsWidthRatio = twoPartsOfThree / threePartsTotal;
  const onePartOfThree = 1;
  const oneThirdWidthRatio = onePartOfThree / threePartsTotal;

  // Maximum Tilt Speed KDE Chart (5-second sliding window)
  // Shows the distribution of maximum angular velocity of phone tilt across scans
  // Initial max set to 200 to capture outliers (some values exceed 100°/s)
  const maxTiltSpeedVals = metadataList.map((m) => m.maxTiltSpeed).filter((v) => v > noResults);
  const maxTiltSpeedInitialMin = 0;
  const maxTiltSpeedInitialMax = 200;
  const maxTiltSpeedKdeResolution = 200;
  const { kde: maxTiltSpeedKde } = buildDynamicKde(
    maxTiltSpeedVals,
    maxTiltSpeedInitialMin,
    maxTiltSpeedInitialMax,
    maxTiltSpeedKdeResolution
  );
  const maxTiltSpeed = getLineChartConfig(
    maxTiltSpeedKde.labels,
    [
      {
        backgroundColor: "rgba(139, 92, 246, 0.3)",
        borderColor: "#8b5cf6",
        borderWidth: 2,
        data: maxTiltSpeedKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "maxTiltSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "°/s",
      yLabel: "Count"
    }
  );

  // Fast Tilts Pie Chart
  // Shows percentage of scans with maximum tilt speed greater than 5 °/s
  const fastTiltThreshold = 5;
  const fastTiltCount = metadataList.filter((m) => m.maxTiltSpeed > fastTiltThreshold).length;
  const noFastTiltCount = metadataList.length - fastTiltCount;
  const fastTilts = getPieChartConfig(["Fast Tilts", "No Fast Tilts"], [fastTiltCount, noFastTiltCount], {
    colors: ["#f97316", "#22c55e"],
    height: pieChartHeight,
    title: "",
    width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
  });

  // Fast Tilt Timing Line Chart
  // Shows when during scans fast tilts occur (as percentage of scan progress)
  const fastTiltTimingCounts = buildFastMovementTimingCounts(metadataList, "fastTiltTimings");
  const fastTiltTimingLabels = buildFastMovementTimingLabels();
  const fastTiltTiming = getLineChartConfig(
    fastTiltTimingLabels,
    [
      {
        borderColor: "#f97316",
        borderWidth: 2,
        data: fastTiltTimingCounts,
        label: "Fast Tilts",
        verticalLines: true
      }
    ],
    {
      chartId: "fastTiltTiming",
      height: layout.HALF_CHART_HEIGHT,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Scan Progress",
      yLabel: "Count"
    }
  );

  // Maximum Roll Speed KDE Chart (5-second sliding window)
  // Shows the distribution of maximum angular velocity of phone roll across scans
  const maxRollSpeedVals = metadataList.map((m) => m.maxRollSpeed).filter((v) => v > noResults);
  const maxRollSpeedInitialMin = 0;
  const maxRollSpeedInitialMax = 200;
  const maxRollSpeedKdeResolution = 200;
  const { kde: maxRollSpeedKde } = buildDynamicKde(
    maxRollSpeedVals,
    maxRollSpeedInitialMin,
    maxRollSpeedInitialMax,
    maxRollSpeedKdeResolution
  );
  const maxRollSpeed = getLineChartConfig(
    maxRollSpeedKde.labels,
    [
      {
        backgroundColor: "rgba(59, 130, 246, 0.3)",
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: maxRollSpeedKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "maxRollSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "°/s",
      yLabel: "Count"
    }
  );

  // Fast Rolls Pie Chart
  // Shows percentage of scans with maximum roll speed greater than 5 °/s
  const fastRollThreshold = 5;
  const fastRollCount = metadataList.filter((m) => m.maxRollSpeed > fastRollThreshold).length;
  const noFastRollCount = metadataList.length - fastRollCount;
  const fastRolls = getPieChartConfig(["Fast Rolls", "No Fast Rolls"], [fastRollCount, noFastRollCount], {
    colors: ["#3b82f6", "#22c55e"],
    height: pieChartHeight,
    title: "",
    width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
  });

  // Fast Roll Timing Line Chart
  // Shows when during scans fast rolls occur (as percentage of scan progress)
  const fastRollTimingCounts = buildFastMovementTimingCounts(metadataList, "fastRollTimings");
  const fastRollTimingLabels = buildFastMovementTimingLabels();
  const fastRollTiming = getLineChartConfig(
    fastRollTimingLabels,
    [
      {
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: fastRollTimingCounts,
        label: "Fast Rolls",
        verticalLines: true
      }
    ],
    {
      chartId: "fastRollTiming",
      height: layout.HALF_CHART_HEIGHT,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Scan Progress",
      yLabel: "Count"
    }
  );

  // Maximum Pan Speed KDE Chart (5-second sliding window)
  // Shows the distribution of maximum angular velocity of phone pan across scans
  const maxPanSpeedVals = metadataList.map((m) => m.maxPanSpeed).filter((v) => v > noResults);
  const maxPanSpeedInitialMin = 0;
  const maxPanSpeedInitialMax = 200;
  const maxPanSpeedKdeResolution = 200;
  const { kde: maxPanSpeedKde } = buildDynamicKde(
    maxPanSpeedVals,
    maxPanSpeedInitialMin,
    maxPanSpeedInitialMax,
    maxPanSpeedKdeResolution
  );
  const maxPanSpeed = getLineChartConfig(
    maxPanSpeedKde.labels,
    [
      {
        backgroundColor: "rgba(16, 185, 129, 0.3)",
        borderColor: "#10b981",
        borderWidth: 2,
        data: maxPanSpeedKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "maxPanSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "°/s",
      yLabel: "Count"
    }
  );

  // Fast Pans Pie Chart
  // Shows percentage of scans with maximum pan speed greater than 5 °/s
  const fastPanThreshold = 5;
  const fastPanCount = metadataList.filter((m) => m.maxPanSpeed > fastPanThreshold).length;
  const noFastPanCount = metadataList.length - fastPanCount;
  const fastPans = getPieChartConfig(["Fast Pans", "No Fast Pans"], [fastPanCount, noFastPanCount], {
    colors: ["#10b981", "#9ca3af"],
    height: pieChartHeight,
    title: "",
    width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
  });

  // Fast Pan Timing Line Chart
  // Shows when during scans fast pans occur (as percentage of scan progress)
  const fastPanTimingCounts = buildFastMovementTimingCounts(metadataList, "fastPanTimings");
  const fastPanTimingLabels = buildFastMovementTimingLabels();
  const fastPanTiming = getLineChartConfig(
    fastPanTimingLabels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: fastPanTimingCounts,
        label: "Fast Pans",
        verticalLines: true
      }
    ],
    {
      chartId: "fastPanTiming",
      height: layout.HALF_CHART_HEIGHT,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Scan Progress",
      yLabel: "Count"
    }
  );

  // Full Rotation Detection Pie Chart
  // A scan is considered to have completed a full 360° rotation if all 36 ten-degree
  // sectors have at least one reading in the phonePanHistogram.
  // The histogram has 3601 bins (0-360° at 0.1° resolution, inclusive of both endpoints).
  // Each 10° sector spans 100 bins (e.g., sector 0 = bins 0-99 covering 0°-9.9°).
  const sectorCount = 36;

  const hasFullRotation = (histogram: number[]): boolean => {
    return countSectorsCovered(histogram) === sectorCount;
  };

  const fullRotationCount = metadataList.filter((m) => hasFullRotation(m.phonePanHistogram)).length;
  const partialRotationCount = metadataList.length - fullRotationCount;
  const fullRotation = getPieChartConfig(
    ["Full 360° Rotation", "Partial Rotation"],
    [fullRotationCount, partialRotationCount],
    {
      colors: ["#22c55e", "#f59e0b"],
      height: pieChartHeight,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
    }
  );

  // Partial Rotation Coverage Line Chart
  // Shows distribution of coverage for scans with less than 360° rotation
  const percentMultiplier = 100;
  const coverageInitialMin = 0;
  const coverageInitialMax = 100;
  const coverageResolution = 200;
  const coveragePercentages: number[] = [];
  for (const artifact of metadataList) {
    const sectorsCovered = countSectorsCovered(artifact.phonePanHistogram);
    if (sectorsCovered < sectorCount) {
      // Calculate percentage coverage for partial rotations so we can build a smooth density curve
      const percentCoverage = (sectorsCovered / sectorCount) * percentMultiplier;
      coveragePercentages.push(percentCoverage);
    }
  }

  const hasPartialCoverage = coveragePercentages.length > initialCount;
  let coverageLabels: string[] = [];
  let coverageValues: number[] = [];
  if (hasPartialCoverage) {
    const { kde: coverageKde } = buildDynamicKde(
      coveragePercentages,
      coverageInitialMin,
      coverageInitialMax,
      coverageResolution
    );
    coverageLabels = coverageKde.labels;
    coverageValues = coverageKde.values;
  } else {
    const percentBinCount = 101;
    coverageLabels = Array.from({ length: percentBinCount }, (_, idx) => `${String(idx)}%`);
    coverageValues = new Array<number>(percentBinCount).fill(initialCount);
  }

  const partialRotationCoverage = getLineChartConfig(
    coverageLabels,
    [
      {
        backgroundColor: "rgba(249, 115, 22, 0.3)",
        borderColor: "#f97316",
        borderWidth: 2,
        data: coverageValues,
        fill: true,
        label: "Partial Rotations"
      }
    ],
    {
      chartId: "partialRotationCoverage",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "",
      yLabel: "Count"
    }
  );

  return {
    fastPanTiming,
    fastPans,
    fastRollTiming,
    fastRolls,
    fastTiltTiming,
    fastTilts,
    fullRotation,
    maxPanSpeed,
    maxRollSpeed,
    maxTiltSpeed,
    partialRotationCoverage
  };
}
