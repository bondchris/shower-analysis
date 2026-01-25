import { ReportSection } from "../../../models/report";
import { CaptureCharts } from "../../dataAnalysisReport/types";

export function buildSummarySections(charts: Partial<CaptureCharts>): ReportSection[] {
  const sections: ReportSection[] = [];

  sections.push({
    data: "",
    level: 3,
    title: "Summary Analysis",
    type: "header"
  });

  if (charts.sections !== undefined) {
    sections.push({
      data: charts.sections,
      title: "Section Types",
      type: "chart"
    });
  }

  if (charts.features !== undefined) {
    sections.push({
      data: charts.features,
      title: "Feature Prevalence",
      type: "chart"
    });
  }

  if (charts.errors !== undefined) {
    sections.push({
      data: charts.errors,
      title: "Capture Errors",
      type: "chart"
    });
  }

  return sections;
}
