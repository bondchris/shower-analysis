import * as fs from "fs";
import * as path from "path";
import React from "react";

import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { LineChartConfig } from "../models/chart/lineChartConfig";
import { ProtractorChartConfig } from "../models/chart/protractorChartConfig";
import { ReportData, ReportSection } from "../models/report";
import { CoverageSphere, aggregateCoverageSpheres } from "../utils/arData/coverage";
import { brightnessToHex } from "../utils/chart/brightnessToRgb";
import {
  getBarChartConfig,
  getLineChartConfig,
  getPieChartConfig,
  getScatterChartConfig
} from "../utils/chart/configBuilders";
import { getGlobalDateRange } from "../utils/chart/dateRange";
import { calculateDynamicKdeBounds, calculateKde } from "../utils/chart/kde";
import { kelvinToHex } from "../utils/chart/kelvinToRgb";
import { sortDeviceModels } from "../utils/deviceSorting";
import { LineChart } from "./components/charts/LineChart";
import { ProtractorChart } from "./components/charts/ProtractorChart";
import { SphericalCoverageGlobe } from "./components/SphericalCoverageGlobe";
import { SphericalCoverageHeatmap } from "./components/SphericalCoverageHeatmap";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";

interface ArDataCharts {
  ambient: ChartConfiguration;
  aperture: ChartConfiguration;
  arDataFramerate: ChartConfiguration;
  brightness: ChartConfiguration;
  deviceModel: ChartConfiguration;
  droppedFrames: ChartConfiguration;
  fastPanTiming: ChartConfiguration;
  fastPans: ChartConfiguration;
  fastRollTiming: ChartConfiguration;
  fastRolls: ChartConfiguration;
  fastTiltTiming: ChartConfiguration;
  fastTilts: ChartConfiguration;
  focalLength: ChartConfiguration;
  fullRotation: ChartConfiguration;
  iso: ChartConfiguration;
  movementSpeed: ChartConfiguration;
  partialRotationCoverage: ChartConfiguration;
  maxAmbient: ChartConfiguration;
  maxBrightness: ChartConfiguration;
  maxIso: ChartConfiguration;
  maxPanSpeed: ChartConfiguration;
  maxRollSpeed: ChartConfiguration;
  maxTemperature: ChartConfiguration;
  maxTiltSpeed: ChartConfiguration;
  minAmbient: ChartConfiguration;
  minBrightness: ChartConfiguration;
  minIso: ChartConfiguration;
  minTemperature: ChartConfiguration;
  scanEfficiency: ChartConfiguration;
  temperature: ChartConfiguration;
  timeOfDay: ChartConfiguration;
  timezone: ChartConfiguration;
}

