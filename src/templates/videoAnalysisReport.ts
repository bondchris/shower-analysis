import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ReportData, ReportSection } from "../models/report";

import { buildColorCharts } from "./videoAnalysisReport/chartBuilders/colorCharts";
import { buildDurationChart } from "./videoAnalysisReport/chartBuilders/durationCharts";
import { buildEncodingCharts } from "./videoAnalysisReport/chartBuilders/encodingCharts";
import { buildGopCharts } from "./videoAnalysisReport/chartBuilders/gopCharts";
import { buildLaplacianCharts } from "./videoAnalysisReport/chartBuilders/laplacianCharts";
import { buildEncodingSummarySections } from "./videoAnalysisReport/sections/encodingSummary";
import { buildLaplacianExamplesSection } from "./videoAnalysisReport/sections/laplacianExamples";
import { type VideoCharts } from "../models/videoCharts";

function buildVideoCharts(metadataList: ArtifactAnalysis[], avgDuration?: number): VideoCharts {
  const duration = buildDurationChart(metadataList, avgDuration);
  const laplacianCharts = buildLaplacianCharts(metadataList);
  const colorCharts = buildColorCharts(metadataList);
  const encodingCharts = buildEncodingCharts(metadataList);
  const gopCharts = buildGopCharts(metadataList);

  return {
    bFrames: encodingCharts.bFrames,
    bitrateValues: encodingCharts.bitrateValues,
    brightnessVariance: colorCharts.brightnessVariance,
    clippedPixels: colorCharts.clippedPixels,
    colorSpace: encodingCharts.colorSpace,
    duration,
    fps: encodingCharts.fps,
    gopAverage: gopCharts.gopAverage,
    gopMax: gopCharts.gopMax,
    gopMin: gopCharts.gopMin,
    gopVariance: gopCharts.gopVariance,
    hueVariance: colorCharts.hueVariance,
    laplacianMedian: laplacianCharts.laplacianMedian,
    laplacianStdDev: laplacianCharts.laplacianStdDev,
    level: encodingCharts.level,
    meanBrightness: colorCharts.meanBrightness,
    meanHue: colorCharts.meanHue,
    meanSaturation: colorCharts.meanSaturation,
    profile: encodingCharts.profile,
    resolution: encodingCharts.resolution,
    rgbMeans: colorCharts.rgbMeans,
    rgbVariance: colorCharts.rgbVariance,
    saturationVariance: colorCharts.saturationVariance
  };
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
