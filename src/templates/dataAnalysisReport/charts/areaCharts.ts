import { getLineChartConfig, getScatterChartConfig } from "../../../utils/chart/configBuilders";
import {
  convertAreasToSquareFeet,
  convertLengthsToFeet,
  convertLengthsToInches,
  getDoorAreas,
  getDoorWidthHeightPairs,
  getFloorWidthHeightPairs,
  getOpeningAreas,
  getOpeningWidthHeightPairs,
  getTubLengths,
  getVanityLengths,
  getWallAreas,
  getWallWidthHeightPairs,
  getWindowAreas,
  getWindowWidthHeightPairs
} from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { buildDynamicKde } from "../kdeBounds";
import { CaptureCharts } from "../types";
import { ScatterPoint } from "../../../models/chart/scatterChartDataset";

/**
 * Adds opacity to scatter points based on how many objects share the same aspect ratio.
 * More objects with the same aspect ratio = higher opacity.
 */
export function addOpacityByAspectRatio(points: ScatterPoint[]): ScatterPoint[] {
  const zeroValue = 0;
  const minOpacity = 0.3;
  const maxOpacity = 1.0;
  const defaultCount = 1;
  const incrementValue = 1;

  // Calculate aspect ratios and count frequencies
  const aspectRatioCounts = new Map<string, number>();
  const pointAspectRatios: string[] = [];

  for (const point of points) {
    if (point.y > zeroValue) {
      const aspectRatio = point.x / point.y;
      const aspectRatioKey = String(aspectRatio);
      pointAspectRatios.push(aspectRatioKey);
      const currentCount = aspectRatioCounts.get(aspectRatioKey) ?? zeroValue;
      aspectRatioCounts.set(aspectRatioKey, currentCount + incrementValue);
    } else {
      pointAspectRatios.push("");
    }
  }

  // Find min and max counts for normalization
  const counts = Array.from(aspectRatioCounts.values());
  const minCount = counts.length > zeroValue ? Math.min(...counts) : defaultCount;
  const maxCount = counts.length > zeroValue ? Math.max(...counts) : defaultCount;

  // Add opacity to each point based on its aspect ratio frequency
  return points.map((point, index) => {
    const aspectRatioKey = pointAspectRatios[index];
    if (aspectRatioKey === "" || aspectRatioKey === undefined) {
      return { opacity: minOpacity, x: point.x, y: point.y };
    }

    const count = aspectRatioCounts.get(aspectRatioKey) ?? defaultCount;
    // Normalize count to opacity range
    const countRange = maxCount - minCount;
    const normalizedCount = countRange > zeroValue ? (count - minCount) / countRange : zeroValue;
    const opacityRange = maxOpacity - minOpacity;
    const opacityAdjustment = normalizedCount * opacityRange;
    const opacity = minOpacity + opacityAdjustment;

    return { opacity, x: point.x, y: point.y };
  });
}

export function buildAreaCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<
  Pick<
    CaptureCharts,
    | "windowArea"
    | "windowAspectRatio"
    | "doorArea"
    | "doorAspectRatio"
    | "openingArea"
    | "openingAspectRatio"
    | "wallArea"
    | "wallAspectRatio"
    | "floorAspectRatio"
    | "tubLength"
    | "vanityLength"
  >