function buildArDataCharts(metadataList: ArtifactAnalysis[]): ArDataCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const notSet = "";
  const initialCount = 0;
  const incrementStep = 1;
  const decimalPlacesLens = 1;
  const lensWidthRatio = 0.9;

  // Device Model Bar Chart
  const deviceMap: Record<string, number> = {};
  for (const m of metadataList) {
    const model = m.deviceModel === notSet ? "Unknown" : m.deviceModel;
    deviceMap[model] = (deviceMap[model] ?? initialCount) + incrementStep;
  }
  const { deviceCounts, deviceLabels, separatorLabel } = sortDeviceModels(deviceMap);
  const deviceModel = getBarChartConfig(deviceLabels, deviceCounts, {
    height: layout.getDynamicHeight(deviceLabels.length, layout.LENS_CHART_HEIGHT),
    horizontal: true,
    ...(separatorLabel !== undefined ? { separatorLabel } : {}),
    title: "",
    totalForPercentages: metadataList.length,
    width: Math.round(layout.PAGE_CONTENT_WIDTH * lensWidthRatio)
  });

  // Timezone Bar Chart
  // Map UTC offsets to common timezone abbreviations (sorted alphabetically by key)
  const timezoneAbbreviations: Record<string, string> = {
    "+00:00": "UTC",
    "+01:00": "CET",
    "+02:00": "EET",
    "+03:00": "MSK",
    "+04:00": "GST",
    "+04:30": "AFT",
    "+05:00": "PKT",
    "+05:30": "IST",
    "+05:45": "NPT",
    "+06:00": "BST",
    "+06:30": "MMT",
    "+07:00": "ICT",
    "+08:00": "SGT",
    "+09:00": "JST",
    "+09:30": "ACST",
    "+10:00": "AEST",
    "+10:30": "ACDT",
    "+11:00": "SBT",
    "+12:00": "NZST",
    "+13:00": "TOT",
    "+14:00": "LINT",
    "-01:00": "CVT",
    "-02:00": "GST",
    "-03:00": "ART",
    "-04:00": "AT",
    "-05:00": "ET",
    "-06:00": "CT",
    "-07:00": "MT",
    "-08:00": "PT",
    "-09:00": "AKT",
    "-10:00": "HT",
    "-11:00": "SST",
    "-12:00": "IDLW"
  };
  const getTimezoneLabel = (offset: string): string => {
    if (offset === notSet) {
      return "Unknown";
    }
    const abbrev = timezoneAbbreviations[offset];
    if (abbrev !== undefined) {
      return `${offset}\n${abbrev}`;
    }
    return offset;
  };
  const timezoneMap: Record<string, number> = {};
  for (const m of metadataList) {
    const label = getTimezoneLabel(m.timezone);
    timezoneMap[label] = (timezoneMap[label] ?? initialCount) + incrementStep;
  }
  // Sort timezones by UTC offset (e.g., -12:00 to +14:00)
  const sortAfter = 1;
  const sortBefore = -1;
  const sortEqual = 0;
  const minutesPerHour = 60;
  const radix = 10;
  const signGroupIndex = 1;
  const hoursGroupIndex = 2;
  const minutesGroupIndex = 3;
  const parseTimezoneOffset = (label: string): number => {
    // Extract the offset portion from labels like "-07:00 (MT)" or just "-07:00"
    const match = /^([+-])(\d{2}):(\d{2})/.exec(label);
    if (match === null) {
      return sortEqual;
    }
    const sign = match[signGroupIndex] === "-" ? sortBefore : sortAfter;
    const hoursStr = match[hoursGroupIndex];
    const minutesStr = match[minutesGroupIndex];
    if (hoursStr === undefined || minutesStr === undefined) {
      return sortEqual;
    }
    const hours = parseInt(hoursStr, radix);
    const minutes = parseInt(minutesStr, radix);
    const hoursInMinutes = hours * minutesPerHour;
    const totalMinutes = hoursInMinutes + minutes;
    return sign * totalMinutes;
  };
  const timezoneLabels = Object.keys(timezoneMap).sort((a, b) => {
    if (a === "Unknown") {
      return sortAfter;
    }
    if (b === "Unknown") {
      return sortBefore;
    }
    return parseTimezoneOffset(a) - parseTimezoneOffset(b);
  });
  const timezoneCounts = timezoneLabels.map((l) => timezoneMap[l] ?? initialCount);
  const timezone = getBarChartConfig(timezoneLabels, timezoneCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.FULL_CHART_WIDTH
  });

  // Time of Day Bar Chart
  // Parses DateTimeOriginal format "YYYY:MM:DD HH:MM:SS" and extracts the hour
  const hourLabelDigits = 2;
  const parseHourFromDateTime = (dateTime: string): number | null => {
    const hourGroupIndex = 1;
    const timeRegex = /\d{4}:\d{2}:\d{2}\s+(\d{2}):\d{2}:\d{2}/;
    const match = timeRegex.exec(dateTime);
    if (match?.[hourGroupIndex] !== undefined) {
      const radix = 10;
      const hour = parseInt(match[hourGroupIndex], radix);
      const maxHour = 23;
      const minHour = 0;
      if (hour >= minHour && hour <= maxHour) {
        return hour;
      }
    }
    return null;
  };
  const hoursPerDay = 24;
  const timeOfDayMap: Record<string, number> = {};
  for (let h = 0; h < hoursPerDay; h++) {
    const hourLabel = h.toString().padStart(hourLabelDigits, "0");
    timeOfDayMap[hourLabel] = initialCount;
  }
  for (const m of metadataList) {
    if (m.scanDateTime !== notSet) {
      const hour = parseHourFromDateTime(m.scanDateTime);
      if (hour !== null) {
        const hourLabel = hour.toString().padStart(hourLabelDigits, "0");
        const currentHourCount = timeOfDayMap[hourLabel] ?? initialCount;
        timeOfDayMap[hourLabel] = currentHourCount + incrementStep;
      }
    }
  }
  const timeOfDayLabels = Object.keys(timeOfDayMap).sort();
  const timeOfDayCounts = timeOfDayLabels.map((l) => timeOfDayMap[l] ?? initialCount);
  const timeOfDay = getBarChartConfig(timeOfDayLabels, timeOfDayCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.FULL_CHART_WIDTH
  });

  // Focal Length Bar Chart
  const focalMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensFocalLength !== notSet) {
      const val = parseFloat(m.lensFocalLength);
      if (!isNaN(val)) {
        key = `${val.toFixed(decimalPlacesLens)} mm`;
      } else {
        key = m.lensFocalLength;
      }
    }
    focalMap[key] = (focalMap[key] ?? initialCount) + incrementStep;
  }
  const focalLabels = Object.keys(focalMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const focalCounts = focalLabels.map((l) => focalMap[l] ?? initialCount);
  const focalLength = getBarChartConfig(focalLabels, focalCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Aperture Bar Chart
  const apertureMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensAperture !== notSet) {
      const val = parseFloat(m.lensAperture.replace("f/", ""));
      if (!isNaN(val)) {
        key = `f/${val.toFixed(decimalPlacesLens)}`;
      } else {
        key = m.lensAperture;
      }
    }
    apertureMap[key] = (apertureMap[key] ?? initialCount) + incrementStep;
  }
  const apertureLabels = Object.keys(apertureMap).sort((a, b) => {
    const valA = parseFloat(a.replace("f/", ""));
    const valB = parseFloat(b.replace("f/", ""));
    return valA - valB;
  });
  const apertureCounts = apertureLabels.map((l) => apertureMap[l] ?? initialCount);
  const aperture = getBarChartConfig(apertureLabels, apertureCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // AR Data Framerate KDE Chart
  // Shows the distribution of sampling framerates across scans
  const framerateVals = metadataList.map((m) => m.arDataFramerate).filter((v) => v > noResults);
  const framerateDefaultMin = 0;
  const framerateDefaultMax = 40;
  const frameratePaddingRatio = 0.1;
  const framerateMaxObserved = framerateVals.length > noResults ? Math.max(...framerateVals) : framerateDefaultMax;
  const framerateMinObserved = framerateVals.length > noResults ? Math.min(...framerateVals) : framerateDefaultMin;
  const framerateRange = framerateMaxObserved - framerateMinObserved;
  const frameratePadding = framerateRange > noResults ? framerateRange * frameratePaddingRatio : frameratePaddingRatio;
  const framerateInitialMin = Math.max(framerateDefaultMin, framerateMinObserved - frameratePadding);
  const framerateInitialMax = Math.max(framerateDefaultMax, framerateMaxObserved + frameratePadding);
  const framerateKdeResolution = 200;
  const { kde: framerateKde } = buildDynamicKde(
    framerateVals,
    framerateInitialMin,
    framerateInitialMax,
    framerateKdeResolution
  );
  const arDataFramerate = getLineChartConfig(
    framerateKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: framerateKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#064e3b",
        gradientTo: "#34d399",
        label: "Density"
      }
    ],
    {
      chartId: "arDataFramerate",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "FPS",
      yLabel: "Count"
    }
  );

  // Dropped AR Frames Pie Chart
  // Shows percentage of artifacts with dropped frames (interval > 1.5x median)
  const droppedCount = metadataList.filter((m) => m.hasDroppedArFrames).length;
  const noDroppedCount = metadataList.length - droppedCount;
  // Use smaller pie chart height (180px) to better match the line chart visually
  // The pie chart adds legend height, so starting smaller results in similar total height
  const pieChartHeight = 180;
  const droppedFrames = getPieChartConfig(["Dropped Frames", "Consistent"], [droppedCount, noDroppedCount], {
    colors: ["#ef4444", "#22c55e"],
    height: pieChartHeight,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Scan Efficiency Scatter Chart
  // Shows path length (total distance traveled) vs. displacement (start-to-end distance)
  // Includes a zoomed detail view of the clustered region
  const efficiencyPoints = metadataList
    .filter((m) => m.totalDistanceTraveled > noResults && m.totalDisplacement > noResults)
    .map((m) => ({
      x: m.totalDistanceTraveled,
      y: m.totalDisplacement
    }));

  const zoomPathLengthMin = 10;
  const zoomPathLengthMax = 60;
  const zoomDisplacementMin = 0;
  const zoomDisplacementMax = 5;

  const scanEfficiency = getScatterChartConfig(
    [
      {
        data: efficiencyPoints,
        label: "Scans",
        pointColor: "#8b5cf6",
        pointRadius: 1.5
      }
    ],
    {
      chartId: "scanEfficiency",
      height: layout.HALF_CHART_HEIGHT,
      independentAxes: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Path Length (feet)",
      yLabel: "Displacement (feet)",
      zoomBox: {
        xMax: zoomPathLengthMax,
        xMin: zoomPathLengthMin,
        yMax: zoomDisplacementMax,
        yMin: zoomDisplacementMin
      }
    }
  );

  // Movement Speed KDE Chart (min/avg/max overlay using shared bounds)
  const avgSpeedVals = metadataList.map((m) => m.avgSpeed).filter((v) => v > noResults);
  const minSpeedVals = metadataList.map((m) => m.minSpeed).filter((v) => v > noResults);
  const maxSpeedVals = metadataList.map((m) => m.maxSpeed).filter((v) => v > noResults);
  const speedInitialMin = 0;
  const speedInitialMax = 2;
  const speedKdeResolution = 200;
  const combinedSpeedVals = [...avgSpeedVals, ...minSpeedVals, ...maxSpeedVals];
  const speedBounds = calculateDynamicKdeBounds(
    combinedSpeedVals,
    speedInitialMin,
    speedInitialMax,
    speedKdeResolution
  );
  const combinedSpeedLabels = calculateKde(combinedSpeedVals, {
    max: speedBounds.max,
    min: speedBounds.min,
    resolution: speedKdeResolution
  }).labels;
  const buildSpeedDataset = (data: number[], label: string, borderColor: string, backgroundColor: string) => {
    const kde = calculateKde(data, {
      max: speedBounds.max,
      min: speedBounds.min,
      resolution: speedKdeResolution
    });
    const emptySpeedValues =
      combinedSpeedLabels.length === initialCount
        ? []
        : new Array<number>(combinedSpeedLabels.length).fill(initialCount);
    const values = kde.values.length === initialCount ? emptySpeedValues : kde.values;
    return {
      backgroundColor,
      borderColor,
      borderWidth: 2,
      data: values,
      fill: false,
      label
    };
  };
  const movementSpeed = getLineChartConfig(
    combinedSpeedLabels,
    [
      buildSpeedDataset(minSpeedVals, "Minimum Speed", "#0ea5e9", "rgba(14, 165, 233, 0.15)"),
      buildSpeedDataset(avgSpeedVals, "Average Speed", "#10b981", "rgba(16, 185, 129, 0.2)"),
      buildSpeedDataset(maxSpeedVals, "Maximum Speed", "#f97316", "rgba(249, 115, 22, 0.18)")
    ],
    {
      chartId: "movementSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "ft/s",
      yLabel: "Density"
    }
  );

  // Ambient Intensity KDE Chart (Average)
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > noResults);
  const ambientInitialMin = 980;
  const ambientInitialMax = 1040;
  const ambientKdeResolution = 200;
  const { kde: ambientKde } = buildDynamicKde(
    intensityVals,
    ambientInitialMin,
    ambientInitialMax,
    ambientKdeResolution
  );
  const ambient = getLineChartConfig(
    ambientKde.labels,
    [
      {
        borderColor: "#d97706",
        borderWidth: 2,
        data: ambientKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#1f2937",
        gradientTo: "#fbbf24",
        label: "Density"
      }
    ],
    {
      chartId: "ambient",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Lux",
      yLabel: "Count"
    }
  );

  // Minimum Ambient Intensity KDE Chart
  // Uses darker colors to represent lower light levels (minimum values are darker conditions)
  const minIntensityVals = metadataList.map((m) => m.minAmbientIntensity).filter((v) => v > noResults);
  const minAmbientInitialMin = 0;
  const minAmbientInitialMax = 1200;
  const minAmbientKdeResolution = 200;
  const { kde: minAmbientKde } = buildDynamicKde(
    minIntensityVals,
    minAmbientInitialMin,
    minAmbientInitialMax,
    minAmbientKdeResolution
  );
  const minAmbient = getLineChartConfig(
    minAmbientKde.labels,
    [
      {
        borderColor: "#44403c",
        borderWidth: 2,
        data: minAmbientKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#0c0a09",
        gradientTo: "#78716c",
        label: "Density"
      }
    ],
    {
      chartId: "minAmbient",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "Lux",
      yLabel: "Count"
    }
  );

  // Maximum Ambient Intensity KDE Chart
  // Uses brighter colors to represent higher light levels (maximum values are brightest conditions)
  const maxIntensityVals = metadataList.map((m) => m.maxAmbientIntensity).filter((v) => v > noResults);
  const maxAmbientInitialMin = 0;
  const maxAmbientInitialMax = 5000;
  const maxAmbientKdeResolution = 200;
  const { kde: maxAmbientKde } = buildDynamicKde(
    maxIntensityVals,
    maxAmbientInitialMin,
    maxAmbientInitialMax,
    maxAmbientKdeResolution
  );
  const maxAmbient = getLineChartConfig(
    maxAmbientKde.labels,
    [
      {
        borderColor: "#eab308",
        borderWidth: 2,
        data: maxAmbientKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#fbbf24",
        gradientTo: "#fef9c3",
        label: "Density"
      }
    ],
    {
      chartId: "maxAmbient",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "Lux",
      yLabel: "Count"
    }
  );

  // Color Temperature KDE Chart (Average)
  // Uses Kelvin-to-RGB conversion for accurate color representation
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > noResults);
  const tempInitialMin = 3500;
  const tempInitialMax = 6700;
  const tempKdeResolution = 200;
  const { bounds: tempBounds, kde: tempKde } = buildDynamicKde(
    tempVals,
    tempInitialMin,
    tempInitialMax,
    tempKdeResolution
  );
  const tempColorFrom = kelvinToHex(tempBounds.min);
  const tempColorTo = kelvinToHex(tempBounds.max);
  const midpointDivisor = 2;
  const tempMidpoint = (tempBounds.min + tempBounds.max) / midpointDivisor;
  const tempBorderColor = kelvinToHex(tempMidpoint);
  const temperature = getLineChartConfig(
    tempKde.labels,
    [
      {
        borderColor: tempBorderColor,
        borderWidth: 2,
        data: tempKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: tempColorFrom,
        gradientTo: tempColorTo,
        label: "Density"
      }
    ],
    {
      chartId: "temperature",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Kelvin",
      yLabel: "Count"
    }
  );

  // Minimum Color Temperature KDE Chart
  const minTempVals = metadataList.map((m) => m.minColorTemperature).filter((v) => v > noResults);
  const minTempInitialMin = 0;
  const minTempInitialMax = 8000;
  const { bounds: minTempBounds, kde: minTempKde } = buildDynamicKde(
    minTempVals,
    minTempInitialMin,
    minTempInitialMax,
    tempKdeResolution
  );
  const minTempColorFrom = kelvinToHex(minTempBounds.min);
  const minTempColorTo = kelvinToHex(minTempBounds.max);
  const minTempMidpoint = (minTempBounds.min + minTempBounds.max) / midpointDivisor;
  const minTempBorderColor = kelvinToHex(minTempMidpoint);
  const minTemperature = getLineChartConfig(
    minTempKde.labels,
    [
      {
        borderColor: minTempBorderColor,
        borderWidth: 2,
        data: minTempKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: minTempColorFrom,
        gradientTo: minTempColorTo,
        label: "Density"
      }
    ],
    {
      chartId: "minTemperature",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "Kelvin",
      yLabel: "Count"
    }
  );

  // Maximum Color Temperature KDE Chart
  const maxTempVals = metadataList.map((m) => m.maxColorTemperature).filter((v) => v > noResults);
  const maxTempInitialMin = 0;
  const maxTempInitialMax = 10000;
  const { bounds: maxTempBounds, kde: maxTempKde } = buildDynamicKde(
    maxTempVals,
    maxTempInitialMin,
    maxTempInitialMax,
    tempKdeResolution
  );
  const maxTempColorFrom = kelvinToHex(maxTempBounds.min);
  const maxTempColorTo = kelvinToHex(maxTempBounds.max);
  const maxTempMidpoint = (maxTempBounds.min + maxTempBounds.max) / midpointDivisor;
  const maxTempBorderColor = kelvinToHex(maxTempMidpoint);
  const maxTemperature = getLineChartConfig(
    maxTempKde.labels,
    [
      {
        borderColor: maxTempBorderColor,
        borderWidth: 2,
        data: maxTempKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: maxTempColorFrom,
        gradientTo: maxTempColorTo,
        label: "Density"
      }
    ],
    {
      chartId: "maxTemperature",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "Kelvin",
      yLabel: "Count"
    }
  );

  // ISO KDE Chart (Average)
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > noResults);
  const isoInitialMin = 0;
  const isoInitialMax = 800;
  const isoKdeResolution = 200;
  const isoPalette = {
    background: "rgba(99, 102, 241, 0.2)",
    border: "#6366f1"
  };
  const createIsoDataset = (values: number[]) => ({
    backgroundColor: isoPalette.background,
    borderColor: isoPalette.border,
    borderWidth: 2,
    data: values,
    fill: true,
    label: "Density"
  });
  const { kde: isoKde } = buildDynamicKde(isoVals, isoInitialMin, isoInitialMax, isoKdeResolution);
  const iso = getLineChartConfig(isoKde.labels, [createIsoDataset(isoKde.values)], {
    chartId: "iso",
    height: layout.HALF_CHART_HEIGHT,
    smooth: true,
    title: "",
    width: layout.FULL_CHART_WIDTH,
    xLabel: "ISO",
    yLabel: "Count"
  });

  // Minimum ISO KDE Chart (lower sensitivity = less noise)
  const minIsoVals = metadataList.map((m) => m.minIso).filter((v) => v > noResults);
  const minIsoInitialMin = 0;
  const minIsoInitialMax = 2000;
  const { kde: minIsoKde } = buildDynamicKde(minIsoVals, minIsoInitialMin, minIsoInitialMax, isoKdeResolution);
  const minIso = getLineChartConfig(minIsoKde.labels, [createIsoDataset(minIsoKde.values)], {
    chartId: "minIso",
    height: layout.HALF_CHART_HEIGHT,
    smooth: true,
    title: "",
    width: layout.HALF_CHART_WIDTH,
    xLabel: "ISO",
    yLabel: "Count"
  });

  // Maximum ISO KDE Chart (higher sensitivity = more noise potential)
  const maxIsoVals = metadataList.map((m) => m.maxIso).filter((v) => v > noResults);
  const maxIsoInitialMin = 0;
  const maxIsoInitialMax = 5000;
  const { kde: maxIsoKde } = buildDynamicKde(maxIsoVals, maxIsoInitialMin, maxIsoInitialMax, isoKdeResolution);
  const maxIso = getLineChartConfig(maxIsoKde.labels, [createIsoDataset(maxIsoKde.values)], {
    chartId: "maxIso",
    height: layout.HALF_CHART_HEIGHT,
    smooth: true,
    title: "",
    width: layout.HALF_CHART_WIDTH,
    xLabel: "ISO",
    yLabel: "Count"
  });

  // Brightness KDE Chart (Average)
  // Uses brightness-to-grayscale conversion: -6 = black, 15 = white
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== noResults);
  const briInitialMin = 0;
  const briInitialMax = 6;
  const briKdeResolution = 200;
  const { bounds: briBounds, kde: briKde } = buildDynamicKde(briVals, briInitialMin, briInitialMax, briKdeResolution);
  const briColorFrom = brightnessToHex(briBounds.min);
  const briColorTo = brightnessToHex(briBounds.max);
  const briMidpoint = (briBounds.min + briBounds.max) / midpointDivisor;
  const briBorderColor = brightnessToHex(briMidpoint);
  const brightness = getLineChartConfig(
    briKde.labels,
    [
      {
        borderColor: briBorderColor,
        borderWidth: 2,
        data: briKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: briColorFrom,
        gradientTo: briColorTo,
        label: "Density"
      }
    ],
    {
      chartId: "brightness",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "EV",
      yLabel: "Count"
    }
  );

  // Minimum Brightness KDE Chart
  const minBriVals = metadataList.map((m) => m.minBrightness).filter((v) => Number.isFinite(v));
  const minBriInitialMin = -5;
  const minBriInitialMax = 10;
  const { bounds: minBriBounds, kde: minBriKde } = buildDynamicKde(
    minBriVals,
    minBriInitialMin,
    minBriInitialMax,
    briKdeResolution
  );
  const minBriColorFrom = brightnessToHex(minBriBounds.min);
  const minBriColorTo = brightnessToHex(minBriBounds.max);
  const minBriMidpoint = (minBriBounds.min + minBriBounds.max) / midpointDivisor;
  const minBriBorderColor = brightnessToHex(minBriMidpoint);
  const minBrightness = getLineChartConfig(
    minBriKde.labels,
    [
      {
        borderColor: minBriBorderColor,
        borderWidth: 2,
        data: minBriKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: minBriColorFrom,
        gradientTo: minBriColorTo,
        label: "Density"
      }
    ],
    {
      chartId: "minBrightness",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "EV",
      yLabel: "Count"
    }
  );

  // Maximum Brightness KDE Chart
  const maxBriVals = metadataList.map((m) => m.maxBrightness).filter((v) => Number.isFinite(v));
  const maxBriInitialMin = 0;
  const maxBriInitialMax = 15;
  const { bounds: maxBriBounds, kde: maxBriKde } = buildDynamicKde(
    maxBriVals,
    maxBriInitialMin,
    maxBriInitialMax,
    briKdeResolution
  );
  const maxBriColorFrom = brightnessToHex(maxBriBounds.min);
  const maxBriColorTo = brightnessToHex(maxBriBounds.max);
  const maxBriMidpoint = (maxBriBounds.min + maxBriBounds.max) / midpointDivisor;
  const maxBriBorderColor = brightnessToHex(maxBriMidpoint);
  const maxBrightness = getLineChartConfig(
    maxBriKde.labels,
    [
      {
        borderColor: maxBriBorderColor,
        borderWidth: 2,
        data: maxBriKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: maxBriColorFrom,
        gradientTo: maxBriColorTo,
        label: "Density"
      }
    ],
    {
      chartId: "maxBrightness",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "EV",
      yLabel: "Count"
    }
  );

  // Maximum Tilt Speed KDE Chart (5-second sliding window)
  // Shows the distribution of maximum angular velocity of phone tilt across scans
  // Initial max set to 200 to capture outliers (some values exceed 100°/s)
  const maxTiltSpeedVals = metadataList.map((m) => m.maxTiltSpeed).filter((v) => v > noResults);
  const maxTiltSpeedInitialMin = 0;
  const maxTiltSpeedInitialMax = 200;
  const maxTiltSpeedKdeResolution = 200;
  const { kde: maxTiltSpeedKde } = buildDynamicKde(
    maxTiltSpeedVals,
    maxTiltSpeedInitialMin,
    maxTiltSpeedInitialMax,
    maxTiltSpeedKdeResolution
  );
  const twoPartsOfThree = 2;
  const threePartsTotal = 3;
  const twoThirdsWidthRatio = twoPartsOfThree / threePartsTotal;
  const maxTiltSpeed = getLineChartConfig(
    maxTiltSpeedKde.labels,
    [
      {
        backgroundColor: "rgba(139, 92, 246, 0.3)",
        borderColor: "#8b5cf6",
        borderWidth: 2,
        data: maxTiltSpeedKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "maxTiltSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "°/s",
      yLabel: "Count"
    }
  );

  // Fast Tilts Pie Chart
  // Shows percentage of scans with maximum tilt speed greater than 5 °/s
  const fastTiltThreshold = 5;
  const fastTiltCount = metadataList.filter((m) => m.maxTiltSpeed > fastTiltThreshold).length;
  const noFastTiltCount = metadataList.length - fastTiltCount;
  const onePartOfThree = 1;
  const oneThirdWidthRatio = onePartOfThree / threePartsTotal;
  const fastTilts = getPieChartConfig(["Fast Tilts", "No Fast Tilts"], [fastTiltCount, noFastTiltCount], {
    colors: ["#f97316", "#22c55e"],
    height: pieChartHeight,
    title: "",
    width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
  });

  // Fast Tilt Timing Line Chart
  // Shows when during scans fast tilts occur (as percentage of scan progress)
  // Use 1001 bins (0-1000 inclusive) for 0.1% granularity to capture ~240 samples per 60s scan at 4fps
  // Each bin counts the number of unique artifacts that have at least one fast tilt at that percentage
  const percentBins = 1001;
  const binsPerPercent = 10;
  const fastTiltTimingCounts: number[] = new Array<number>(percentBins).fill(initialCount);
  const firstBinIdx = 0;
  const lastBinIdx = 1000;

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.fastTiltTimings)) {
      continue;
    }
    // Track which bins this artifact contributes to (each artifact counts at most once per bin)
    const binsForThisArtifact = new Set<number>();
    for (const percentage of artifact.fastTiltTimings) {
      const binIdx = Math.min(Math.max(Math.round(percentage * binsPerPercent), firstBinIdx), lastBinIdx);
      binsForThisArtifact.add(binIdx);
    }
    // Increment each bin that this artifact contributed to
    for (const binIdx of binsForThisArtifact) {
      const currentVal = fastTiltTimingCounts[binIdx] ?? initialCount;
      fastTiltTimingCounts[binIdx] = currentVal + incrementStep;
    }
  }

  const fastTiltTimingLabels: string[] = [];
  for (let i = 0; i < percentBins; i++) {
    if (i === firstBinIdx) {
      fastTiltTimingLabels.push("Scan Start");
    } else if (i === lastBinIdx) {
      fastTiltTimingLabels.push("Scan End");
    } else {
      const percentValue = i / binsPerPercent;
      fastTiltTimingLabels.push(`${String(percentValue)}%`);
    }
  }

  const fastTiltTiming = getLineChartConfig(
    fastTiltTimingLabels,
    [
      {
        borderColor: "#f97316",
        borderWidth: 2,
        data: fastTiltTimingCounts,
        label: "Fast Tilts",
        verticalLines: true
      }
    ],
    {
      chartId: "fastTiltTiming",
      height: layout.HALF_CHART_HEIGHT,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Scan Progress",
      yLabel: "Count"
    }
  );

  // Maximum Roll Speed KDE Chart (5-second sliding window)
  // Shows the distribution of maximum angular velocity of phone roll across scans
  const maxRollSpeedVals = metadataList.map((m) => m.maxRollSpeed).filter((v) => v > noResults);
  const maxRollSpeedInitialMin = 0;
  const maxRollSpeedInitialMax = 200;
  const maxRollSpeedKdeResolution = 200;
  const { kde: maxRollSpeedKde } = buildDynamicKde(
    maxRollSpeedVals,
    maxRollSpeedInitialMin,
    maxRollSpeedInitialMax,
    maxRollSpeedKdeResolution
  );
  const maxRollSpeed = getLineChartConfig(
    maxRollSpeedKde.labels,
    [
      {
        backgroundColor: "rgba(59, 130, 246, 0.3)",
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: maxRollSpeedKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "maxRollSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "°/s",
      yLabel: "Count"
    }
  );

  // Fast Rolls Pie Chart
  // Shows percentage of scans with maximum roll speed greater than 5 °/s
  const fastRollThreshold = 5;
  const fastRollCount = metadataList.filter((m) => m.maxRollSpeed > fastRollThreshold).length;
  const noFastRollCount = metadataList.length - fastRollCount;
  const fastRolls = getPieChartConfig(["Fast Rolls", "No Fast Rolls"], [fastRollCount, noFastRollCount], {
    colors: ["#3b82f6", "#22c55e"],
    height: pieChartHeight,
    title: "",
    width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
  });

  // Fast Roll Timing Line Chart
  // Shows when during scans fast rolls occur (as percentage of scan progress)
  const fastRollTimingCounts: number[] = new Array<number>(percentBins).fill(initialCount);

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.fastRollTimings)) {
      continue;
    }
    // Track which bins this artifact contributes to (each artifact counts at most once per bin)
    const binsForThisArtifact = new Set<number>();
    for (const percentage of artifact.fastRollTimings) {
      const binIdx = Math.min(Math.max(Math.round(percentage * binsPerPercent), firstBinIdx), lastBinIdx);
      binsForThisArtifact.add(binIdx);
    }
    // Increment each bin that this artifact contributed to
    for (const binIdx of binsForThisArtifact) {
      const currentVal = fastRollTimingCounts[binIdx] ?? initialCount;
      fastRollTimingCounts[binIdx] = currentVal + incrementStep;
    }
  }

  const fastRollTimingLabels: string[] = [];
  for (let i = 0; i < percentBins; i++) {
    if (i === firstBinIdx) {
      fastRollTimingLabels.push("Scan Start");
    } else if (i === lastBinIdx) {
      fastRollTimingLabels.push("Scan End");
    } else {
      const percentValue = i / binsPerPercent;
      fastRollTimingLabels.push(`${String(percentValue)}%`);
    }
  }

  const fastRollTiming = getLineChartConfig(
    fastRollTimingLabels,
    [
      {
        borderColor: "#3b82f6",
        borderWidth: 2,
        data: fastRollTimingCounts,
        label: "Fast Rolls",
        verticalLines: true
      }
    ],
    {
      chartId: "fastRollTiming",
      height: layout.HALF_CHART_HEIGHT,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Scan Progress",
      yLabel: "Count"
    }
  );

  // Maximum Pan Speed KDE Chart (5-second sliding window)
  // Shows the distribution of maximum angular velocity of phone pan across scans
  const maxPanSpeedVals = metadataList.map((m) => m.maxPanSpeed).filter((v) => v > noResults);
  const maxPanSpeedInitialMin = 0;
  const maxPanSpeedInitialMax = 200;
  const maxPanSpeedKdeResolution = 200;
  const { kde: maxPanSpeedKde } = buildDynamicKde(
    maxPanSpeedVals,
    maxPanSpeedInitialMin,
    maxPanSpeedInitialMax,
    maxPanSpeedKdeResolution
  );
  const maxPanSpeed = getLineChartConfig(
    maxPanSpeedKde.labels,
    [
      {
        backgroundColor: "rgba(16, 185, 129, 0.3)",
        borderColor: "#10b981",
        borderWidth: 2,
        data: maxPanSpeedKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "maxPanSpeed",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "°/s",
      yLabel: "Count"
    }
  );

  // Fast Pans Pie Chart
  // Shows percentage of scans with maximum pan speed greater than 5 °/s
  const fastPanThreshold = 5;
  const fastPanCount = metadataList.filter((m) => m.maxPanSpeed > fastPanThreshold).length;
  const noFastPanCount = metadataList.length - fastPanCount;
  const fastPans = getPieChartConfig(["Fast Pans", "No Fast Pans"], [fastPanCount, noFastPanCount], {
    colors: ["#10b981", "#9ca3af"],
    height: pieChartHeight,
    title: "",
    width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
  });

  // Fast Pan Timing Line Chart
  // Shows when during scans fast pans occur (as percentage of scan progress)
  const fastPanTimingCounts: number[] = new Array<number>(percentBins).fill(initialCount);

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.fastPanTimings)) {
      continue;
    }
    // Track which bins this artifact contributes to (each artifact counts at most once per bin)
    const binsForThisArtifact = new Set<number>();
    for (const percentage of artifact.fastPanTimings) {
      const binIdx = Math.min(Math.max(Math.round(percentage * binsPerPercent), firstBinIdx), lastBinIdx);
      binsForThisArtifact.add(binIdx);
    }
    // Increment each bin that this artifact contributed to
    for (const binIdx of binsForThisArtifact) {
      const currentVal = fastPanTimingCounts[binIdx] ?? initialCount;
      fastPanTimingCounts[binIdx] = currentVal + incrementStep;
    }
  }

  const fastPanTimingLabels: string[] = [];
  for (let i = 0; i < percentBins; i++) {
    if (i === firstBinIdx) {
      fastPanTimingLabels.push("Scan Start");
    } else if (i === lastBinIdx) {
      fastPanTimingLabels.push("Scan End");
    } else {
      const percentValue = i / binsPerPercent;
      fastPanTimingLabels.push(`${String(percentValue)}%`);
    }
  }

  const fastPanTiming = getLineChartConfig(
    fastPanTimingLabels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: fastPanTimingCounts,
        label: "Fast Pans",
        verticalLines: true
      }
    ],
    {
      chartId: "fastPanTiming",
      height: layout.HALF_CHART_HEIGHT,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "Scan Progress",
      yLabel: "Count"
    }
  );

  // Full Rotation Detection Pie Chart
  // A scan is considered to have completed a full 360° rotation if all 36 ten-degree
  // sectors have at least one reading in the phonePanHistogram.
  // The histogram has 3601 bins (0-360° at 0.1° resolution, inclusive of both endpoints).
  // Each 10° sector spans 100 bins (e.g., sector 0 = bins 0-99 covering 0°-9.9°).
  const sectorCount = 36;
  const binsPerSector = 100;
  const panHistogramLength = 3601;

  // Count how many sectors have coverage in a histogram
  const countSectorsCovered = (histogram: number[]): number => {
    if (!Array.isArray(histogram) || histogram.length !== panHistogramLength) {
      return initialCount;
    }
    let coveredCount = initialCount;
    for (let sector = 0; sector < sectorCount; sector++) {
      const sectorStart = sector * binsPerSector;
      const sectorEnd = sectorStart + binsPerSector;
      for (let bin = sectorStart; bin < sectorEnd; bin++) {
        const binCount = histogram[bin] ?? initialCount;
        if (binCount > initialCount) {
          coveredCount++;
          break;
        }
      }
    }
    return coveredCount;
  };

  const hasFullRotation = (histogram: number[]): boolean => {
    return countSectorsCovered(histogram) === sectorCount;
  };

  const fullRotationCount = metadataList.filter((m) => hasFullRotation(m.phonePanHistogram)).length;
  const partialRotationCount = metadataList.length - fullRotationCount;
  const fullRotation = getPieChartConfig(
    ["Full 360° Rotation", "Partial Rotation"],
    [fullRotationCount, partialRotationCount],
    {
      colors: ["#22c55e", "#f59e0b"],
      height: pieChartHeight,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * oneThirdWidthRatio)
    }
  );

  // Partial Rotation Coverage Line Chart
  // Shows distribution of coverage for scans with less than 360° rotation
  const percentMultiplier = 100;
  const coverageInitialMin = 0;
  const coverageInitialMax = 100;
  const coverageResolution = 200;
  const coveragePercentages: number[] = [];
  for (const artifact of metadataList) {
    const sectorsCovered = countSectorsCovered(artifact.phonePanHistogram);
    if (sectorsCovered < sectorCount) {
      // Calculate percentage coverage for partial rotations so we can build a smooth density curve
      const percentCoverage = (sectorsCovered / sectorCount) * percentMultiplier;
      coveragePercentages.push(percentCoverage);
    }
  }

  const hasPartialCoverage = coveragePercentages.length > initialCount;
  let coverageLabels: string[] = [];
  let coverageValues: number[] = [];
  if (hasPartialCoverage) {
    const { kde: coverageKde } = buildDynamicKde(
      coveragePercentages,
      coverageInitialMin,
      coverageInitialMax,
      coverageResolution
    );
    coverageLabels = coverageKde.labels;
    coverageValues = coverageKde.values;
  } else {
    const percentBinCount = 101;
    coverageLabels = Array.from({ length: percentBinCount }, (_, idx) => `${String(idx)}%`);
    coverageValues = new Array<number>(percentBinCount).fill(initialCount);
  }

  const partialRotationCoverage = getLineChartConfig(
    coverageLabels,
    [
      {
        backgroundColor: "rgba(249, 115, 22, 0.3)",
        borderColor: "#f97316",
        borderWidth: 2,
        data: coverageValues,
        fill: true,
        label: "Partial Rotations"
      }
    ],
    {
      chartId: "partialRotationCoverage",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio),
      xLabel: "",
      yLabel: "Count"
    }
  );

  return {
    ambient,
    aperture,
    arDataFramerate,
    brightness,
    deviceModel,
    droppedFrames,
    fastPanTiming,
    fastPans,
    fastRollTiming,
    fastRolls,
    fastTiltTiming,
    fastTilts,
    focalLength,
    fullRotation,
    iso,
    maxAmbient,
    maxBrightness,
    maxIso,
    maxPanSpeed,
    maxRollSpeed,
    maxTemperature,
    maxTiltSpeed,
    minAmbient,
    minBrightness,
    minIso,
    minTemperature,
    movementSpeed,
    partialRotationCoverage,
    scanEfficiency,
    temperature,
    timeOfDay,
    timezone
  };
}

function buildDroppedFramesOverTimeSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const noEntries = 0;
  const minDatesForChart = 2;
  const datePartIndex = 0;
  const defaultCount = 0;
  const countIncrement = 1;

  // Group artifacts by scan date and count dropped frames
  const dateDroppedCounts = new Map<string, number>();
  const dateTotalCounts = new Map<string, number>();
  const datesToCount = new Set<string>();

  for (const artifact of metadataList) {
    if (artifact.scanDateTime === "") {
      continue;
    }
    // Parse EXIF date format "YYYY:MM:DD HH:MM:SS" to extract date
    const datePart = artifact.scanDateTime.split(" ")[datePartIndex];
    if (datePart === undefined || datePart === "") {
      continue;
    }
    // Convert "YYYY:MM:DD" to "YYYY-MM-DD" for consistency
    const dateKey = datePart.replace(/:/g, "-");
    if (dateKey.startsWith("0001")) {
      continue;
    }
    datesToCount.add(dateKey);

    dateTotalCounts.set(dateKey, (dateTotalCounts.get(dateKey) ?? defaultCount) + countIncrement);
    if (artifact.hasDroppedArFrames) {
      dateDroppedCounts.set(dateKey, (dateDroppedCounts.get(dateKey) ?? defaultCount) + countIncrement);
    }
  }

  const sortedDataDates = Array.from(datesToCount).sort();
  if (sortedDataDates.length < minDatesForChart) {
    return null;
  }

  // Use global date range for consistent x-axis
  const sortedDates = getGlobalDateRange();

  // Calculate percentage of dropped frames per date
  const percentageMultiplier = 100;
  const data = sortedDates.map((date) => {
    const total = dateTotalCounts.get(date) ?? noEntries;
    const dropped = dateDroppedCounts.get(date) ?? noEntries;
    if (total === noEntries) {
      return noEntries;
    }
    return (dropped / total) * percentageMultiplier;
  });

  const chartConfig: LineChartConfig = {
    datasets: [
      {
        borderColor: "#ef4444",
        data,
        label: "Dropped Frames %",
        verticalLines: true
      }
    ],
    height: 300,
    labels: sortedDates,
    options: {
      title: "Artifacts with Dropped Frames Over Time",
      yLabel: "% of Scans"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Artifacts with Dropped Frames Over Time",
    type: "react-component"
  };
}

function buildAvgDroppedFramePercentageOverTimeSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const noEntries = 0;
  const minDatesForChart = 2;
  const datePartIndex = 0;
  const defaultCount = 0;
  const countIncrement = 1;

  // Group artifacts by scan date and sum dropped frame percentages
  const dateDroppedPercentageSums = new Map<string, number>();
  const dateTotalCounts = new Map<string, number>();
  const datesToCount = new Set<string>();

  for (const artifact of metadataList) {
    if (artifact.scanDateTime === "") {
      continue;
    }
    // Parse EXIF date format "YYYY:MM:DD HH:MM:SS" to extract date
    const datePart = artifact.scanDateTime.split(" ")[datePartIndex];
    if (datePart === undefined || datePart === "") {
      continue;
    }
    // Convert "YYYY:MM:DD" to "YYYY-MM-DD" for consistency
    const dateKey = datePart.replace(/:/g, "-");
    if (dateKey.startsWith("0001")) {
      continue;
    }
    datesToCount.add(dateKey);

    dateTotalCounts.set(dateKey, (dateTotalCounts.get(dateKey) ?? defaultCount) + countIncrement);
    const currentSum = dateDroppedPercentageSums.get(dateKey) ?? defaultCount;
    dateDroppedPercentageSums.set(dateKey, currentSum + artifact.droppedArFramePercentage);
  }

  const sortedDataDates = Array.from(datesToCount).sort();
  if (sortedDataDates.length < minDatesForChart) {
    return null;
  }

  // Use global date range for consistent x-axis
  const sortedDates = getGlobalDateRange();

  // Calculate average dropped frame percentage per date
  const data = sortedDates.map((date) => {
    const total = dateTotalCounts.get(date) ?? noEntries;
    const sumPercentage = dateDroppedPercentageSums.get(date) ?? noEntries;
    if (total === noEntries) {
      return noEntries;
    }
    return sumPercentage / total;
  });

  const chartConfig: LineChartConfig = {
    datasets: [
      {
        borderColor: "#f97316",
        data,
        label: "Avg Dropped Frame %",
        verticalLines: true
      }
    ],
    height: 300,
    labels: sortedDates,
    options: {
      title: "Average Dropped Frame Percentage Over Time",
      yDecimalPlaces: 1,
      yLabel: "% of Frames Dropped",
      yTickSuffix: "%"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Average Dropped Frame Percentage Over Time",
    type: "react-component"
  };
}

