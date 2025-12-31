import { describe, expect, it } from "vitest";
import { buildVideoAnalysisReport } from "../../../src/templates/videoAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";

/**
 * Tests for the Video Analysis Report template.
 * - Verifies duration, framerate, and resolution chart generation.
 * - Tests filtering of invalid (zero) metadata values.
 */
describe("videoAnalysisReport", () => {
  const mockMetadata: ArtifactAnalysis[] = [
    {
      duration: 60,
      fps: 30,
      height: 1080,
      width: 1920
    } as ArtifactAnalysis,
    {
      duration: 120,
      fps: 60,
      height: 2160,
      width: 3840
    } as ArtifactAnalysis
  ];

  it("should generate a report with all expected sections", () => {
    const report = buildVideoAnalysisReport(mockMetadata, 90, 2);

    expect(report.title).toBe("Video Analysis");
    expect(report.subtitle).toBe("Artifacts: 2");

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Duration");

    const chartRow = report.sections.find((s) => s.type === "chart-row");
    expect(chartRow).toBeDefined();
    if (chartRow && Array.isArray(chartRow.data)) {
      const rowTitles = (chartRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("Framerate");
      expect(rowTitles).toContain("Resolution");
    }
  });

  it("should handle metadata with zero values", () => {
    const zeroMetadata: ArtifactAnalysis[] = [
      {
        duration: 0,
        fps: 0,
        height: 0,
        width: 0
      } as ArtifactAnalysis
    ];
    const report = buildVideoAnalysisReport(zeroMetadata, 0, 1);
    expect(report.subtitle).toBe("Artifacts: 1");

    const chartRow = report.sections.find((s) => s.type === "chart-row");
    expect(chartRow).toBeDefined();
    if (chartRow && Array.isArray(chartRow.data)) {
      const rowData = chartRow.data as { title: string; data: ChartConfiguration }[];
      const fpsChart = rowData.find((c) => c.title === "Framerate");
      const resChart = rowData.find((c) => c.title === "Resolution");

      // FPS and Resolution charts should be empty because of the filters
      if (fpsChart && "labels" in fpsChart.data) {
        expect(fpsChart.data.labels).toHaveLength(0);
      }
      if (resChart && "labels" in resChart.data) {
        expect(resChart.data.labels).toHaveLength(0);
      }
    }
  });

  it("should handle undefined avgDuration in buildVideoCharts (via buildVideoAnalysisReport)", () => {
    // buildVideoAnalysisReport expects number, but we can pass undefined as any to test internal buildVideoCharts optional param
    const report = buildVideoAnalysisReport(mockMetadata, undefined as unknown as number, 2);
    expect(report.title).toBe("Video Analysis");
    const durationSection = report.sections.find((s) => s.title === "Duration");
    const durationChart = durationSection?.data as ChartConfiguration;
    // @ts-ignore - access options to verify reference line
    expect(durationChart.options.verticalReferenceLine).toBeUndefined();
  });
});
