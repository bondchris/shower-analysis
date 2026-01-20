import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getBarChartConfig } from "../../../utils/chart/configBuilders";
import { sortDeviceModels } from "../../../utils/deviceSorting";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

export interface DeviceCharts {
  aperture: ChartConfiguration;
  deviceModel: ChartConfiguration;
  focalLength: ChartConfiguration;
}

export function buildDeviceCharts(metadataList: ArtifactAnalysis[]): DeviceCharts {
  const layout = computeLayoutConstants();
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

  return {
    aperture,
    deviceModel,
    focalLength
  };
}
