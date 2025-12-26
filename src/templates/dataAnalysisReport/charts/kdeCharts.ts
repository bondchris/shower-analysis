import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";
import { buildDynamicKde } from "../kdeBounds";

export function buildKdeCharts(
  metadataList: ArtifactAnalysis[],
  layout: LayoutConstants,
  avgDuration?: number
): Partial<Pick<CaptureCharts, "duration" | "ambient" | "temperature" | "iso" | "brightness" | "area">> {
  const charts: Partial<Pick<CaptureCharts, "duration" | "ambient" | "temperature" | "iso" | "brightness" | "area">> =
    {};
  const NO_RESULTS = 0;

  // Duration
  const durations = metadataList.map((m) => m.duration);
  const durationInitialMin = 10;
  const durationInitialMax = 120;
  const durationKdeResolution = 200;
  const { kde: durationKde } = buildDynamicKde(
    durations,
    durationInitialMin,
    durationInitialMax,
    durationKdeResolution
  );

  const durationChartOptions: {
    chartId: string;
    height: number;
    smooth: boolean;
    title: string;
    width: number;
    xLabel: string;
    yLabel: string;
    verticalReferenceLine?: { value: number; label: string };
  } = {
    chartId: "duration",
    height: layout.DURATION_CHART_HEIGHT,
    smooth: true,
    title: "",
    width: layout.DURATION_CHART_WIDTH,
    xLabel: "Seconds",
    yLabel: "Count"
  };

  if (avgDuration !== undefined) {
    const DECIMAL_PLACES_AVG = 1;
    durationChartOptions.verticalReferenceLine = {
      label: `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES_AVG)}s`,
      value: avgDuration
    };
  }

  charts.duration = getLineChartConfig(
    durationKde.labels,
    [
      {
        borderColor: "#06b6d4", // Cyan-500
        borderWidth: 2,
        data: durationKde.values,
        fill: true,
        label: "Density"
      }
    ],
    durationChartOptions
  );

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > NO_RESULTS);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > NO_RESULTS);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > NO_RESULTS);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== NO_RESULTS);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > NO_RESULTS);

  // Ambient: 980-1040
  const ambientInitialMin = 980;
  const ambientInitialMax = 1040;
  const ambientKdeResolution = 200;
  const { kde: ambientKde } = buildDynamicKde(
    intensityVals,
    ambientInitialMin,
    ambientInitialMax,
    ambientKdeResolution
  );
  charts.ambient = getLineChartConfig(
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

  // Temp: 3500-6700
  const tempInitialMin = 3500;
  const tempInitialMax = 6700;
  const tempKdeResolution = 200;
  const { kde: tempKde } = buildDynamicKde(tempVals, tempInitialMin, tempInitialMax, tempKdeResolution);
  charts.temperature = getLineChartConfig(
    tempKde.labels,
    [
      {
        borderColor: "#f59e0b",
        borderWidth: 2,
        data: tempKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#fbbf24", // Orange (3500K)
        gradientTo: "#60a5fa", // Blue (6700K)
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

  // ISO: 0-800
  const isoInitialMin = 0;
  const isoInitialMax = 800;
  const isoKdeResolution = 200;
  const { kde: isoKde } = buildDynamicKde(isoVals, isoInitialMin, isoInitialMax, isoKdeResolution);
  charts.iso = getLineChartConfig(
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

  // Brightness: 0-6
  const briInitialMin = 0;
  const briInitialMax = 6;
  const briKdeResolution = 200;
  const { kde: briKde } = buildDynamicKde(briVals, briInitialMin, briInitialMax, briKdeResolution);
  charts.brightness = getLineChartConfig(
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

  // Room Area: 0-150
  const areaInitialMin = 0;
  const areaInitialMax = 150;
  const areaKdeResolution = 200;
  const { kde: areaKde } = buildDynamicKde(areaVals, areaInitialMin, areaInitialMax, areaKdeResolution);
  charts.area = getLineChartConfig(
    areaKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: areaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "area",
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.FULL_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  return charts;
}
