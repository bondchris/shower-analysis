import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getBarChartConfig } from "../../../utils/chart/configBuilders";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";
import { buildBitrateCharts } from "../../shared/bitrateCharts";

interface EncodingCharts {
  fps: ChartConfiguration;
  resolution: ChartConfiguration;
  colorSpace: ChartConfiguration;
  profile: ChartConfiguration;
  level: ChartConfiguration;
  bFrames: ChartConfiguration;
  bitrateValues: ChartConfiguration;
}

export function buildEncodingCharts(metadataList: ArtifactAnalysis[]): EncodingCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const initialCount = 0;
  const incrementStep = 1;
  const defaultNumeric = 0;
  const chartRowGapPx = 4;
  const chartsPerThreeColumnRow = 3;
  const gapCountOffset = 1;
  const gapMultiplier = chartsPerThreeColumnRow - gapCountOffset;
  const totalRowGapWidth = chartRowGapPx * gapMultiplier;
  const bFrameRowChartWidth = Math.floor((layout.PAGE_CONTENT_WIDTH - totalRowGapWidth) / chartsPerThreeColumnRow);
  const emptyColorSpaceLength = 0;
  const unknownColorSpaceLabel = "Unknown";

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

  // Color Space Bar Chart
  const colorSpaceMap: Record<string, number> = {};
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

  // Profile Bar Chart
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

  // Level Bar Chart
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

  // B-Frames Bar Chart
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

  // Bitrate Chart
  const { bitrateValues: sharedBitrateValues } = buildBitrateCharts(metadataList, layout);
  const bitrateValues: ChartConfiguration =
    sharedBitrateValues.type === "bar"
      ? {
          ...sharedBitrateValues,
          height: layout.HALF_CHART_HEIGHT,
          options: { ...sharedBitrateValues.options, width: layout.HALF_CHART_WIDTH }
        }
      : sharedBitrateValues;

  return {
    bFrames,
    bitrateValues,
    colorSpace,
    fps,
    level,
    profile,
    resolution
  };
}
