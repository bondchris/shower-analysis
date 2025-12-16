import { ReportData, ReportSection } from "../utils/reportGenerator";

export interface CaptureCharts {
  ambient: Buffer;
  area: Buffer;
  brightness: Buffer;
  duration: Buffer;
  errors: Buffer;
  features: Buffer;
  fps: Buffer;
  iso: Buffer;
  lens: Buffer;
  resolution: Buffer;
  temperature: Buffer;
}

export function buildDataAnalysisReport(charts: CaptureCharts, avgDuration: number, videoCount: number): ReportData {
  const sections: ReportSection[] = [];

  // Metadata
  const DECIMAL_PLACES_AVG = 1;
  const subtitle = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES_AVG)}s | Artifacts: ${videoCount.toString()}`;

  // Charts
  const chartSections: ReportSection[] = [];

  // Duration
  chartSections.push({
    data: `data:image/png;base64,${charts.duration.toString("base64")}`,
    title: "Duration",
    type: "chart"
  });

  // Lens Model
  chartSections.push({
    data: `data:image/png;base64,${charts.lens.toString("base64")}`,
    title: "Lens Model",
    type: "chart"
  });

  // Framerate & Resolution Side-by-Side
  chartSections.push({
    data: [
      {
        data: `data:image/png;base64,${charts.fps.toString("base64")}`,
        title: "Framerate"
      },
      {
        data: `data:image/png;base64,${charts.resolution.toString("base64")}`,
        title: "Resolution"
      }
    ],
    type: "chart-row"
  });

  // Ambient Intensity & Color Temperature Side-by-Side
  chartSections.push({
    data: [
      {
        data: `data:image/png;base64,${charts.ambient.toString("base64")}`,
        title: "Ambient Intensity"
      },
      {
        data: `data:image/png;base64,${charts.temperature.toString("base64")}`,
        title: "Color Temperature"
      }
    ],
    type: "chart-row"
  });

  // ISO Speed & Brightness Value Side-by-Side
  chartSections.push({
    data: [
      {
        data: `data:image/png;base64,${charts.iso.toString("base64")}`,
        title: "ISO Speed"
      },
      {
        data: `data:image/png;base64,${charts.brightness.toString("base64")}`,
        title: "Brightness Value"
      }
    ],
    type: "chart-row"
  });

  // Room Area
  chartSections.push({
    data: `data:image/png;base64,${charts.area.toString("base64")}`,
    title: "Room Area (Sq Ft)",
    type: "chart"
  });

  // Capture Errors
  chartSections.push({
    data: `data:image/png;base64,${charts.errors.toString("base64")}`,
    title: "Capture Errors",
    type: "chart"
  });

  // Feature Prevalence
  chartSections.push({
    data: `data:image/png;base64,${charts.features.toString("base64")}`,
    title: "Feature Prevalence",
    type: "chart"
  });

  return {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
}