> {
  const charts: Partial<
    Pick<
      CaptureCharts,
      | "windowArea"
      | "windowAspectRatio"
      | "doorArea"
      | "doorAspectRatio"
      | "openingArea"
      | "openingAspectRatio"
      | "wallArea"
      | "wallAspectRatio"
      | "floorAspectRatio"
      | "tubLength"
      | "vanityLength"
    >
  > = {};

  const windowAreasSqM = getWindowAreas(artifactDirs);
  const doorAreasSqM = getDoorAreas(artifactDirs);
  const openingAreasSqM = getOpeningAreas(artifactDirs);
  const wallAreasSqM = getWallAreas(artifactDirs);

  const windowAreasSqFt = convertAreasToSquareFeet(windowAreasSqM);
  const doorAreasSqFt = convertAreasToSquareFeet(doorAreasSqM);
  const openingAreasSqFt = convertAreasToSquareFeet(openingAreasSqM);
  const wallAreasSqFt = convertAreasToSquareFeet(wallAreasSqM);

  const windowAreaInitialMin = 0;
  const windowAreaInitialMax = 50;
  const windowAreaKdeResolution = 200;
  const { kde: windowAreaKde } = buildDynamicKde(
    windowAreasSqFt,
    windowAreaInitialMin,
    windowAreaInitialMax,
    windowAreaKdeResolution
  );
  charts.windowArea = getLineChartConfig(
    windowAreaKde.labels,
    [
      {
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: windowAreaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "windowArea",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const windowWidthHeightPairsM = getWindowWidthHeightPairs(artifactDirs);
  const windowWidthsM = windowWidthHeightPairsM.map((pair) => pair.width);
  const windowHeightsM = windowWidthHeightPairsM.map((pair) => pair.height);
  const windowWidthsFt = convertLengthsToFeet(windowWidthsM);
  const windowHeightsFt = convertLengthsToFeet(windowHeightsM);
  const windowWidthHeightPairsFt = windowWidthHeightPairsM.map((_, index) => {
    const width = windowWidthsFt[index];
    const height = windowHeightsFt[index];
    if (width === undefined || height === undefined) {
      return null;
    }
    return { x: width, y: height };
  });
  const validWindowPairs = windowWidthHeightPairsFt.filter((p): p is ScatterPoint => p !== null);
  const windowPairsWithOpacity = addOpacityByAspectRatio(validWindowPairs);
  const scatterChartSizeDivisor = 2;
  const scatterChartSize = layout.FULL_CHART_WIDTH / scatterChartSizeDivisor;
  charts.windowAspectRatio = getScatterChartConfig(
    [
      {
        data: windowPairsWithOpacity,
        label: "Windows",
        pointColor: "#3b82f6",
        pointRadius: scatterChartSizeDivisor
      }
    ],
    {
      chartId: "windowAspectRatio",
      height: scatterChartSize,
      width: scatterChartSize,
      xLabel: "Width (ft)",
      yLabel: "Height (ft)"
    }
  );

  const doorAreaInitialMin = 0;
  const doorAreaInitialMax = 30;
  const doorAreaKdeResolution = 200;
  const { kde: doorAreaKde } = buildDynamicKde(
    doorAreasSqFt,
    doorAreaInitialMin,
    doorAreaInitialMax,
    doorAreaKdeResolution
  );
  charts.doorArea = getLineChartConfig(
    doorAreaKde.labels,
    [
      {
        borderColor: "#8b5cf6",
        borderWidth: 2,
        data: doorAreaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "doorArea",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const doorWidthHeightPairsM = getDoorWidthHeightPairs(artifactDirs);
  const doorWidthsM = doorWidthHeightPairsM.map((pair) => pair.width);
  const doorHeightsM = doorWidthHeightPairsM.map((pair) => pair.height);
  const doorWidthsFt = convertLengthsToFeet(doorWidthsM);
  const doorHeightsFt = convertLengthsToFeet(doorHeightsM);
  const doorWidthHeightPairsFt = doorWidthHeightPairsM.map((_, index) => {
    const width = doorWidthsFt[index];
    const height = doorHeightsFt[index];
    if (width === undefined || height === undefined) {
      return null;
    }
    return { x: width, y: height };
  });
  const validDoorPairs = doorWidthHeightPairsFt.filter((p): p is ScatterPoint => p !== null);
  const doorPairsWithOpacity = addOpacityByAspectRatio(validDoorPairs);
  charts.doorAspectRatio = getScatterChartConfig(
    [
      {
        data: doorPairsWithOpacity,
        label: "Doors",
        pointColor: "#8b5cf6",
        pointRadius: scatterChartSizeDivisor
      }
    ],
    {
      chartId: "doorAspectRatio",
      height: scatterChartSize,
      width: scatterChartSize,
      xLabel: "Width (ft)",
      yLabel: "Height (ft)"
    }
  );

  const openingAreaInitialMin = 0;
  const openingAreaInitialMax = 50;
  const openingAreaKdeResolution = 200;
  const { kde: openingAreaKde } = buildDynamicKde(
    openingAreasSqFt,
    openingAreaInitialMin,
    openingAreaInitialMax,
    openingAreaKdeResolution
  );
  charts.openingArea = getLineChartConfig(
    openingAreaKde.labels,
    [
      {
        borderColor: "#f59e0b",
        borderWidth: 2,
        data: openingAreaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "openingArea",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const openingWidthHeightPairsM = getOpeningWidthHeightPairs(artifactDirs);
  const openingWidthsM = openingWidthHeightPairsM.map((pair) => pair.width);
  const openingHeightsM = openingWidthHeightPairsM.map((pair) => pair.height);
  const openingWidthsFt = convertLengthsToFeet(openingWidthsM);
  const openingHeightsFt = convertLengthsToFeet(openingHeightsM);
  const openingWidthHeightPairsFt = openingWidthHeightPairsM.map((_, index) => {
    const width = openingWidthsFt[index];
    const height = openingHeightsFt[index];
    if (width === undefined || height === undefined) {
      return null;
    }
    return { x: width, y: height };
  });
  const validOpeningPairs = openingWidthHeightPairsFt.filter((p): p is ScatterPoint => p !== null);
  const openingPairsWithOpacity = addOpacityByAspectRatio(validOpeningPairs);
  charts.openingAspectRatio = getScatterChartConfig(
    [
      {
        data: openingPairsWithOpacity,
        label: "Openings",
        pointColor: "#f59e0b",
        pointRadius: scatterChartSizeDivisor
      }
    ],
    {
      chartId: "openingAspectRatio",
      height: scatterChartSize,
      width: scatterChartSize,
      xLabel: "Width (ft)",
      yLabel: "Height (ft)"
    }
  );

  const wallAreaInitialMin = 0;
  const wallAreaInitialMax = 200;
  const wallAreaKdeResolution = 200;
  const { kde: wallAreaKde } = buildDynamicKde(
    wallAreasSqFt,
    wallAreaInitialMin,
    wallAreaInitialMax,
    wallAreaKdeResolution
  );
  charts.wallArea = getLineChartConfig(
    wallAreaKde.labels,
    [
      {
        borderColor: "#ef4444",
        borderWidth: 2,
        data: wallAreaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "wallArea",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const wallWidthHeightPairsM = getWallWidthHeightPairs(artifactDirs);
  const wallWidthsM = wallWidthHeightPairsM.map((pair) => pair.width);
  const wallHeightsM = wallWidthHeightPairsM.map((pair) => pair.height);
  const wallWidthsFt = convertLengthsToFeet(wallWidthsM);
  const wallHeightsFt = convertLengthsToFeet(wallHeightsM);
  const wallWidthHeightPairsFt = wallWidthHeightPairsM.map((_, index) => {
    const width = wallWidthsFt[index];
    const height = wallHeightsFt[index];
    if (width === undefined || height === undefined) {
      return null;
    }
    return { x: width, y: height };
  });
  const validPairs = wallWidthHeightPairsFt.filter((p): p is ScatterPoint => p !== null);
  const wallPairsWithOpacity = addOpacityByAspectRatio(validPairs);
  charts.wallAspectRatio = getScatterChartConfig(
    [
      {
        data: wallPairsWithOpacity,
        label: "Walls",
        pointColor: "#ef4444",
        pointRadius: scatterChartSizeDivisor
      }
    ],
    {
      chartId: "wallAspectRatio",
      height: scatterChartSize,
      width: scatterChartSize,
      xLabel: "Width (ft)",
      yLabel: "Height (ft)"
    }
  );

  const floorWidthHeightPairsM = getFloorWidthHeightPairs(artifactDirs);
  const floorWidthsM = floorWidthHeightPairsM.map((pair) => pair.width);
  const floorHeightsM = floorWidthHeightPairsM.map((pair) => pair.height);
  const floorWidthsFt = convertLengthsToFeet(floorWidthsM);
  const floorHeightsFt = convertLengthsToFeet(floorHeightsM);
  const floorWidthHeightPairsFt = floorWidthHeightPairsM.map((_, index) => {
    const width = floorWidthsFt[index];
    const height = floorHeightsFt[index];
    if (width === undefined || height === undefined) {
      return null;
    }
    return { x: width, y: height };
  });
  const validFloorPairs = floorWidthHeightPairsFt.filter((p): p is ScatterPoint => p !== null);
  const floorPairsWithOpacity = addOpacityByAspectRatio(validFloorPairs);
  charts.floorAspectRatio = getScatterChartConfig(
    [
      {
        data: floorPairsWithOpacity,
        label: "Floors",
        pointColor: "#10b981",
        pointRadius: scatterChartSizeDivisor
      }
    ],
    {
      chartId: "floorAspectRatio",
      height: scatterChartSize,
      width: scatterChartSize,
      xLabel: "Width (ft)",
      yLabel: "Length (ft)"
    }
  );

  const tubLengthsM = getTubLengths(artifactDirs);
  const tubLengthsIn = convertLengthsToInches(tubLengthsM);
  const initialMaxTubLengthInches = 120;
  const initialMinTubLengthInches = 0;
  const kdeResolution = 200;
  // First pass: calculate initial bounds based on full range KDE
  const { kde: tubLengthKde } = buildDynamicKde(
    tubLengthsIn,
    initialMinTubLengthInches,
    initialMaxTubLengthInches,
    kdeResolution
  );
  const tubLengthChartConfig = getLineChartConfig(
    tubLengthKde.labels,
    [
      {
        borderColor: "#06b6d4",
        borderWidth: 2,
        data: tubLengthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "tubLength",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );
  charts.tubLength = tubLengthChartConfig;

  const vanityLengthsM = getVanityLengths(artifactDirs);
  const vanityLengthsIn = convertLengthsToInches(vanityLengthsM);
  const initialMaxVanityLengthInches = 120;
  const initialMinVanityLengthInches = 0;
  const vanityKdeResolution = 200;
  const { kde: vanityLengthKde } = buildDynamicKde(
    vanityLengthsIn,
    initialMinVanityLengthInches,
    initialMaxVanityLengthInches,
    vanityKdeResolution
  );
  const vanityLengthChartConfig = getLineChartConfig(
    vanityLengthKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: vanityLengthKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "vanityLength",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );
  charts.vanityLength = vanityLengthChartConfig;

  return charts;
}
