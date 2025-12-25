import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import {
  convertAreasToSquareFeet,
  convertLengthsToInches,
  getDoorAreas,
  getOpeningAreas,
  getTubLengths,
  getVanityLengths,
  getWallAreas,
  getWindowAreas
} from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { buildDynamicKde } from "../kdeBounds";
import { CaptureCharts } from "../types";

export function buildAreaCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "windowArea" | "doorArea" | "openingArea" | "wallArea" | "tubLength" | "vanityLength">> {
  const charts: Partial<
    Pick<CaptureCharts, "windowArea" | "doorArea" | "openingArea" | "wallArea" | "tubLength" | "vanityLength">
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
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
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
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
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
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
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
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
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
      width: layout.HISTO_CHART_WIDTH,
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
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "in",
      yLabel: "Count"
    }
  );
  charts.vanityLength = vanityLengthChartConfig;

  return charts;
}
