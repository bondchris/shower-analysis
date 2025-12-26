import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ReportData } from "../models/report";
import { buildAreaCharts } from "./dataAnalysisReport/charts/areaCharts";
import { buildAttributePieCharts } from "./dataAnalysisReport/charts/attributePieCharts";
import { buildDeviceAndCameraCharts } from "./dataAnalysisReport/charts/deviceAndCameraCharts";
import { buildDimensionCharts } from "./dataAnalysisReport/charts/dimensionCharts";
import { buildKdeCharts } from "./dataAnalysisReport/charts/kdeCharts";
import { buildVanityAttributesCharts } from "./dataAnalysisReport/charts/vanityAttributesCharts";
import { buildWallEmbeddedPieCharts } from "./dataAnalysisReport/charts/wallEmbeddedPieCharts";
import { buildErrorFeatureObjectCharts } from "./dataAnalysisReport/charts/prevalenceCharts";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import { buildReportSections } from "./dataAnalysisReport/reportSections";
import { CaptureCharts } from "./dataAnalysisReport/types";

export { CaptureCharts } from "./dataAnalysisReport/types";

export function buildDataAnalysisReport(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const layout = computeLayoutConstants();
  const charts: Partial<CaptureCharts> = {};

  Object.assign(charts, buildKdeCharts(metadataList, layout, avgDuration));
  Object.assign(charts, buildDeviceAndCameraCharts(metadataList, layout));
  Object.assign(charts, buildErrorFeatureObjectCharts(metadataList, artifactDirs, layout));

  if (artifactDirs !== undefined) {
    Object.assign(charts, buildDimensionCharts(artifactDirs, layout));
    Object.assign(charts, buildAreaCharts(artifactDirs, layout));
    Object.assign(charts, buildAttributePieCharts(artifactDirs, layout));
    Object.assign(charts, buildWallEmbeddedPieCharts(artifactDirs, layout));
    Object.assign(charts, buildVanityAttributesCharts(artifactDirs, layout));
  }

  const populatedCharts = charts as CaptureCharts;
  return buildReportSections(populatedCharts, artifactDirs, avgDuration, videoCount);
}
