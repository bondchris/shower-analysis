import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import {
  convertLengthsToFeet,
  convertLengthsToInches,
  getDoorHeights,
  getDoorWidths,
  getFloorLengths,
  getFloorWidths,
  getOpeningHeights,
  getOpeningWidths,
  getWallHeights,
  getWallWidths,
  getWindowHeights,
  getWindowWidths
} from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { buildDynamicKde } from "../kdeBounds";
import { CaptureCharts } from "../types";

export function buildDimensionCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<
  Pick<
    CaptureCharts,
    | "wallHeight"
    | "wallWidth"
    | "windowHeight"
    | "windowWidth"
    | "openingHeight"
    | "openingWidth"
    | "doorHeight"
    | "doorWidth"
    | "floorLength"
    | "floorWidth"
  >
> {
  const charts: Partial<
    Pick<
      CaptureCharts,
      | "wallHeight"
      | "wallWidth"
      | "windowHeight"
      | "windowWidth"
      | "openingHeight"
      | "openingWidth"
      | "doorHeight"
      | "doorWidth"
      | "floorLength"
      | "floorWidth"
    >
  > = {};

  const wallHeightsM = getWallHeights(artifactDirs);
  const wallWidthsM = getWallWidths(artifactDirs);
  const windowHeightsM = getWindowHeights(artifactDirs);
  const windowWidthsM = getWindowWidths(artifactDirs);
  const doorHeightsM = getDoorHeights(artifactDirs);
  const doorWidthsM = getDoorWidths(artifactDirs);
  const openingHeightsM = getOpeningHeights(artifactDirs);
  const openingWidthsM = getOpeningWidths(artifactDirs);
  const floorLengthsM = getFloorLengths(artifactDirs);
  const floorWidthsM = getFloorWidths(artifactDirs);

  const wallHeightsIn = convertLengthsToInches(wallHeightsM);
  const wallWidthsIn = convertLengthsToInches(wallWidthsM);
  const windowHeightsIn = convertLengthsToInches(windowHeightsM);
  const windowWidthsIn = convertLengthsToInches(windowWidthsM);
  const doorHeightsIn = convertLengthsToInches(doorHeightsM);
  const doorWidthsIn = convertLengthsToInches(doorWidthsM);
  const openingHeightsIn = convertLengthsToInches(openingHeightsM);
  const openingWidthsIn = convertLengthsToInches(openingWidthsM);
  const floorLengthsFt = convertLengthsToFeet(floorLengthsM);
  const floorWidthsFt = convertLengthsToFeet(floorWidthsM);

  const wallHeightInitialMin = 0;
  const wallHeightInitialMax = 120;
  const wallHeightKdeResolution = 200;
  const { kde: wallHeightKde } = buildDynamicKde(
    wallHeightsIn,
    wallHeightInitialMin,
    wallHeightInitialMax,
    wallHeightKdeResolution
  );
  charts.wallHeight = getLineChartConfig(
    wallHeightKde.labels,
    [
      {
        borderColor: "#ef4444",
        borderWidth: 2,
        data: wallHeightKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "wallHeight",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const wallWidthInitialMin = 0;
  const wallWidthInitialMax = 300;
  const wallWidthKdeResolution = 200;
  const { kde: wallWidthKde } = buildDynamicKde(
    wallWidthsIn,
    wallWidthInitialMin,
    wallWidthInitialMax,
    wallWidthKdeResolution
  );
  charts.wallWidth = getLineChartConfig(
    wallWidthKde.labels,
    [
      {
        borderColor: "#ef4444",
        borderWidth: 2,
        data: wallWidthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "wallWidth",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const windowHeightInitialMin = 0;
  const windowHeightInitialMax = 120;
  const windowHeightKdeResolution = 200;
  const { kde: windowHeightKde } = buildDynamicKde(
    windowHeightsIn,
    windowHeightInitialMin,
    windowHeightInitialMax,
    windowHeightKdeResolution
  );
  charts.windowHeight = getLineChartConfig(
    windowHeightKde.labels,
    [
      {
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: windowHeightKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "windowHeight",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const windowWidthInitialMin = 0;
  const windowWidthInitialMax = 120;
  const windowWidthKdeResolution = 200;
  const { kde: windowWidthKde } = buildDynamicKde(
    windowWidthsIn,
    windowWidthInitialMin,
    windowWidthInitialMax,
    windowWidthKdeResolution
  );
  charts.windowWidth = getLineChartConfig(
    windowWidthKde.labels,
    [
      {
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: windowWidthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "windowWidth",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const doorHeightInitialMin = 0;
  const doorHeightInitialMax = 120;
  const doorHeightKdeResolution = 200;
  const { kde: doorHeightKde } = buildDynamicKde(
    doorHeightsIn,
    doorHeightInitialMin,
    doorHeightInitialMax,
    doorHeightKdeResolution
  );
  charts.doorHeight = getLineChartConfig(
    doorHeightKde.labels,
    [
      {
        borderColor: "#8b5cf6",
        borderWidth: 2,
        data: doorHeightKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "doorHeight",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const doorWidthInitialMin = 0;
  const doorWidthInitialMax = 60;
  const doorWidthKdeResolution = 200;
  const { kde: doorWidthKde } = buildDynamicKde(
    doorWidthsIn,
    doorWidthInitialMin,
    doorWidthInitialMax,
    doorWidthKdeResolution
  );
  charts.doorWidth = getLineChartConfig(
    doorWidthKde.labels,
    [
      {
        borderColor: "#8b5cf6",
        borderWidth: 2,
        data: doorWidthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "doorWidth",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const openingHeightInitialMin = 0;
  const openingHeightInitialMax = 120;
  const openingHeightKdeResolution = 200;
  const { kde: openingHeightKde } = buildDynamicKde(
    openingHeightsIn,
    openingHeightInitialMin,
    openingHeightInitialMax,
    openingHeightKdeResolution
  );
  charts.openingHeight = getLineChartConfig(
    openingHeightKde.labels,
    [
      {
        borderColor: "#f59e0b",
        borderWidth: 2,
        data: openingHeightKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "openingHeight",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const openingWidthInitialMin = 0;
  const openingWidthInitialMax = 120;
  const openingWidthKdeResolution = 200;
  const { kde: openingWidthKde } = buildDynamicKde(
    openingWidthsIn,
    openingWidthInitialMin,
    openingWidthInitialMax,
    openingWidthKdeResolution
  );
  charts.openingWidth = getLineChartConfig(
    openingWidthKde.labels,
    [
      {
        borderColor: "#f59e0b",
        borderWidth: 2,
        data: openingWidthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "openingWidth",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );

  const floorLengthInitialMin = 0;
  const floorLengthInitialMax = 50;
  const floorLengthKdeResolution = 200;
  const { kde: floorLengthKde } = buildDynamicKde(
    floorLengthsFt,
    floorLengthInitialMin,
    floorLengthInitialMax,
    floorLengthKdeResolution
  );
  charts.floorLength = getLineChartConfig(
    floorLengthKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: floorLengthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "floorLength",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "ft",
      yLabel: "Count"
    }
  );

  const floorWidthInitialMin = 0;
  const floorWidthInitialMax = 50;
  const floorWidthKdeResolution = 200;
  const { kde: floorWidthKde } = buildDynamicKde(
    floorWidthsFt,
    floorWidthInitialMin,
    floorWidthInitialMax,
    floorWidthKdeResolution
  );
  charts.floorWidth = getLineChartConfig(
    floorWidthKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: floorWidthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "floorWidth",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "ft",
      yLabel: "Count"
    }
  );

  return charts;
}
