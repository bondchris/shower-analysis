import { ReportSection } from "../../../models/report";
import { CaptureCharts } from "../../dataAnalysisReport/types";

export function buildCeilingSections(charts: Partial<CaptureCharts>): ReportSection[] {
  const sections: ReportSection[] = [];

  sections.push({
    data: "",
    level: 3,
    title: "Ceiling Analysis",
    type: "header"
  });

  if (charts.ceilingHeightDifference !== undefined) {
    sections.push({
      data: charts.ceilingHeightDifference,
      title: "Maximum Difference in Ceiling Height",
      type: "chart"
    });
  }

  if (charts.slantedWallShapes !== undefined || charts.notchedWallShapes !== undefined) {
    if (charts.slantedWallShapes !== undefined && charts.notchedWallShapes !== undefined) {
      sections.push({
        data: [
          { data: charts.slantedWallShapes, title: "Slanted Wall Shapes" },
          { data: charts.notchedWallShapes, title: "Notched Wall Shapes" }
        ],
        type: "chart-row"
      });
    } else if (charts.slantedWallShapes !== undefined) {
      sections.push({
        data: charts.slantedWallShapes,
        title: "Slanted Wall Shapes",
        type: "chart"
      });
    } else if (charts.notchedWallShapes !== undefined) {
      sections.push({
        data: charts.notchedWallShapes,
        title: "Notched Wall Shapes",
        type: "chart"
      });
    }
  }

  return sections;
}
