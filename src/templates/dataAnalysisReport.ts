import { ChartConfiguration } from "../utils/chartUtils";
import { ReportData, ReportSection } from "../utils/reportGenerator";

export interface CaptureCharts {
  ambient: ChartConfiguration;
  area: ChartConfiguration;
  brightness: ChartConfiguration;
  duration: ChartConfiguration;
  errors: ChartConfiguration;
  features: ChartConfiguration;
  fps: ChartConfiguration;
  iso: ChartConfiguration;
  lens: ChartConfiguration;
  resolution: ChartConfiguration;
  temperature: ChartConfiguration;
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
    data: charts.duration,
    title: "Duration",
    type: "chart"
  });

  // Framerate & Resolution Side-by-Side (move up to appear earlier)
  chartSections.push({
    data: [
      {
        data: charts.fps,
        title: "Framerate"
      },
      {
        data: charts.resolution,
        title: "Resolution"
      }
    ],
    type: "chart-row"
  });

  // Page break before Lens Model so it starts on page 2
  chartSections.push({
    data: "",
    title: "",
    type: "page-break"
  });

  // Lens Model (dedicated page)
  chartSections.push({
    data: charts.lens,
    title: "Lens Model",
    type: "chart"
  });

  // Ambient Intensity (full-width)
  chartSections.push({
    data: charts.ambient,
    title: "Ambient Intensity",
    type: "chart"
  });

  // Color Temperature (full-width)
  chartSections.push({
    data: charts.temperature,
    title: "Color Temperature",
    type: "chart"
  });

  // ISO Speed (full-width)
  chartSections.push({
    data: charts.iso,
    title: "ISO Speed",
    type: "chart"
  });

  // Brightness Value (full-width)
  chartSections.push({
    data: charts.brightness,
    title: "Brightness Value",
    type: "chart"
  });

  // Room Area
  chartSections.push({
    data: charts.area,
    title: "Room Area (Sq Ft)",
    type: "chart"
  });

  // Capture Errors
  chartSections.push({
    data: charts.errors,
    title: "Capture Errors",
    type: "chart"
  });

  // Feature Prevalence
  chartSections.push({
    data: charts.features,
    title: "Feature Prevalence",
    type: "chart"
  });

  return {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
}
