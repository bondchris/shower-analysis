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
} from "./roomAnalysisReport/charts";
import { buildCeilingSections } from "./roomAnalysisReport/sections/ceilingSection";
import { buildFloorSections } from "./roomAnalysisReport/sections/floorSection";
import { buildObjectSections } from "./roomAnalysisReport/sections/objectSection";
import { buildSummarySections } from "./roomAnalysisReport/sections/summarySection";
import {
  buildDoorSections,
  buildOpeningSections,
  buildWallSections,
  buildWindowSections
} from "./roomAnalysisReport/sections/surfaceSection";

function buildRoomCharts(metadataList: ArtifactAnalysis[], artifactDirs?: string[]): Partial<CaptureCharts> {
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

function buildRoomReportSections(
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
    title: "Room Data Analysis"
  };
}

export function buildRoomAnalysisReport(
  metadataList: ArtifactAnalysis[],
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const charts = buildRoomCharts(metadataList, artifactDirs);
  return buildRoomReportSections(charts, artifactDirs, videoCount);
}
