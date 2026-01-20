import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import { brightnessToHex } from "../../../utils/chart/brightnessToRgb";
import { kelvinToHex } from "../../../utils/chart/kelvinToRgb";
import { buildDynamicKde } from "../../dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

export interface LightingCharts {
  ambient: ChartConfiguration;
  brightness: ChartConfiguration;
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
}

export function buildLightingCharts(metadataList: ArtifactAnalysis[]): LightingCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const midpointDivisor = 2;

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

  return {
    ambient,
    brightness,
    iso,
    maxAmbient,
    maxBrightness,
    maxIso,
    maxTemperature,
    minAmbient,
    minBrightness,
    minIso,
    minTemperature,
    temperature
  };
}
