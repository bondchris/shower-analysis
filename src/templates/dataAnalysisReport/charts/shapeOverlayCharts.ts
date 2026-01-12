import { SurfaceOutline } from "../../../models/shapeOutline";
import { getShapeOverlayChartConfig } from "../../../utils/chart/configBuilders";
import { filterValidOutlines, sampleOutlines } from "../../../utils/chart/shapeOverlay";
import {
  getDoorOutlines,
  getFloorOutlines,
  getOpeningOutlines,
  getWallOutlines,
  getWindowOutlines
} from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";

const prepareOutlines = (outlines: SurfaceOutline[], maxOutlines: number): SurfaceOutline[] => {
  const validOutlines = filterValidOutlines(outlines);
  return sampleOutlines(validOutlines, maxOutlines);
};

const buildShapeChart = (
  outlines: SurfaceOutline[],
  color: string,
  chartId: string,
  size: number,
  strokeOpacity: number
) => {
  return getShapeOverlayChartConfig(outlines, {
    chartId,
    height: size,
    strokeColor: color,
    strokeOpacity,
    width: size
  });
};

export function buildSurfaceShapeCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "floorShapes" | "wallShapes" | "windowShapes" | "doorShapes" | "openingShapes">> {
  const charts: Partial<
    Pick<CaptureCharts, "floorShapes" | "wallShapes" | "windowShapes" | "doorShapes" | "openingShapes">
  > = {};

  const aspectRatioSizeDivisor = 2.3;
  const chartSize = Math.round(layout.FULL_CHART_WIDTH / aspectRatioSizeDivisor);
  const strokeOpacity = 0.22;
  const maxOutlines = 400;

  const floorOutlines = prepareOutlines(getFloorOutlines(artifactDirs), maxOutlines);
  const wallOutlines = prepareOutlines(getWallOutlines(artifactDirs), maxOutlines);
  const windowOutlines = prepareOutlines(getWindowOutlines(artifactDirs), maxOutlines);
  const doorOutlines = prepareOutlines(getDoorOutlines(artifactDirs), maxOutlines);
  const openingOutlines = prepareOutlines(getOpeningOutlines(artifactDirs), maxOutlines);

  charts.floorShapes = buildShapeChart(floorOutlines, "#10b981", "floorShapes", chartSize, strokeOpacity);
  charts.wallShapes = buildShapeChart(wallOutlines, "#ef4444", "wallShapes", chartSize, strokeOpacity);
  charts.windowShapes = buildShapeChart(windowOutlines, "#3b82f6", "windowShapes", chartSize, strokeOpacity);
  charts.doorShapes = buildShapeChart(doorOutlines, "#8b5cf6", "doorShapes", chartSize, strokeOpacity);
  charts.openingShapes = buildShapeChart(openingOutlines, "#f59e0b", "openingShapes", chartSize, strokeOpacity);

  return charts;
}
