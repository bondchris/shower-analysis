import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { ReportSection } from "../../../models/report";
import { CaptureCharts } from "../../dataAnalysisReport/types";

interface SurfaceConfig {
  title: string;
  heightKey: keyof CaptureCharts;
  widthKey: keyof CaptureCharts;
  areaKey: keyof CaptureCharts;
  aspectRatioKey: keyof CaptureCharts;
  shapesKey: keyof CaptureCharts;
}

function buildSurfaceAnalysisSections(charts: Partial<CaptureCharts>, config: SurfaceConfig): ReportSection[] {
  const sections: ReportSection[] = [];

  sections.push({
    data: "",
    level: 3,
    title: `${config.title} Analysis`,
    type: "header"
  });

  const heightChart = charts[config.heightKey];
  if (heightChart !== undefined) {
    sections.push({
      data: heightChart,
      title: `${config.title} Heights`,
      type: "chart"
    });
  }

  const widthChart = charts[config.widthKey];
  if (widthChart !== undefined) {
    sections.push({
      data: widthChart,
      title: `${config.title} Widths`,
      type: "chart"
    });
  }

  const areaChart = charts[config.areaKey];
  if (areaChart !== undefined) {
    sections.push({
      data: areaChart,
      title: `${config.title} Areas`,
      type: "chart"
    });
  }

  const aspectRatioChart = charts[config.aspectRatioKey];
  const shapesChart = charts[config.shapesKey];

  if (aspectRatioChart !== undefined || shapesChart !== undefined) {
    if (aspectRatioChart !== undefined && shapesChart !== undefined) {
      sections.push({
        data: [
          { data: aspectRatioChart, title: `${config.title} Aspect Ratio` },
          { data: shapesChart, title: `${config.title} Shapes` }
        ],
        type: "chart-row"
      });
    } else if (aspectRatioChart !== undefined) {
      sections.push({
        data: aspectRatioChart,
        title: `${config.title} Aspect Ratio`,
        type: "chart"
      });
    } else if (shapesChart !== undefined) {
      sections.push({
        data: shapesChart,
        title: `${config.title} Shapes`,
        type: "chart"
      });
    }
  }

  return sections;
}

export function buildWallSections(charts: Partial<CaptureCharts>): ReportSection[] {
  const initialCount = 0;
  const sections = buildSurfaceAnalysisSections(charts, {
    areaKey: "wallArea",
    aspectRatioKey: "wallAspectRatio",
    heightKey: "wallHeight",
    shapesKey: "wallShapes",
    title: "Wall",
    widthKey: "wallWidth"
  });

  const embeddedCharts: { data: ChartConfiguration; title: string }[] = [];
  if (charts.wallsWithWindows !== undefined) {
    embeddedCharts.push({ data: charts.wallsWithWindows, title: "Walls with Windows" });
  }
  if (charts.wallsWithDoors !== undefined) {
    embeddedCharts.push({ data: charts.wallsWithDoors, title: "Walls with Doors" });
  }
  if (charts.wallsWithOpenings !== undefined) {
    embeddedCharts.push({ data: charts.wallsWithOpenings, title: "Walls with Openings" });
  }

  if (embeddedCharts.length > initialCount) {
    sections.push({
      data: embeddedCharts,
      type: "chart-row"
    });
  }

  return sections;
}

export function buildWindowSections(charts: Partial<CaptureCharts>): ReportSection[] {
  return buildSurfaceAnalysisSections(charts, {
    areaKey: "windowArea",
    aspectRatioKey: "windowAspectRatio",
    heightKey: "windowHeight",
    shapesKey: "windowShapes",
    title: "Window",
    widthKey: "windowWidth"
  });
}

export function buildDoorSections(charts: Partial<CaptureCharts>): ReportSection[] {
  return buildSurfaceAnalysisSections(charts, {
    areaKey: "doorArea",
    aspectRatioKey: "doorAspectRatio",
    heightKey: "doorHeight",
    shapesKey: "doorShapes",
    title: "Door",
    widthKey: "doorWidth"
  });
}

export function buildOpeningSections(charts: Partial<CaptureCharts>): ReportSection[] {
  return buildSurfaceAnalysisSections(charts, {
    areaKey: "openingArea",
    aspectRatioKey: "openingAspectRatio",
    heightKey: "openingHeight",
    shapesKey: "openingShapes",
    title: "Opening",
    widthKey: "openingWidth"
  });
}
