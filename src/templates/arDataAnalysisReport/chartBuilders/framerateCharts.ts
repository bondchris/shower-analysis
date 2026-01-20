import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getLineChartConfig, getPieChartConfig } from "../../../utils/chart/configBuilders";
import { buildDynamicKde } from "../../dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

export interface FramerateCharts {
  arDataFramerate: ChartConfiguration;
  droppedFrames: ChartConfiguration;
}

export function buildFramerateCharts(metadataList: ArtifactAnalysis[]): FramerateCharts {
  const layout = computeLayoutConstants();
  const noResults = 0;

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

  return {
    arDataFramerate,
    droppedFrames
  };
}
