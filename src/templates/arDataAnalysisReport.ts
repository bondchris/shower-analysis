import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { ReportData, ReportSection } from "../models/report";
import { getBarChartConfig, getLineChartConfig } from "../utils/chart/configBuilders";
import { sortDeviceModels } from "../utils/deviceSorting";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";

interface ArDataCharts {
  ambient: ChartConfiguration;
  aperture: ChartConfiguration;
  brightness: ChartConfiguration;
  deviceModel: ChartConfiguration;
  focalLength: ChartConfiguration;
  iso: ChartConfiguration;
  temperature: ChartConfiguration;
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

  // Ambient Intensity KDE Chart
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

  // Color Temperature KDE Chart
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > noResults);
  const tempInitialMin = 3500;
  const tempInitialMax = 6700;
  const tempKdeResolution = 200;
  const { kde: tempKde } = buildDynamicKde(tempVals, tempInitialMin, tempInitialMax, tempKdeResolution);
  const temperature = getLineChartConfig(
    tempKde.labels,
    [
      {
        borderColor: "#f59e0b",
        borderWidth: 2,
        data: tempKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#fbbf24",
        gradientTo: "#60a5fa",
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

  // ISO KDE Chart
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

  // Brightness KDE Chart
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== noResults);
  const briInitialMin = 0;
  const briInitialMax = 6;
  const briKdeResolution = 200;
  const { kde: briKde } = buildDynamicKde(briVals, briInitialMin, briInitialMax, briKdeResolution);
  const brightness = getLineChartConfig(
    briKde.labels,
    [
      {
        borderColor: "#eab308",
        borderWidth: 2,
        data: briKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#1f2937",
        gradientTo: "#fef08a",
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

  return { ambient, aperture, brightness, deviceModel, focalLength, iso, temperature };
}

function buildArDataReportSections(charts: ArDataCharts, videoCount: number): ReportData {
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
    data: charts.ambient,
    title: "Ambient Intensity",
    type: "chart"
  });

  sections.push({
    data: charts.temperature,
    title: "Color Temperature",
    type: "chart"
  });

  sections.push({
    data: charts.iso,
    title: "ISO Speed",
    type: "chart"
  });

  sections.push({
    data: charts.brightness,
    title: "Brightness Value",
    type: "chart"
  });

  return {
    sections,
    subtitle,
    title: "AR Data Analysis"
  };
}

export function buildArDataAnalysisReport(metadataList: ArtifactAnalysis[], videoCount: number): ReportData {
  const charts = buildArDataCharts(metadataList);
  return buildArDataReportSections(charts, videoCount);
}
