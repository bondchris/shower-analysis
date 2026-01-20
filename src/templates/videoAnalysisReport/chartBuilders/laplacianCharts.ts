import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getLineChartConfig } from "../../../utils/chart/configBuilders";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";
import { buildDynamicKde } from "../../dataAnalysisReport/kdeBounds";

interface LaplacianCharts {
  laplacianMedian: ChartConfiguration;
  laplacianStdDev: ChartConfiguration;
}

function collectLaplacianValues(
  metadataList: ArtifactAnalysis[],
  selector: (meta: ArtifactAnalysis) => number | undefined
): number[] {
  const minSamples = 1;
  return metadataList
    .filter(
      (meta) =>
        typeof meta.laplacianSampleCount === "number" &&
        Number.isFinite(meta.laplacianSampleCount) &&
        meta.laplacianSampleCount >= minSamples
    )
    .map(selector)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function buildRange(values: number[], fallbackMax: number): { max: number; min: number } {
  const noResults = 0;
  const defaultNumeric = 0;
  const paddingRatio = 0.1;
  const minRangeDelta = 0.1;
  if (values.length === noResults) {
    return { max: fallbackMax, min: defaultNumeric };
  }
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  if (maxValue === minValue) {
    const basePadding = Math.max(Math.abs(maxValue), fallbackMax) * paddingRatio;
    const padding = Math.max(basePadding, minRangeDelta);
    const paddedMin = Math.max(defaultNumeric, minValue - padding);
    return { max: maxValue + padding, min: paddedMin };
  }
  const rangePadding = (maxValue - minValue) * paddingRatio;
  return { max: maxValue + rangePadding, min: Math.max(defaultNumeric, minValue - rangePadding) };
}

function buildLaplacianChart(values: number[], chartId: string, xLabel: string, color: string): ChartConfiguration {
  const layout = computeLayoutConstants();
  const defaultRangeMax = 5;
  const minRangeDelta = 0.1;
  const laplacianResolution = 200;
  const laplacianDiffThreshold = 0.01;
  const range = buildRange(values, defaultRangeMax);
  const effectiveMax = Math.max(range.max, range.min + minRangeDelta);
  const { kde } = buildDynamicKde(values, range.min, effectiveMax, laplacianResolution, laplacianDiffThreshold);
  return getLineChartConfig(
    kde.labels,
    [
      {
        borderColor: color,
        borderWidth: 2,
        data: kde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId,
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HALF_CHART_WIDTH,
      xLabel,
      yLabel: "Density"
    }
  );
}

export function buildLaplacianCharts(metadataList: ArtifactAnalysis[]): LaplacianCharts {
  const laplacianMedianValues = collectLaplacianValues(metadataList, (meta) => meta.laplacianMedian);
  const laplacianStdDevValues = collectLaplacianValues(metadataList, (meta) => meta.laplacianStdDev);

  const laplacianColor = "rgba(75, 192, 192, 0.9)";
  const laplacianMedian = buildLaplacianChart(
    laplacianMedianValues,
    "laplacian-median",
    "Median Laplacian (per frame)",
    laplacianColor
  );

  const laplacianStdDev = buildLaplacianChart(
    laplacianStdDevValues,
    "laplacian-stddev",
    "Std Dev of Laplacian (per frame)",
    laplacianColor
  );

  return { laplacianMedian, laplacianStdDev };
}

export { buildRange };
