import { describe, expect, it } from "vitest";
import { buildVideoAnalysisReport } from "../../../src/templates/videoAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { computeLayoutConstants } from "../../../src/templates/dataAnalysisReport/layout";

/**
 * Tests for the Video Analysis Report template.
 * - Verifies duration, framerate, and resolution chart generation.
 * - Tests filtering of invalid (zero) metadata values.
 */
describe("videoAnalysisReport", () => {
  const mockMetadata: ArtifactAnalysis[] = [
    {
      avgGopDistance: 42,
      bFrameCount: 3,
      bitDepth: 10,
      bitrate: 700000,
      codecName: "h264",
      colorRange: "pc",
      colorSpace: "bt709",
      colorTransfer: "bt709",
      duration: 60,
      entropyCoding: "CABAC",
      fps: 30,
      gopSize: 42,
      gopVariance: 1,
      height: 1080,
      maxGopDistance: 48,
      minGopDistance: 36,
      pixelFormat: "yuv420p",
      videoLevel: 40,
      videoProfile: "High",
      width: 1920
    } as ArtifactAnalysis,
    {
      avgGopDistance: 30,
      bFrameCount: 2,
      bitDepth: 10,
      bitrate: 6000000,
      codecName: "h264",
      colorRange: "pc",
      colorSpace: "bt2020",
      colorTransfer: "bt709",
      duration: 120,
      entropyCoding: "CABAC",
      fps: 60,
      gopSize: 30,
      gopVariance: 0.5,
      height: 2160,
      maxGopDistance: 34,
      minGopDistance: 30,
      pixelFormat: "yuv420p",
      videoLevel: 42,
      videoProfile: "Main",
      width: 3840
    } as ArtifactAnalysis
  ];

  it("should generate a report with all expected sections", () => {
    const report = buildVideoAnalysisReport(mockMetadata, 90, 2);

    expect(report.title).toBe("Video Analysis");
    expect(report.subtitle).toBe("Artifacts: 2");

    const encodingSummaryTexts = report.sections
      .filter((section) => section.type === "text" && typeof section.data === "string")
      .map((section) => section.data as string);
    expect(encodingSummaryTexts).toHaveLength(2);
    expect(encodingSummaryTexts[0]).toContain("Codec:");
    expect(encodingSummaryTexts[1]).toContain("Entropy coding:");

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Duration");
    const maxGopSection = report.sections.find((s) => s.title === "Max GOP");
    expect(maxGopSection?.type).toBe("chart");
    const chartRows = report.sections.filter((s) => s.type === "chart-row");
    expect(chartRows).toHaveLength(5);
    const firstRow = chartRows[0];
    const secondRow = chartRows[1];
    const thirdRow = chartRows[2];
    const fourthRow = chartRows[3];
    const fifthRow = chartRows[4];
    if (firstRow && Array.isArray(firstRow.data)) {
      const rowTitles = (firstRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("Framerate");
      expect(rowTitles).toContain("Resolution");
    }
    if (secondRow && Array.isArray(secondRow.data)) {
      const rowTitles = (secondRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("B-Frames");
      expect(rowTitles).toContain("Color Space");
    }
    if (thirdRow && Array.isArray(thirdRow.data)) {
      const rowTitles = (thirdRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("Profile");
      expect(rowTitles).toContain("Level");

      const rowData = thirdRow.data as { title: string; data: ChartConfiguration }[];
      const levelChart = rowData.find((c) => c.title === "Level");
      if (levelChart && "labels" in levelChart.data) {
        expect(levelChart.data.labels).toEqual(["4.0", "4.2"]);
      }
    }
    if (fourthRow && Array.isArray(fourthRow.data)) {
      const rowTitles = (fourthRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("Average GOP");
      expect(rowTitles).toContain("Min GOP");

      const rowData = fourthRow.data as { title: string; data: ChartConfiguration }[];
      const avgGopChart = rowData.find((c) => c.title === "Average GOP");
      const minGopChart = rowData.find((c) => c.title === "Min GOP");
      if (avgGopChart && "labels" in avgGopChart.data) {
        expect(avgGopChart.data.labels).toEqual(["30", "42"]);
      }
      if (minGopChart && "labels" in minGopChart.data) {
        expect(minGopChart.data.labels).toEqual(["30", "36"]);
      }
    }
    if (fifthRow && Array.isArray(fifthRow.data)) {
      const rowTitles = (fifthRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("GOP Variance");

      const rowData = fifthRow.data as { title: string; data: ChartConfiguration }[];
      const varianceChart = rowData.find((c) => c.title === "GOP Variance");
      if (varianceChart && "labels" in varianceChart.data) {
        expect(varianceChart.data.labels).toEqual(["0.5", "1.0"]);
      }
    }
    const bitrateSection = report.sections.find((section) => section.title === "Bitrate");
    expect(bitrateSection).toBeDefined();
  });

  it("should render GOP Variance at two-thirds width", () => {
    const report = buildVideoAnalysisReport(mockMetadata, 90, 2);
    const chartRows = report.sections.filter((section) => section.type === "chart-row");
    const varianceRow = chartRows[chartRows.length - 1];
    if (!varianceRow || !Array.isArray(varianceRow.data)) {
      throw new Error("Variance chart row missing");
    }
    const varianceCharts = varianceRow.data as { title: string; data: ChartConfiguration }[];
    const varianceChartEntry = varianceCharts.find((chart) => chart.title === "GOP Variance");
    if (!varianceChartEntry) {
      throw new Error("GOP Variance chart missing");
    }
    const varianceOptions = (varianceChartEntry.data as { options?: { width?: number } }).options;
    const twoThirdsMultiplier = 2;
    const twoThirdsDivisor = 3;
    const expectedWidth = Math.round(
      (computeLayoutConstants().FULL_CHART_WIDTH * twoThirdsMultiplier) / twoThirdsDivisor
    );
    expect(varianceOptions?.width).toBe(expectedWidth);
  });

  it("should render Max GOP at two-thirds width", () => {
    const report = buildVideoAnalysisReport(mockMetadata, 90, 2);
    const maxGopSection = report.sections.find((section) => section.title === "Max GOP");
    const maxGopChart = maxGopSection?.data as { options?: { width?: number } } | undefined;
    const twoThirdsMultiplier = 2;
    const twoThirdsDivisor = 3;
    const expectedWidth = Math.round(
      (computeLayoutConstants().FULL_CHART_WIDTH * twoThirdsMultiplier) / twoThirdsDivisor
    );
    expect(maxGopChart?.options?.width).toBe(expectedWidth);
  });

  it("should include tail notes for overflow buckets", () => {
    const overflowMetadata: ArtifactAnalysis[] = [
      {
        avgGopDistance: 30,
        bitrate: 1000,
        duration: 10,
        fps: 30,
        gopSize: 30,
        gopVariance: 1.2,
        height: 1080,
        maxGopDistance: 40,
        minGopDistance: 30,
        width: 1920
      } as ArtifactAnalysis
    ];

    const report = buildVideoAnalysisReport(overflowMetadata, 10, 1);
    const maxGopSection = report.sections.find((section) => section.title === "Max GOP");
    const maxGopOptions = (maxGopSection?.data as { options?: { sideNotes?: string[] } } | undefined)?.options;
    expect(maxGopOptions?.sideNotes).toEqual([
      "There is a long tail of Max GOP values.",
      "1 unique values greater than 32",
      "With a maximum value of 40"
    ]);

    const varianceRow = report.sections.filter((section) => section.type === "chart-row").slice(-1)[0];
    if (!varianceRow || !Array.isArray(varianceRow.data)) {
      throw new Error("Variance chart row missing");
    }
    const varianceChartEntry = (varianceRow.data as { title: string; data: ChartConfiguration }[]).find(
      (chart) => chart.title === "GOP Variance"
    );
    if (!varianceChartEntry) {
      throw new Error("Variance chart missing");
    }
    const varianceOptions = (varianceChartEntry.data as { options?: { sideNotes?: string[] } }).options;
    expect(varianceOptions?.sideNotes).toEqual([
      "There is a long tail of GOP Variance values.",
      "1 unique values greater than 1.0",
      "With a maximum value of 1.2"
    ]);
  });

  it("should handle metadata with zero values", () => {
    const zeroMetadata: ArtifactAnalysis[] = [
      {
        avgGopDistance: 0,
        bitrate: 0,
        duration: 0,
        fps: 0,
        gopSize: 0,
        gopVariance: 0,
        height: 0,
        maxGopDistance: 0,
        minGopDistance: 0,
        width: 0
      } as ArtifactAnalysis
    ];
    const report = buildVideoAnalysisReport(zeroMetadata, 0, 1);
    expect(report.subtitle).toBe("Artifacts: 1");

    const maxGopSection = report.sections.find((s) => s.title === "Max GOP");
    const maxGopData = maxGopSection?.data as { labels?: string[] } | undefined;
    if (maxGopData?.labels !== undefined) {
      expect(maxGopData.labels).toHaveLength(0);
    }

    const chartRows = report.sections.filter((s) => s.type === "chart-row");
    expect(chartRows).toHaveLength(5);

    const firstRow = chartRows[0];
    const secondRow = chartRows[1];
    const thirdRow = chartRows[2];
    const fourthRow = chartRows[3];
    const fifthRow = chartRows[4];
    if (firstRow && Array.isArray(firstRow.data)) {
      const rowData = firstRow.data as { title: string; data: ChartConfiguration }[];
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

    if (secondRow && Array.isArray(secondRow.data)) {
      const rowData = secondRow.data as { title: string; data: ChartConfiguration }[];
      const bFrameChart = rowData.find((c) => c.title === "B-Frames");
      if (bFrameChart && "labels" in bFrameChart.data) {
        expect(bFrameChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
      const colorChart = rowData.find((c) => c.title === "Color Space");
      if (colorChart && "labels" in colorChart.data) {
        expect(colorChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
    }

    if (thirdRow && Array.isArray(thirdRow.data)) {
      const rowData = thirdRow.data as { title: string; data: ChartConfiguration }[];
      const profileChart = rowData.find((c) => c.title === "Profile");
      const levelChart = rowData.find((c) => c.title === "Level");
      if (profileChart && "labels" in profileChart.data) {
        expect(profileChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
      if (levelChart && "labels" in levelChart.data) {
        expect(levelChart.data.labels).toHaveLength(0);
      }
    }

    if (fourthRow && Array.isArray(fourthRow.data)) {
      const rowData = fourthRow.data as { title: string; data: ChartConfiguration }[];
      const avgGopChart = rowData.find((c) => c.title === "Average GOP");
      const minGopChart = rowData.find((c) => c.title === "Min GOP");
      if (avgGopChart && "labels" in avgGopChart.data) {
        expect(avgGopChart.data.labels).toHaveLength(0);
      }
      if (minGopChart && "labels" in minGopChart.data) {
        expect(minGopChart.data.labels).toHaveLength(0);
      }
    }

    if (fifthRow && Array.isArray(fifthRow.data)) {
      const rowData = fifthRow.data as { title: string; data: ChartConfiguration }[];
      const profileChart = rowData.find((c) => c.title === "Profile");
      const levelChart = rowData.find((c) => c.title === "Level");
      if (profileChart && "labels" in profileChart.data) {
        expect(profileChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
      if (levelChart && "labels" in levelChart.data) {
        expect(levelChart.data.labels).toHaveLength(0);
      }
    }

    const bitrateSection = report.sections.find((section) => section.title === "Bitrate");
    if (bitrateSection && "labels" in (bitrateSection.data as ChartConfiguration)) {
      const bitrateChart = bitrateSection.data as ChartConfiguration & { labels: string[] };
      expect(bitrateChart.labels).toHaveLength(0);
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

  it("should bucket GOP variance values above the overflow threshold", () => {
    const overflowVarianceMetadata: ArtifactAnalysis[] = [
      {
        avgGopDistance: 30,
        bitrate: 1000,
        duration: 10,
        fps: 30,
        gopSize: 30,
        gopVariance: 2,
        height: 1080,
        maxGopDistance: 30,
        minGopDistance: 30,
        width: 1920
      } as ArtifactAnalysis
    ];

    const report = buildVideoAnalysisReport(overflowVarianceMetadata, 10, 1);
    const chartRows = report.sections.filter((section) => section.type === "chart-row");
    const varianceRow = chartRows[chartRows.length - 1];
    if (!varianceRow || !Array.isArray(varianceRow.data)) {
      throw new Error("Variance chart row missing");
    }
    const varianceRowCharts = varianceRow.data as { title: string; data: ChartConfiguration }[];
    const varianceChartEntry = varianceRowCharts.find((chart) => chart.title === "GOP Variance");
    if (!varianceChartEntry) {
      throw new Error("Variance chart entry missing");
    }
    const varianceChart = varianceChartEntry.data;
    const labels = (varianceChart as { labels?: string[] }).labels;
    if (labels === undefined) {
      throw new Error("Variance chart missing labels");
    }
    expect(labels).toEqual(["1.1+"]);
  });

  it("should bucket Max GOP values above the overflow threshold", () => {
    const overflowMaxMetadata: ArtifactAnalysis[] = [
      {
        avgGopDistance: 30,
        bitrate: 1000,
        duration: 10,
        fps: 30,
        gopSize: 30,
        gopVariance: 0.1,
        height: 1080,
        maxGopDistance: 40,
        minGopDistance: 30,
        width: 1920
      } as ArtifactAnalysis
    ];

    const report = buildVideoAnalysisReport(overflowMaxMetadata, 10, 1);
    const maxGopSection = report.sections.find((section) => section.title === "Max GOP");
    const maxGopChart = maxGopSection?.data;
    const labels = (maxGopChart as { labels?: string[] } | undefined)?.labels;
    if (labels === undefined) {
      throw new Error("Max GOP chart missing labels");
    }
    expect(labels).toEqual(["33+"]);
  });
});
