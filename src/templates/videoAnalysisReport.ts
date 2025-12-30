import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { ReportData, ReportSection } from "../models/report";
import { getBarChartConfig, getLineChartConfig } from "../utils/chart/configBuilders";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";

interface VideoCharts {
  duration: ChartConfiguration;
  fps: ChartConfiguration;
  resolution: ChartConfiguration;
}

function buildVideoCharts(metadataList: ArtifactAnalysis[], avgDuration?: number): VideoCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const initialCount = 0;
  const incrementStep = 1;

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

  return { duration, fps, resolution };
}

function buildVideoReportSections(charts: VideoCharts, videoCount: number): ReportData {
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];

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
  return buildVideoReportSections(charts, videoCount);
}