function loadPhoneTiltImageBase64(): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "phone-orientation", "tilt.png");
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

function loadPhoneRollImageBase64(): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "phone-orientation", "roll.png");
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

function loadPhonePanImageBase64(): string {
  const imagePath = path.join(process.cwd(), "src", "templates", "assets", "images", "phone-orientation", "pan.png");
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

function buildPhoneTiltSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const layout = computeLayoutConstants();
  const binsPerDegree = 10;
  const maxAngleDegrees = 180;
  const maxBinIndex = maxAngleDegrees * binsPerDegree;
  const histogramSizeOffset = 1;
  const histogramSize = maxBinIndex + histogramSizeOffset;
  const noCount = 0;
  const startIndex = 0;

  const aggregatedHistogram: number[] = new Array<number>(histogramSize).fill(noCount);
  let leftOverflowCount = noCount;
  let rightOverflowCount = noCount;

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.phoneTiltHistogram)) {
      continue;
    }
    for (let i = startIndex; i < artifact.phoneTiltHistogram.length && i < histogramSize; i++) {
      const count = artifact.phoneTiltHistogram[i];
      if (typeof count === "number") {
        const currentTotal = aggregatedHistogram[i] ?? noCount;
        aggregatedHistogram[i] = currentTotal + count;
      }
    }
    leftOverflowCount += artifact.phoneTiltLeftOverflow;
    rightOverflowCount += artifact.phoneTiltRightOverflow;
  }

  const totalCount = aggregatedHistogram.reduce((sum, count) => sum + count, noCount);
  if (totalCount === noCount) {
    return null;
  }

  const twoThirdsWidthRatio = 0.6;
  const chartWidth = Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio);

  const chartConfig: ProtractorChartConfig = {
    height: layout.HALF_CHART_HEIGHT,
    histogram: aggregatedHistogram,
    leftOverflowCount,
    options: {
      chartId: "phoneTilt",
      lineColor: "#8b5cf6",
      title: "",
      width: chartWidth
    },
    rightOverflowCount,
    type: "protractor"
  };

  const imageDataUri = loadPhoneTiltImageBase64();

  const ChartComponent = (): React.ReactElement =>
    React.createElement(
      "div",
      {
        style: {
          alignItems: "center",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          width: "100%"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            alignItems: "center",
            display: "flex",
            flex: "1",
            justifyContent: "center"
          }
        },
        React.createElement("img", {
          alt: "Phone tilt illustration",
          src: imageDataUri,
          style: {
            maxHeight: `${String(layout.HALF_CHART_HEIGHT)}px`,
            maxWidth: "100%",
            objectFit: "contain"
          }
        })
      ),
      React.createElement(
        "div",
        {
          style: {
            flex: "2"
          }
        },
        React.createElement(ProtractorChart, { config: chartConfig })
      )
    );

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Phone Tilt Profile",
    type: "react-component"
  };
}

function buildPhoneRollSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const layout = computeLayoutConstants();
  const binsPerDegree = 10;
  const maxAngleDegrees = 180;
  const maxBinIndex = maxAngleDegrees * binsPerDegree;
  const histogramSizeOffset = 1;
  const histogramSize = maxBinIndex + histogramSizeOffset;
  const noCount = 0;
  const startIndex = 0;

  const aggregatedHistogram: number[] = new Array<number>(histogramSize).fill(noCount);
  let leftOverflowCount = noCount;
  let rightOverflowCount = noCount;

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.phoneRollHistogram)) {
      continue;
    }
    for (let i = startIndex; i < artifact.phoneRollHistogram.length && i < histogramSize; i++) {
      const count = artifact.phoneRollHistogram[i];
      if (typeof count === "number") {
        const currentTotal = aggregatedHistogram[i] ?? noCount;
        aggregatedHistogram[i] = currentTotal + count;
      }
    }
    leftOverflowCount += artifact.phoneRollLeftOverflow;
    rightOverflowCount += artifact.phoneRollRightOverflow;
  }

  const totalCount = aggregatedHistogram.reduce((sum, count) => sum + count, noCount);
  if (totalCount === noCount) {
    return null;
  }

  const twoThirdsWidthRatio = 0.6;
  const chartWidth = Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio);

  const chartConfig: ProtractorChartConfig = {
    height: layout.HALF_CHART_HEIGHT,
    histogram: aggregatedHistogram,
    leftOverflowCount,
    options: {
      chartId: "phoneRoll",
      lineColor: "#3b82f6",
      title: "",
      width: chartWidth
    },
    rightOverflowCount,
    type: "protractor"
  };

  const imageDataUri = loadPhoneRollImageBase64();

  const ChartComponent = (): React.ReactElement =>
    React.createElement(
      "div",
      {
        style: {
          alignItems: "center",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          width: "100%"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            alignItems: "center",
            display: "flex",
            flex: "1",
            justifyContent: "center"
          }
        },
        React.createElement("img", {
          alt: "Phone roll illustration",
          src: imageDataUri,
          style: {
            maxHeight: `${String(layout.HALF_CHART_HEIGHT)}px`,
            maxWidth: "100%",
            objectFit: "contain"
          }
        })
      ),
      React.createElement(
        "div",
        {
          style: {
            flex: "2"
          }
        },
        React.createElement(ProtractorChart, { config: chartConfig })
      )
    );

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Phone Roll Profile",
    type: "react-component"
  };
}

function buildPhonePanSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const layout = computeLayoutConstants();
  const binsPerDegree = 10;
  const maxAngleDegrees = 360;
  const maxBinIndex = maxAngleDegrees * binsPerDegree;
  const histogramSizeOffset = 1;
  const histogramSize = maxBinIndex + histogramSizeOffset;
  const noCount = 0;
  const startIndex = 0;

  const aggregatedHistogram: number[] = new Array<number>(histogramSize).fill(noCount);

  for (const artifact of metadataList) {
    if (!Array.isArray(artifact.phonePanHistogram)) {
      continue;
    }
    for (let i = startIndex; i < artifact.phonePanHistogram.length && i < histogramSize; i++) {
      const count = artifact.phonePanHistogram[i];
      if (typeof count === "number") {
        const currentTotal = aggregatedHistogram[i] ?? noCount;
        aggregatedHistogram[i] = currentTotal + count;
      }
    }
  }

  const totalCount = aggregatedHistogram.reduce((sum, count) => sum + count, noCount);
  if (totalCount === noCount) {
    return null;
  }

  const twoThirdsWidthRatio = 0.6;
  const chartWidth = Math.round(layout.PAGE_CONTENT_WIDTH * twoThirdsWidthRatio);
  const zeroAtTopAngleOffset = 90;

  const chartConfig: ProtractorChartConfig = {
    height: layout.HALF_CHART_HEIGHT,
    histogram: aggregatedHistogram,
    leftOverflowCount: noCount,
    options: {
      angleOffsetDegrees: zeroAtTopAngleOffset,
      chartId: "phonePan",
      fullCircle: true,
      lineColor: "#10b981",
      showAverage: false,
      title: "",
      width: chartWidth
    },
    rightOverflowCount: noCount,
    type: "protractor"
  };

  const imageDataUri = loadPhonePanImageBase64();

  const ChartComponent = (): React.ReactElement =>
    React.createElement(
      "div",
      {
        style: {
          alignItems: "center",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          width: "100%"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            alignItems: "center",
            display: "flex",
            flex: "1",
            justifyContent: "center"
          }
        },
        React.createElement("img", {
          alt: "Phone pan illustration",
          src: imageDataUri,
          style: {
            maxHeight: `${String(layout.HALF_CHART_HEIGHT)}px`,
            maxWidth: "100%",
            objectFit: "contain"
          }
        })
      ),
      React.createElement(
        "div",
        {
          style: {
            flex: "2"
          }
        },
        React.createElement(ProtractorChart, { config: chartConfig })
      )
    );

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Phone Pan Profile",
    type: "react-component"
  };
}

