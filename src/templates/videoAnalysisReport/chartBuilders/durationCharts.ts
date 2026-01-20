import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";
import { buildDynamicKde } from "../../dataAnalysisReport/kdeBounds";

export function buildDurationChart(metadataList: ArtifactAnalysis[], avgDuration?: number): ChartConfiguration {
  const layout = computeLayoutConstants();
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
    const decimalPlacesAvg = 1;
    durationChartOptions.verticalReferenceLine = {
      label: `Avg Duration: ${avgDuration.toFixed(decimalPlacesAvg)}s`,
      value: avgDuration
    };
  }

  return getLineChartConfig(
    durationKde.labels,
    [
      {
        borderColor: "#06b6d4",
        borderWidth: 2,
        data: durationKde.values,
        fill: true,
        label: "Density"
      }
    ],
    durationChartOptions
  );
}
