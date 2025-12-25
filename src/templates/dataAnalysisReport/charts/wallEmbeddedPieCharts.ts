import { getPieChartConfig } from "../../../utils/chart/configBuilders";
import { getWallEmbeddedCounts } from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";

export function buildWallEmbeddedPieCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "wallsWithWindows" | "wallsWithDoors" | "wallsWithOpenings">> {
  const charts: Partial<Pick<CaptureCharts, "wallsWithWindows" | "wallsWithDoors" | "wallsWithOpenings">> = {};
  const INITIAL_COUNT = 0;

  const embeddedCounts = getWallEmbeddedCounts(artifactDirs);
  const { totalWalls, wallsWithDoors, wallsWithOpenings, wallsWithWindows } = embeddedCounts;

  const distinctColors = [
    "#4E79A7", // Blue
    "#F28E2B", // Orange
    "#E15759", // Red
    "#76B7B2", // Cyan/Teal
    "#59A14F", // Green
    "#EDC948", // Yellow
    "#B07AA1", // Purple
    "#BAB0AC", // Gray
    "#FF9DA7", // Light Pink/Red
    "#9C755F" // Brown
  ] as const;

  const colorIndexBlue = 0;
  const colorIndexOrange = 1;
  const colorIndexRed = 2;
  const colorIndexGray = 6;

  // Walls with Windows pie chart
  const wallsWithoutWindows = totalWalls - wallsWithWindows;
  const defaultWallsCount = 0;
  charts.wallsWithWindows = getPieChartConfig(
    ["With Windows", "Without Windows"],
    totalWalls > INITIAL_COUNT ? [wallsWithWindows, wallsWithoutWindows] : [defaultWallsCount, defaultWallsCount],
    {
      colors: [distinctColors[colorIndexBlue], distinctColors[colorIndexGray]],
      height: layout.HALF_CHART_HEIGHT,
      shrinkToLegend: true,
      title: "",
      width: layout.THIRD_CHART_WIDTH
    }
  );

  // Walls with Doors pie chart
  const wallsWithoutDoors = totalWalls - wallsWithDoors;
  charts.wallsWithDoors = getPieChartConfig(
    ["With Doors", "Without Doors"],
    totalWalls > INITIAL_COUNT ? [wallsWithDoors, wallsWithoutDoors] : [defaultWallsCount, defaultWallsCount],
    {
      colors: [distinctColors[colorIndexOrange], distinctColors[colorIndexGray]],
      height: layout.HALF_CHART_HEIGHT,
      shrinkToLegend: true,
      title: "",
      width: layout.THIRD_CHART_WIDTH
    }
  );

  // Walls with Openings pie chart
  const wallsWithoutOpenings = totalWalls - wallsWithOpenings;
  charts.wallsWithOpenings = getPieChartConfig(
    ["With Openings", "Without Openings"],
    totalWalls > INITIAL_COUNT ? [wallsWithOpenings, wallsWithoutOpenings] : [defaultWallsCount, defaultWallsCount],
    {
      colors: [distinctColors[colorIndexRed], distinctColors[colorIndexGray]],
      height: layout.HALF_CHART_HEIGHT,
      shrinkToLegend: true,
      title: "",
      width: layout.THIRD_CHART_WIDTH
    }
  );

  return charts;
}
