import { describe, expect, it } from "vitest";
import { ArtifactAnalysis } from "../../../../src/models/artifactAnalysis";
import { BarChartConfig } from "../../../../src/models/chart/barChartConfig";
import { computeLayoutConstants } from "../../../../src/templates/dataAnalysisReport/layout";
import { buildBitrateCharts } from "../../../../src/templates/shared/bitrateCharts";

describe("buildBitrateCharts", () => {
  it("uses exact bitrate values and filters invalid entries", () => {
    const layout = computeLayoutConstants();
    const metadata: ArtifactAnalysis[] = [
      { bitrate: 500_000 } as ArtifactAnalysis,
      { bitrate: 12_000_000 } as ArtifactAnalysis,
      { bitrate: 2_000_000 } as ArtifactAnalysis,
      { bitrate: Number.POSITIVE_INFINITY } as ArtifactAnalysis,
      { bitrate: NaN } as ArtifactAnalysis,
      { bitrate: -1 } as ArtifactAnalysis
    ];

    const { bitrateValues } = buildBitrateCharts(metadata, layout);
    expect(bitrateValues.type).toBe("bar");
    const barChart = bitrateValues as BarChartConfig;

    expect(barChart.labels).toEqual(["0.5", "2.0", "12.0"]);
    expect(barChart.data).toEqual([1, 1, 1]);
    expect(barChart.options.horizontal).toBeFalsy();
    expect(barChart.options.showCount).toBe(true);
    expect(barChart.options.stacked).toBeFalsy();
    expect(barChart.options.stackLabels).toBeUndefined();
  });
});
