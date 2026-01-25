import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { ReportSection } from "../../../models/report";
import { CaptureCharts } from "../../dataAnalysisReport/types";

export function buildObjectSections(charts: Partial<CaptureCharts>, hasArtifactDirs: boolean): ReportSection[] {
  const sections: ReportSection[] = [];
  const initialCount = 0;

  sections.push({
    data: "",
    level: 3,
    title: "Object Analysis",
    type: "header"
  });

  if (charts.objects !== undefined) {
    sections.push({
      data: charts.objects,
      title: "Object Distribution",
      type: "chart"
    });
  }

  if (hasArtifactDirs) {
    const attributeChartMap: { chartKey: keyof CaptureCharts; title: string }[] = [
      { chartKey: "doorIsOpen", title: "Door Open/Closed" },
      { chartKey: "chairArmType", title: "Chair Arm Type" },
      { chartKey: "chairBackType", title: "Chair Back Type" },
      { chartKey: "chairLegType", title: "Chair Base Type" },
      { chartKey: "chairType", title: "Chair Type" },
      { chartKey: "sofaType", title: "Sofa Type" },
      { chartKey: "storageType", title: "Storage Type" },
      { chartKey: "tableShapeType", title: "Table Shape Type" },
      { chartKey: "tableType", title: "Table Type" }
    ];

    const availableCharts: { data: ChartConfiguration; title: string }[] = [];
    for (const { chartKey, title } of attributeChartMap) {
      if (Object.prototype.hasOwnProperty.call(charts, chartKey)) {
        const chartData = charts[chartKey];
        if (chartData !== undefined) {
          availableCharts.push({ data: chartData, title });
        }
      }
    }

    if (availableCharts.length > initialCount) {
      const chartsPerRow = 3;
      for (let i = initialCount; i < availableCharts.length; i += chartsPerRow) {
        const rowCharts = availableCharts.slice(i, i + chartsPerRow);
        sections.push({
          data: rowCharts,
          type: "chart-row"
        });
      }
    }
  }

  if (hasArtifactDirs) {
    const vanityAttributeCharts: { data: ChartConfiguration; title: string }[] = [];
    if (charts.sinkCount !== undefined) {
      vanityAttributeCharts.push({ data: charts.sinkCount, title: "Number of Sinks" });
    }
    if (charts.vanityType !== undefined) {
      vanityAttributeCharts.push({ data: charts.vanityType, title: "Vanity Type" });
    }
    if (charts.vanityPlacement !== undefined) {
      vanityAttributeCharts.push({ data: charts.vanityPlacement, title: "Vanity Placement" });
    }

    if (vanityAttributeCharts.length > initialCount) {
      sections.push({
        data: vanityAttributeCharts,
        type: "chart-row"
      });
    }
  }

  if (hasArtifactDirs && charts.tubLength !== undefined) {
    sections.push({
      data: charts.tubLength,
      title: "Tub Length Distribution",
      type: "chart"
    });
  }

  if (hasArtifactDirs && charts.vanityLength !== undefined) {
    sections.push({
      data: charts.vanityLength,
      title: "Vanity Length Distribution",
      type: "chart"
    });
  }

  return sections;
}