function buildSphericalCoverageSection(metadataList: ArtifactAnalysis[]): ReportSection | null {
  const emptyCount = 0;
  const hundredPercent = 100;
  const coverageSpheres: CoverageSphere[] = [];
  for (const artifact of metadataList) {
    if (
      artifact.coverageSphere !== undefined &&
      artifact.coverageSphere.rows > emptyCount &&
      artifact.coverageSphere.cols > emptyCount &&
      artifact.coverageSphere.grid.length > emptyCount
    ) {
      coverageSpheres.push(artifact.coverageSphere);
    }
  }

  const aggregation = aggregateCoverageSpheres(coverageSpheres);
  if (aggregation === null) {
    return null;
  }

  let coveragePercent = emptyCount;
  if (coverageSpheres.length > emptyCount) {
    const totalBins =
      coverageSpheres[emptyCount] !== undefined
        ? coverageSpheres[emptyCount].rows * coverageSpheres[emptyCount].cols
        : aggregation.totalBins;
    const coverageSum = coverageSpheres.reduce((sum, sphere) => {
      const nonZero = sphere.grid.reduce((rowTotal, row) => {
        if (!Array.isArray(row)) {
          return rowTotal;
        }
        return rowTotal + row.filter((value) => value > emptyCount).length;
      }, emptyCount);
      return sum + (totalBins > emptyCount ? nonZero / totalBins : emptyCount);
    }, emptyCount);
    coveragePercent = (coverageSum / coverageSpheres.length) * hundredPercent;
  }

  const CoverageComponent = (): React.ReactElement =>
    React.createElement(
      "div",
      { className: "flex flex-col gap-4" },
      React.createElement(SphericalCoverageGlobe, {
        coveragePercent,
        grid: aggregation.grid,
        maxSeconds: aggregation.maxBinSeconds,
        nonZeroBins: aggregation.nonZeroBins,
        totalSeconds: aggregation.totalSeconds
      }),
      React.createElement(SphericalCoverageHeatmap, {
        grid: aggregation.grid,
        maxSeconds: aggregation.maxBinSeconds
      })
    );

  return {
    component: CoverageComponent,
    title: "Spherical Coverage",
    type: "react-component"
  };
}

function buildArDataReportSections(
  charts: ArDataCharts,
  videoCount: number,
  metadataList: ArtifactAnalysis[]
): ReportData {
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];

  sections.push({
    data: charts.deviceModel,
    title: "Device Model",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.focalLength,
        title: "Focal Length"
      },
      {
        data: charts.aperture,
        title: "Max Aperture"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.timezone,
    title: "Timezone (UTC Offset)",
    type: "chart"
  });

  sections.push({
    data: charts.timeOfDay,
    title: "Time of Day (Hour)",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.arDataFramerate,
        title: "AR Data Capture Rate"
      },
      {
        data: charts.droppedFrames,
        title: "Artifacts with Dropped Frames"
      }
    ],
    type: "chart-row"
  });

  const droppedFramesOverTime = buildDroppedFramesOverTimeSection(metadataList);
  if (droppedFramesOverTime !== null) {
    sections.push(droppedFramesOverTime);
  }

  const avgDroppedFramePercentageOverTime = buildAvgDroppedFramePercentageOverTimeSection(metadataList);
  if (avgDroppedFramePercentageOverTime !== null) {
    sections.push(avgDroppedFramePercentageOverTime);
  }

  sections.push({
    data: charts.scanEfficiency,
    title: "Scan Efficiency",
    type: "chart"
  });

  sections.push({
    title: "Movement Speed",
    type: "header"
  });

  sections.push({
    data: charts.movementSpeed,
    title: "Min / Avg / Max Speed Distribution",
    type: "chart"
  });

  const phoneTiltSection = buildPhoneTiltSection(metadataList);
  if (phoneTiltSection !== null) {
    sections.push(phoneTiltSection);
  }

  sections.push({
    data: [
      {
        data: charts.fastTilts,
        title: "Scans with Fast Tilts (>5 °/s)"
      },
      {
        data: charts.maxTiltSpeed,
        title: "Maximum Tilt Speed"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.fastTiltTiming,
    title: "Fast Tilt Timing During Scan",
    type: "chart"
  });

  const phoneRollSection = buildPhoneRollSection(metadataList);
  if (phoneRollSection !== null) {
    sections.push(phoneRollSection);
  }

  sections.push({
    data: [
      {
        data: charts.fastRolls,
        title: "Scans with Fast Rolls (>5 °/s)"
      },
      {
        data: charts.maxRollSpeed,
        title: "Maximum Roll Speed"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.fastRollTiming,
    title: "Fast Roll Timing During Scan",
    type: "chart"
  });

  const phonePanSection = buildPhonePanSection(metadataList);
  if (phonePanSection !== null) {
    sections.push(phonePanSection);
  }

  sections.push({
    data: [
      {
        data: charts.fastPans,
        title: "Scans with Fast Pans (>5 °/s)"
      },
      {
        data: charts.maxPanSpeed,
        title: "Maximum Pan Speed"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    data: charts.fastPanTiming,
    title: "Fast Pan Timing During Scan",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.fullRotation,
        title: "Scans with Full 360° Rotation"
      },
      {
        data: charts.partialRotationCoverage,
        title: "Partial Rotation Coverage"
      }
    ],
    type: "chart-row"
  });

  const sphericalCoverageSection = buildSphericalCoverageSection(metadataList);
  if (sphericalCoverageSection !== null) {
    sections.push(sphericalCoverageSection);
  }

  sections.push({
    title: "Ambient Intensity",
    type: "header"
  });

  sections.push({
    data: charts.ambient,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minAmbient,
        title: "Minimum"
      },
      {
        data: charts.maxAmbient,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    title: "Color Temperature",
    type: "header"
  });

  sections.push({
    data: charts.temperature,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minTemperature,
        title: "Minimum"
      },
      {
        data: charts.maxTemperature,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    title: "ISO Speed",
    type: "header"
  });

  sections.push({
    data: charts.iso,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minIso,
        title: "Minimum"
      },
      {
        data: charts.maxIso,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  sections.push({
    title: "Brightness Value",
    type: "header"
  });

  sections.push({
    data: charts.brightness,
    title: "Average",
    type: "chart"
  });

  sections.push({
    data: [
      {
        data: charts.minBrightness,
        title: "Minimum"
      },
      {
        data: charts.maxBrightness,
        title: "Maximum"
      }
    ],
    type: "chart-row"
  });

  return {
    sections,
    subtitle,
    title: "AR Data Analysis"
  };
}

export function buildArDataAnalysisReport(metadataList: ArtifactAnalysis[], videoCount: number): ReportData {
  const charts = buildArDataCharts(metadataList);
  return buildArDataReportSections(charts, videoCount, metadataList);
}
