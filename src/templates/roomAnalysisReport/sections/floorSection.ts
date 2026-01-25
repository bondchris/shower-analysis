import { ReportSection } from "../../../models/report";
import { CaptureCharts } from "../../dataAnalysisReport/types";

export function buildFloorSections(charts: Partial<CaptureCharts>, hasArtifactDirs: boolean): ReportSection[] {
  const sections: ReportSection[] = [];

  sections.push({
    data: "",
    level: 3,
    title: "Floor Analysis",
    type: "header"
  });

  if (charts.area !== undefined) {
    sections.push({
      data: charts.area,
      title: "Floor Area",
      type: "chart"
    });
  }

  if (hasArtifactDirs) {
    if (charts.floorLength !== undefined) {
      sections.push({
        data: charts.floorLength,
        title: "Floor Lengths",
        type: "chart"
      });
    }

    if (charts.floorWidth !== undefined) {
      sections.push({
        data: charts.floorWidth,
        title: "Floor Widths",
        type: "chart"
      });
    }

    if (charts.floorAspectRatio !== undefined || charts.floorShapes !== undefined) {
      if (charts.floorAspectRatio !== undefined && charts.floorShapes !== undefined) {
        sections.push({
          data: [
            { data: charts.floorAspectRatio, title: "Floor Aspect Ratio" },
            { data: charts.floorShapes, title: "Floor Shapes" }
          ],
          type: "chart-row"
        });
      } else if (charts.floorAspectRatio !== undefined) {
        sections.push({
          data: charts.floorAspectRatio,
          title: "Floor Aspect Ratio",
          type: "chart"
        });
      } else if (charts.floorShapes !== undefined) {
        sections.push({
          data: charts.floorShapes,
          title: "Floor Shapes",
          type: "chart"
        });
      }
    }
  }

  return sections;
}
