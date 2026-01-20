import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getLineChartConfig, getScatterChartConfig } from "../../../utils/chart/configBuilders";
import { calculateDynamicKdeBounds, calculateKde } from "../../../utils/chart/kde";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

export interface MovementCharts {
  movementSpeed: ChartConfiguration;
  scanEfficiency: ChartConfiguration;
}

export function buildMovementCharts(metadataList: ArtifactAnalysis[]): MovementCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;
  const initialCount = 0;

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

  return {
    movementSpeed,
    scanEfficiency
  };
}
