import React from "react";

import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { LineChartConfig } from "../models/chart/lineChartConfig";
import { ReportData, ReportSection } from "../models/report";
import { brightnessToHex } from "../utils/chart/brightnessToRgb";
import { getBarChartConfig, getLineChartConfig, getPieChartConfig } from "../utils/chart/configBuilders";
import { getGlobalDateRange } from "../utils/chart/dateRange";
import { kelvinToHex } from "../utils/chart/kelvinToRgb";
import { sortDeviceModels } from "../utils/deviceSorting";
import { LineChart } from "./components/charts/LineChart";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";

interface ArDataCharts {
  ambient: ChartConfiguration;
  aperture: ChartConfiguration;
  arDataFramerate: ChartConfiguration;
  brightness: ChartConfiguration;
  deviceModel: ChartConfiguration;
  droppedFrames: ChartConfiguration;
  focalLength: ChartConfiguration;
  iso: ChartConfiguration;
  maxAmbient: ChartConfiguration;
  maxBrightness: ChartConfiguration;
  maxIso: ChartConfiguration;
  maxTemperature: ChartConfiguration;
  minAmbient: ChartConfiguration;
  minBrightness: ChartConfiguration;
  minIso: ChartConfiguration;
  minTemperature: ChartConfiguration;
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
  const offsetGroupIndex = 1;
  const parseTimezoneOffset = (label: string): number => {
    // Extract the offset portion from labels like "-07:00 (MT)" or just "-07:00"
    const offsetMatch = /^([+-]\d{2}:\d{2})/.exec(label);
    if (offsetMatch === null) {
      return sortEqual;
    }
    const offset = offsetMatch[offsetGroupIndex] ?? "";
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    if (match === null) {
      return sortEqual;
    }
    const sign = match[signGroupIndex] === "-" ? sortBefore : sortAfter;
    const hours = parseInt(match[hoursGroupIndex] ?? "0", radix);
    const minutes = parseInt(match[minutesGroupIndex] ?? "0", radix);
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
        timeOfDayMap[hourLabel] = (timeOfDayMap[hourLabel] ?? initialCount) + incrementStep;
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
  const framerateInitialMin = 0;
  const framerateInitialMax = 10;
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
  const { kde: isoKde } = buildDynamicKde(isoVals, isoInitialMin, isoInitialMax, isoKdeResolution);
  const iso = getLineChartConfig(
    isoKde.labels,
    [
      {
        borderColor: "#6366f1",
        borderWidth: 2,
        data: isoKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "iso",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "ISO",
      yLabel: "Count"
    }
  );

  // Minimum ISO KDE Chart (lower sensitivity = less noise)
  const minIsoVals = metadataList.map((m) => m.minIso).filter((v) => v > noResults);
  const minIsoInitialMin = 0;
  const minIsoInitialMax = 2000;
  const { kde: minIsoKde } = buildDynamicKde(minIsoVals, minIsoInitialMin, minIsoInitialMax, isoKdeResolution);
  const minIso = getLineChartConfig(
    minIsoKde.labels,
    [
      {
        borderColor: "#4338ca",
        borderWidth: 2,
        data: minIsoKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#312e81",
        gradientTo: "#6366f1",
        label: "Density"
      }
    ],
    {
      chartId: "minIso",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "ISO",
      yLabel: "Count"
    }
  );

  // Maximum ISO KDE Chart (higher sensitivity = more noise potential)
  const maxIsoVals = metadataList.map((m) => m.maxIso).filter((v) => v > noResults);
  const maxIsoInitialMin = 0;
  const maxIsoInitialMax = 5000;
  const { kde: maxIsoKde } = buildDynamicKde(maxIsoVals, maxIsoInitialMin, maxIsoInitialMax, isoKdeResolution);
  const maxIso = getLineChartConfig(
    maxIsoKde.labels,
    [
      {
        borderColor: "#a78bfa",
        borderWidth: 2,
        data: maxIsoKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#8b5cf6",
        gradientTo: "#c4b5fd",
        label: "Density"
      }
    ],
    {
      chartId: "maxIso",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel: "ISO",
      yLabel: "Count"
    }
  );

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

  return {
    ambient,
    aperture,
    arDataFramerate,
    brightness,
    deviceModel,
    droppedFrames,
    focalLength,
    iso,
    maxAmbient,
    maxBrightness,
    maxIso,
    maxTemperature,
    minAmbient,
    minBrightness,
    minIso,
    minTemperature,
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
      title: "Dropped Frames Over Time",
      yLabel: "% of Scans"
    },
    type: "line"
  };

  const ChartComponent = (): React.ReactElement => React.createElement(LineChart, { config: chartConfig });

  return {
    component: ChartComponent,
    data: chartConfig,
    title: "Dropped Frames Over Time",
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
        title: "AR Data Capture Rate (FPS)"
      },
      {
        data: charts.droppedFrames,
        title: "Dropped Frames"
      }
    ],
    type: "chart-row"
  });

  const droppedFramesOverTime = buildDroppedFramesOverTimeSection(metadataList);
  if (droppedFramesOverTime !== null) {
    sections.push(droppedFramesOverTime);
  }

  sections.push({
    title: "Ambient Intensity (lux)",
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
    title: "Color Temperature (Kelvin)",
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
    title: "Brightness Value (EV)",
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
