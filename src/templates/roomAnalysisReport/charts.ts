import { ArtifactAnalysis } from "../../models/artifactAnalysis";
import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { getLineChartConfig, getShapeOverlayChartConfig } from "../../utils/chart/configBuilders";
import { filterValidOutlines, sampleOutlines } from "../../utils/chart/shapeOverlay";
import { convertLengthsToFeet } from "../../utils/data/rawScanMetadataCollectors";
import {
  getCeilingHeightDifferences,
  getNotchedWallOutlines,
  getSlantedWallOutlines
} from "../../utils/data/rawScanWallAnalysis";
import { buildDynamicKde } from "../dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "../dataAnalysisReport/layout";

export function buildAreaKdeChart(metadataList: ArtifactAnalysis[]): ChartConfiguration {
  const layout = computeLayoutConstants();
  const noResults = 0;

  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > noResults);
  const areaInitialMin = 0;
  const areaInitialMax = 150;
  const areaKdeResolution = 200;
  const { kde: areaKde } = buildDynamicKde(areaVals, areaInitialMin, areaInitialMax, areaKdeResolution);

  return getLineChartConfig(
    areaKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: areaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "area",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );
}

export function buildCeilingHeightDifferenceChart(artifactDirs: string[]): ChartConfiguration {
  const layout = computeLayoutConstants();
  const ceilingHeightDifferencesM = getCeilingHeightDifferences(artifactDirs);
  const ceilingHeightDifferencesFt = convertLengthsToFeet(ceilingHeightDifferencesM);

  const ceilingHeightDifferenceInitialMin = 0;
  const ceilingHeightDifferenceInitialMax = 10;
  const ceilingHeightDifferenceKdeResolution = 200;
  const { kde: ceilingHeightDifferenceKde } = buildDynamicKde(
    ceilingHeightDifferencesFt,
    ceilingHeightDifferenceInitialMin,
    ceilingHeightDifferenceInitialMax,
    ceilingHeightDifferenceKdeResolution
  );

  return getLineChartConfig(
    ceilingHeightDifferenceKde.labels,
    [
      {
        borderColor: "#6366f1",
        borderWidth: 2,
        data: ceilingHeightDifferenceKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "ceilingHeightDifference",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "ft",
      yLabel: "Count"
    }
  );
}

export function buildSlantedWallShapesChart(artifactDirs: string[]): ChartConfiguration | undefined {
  const layout = computeLayoutConstants();
  const slantedWallOutlines = getSlantedWallOutlines(artifactDirs);

  const minOutlines = 0;
  const validOutlines = filterValidOutlines(slantedWallOutlines);
  if (validOutlines.length === minOutlines) {
    return undefined;
  }

  const aspectRatioSizeDivisor = 2.3;
  const chartSize = Math.round(layout.FULL_CHART_WIDTH / aspectRatioSizeDivisor);
  const strokeOpacity = 0.22;
  const maxOutlines = 400;

  const sampledOutlines = sampleOutlines(validOutlines, maxOutlines);

  return getShapeOverlayChartConfig(sampledOutlines, {
    chartId: "slantedWallShapes",
    height: chartSize,
    strokeColor: "#ef4444",
    strokeOpacity,
    width: chartSize
  });
}

export function buildNotchedWallShapesChart(artifactDirs: string[]): ChartConfiguration | undefined {
  const layout = computeLayoutConstants();
  const notchedWallOutlines = getNotchedWallOutlines(artifactDirs);

  const minOutlines = 0;
  const validOutlines = filterValidOutlines(notchedWallOutlines);
  if (validOutlines.length === minOutlines) {
    return undefined;
  }

  const aspectRatioSizeDivisor = 2.3;
  const chartSize = Math.round(layout.FULL_CHART_WIDTH / aspectRatioSizeDivisor);
  const strokeOpacity = 0.22;
  const maxOutlines = 400;

  const sampledOutlines = sampleOutlines(validOutlines, maxOutlines);

  return getShapeOverlayChartConfig(sampledOutlines, {
    chartId: "notchedWallShapes",
    height: chartSize,
    strokeColor: "#ef4444",
    strokeOpacity,
    width: chartSize
  });
}
