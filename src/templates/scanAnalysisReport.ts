import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { ReportData, ReportSection } from "../models/report";
import { getLineChartConfig } from "../utils/chart/configBuilders";
import { buildDynamicKde } from "./dataAnalysisReport/kdeBounds";
import { computeLayoutConstants } from "./dataAnalysisReport/layout";
import {
  OBJECT_CATEGORY_DISPLAY_NAMES,
  OBJECT_CATEGORY_KEYS,
  collectAllObjectViewTimes
} from "../utils/scan/objectViewTime";

function buildObjectViewTimeChart(
  displayName: string,
  values: number[],
  chartId: string,
  layout: ReturnType<typeof computeLayoutConstants>
): { chart: ChartConfiguration; title: string } {
  const viewInitialMin = 0;
  const viewInitialMax = 120;
  const kdeResolution = 200;
  const { kde } = buildDynamicKde(values, viewInitialMin, viewInitialMax, kdeResolution);
  const initialSum = 0;
  const sum = values.reduce((a, b) => a + b, initialSum);
  const avgSeconds = sum / values.length;
  const decimalPlacesAvg = 1;
  const chartOptions: {
    chartId: string;
    height: number;
    smooth: boolean;
    title: string;
    verticalReferenceLine: { label: string; value: number };
    width: number;
    xLabel: string;
    yLabel: string;
  } = {
    chartId,
    height: layout.DURATION_CHART_HEIGHT,
    smooth: true,
    title: "",
    verticalReferenceLine: {
      label: `Avg: ${avgSeconds.toFixed(decimalPlacesAvg)}s`,
      value: avgSeconds
    },
    width: layout.DURATION_CHART_WIDTH,
    xLabel: "Seconds",
    yLabel: "Count"
  };
  const chart = getLineChartConfig(
    kde.labels,
    [
      {
        borderColor: "#06b6d4",
        borderWidth: 2,
        data: kde.values,
        fill: true,
        label: "Density"
      }
    ],
    chartOptions
  );
  return {
    chart,
    title: `Time with ${displayName} in View`
  };
}

/**
 * Builds the Scan Analysis report.
 * Combines rawScan.json and arData.json to analyze how users scan the room
 * (e.g. path coverage, movement vs. geometry, scan behavior over time).
 */
export function buildScanAnalysisReport(
  _metadataList: ArtifactAnalysis[],
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const subtitle = `Artifacts: ${videoCount.toString()}`;
  const sections: ReportSection[] = [];
  const emptyLength = 0;

  if (artifactDirs !== undefined && artifactDirs.length > emptyLength) {
    const layout = computeLayoutConstants();
    const allViewTimes = collectAllObjectViewTimes(artifactDirs);
    for (const key of OBJECT_CATEGORY_KEYS) {
      const values = allViewTimes[key];
      if (values.length > emptyLength) {
        const displayName = OBJECT_CATEGORY_DISPLAY_NAMES[key];
        const chartId = `objectViewTime_${key}`;
        const { chart, title } = buildObjectViewTimeChart(displayName, values, chartId, layout);
        sections.push({
          data: chart,
          title,
          type: "chart"
        });
      }
    }
  }

  return {
    sections,
    subtitle,
    title: "Scan Analysis"
  };
}
