import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { getBarChartConfig } from "../../../utils/chart/configBuilders";
import { sortDeviceModels } from "../../../utils/deviceSorting";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";

export function buildDeviceAndCameraCharts(
  metadataList: ArtifactAnalysis[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "deviceModel" | "focalLength" | "aperture" | "fps" | "resolution">> {
  const charts: Partial<Pick<CaptureCharts, "deviceModel" | "focalLength" | "aperture" | "fps" | "resolution">> = {};
  const NOT_SET = "";
  const INCREMENT_STEP = 1;
  const INITIAL_COUNT = 0;
  const DECIMAL_PLACES_LENS = 1;
  const LENS_WIDTH_RATIO = 0.9;

  // Device Model
  const deviceMap: Record<string, number> = {};
  for (const m of metadataList) {
    const model = m.deviceModel === NOT_SET ? "Unknown" : m.deviceModel;
    deviceMap[model] = (deviceMap[model] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }

  const { deviceCounts, deviceLabels, separatorLabel } = sortDeviceModels(deviceMap);

  charts.deviceModel = getBarChartConfig(deviceLabels, deviceCounts, {
    height: layout.getDynamicHeight(deviceLabels.length, layout.LENS_CHART_HEIGHT),
    horizontal: true,
    ...(separatorLabel !== undefined ? { separatorLabel } : {}),
    title: "",
    totalForPercentages: metadataList.length,
    width: Math.round(layout.PAGE_CONTENT_WIDTH * LENS_WIDTH_RATIO)
  });

  // Focal Length (aggregated & normalized)
  const focalMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensFocalLength !== NOT_SET) {
      const val = parseFloat(m.lensFocalLength);
      if (!isNaN(val)) {
        key = `${val.toFixed(DECIMAL_PLACES_LENS)} mm`;
      } else {
        key = m.lensFocalLength;
      }
    }
    focalMap[key] = (focalMap[key] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const focalLabels = Object.keys(focalMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const focalCounts = focalLabels.map((l) => focalMap[l] ?? INITIAL_COUNT);

  // Aperture
  const apertureMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensAperture !== NOT_SET) {
      const val = parseFloat(m.lensAperture.replace("f/", ""));
      if (!isNaN(val)) {
        key = `f/${val.toFixed(DECIMAL_PLACES_LENS)}`;
      } else {
        key = m.lensAperture;
      }
    }
    apertureMap[key] = (apertureMap[key] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const apertureLabels = Object.keys(apertureMap).sort((a, b) => {
    const valA = parseFloat(a.replace("f/", ""));
    const valB = parseFloat(b.replace("f/", ""));
    return valA - valB;
  });
  const apertureCounts = apertureLabels.map((l) => apertureMap[l] ?? INITIAL_COUNT);

  charts.focalLength = getBarChartConfig(focalLabels, focalCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  charts.aperture = getBarChartConfig(apertureLabels, apertureCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Framerate
  const fpsMap: Record<string, number> = {};
  for (const m of metadataList) {
    const fps = Math.round(m.fps).toString();
    fpsMap[fps] = (fpsMap[fps] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const fpsLabels = Object.keys(fpsMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsMap[l] ?? INITIAL_COUNT);
  charts.fps = getBarChartConfig(fpsLabels, fpsCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Resolution
  const resMap: Record<string, number> = {};
  for (const m of metadataList) {
    const res = `${m.width.toString()}x${m.height.toString()}`;
    resMap[res] = (resMap[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const resLabels = Object.keys(resMap).sort();
  const resCounts = resLabels.map((l) => resMap[l] ?? INITIAL_COUNT);
  charts.resolution = getBarChartConfig(resLabels, resCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  return charts;
}
