import { ChartConfiguration } from "chart.js";
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

  // Lens Model
  chartSections.push({
    data: charts.lens,
    title: "Lens Model",
    type: "chart"
  });

  // Framerate & Resolution Side-by-Side
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

  // Ambient Intensity & Color Temperature Side-by-Side
  chartSections.push({
    data: [
      {
        data: charts.ambient,
        title: "Ambient Intensity"
      },
      {
        data: charts.temperature,
        title: "Color Temperature"
      }
    ],
    type: "chart-row"
  });

  // ISO Speed & Brightness Value Side-by-Side
  chartSections.push({
    data: [
      {
        data: charts.iso,
        title: "ISO Speed"
      },
      {
        data: charts.brightness,
        title: "Brightness Value"
      }
    ],
    type: "chart-row"
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
