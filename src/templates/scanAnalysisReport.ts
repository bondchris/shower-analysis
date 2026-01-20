import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ReportData, ReportSection } from "../models/report";
import { buildAreaCharts } from "./dataAnalysisReport/charts/areaCharts";
import { buildAttributePieCharts } from "./dataAnalysisReport/charts/attributePieCharts";
import { buildDimensionCharts } from "./dataAnalysisReport/charts/dimensionCharts";
import { buildErrorFeatureObjectCharts } from "./dataAnalysisReport/charts/prevalenceCharts";
import { buildSurfaceShapeCharts } from "./dataAnalysisReport/charts/shapeOverlayCharts";
import { buildVanityAttributesCharts } from "./dataAnalysisReport/charts/vanityAttributesCharts";
import { buildWallEmbeddedPieCharts } from "./dataAnalysisReport/charts/wallEmbeddedPieCharts";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import { CaptureCharts } from "./dataAnalysisReport/types";
import {
  buildAreaKdeChart,
  buildCeilingHeightDifferenceChart,
  buildNotchedWallShapesChart,
  buildSlantedWallShapesChart
} from "./scanAnalysisReport/charts";
import { buildCeilingSections } from "./scanAnalysisReport/sections/ceilingSection";
import { buildFloorSections } from "./scanAnalysisReport/sections/floorSection";
import { buildObjectSections } from "./scanAnalysisReport/sections/objectSection";
import { buildSummarySections } from "./scanAnalysisReport/sections/summarySection";
import {
  buildDoorSections,
  buildOpeningSections,
  buildWallSections,
  buildWindowSections
} from "./scanAnalysisReport/sections/surfaceSection";

function buildScanCharts(metadataList: ArtifactAnalysis[], artifactDirs?: string[]): Partial<CaptureCharts> {
  const layout = computeLayoutConstants();
  const charts: Partial<CaptureCharts> = {};

  charts.area = buildAreaKdeChart(metadataList);

  Object.assign(charts, buildErrorFeatureObjectCharts(metadataList, artifactDirs, layout));

  if (artifactDirs !== undefined) {
    Object.assign(charts, buildDimensionCharts(artifactDirs, layout));
    Object.assign(charts, buildAreaCharts(artifactDirs, layout));
    Object.assign(charts, buildAttributePieCharts(artifactDirs, layout));
    Object.assign(charts, buildWallEmbeddedPieCharts(artifactDirs, layout));
    Object.assign(charts, buildVanityAttributesCharts(artifactDirs, layout));
    Object.assign(charts, buildSurfaceShapeCharts(artifactDirs, layout));
    charts.ceilingHeightDifference = buildCeilingHeightDifferenceChart(artifactDirs);
    const slantedWallShapes = buildSlantedWallShapesChart(artifactDirs);
    if (slantedWallShapes !== undefined) {
      charts.slantedWallShapes = slantedWallShapes;
    }
    const notchedWallShapes = buildNotchedWallShapesChart(artifactDirs);
    if (notchedWallShapes !== undefined) {
      charts.notchedWallShapes = notchedWallShapes;
    }
  }

  return charts;
}

function buildScanReportSections(
  charts: Partial<CaptureCharts>,
  artifactDirs: string[] | undefined,
  videoCount: number
): ReportData {
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];
  const hasArtifactDirs = artifactDirs !== undefined;

  sections.push(...buildSummarySections(charts));
  sections.push(...buildObjectSections(charts, hasArtifactDirs));
  sections.push(...buildFloorSections(charts, hasArtifactDirs));

  if (hasArtifactDirs) {
    sections.push(...buildWallSections(charts));
    sections.push(...buildWindowSections(charts));
    sections.push(...buildDoorSections(charts));
    sections.push(...buildOpeningSections(charts));
    sections.push(...buildCeilingSections(charts));
  }

  return {
    sections,
    subtitle,
    title: "Scan Data Analysis"
  };
}

export function buildScanAnalysisReport(
  metadataList: ArtifactAnalysis[],
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const charts = buildScanCharts(metadataList, artifactDirs);
  return buildScanReportSections(charts, artifactDirs, videoCount);
}
