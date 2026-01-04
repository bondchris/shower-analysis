import { ArtifactAnalysis } from "../../models/artifactAnalysis";
import { ChartConfiguration } from "../../models/chart/chartConfiguration";
import { getBarChartConfig } from "../../utils/chart/configBuilders";
import { LayoutConstants } from "../dataAnalysisReport/layout";

export interface BitrateCharts {
  bitrateValues: ChartConfiguration;
}

function buildBitrateValueChart(bitrates: number[], layout: LayoutConstants): ChartConfiguration {
  const megabitsDivisor = 1_000_000;
  const decimalPlaces = 1;
  const roundingMultiplier = 10;
  const initialCount = 0;
  const countIncrement = 1;
  const bitrateCounts = new Map<number, number>();
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimalPlaces,
    minimumFractionDigits: decimalPlaces
  });

  for (const bitrate of bitrates) {
    const rounded = Math.round((bitrate / megabitsDivisor) * roundingMultiplier) / roundingMultiplier;
    const currentCount = bitrateCounts.get(rounded) ?? initialCount;
    bitrateCounts.set(rounded, currentCount + countIncrement);
  }

  const sortedBitrates = [...bitrateCounts.keys()].sort((a, b) => a - b);
  const bitrateLabels = sortedBitrates.map((value) => `${formatter.format(value)} Mbps`);
  const bitrateData = sortedBitrates.map((value) => bitrateCounts.get(value) ?? initialCount);

  return getBarChartConfig(bitrateLabels, bitrateData, {
    height: layout.getDynamicHeight(bitrateLabels.length, layout.HALF_CHART_HEIGHT),
    showCount: true,
    width: layout.FULL_CHART_WIDTH
  });
}

export function buildBitrateCharts(metadataList: ArtifactAnalysis[], layout: LayoutConstants): BitrateCharts {
  const minValidBitrate = 0;
  const bitrates = metadataList
    .map((m) => m.bitrate)
    .filter((b): b is number => typeof b === "number" && Number.isFinite(b) && b > minValidBitrate);

  const bitrateValues = buildBitrateValueChart(bitrates, layout);

  return { bitrateValues };
}
