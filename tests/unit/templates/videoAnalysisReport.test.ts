import { describe, expect, it, vi } from "vitest";
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
      blueMean: 110,
      blueVariance: 6,
      brightnessVariance: 12,
      clippedPixelPercentage: 1.5,
      codecName: "h264",
      colorRange: "pc",
      colorSampleCount: 120,
      colorSpace: "bt709",
      colorTransfer: "bt709",
      duration: 60,
      entropyCoding: "CABAC",
      fps: 30,
      gopSize: 42,
      gopVariance: 1,
      greenMean: 120,
      greenVariance: 8,
      height: 1080,
      hueVariance: 25,
      laplacianMedian: 1.2,
      laplacianSampleCount: 10,
      laplacianStdDev: 0.5,
      maxGopDistance: 48,
      meanBrightness: 140,
      meanHue: 120,
      meanSaturation: 40,
      minGopDistance: 36,
      pixelFormat: "yuv420p",
      redMean: 150,
      redVariance: 10,
      saturationVariance: 6,
      videoLevel: 40,
      videoProfile: "High",
      width: 1920
    } as ArtifactAnalysis,
    {
      avgGopDistance: 30,
      bFrameCount: 2,
      bitDepth: 10,
      bitrate: 6000000,
      blueMean: 140,
      blueVariance: 7,
      brightnessVariance: 15,
      clippedPixelPercentage: 2.5,
      codecName: "h264",
      colorRange: "pc",
      colorSampleCount: 240,
      colorSpace: "bt2020",
      colorTransfer: "bt709",
      duration: 120,
      entropyCoding: "CABAC",
      fps: 60,
      gopSize: 30,
      gopVariance: 0.5,
      greenMean: 130,
      greenVariance: 9,
      height: 2160,
      hueVariance: 30,
      laplacianMedian: 2.4,
      laplacianSampleCount: 20,
      laplacianStdDev: 0.8,
      maxGopDistance: 34,
      meanBrightness: 150,
      meanHue: 200,
      meanSaturation: 55,
      minGopDistance: 30,
      pixelFormat: "yuv420p",
      redMean: 160,
      redVariance: 11,
      saturationVariance: 8,
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
    expect(chartRows).toHaveLength(10);

    const findRow = (title: string) =>
      chartRows.find(
        (section) =>
          Array.isArray(section.data) &&
          (section.data as { title: string; data: ChartConfiguration }[]).some((c) => c.title === title)
      );

    const laplacianRow = findRow("Median Blurriness");
    expect(laplacianRow).toBeDefined();

    const hueRow = findRow("Mean Hue");
    expect(hueRow).toBeDefined();

    const saturationRow = findRow("Mean Saturation");
    expect(saturationRow).toBeDefined();

    const brightnessRow = findRow("Mean Brightness");
    expect(brightnessRow).toBeDefined();

    const rgbMeanRow = findRow("RGB Channel Means");
    expect(rgbMeanRow).toBeDefined();
    const rgbVarianceRow = findRow("RGB Channel Variance");
    expect(rgbVarianceRow).toBeDefined();

    const fpsResolutionRow = findRow("Framerate");
    if (fpsResolutionRow && Array.isArray(fpsResolutionRow.data)) {
      const rowTitles = (fpsResolutionRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("Framerate");
      expect(rowTitles).toContain("Resolution");
    }

    const bFramesRow = findRow("B-Frames");
    if (bFramesRow && Array.isArray(bFramesRow.data)) {
      const rowTitles = (bFramesRow.data as { title: string; data: ChartConfiguration }[]).map((c) => c.title);
      expect(rowTitles).toContain("B-Frames");
      expect(rowTitles).toContain("Color Space");
      expect(rowTitles).toContain("Profile");
    }

    const levelRow = findRow("Level");
    if (levelRow && Array.isArray(levelRow.data)) {
      const rowData = levelRow.data as { title: string; data: ChartConfiguration }[];
      const rowTitles = rowData.map((c) => c.title);
      expect(rowTitles).toContain("Level");
      expect(rowTitles).toContain("Bitrate (Mbps)");
      const levelChart = rowData.find((c) => c.title === "Level");
      const bitrateChart = rowData.find((c) => c.title === "Bitrate (Mbps)");
      if (levelChart && "labels" in levelChart.data) {
        expect(levelChart.data.labels).toEqual(["4.0", "4.2"]);
      }
      if (bitrateChart && "labels" in bitrateChart.data) {
        const bitrateChartData = bitrateChart.data as { labels?: string[] };
        expect(bitrateChartData.labels).toEqual(["0.7", "6.0"]);
      }
    }

    const minGopSection = report.sections.find((section) => section.title === "Min GOP");
    expect(minGopSection?.type).toBe("chart");
    const minGopChart = minGopSection?.data as ChartConfiguration | undefined;
    if (minGopChart && "labels" in minGopChart) {
      expect(minGopChart.labels).toEqual(["30", "36"]);
      const minGopOptions = (minGopChart as { options?: { width?: number } }).options;
      expect(minGopOptions?.width).toBe(computeLayoutConstants().FULL_CHART_WIDTH);
    }

    const averageGopSection = report.sections.find((section) => section.title === "Average GOP");
    expect(averageGopSection?.type).toBe("chart");
    const averageGopChart = averageGopSection?.data as ChartConfiguration | undefined;
    if (averageGopChart && "labels" in averageGopChart) {
      expect(averageGopChart.labels).toEqual(["30 frames", "42 frames"]);
    }

    const varianceRow = findRow("GOP Variance");
    if (varianceRow && Array.isArray(varianceRow.data)) {
      const rowData = varianceRow.data as { title: string; data: ChartConfiguration }[];
      const rowTitles = rowData.map((c) => c.title);
      expect(rowTitles).toContain("GOP Variance");
      const varianceChart = rowData.find((c) => c.title === "GOP Variance");
      if (varianceChart && "labels" in varianceChart.data) {
        expect(varianceChart.data.labels).toEqual(["0.5 frames^2", "1.0 frames^2"]);
      }
    }
  });

  it("should render GOP Variance at two-thirds width", () => {
    const report = buildVideoAnalysisReport(mockMetadata, 90, 2);
    const varianceRow = report.sections.find(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        (section.data as { title: string; data: ChartConfiguration }[]).some((chart) => chart.title === "GOP Variance")
    );
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

  it("should render Bitrate at half width", () => {
    const report = buildVideoAnalysisReport(mockMetadata, 90, 2);
    const bitrateRow = report.sections.find(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        (section.data as { title: string; data: ChartConfiguration }[]).some(
          (chart) => chart.title === "Bitrate (Mbps)"
        )
    );
    if (!bitrateRow || !Array.isArray(bitrateRow.data)) {
      throw new Error("Bitrate chart row missing");
    }
    const bitrateChartEntry = (bitrateRow.data as { title: string; data: ChartConfiguration }[]).find(
      (chart) => chart.title === "Bitrate (Mbps)"
    );
    if (!bitrateChartEntry) {
      throw new Error("Bitrate chart missing");
    }
    const bitrateChart = bitrateChartEntry.data as { options?: { width?: number } };
    const expectedWidth = computeLayoutConstants().HALF_CHART_WIDTH;
    expect(bitrateChart.options?.width).toBe(expectedWidth);
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

    const varianceRow = report.sections.find(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        (section.data as { title: string; data: ChartConfiguration }[]).some((chart) => chart.title === "GOP Variance")
    );
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
    expect(chartRows).toHaveLength(10);

    const findRow = (title: string) =>
      chartRows.find(
        (section) =>
          Array.isArray(section.data) &&
          (section.data as { title: string; data: ChartConfiguration }[]).some((c) => c.title === title)
      );

    const laplacianRow = findRow("Median Blurriness");
    if (laplacianRow && Array.isArray(laplacianRow.data)) {
      const rowData = laplacianRow.data as { title: string; data: ChartConfiguration }[];
      const blurChart = rowData.find((c) => c.title === "Median Blurriness");
      const shakeChart = rowData.find((c) => c.title === "Shakiness");
      if (blurChart && "labels" in blurChart.data) {
        expect(blurChart.data.labels).toHaveLength(0);
      }
      if (shakeChart && "labels" in shakeChart.data) {
        expect(shakeChart.data.labels).toHaveLength(0);
      }
    }

    const hueRow = findRow("Mean Hue");
    if (hueRow && Array.isArray(hueRow.data)) {
      const hueCharts = hueRow.data as { title: string; data: ChartConfiguration }[];
      const meanHueChart = hueCharts.find((c) => c.title === "Mean Hue");
      const hueVarianceChart = hueCharts.find((c) => c.title === "Hue Variance");
      if (meanHueChart && "labels" in meanHueChart.data) {
        expect(meanHueChart.data.labels).toHaveLength(0);
      }
      if (hueVarianceChart && "labels" in hueVarianceChart.data) {
        expect(hueVarianceChart.data.labels).toHaveLength(0);
      }
    }

    const brightnessRow = findRow("Mean Brightness");
    if (brightnessRow && Array.isArray(brightnessRow.data)) {
      const brightnessCharts = brightnessRow.data as { title: string; data: ChartConfiguration }[];
      const meanBrightnessChart = brightnessCharts.find((c) => c.title === "Mean Brightness");
      const brightnessVarianceChart = brightnessCharts.find((c) => c.title === "Brightness Variance");
      if (meanBrightnessChart && "labels" in meanBrightnessChart.data) {
        expect(meanBrightnessChart.data.labels).toHaveLength(0);
      }
      if (brightnessVarianceChart && "labels" in brightnessVarianceChart.data) {
        expect(brightnessVarianceChart.data.labels).toHaveLength(0);
      }
    }

    const rgbMeanRow = findRow("RGB Channel Means");
    if (rgbMeanRow && Array.isArray(rgbMeanRow.data)) {
      const rgbCharts = rgbMeanRow.data as { title: string; data: ChartConfiguration }[];
      const rgbMeanChart = rgbCharts.find((c) => c.title === "RGB Channel Means");
      if (rgbMeanChart && "labels" in rgbMeanChart.data) {
        expect(rgbMeanChart.data.labels).toHaveLength(0);
      }
    }

    const rgbVarianceRow = findRow("RGB Channel Variance");
    if (rgbVarianceRow && Array.isArray(rgbVarianceRow.data)) {
      const rgbVarianceCharts = rgbVarianceRow.data as { title: string; data: ChartConfiguration }[];
      const rgbVarianceChart = rgbVarianceCharts.find((c) => c.title === "RGB Channel Variance");
      if (rgbVarianceChart && "labels" in rgbVarianceChart.data) {
        expect(rgbVarianceChart.data.labels).toHaveLength(0);
      }
    }

    const clippedSection = report.sections.find((s) => s.title === "Clipped Pixels");
    const clippedChart = clippedSection?.data as { labels?: string[] } | undefined;
    if (clippedChart?.labels !== undefined) {
      expect(clippedChart.labels).toHaveLength(0);
    }

    const fpsRow = findRow("Framerate");
    if (fpsRow && Array.isArray(fpsRow.data)) {
      const rowData = fpsRow.data as { title: string; data: ChartConfiguration }[];
      const fpsChart = rowData.find((c) => c.title === "Framerate");
      const resChart = rowData.find((c) => c.title === "Resolution");

      if (fpsChart && "labels" in fpsChart.data) {
        expect(fpsChart.data.labels).toHaveLength(0);
      }
      if (resChart && "labels" in resChart.data) {
        expect(resChart.data.labels).toHaveLength(0);
      }
    }

    const bFrameRow = findRow("B-Frames");
    if (bFrameRow && Array.isArray(bFrameRow.data)) {
      const rowData = bFrameRow.data as { title: string; data: ChartConfiguration }[];
      const bFrameChart = rowData.find((c) => c.title === "B-Frames");
      if (bFrameChart && "labels" in bFrameChart.data) {
        expect(bFrameChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
      const colorChart = rowData.find((c) => c.title === "Color Space");
      if (colorChart && "labels" in colorChart.data) {
        expect(colorChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
      const profileChart = rowData.find((c) => c.title === "Profile");
      if (profileChart && "labels" in profileChart.data) {
        expect(profileChart.data.labels.length).toBeGreaterThanOrEqual(1);
      }
    }

    const levelRow = findRow("Level");
    if (levelRow && Array.isArray(levelRow.data)) {
      const rowData = levelRow.data as { title: string; data: ChartConfiguration }[];
      const levelChart = rowData.find((c) => c.title === "Level");
      const bitrateChart = rowData.find((c) => c.title === "Bitrate (Mbps)");
      if (levelChart && "labels" in levelChart.data) {
        expect(levelChart.data.labels).toHaveLength(0);
      }
      if (bitrateChart && "labels" in bitrateChart.data) {
        const bitrateChartData = bitrateChart.data as { labels?: string[] };
        expect(bitrateChartData.labels).toHaveLength(0);
      }
    }

    const averageGopSection = report.sections.find((section) => section.title === "Average GOP");
    const averageGopChart = averageGopSection?.data as ChartConfiguration | undefined;
    if (averageGopChart && "labels" in averageGopChart) {
      expect(averageGopChart.labels).toHaveLength(0);
    }

    const minGopSection = report.sections.find((section) => section.title === "Min GOP");
    const minGopChart = minGopSection?.data as ChartConfiguration | undefined;
    if (minGopChart && "labels" in minGopChart) {
      expect(minGopChart.labels).toHaveLength(0);
    }

    const varianceRow = findRow("GOP Variance");
    if (varianceRow && Array.isArray(varianceRow.data)) {
      const rowData = varianceRow.data as { title: string; data: ChartConfiguration }[];
      const varianceChart = rowData.find((c) => c.title === "GOP Variance");
      if (varianceChart && "labels" in varianceChart.data) {
        expect(varianceChart.data.labels).toHaveLength(0);
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
    const varianceRow = report.sections.find(
      (section) =>
        section.type === "chart-row" &&
        Array.isArray(section.data) &&
        (section.data as { title: string; data: ChartConfiguration }[]).some((chart) => chart.title === "GOP Variance")
    );
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
    expect(labels).toEqual(["1.1 frames^2+"]);
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
    expect(labels).toEqual(["33 frames+"]);
  });

  it("renders static gradients when KDE labels collapse to a single value", async () => {
    vi.resetModules();
    const mockLabels = ["10.0"];
    const mockBuildDynamicKde = vi.fn(() => ({
      bounds: { max: 1, min: 0 },
      kde: { labels: mockLabels, values: mockLabels.map(() => 1) }
    }));
    vi.doMock("../../../src/templates/dataAnalysisReport/kdeBounds", () => ({
      buildDynamicKde: mockBuildDynamicKde
    }));
    const singleValueMetadata: ArtifactAnalysis[] = [
      {
        avgGopDistance: 30,
        bFrameCount: 1,
        bitrate: 1000000,
        blueMean: 50,
        blueVariance: 2,
        brightnessVariance: 1,
        clippedPixelPercentage: 1,
        codecName: "h264",
        colorRange: "pc",
        colorSampleCount: 10,
        colorSpace: "bt709",
        colorTransfer: "bt709",
        duration: 60,
        entropyCoding: "CABAC",
        fps: 30,
        gopSize: 30,
        gopVariance: 0.5,
        greenMean: 50,
        greenVariance: 2,
        height: 1080,
        hueVariance: 2,
        laplacianMedian: 1,
        laplacianSampleCount: 5,
        laplacianStdDev: 0.1,
        maxGopDistance: 30,
        meanBrightness: 120,
        meanHue: 50,
        meanSaturation: 25,
        minGopDistance: 30,
        pixelFormat: "yuv420p",
        redMean: 50,
        redVariance: 2,
        saturationVariance: 1,
        videoLevel: 40,
        videoProfile: "High",
        width: 1920
      } as ArtifactAnalysis
    ];

    const { buildVideoAnalysisReport: buildReport } = await import("../../../src/templates/videoAnalysisReport");
    const report = buildReport(singleValueMetadata, 60, singleValueMetadata.length);

    const extractChart = (title: string) => {
      const section = report.sections.find((s) => {
        if (s.title === title && s.type === "chart") {
          return true;
        }
        if (s.type === "chart-row" && Array.isArray(s.data)) {
          return (s.data as { title: string }[]).some((item) => item.title === title);
        }
        return false;
      });
      if (!section) {
        return undefined;
      }
      if (section.type === "chart") {
        return section.data as ChartConfiguration;
      }
      if (Array.isArray(section.data)) {
        const entry = (section.data as { title: string; data: ChartConfiguration }[]).find(
          (item) => item.title === title
        );
        return entry?.data;
      }
      return undefined;
    };

    const hueChart = extractChart("Mean Hue") as ChartConfiguration & { datasets?: unknown[] };
    const saturationChart = extractChart("Mean Saturation") as ChartConfiguration & { datasets?: unknown[] };
    const brightnessChart = extractChart("Mean Brightness") as ChartConfiguration & { datasets?: unknown[] };

    const expectStaticGradient = (chart?: ChartConfiguration & { datasets?: unknown[] }) => {
      const lineChart = chart as { datasets?: { gradientStops?: { offset: number }[]; gradientDirection?: string }[] };
      const dataset = lineChart.datasets?.[0];
      expect(dataset?.gradientDirection).toBe("horizontal");
      expect(dataset?.gradientStops).toEqual([
        expect.objectContaining({ offset: 0 }),
        expect.objectContaining({ offset: 1 })
      ]);
    };

    expectStaticGradient(hueChart);
    expectStaticGradient(saturationChart);
    expectStaticGradient(brightnessChart);
  });

  it("deduplicates gradient stops when labels round to the same value but span a range", async () => {
    vi.resetModules();
    const mockLabels = ["10.01", "10.02"];
    const mockBuildDynamicKde = vi.fn(() => ({
      bounds: { max: 1, min: 0 },
      kde: { labels: mockLabels, values: mockLabels.map(() => 1) }
    }));
    vi.doMock("../../../src/templates/dataAnalysisReport/kdeBounds", () => ({
      buildDynamicKde: mockBuildDynamicKde
    }));
    const closeValuesMetadata: ArtifactAnalysis[] = [
      {
        avgGopDistance: 30,
        bFrameCount: 1,
        bitrate: 1500000,
        blueMean: 51,
        blueVariance: 2,
        brightnessVariance: 2,
        clippedPixelPercentage: 1,
        codecName: "h264",
        colorRange: "pc",
        colorSampleCount: 10,
        colorSpace: "bt709",
        colorTransfer: "bt709",
        duration: 30,
        entropyCoding: "CABAC",
        fps: 24,
        gopSize: 30,
        gopVariance: 0.2,
        greenMean: 52,
        greenVariance: 2,
        height: 720,
        hueVariance: 1,
        laplacianMedian: 0.9,
        laplacianSampleCount: 5,
        laplacianStdDev: 0.1,
        maxGopDistance: 30,
        meanBrightness: 121,
        meanHue: 10.01,
        meanSaturation: 10.01,
        minGopDistance: 30,
        pixelFormat: "yuv420p",
        redMean: 53,
        redVariance: 2,
        saturationVariance: 1,
        videoLevel: 40,
        videoProfile: "High",
        width: 1280
      } as ArtifactAnalysis,
      {
        avgGopDistance: 30,
        bFrameCount: 1,
        bitrate: 1500000,
        blueMean: 52,
        blueVariance: 2,
        brightnessVariance: 2,
        clippedPixelPercentage: 1,
        codecName: "h264",
        colorRange: "pc",
        colorSampleCount: 10,
        colorSpace: "bt709",
        colorTransfer: "bt709",
        duration: 32,
        entropyCoding: "CABAC",
        fps: 24,
        gopSize: 30,
        gopVariance: 0.2,
        greenMean: 52,
        greenVariance: 2,
        height: 720,
        hueVariance: 1,
        laplacianMedian: 0.9,
        laplacianSampleCount: 5,
        laplacianStdDev: 0.1,
        maxGopDistance: 30,
        meanBrightness: 121,
        meanHue: 10.02,
        meanSaturation: 10.02,
        minGopDistance: 30,
        pixelFormat: "yuv420p",
        redMean: 53,
        redVariance: 2,
        saturationVariance: 1,
        videoLevel: 40,
        videoProfile: "High",
        width: 1280
      } as ArtifactAnalysis
    ];

    const { buildVideoAnalysisReport: buildReport } = await import("../../../src/templates/videoAnalysisReport");
    const report = buildReport(closeValuesMetadata, 31, closeValuesMetadata.length);

    const findGradientStops = (title: string): { offset: number }[] | undefined => {
      const section = report.sections.find((s) => {
        if (s.title === title && s.type === "chart") {
          return true;
        }
        if (s.type === "chart-row" && Array.isArray(s.data)) {
          return (s.data as { title: string }[]).some((item) => item.title === title);
        }
        return false;
      });
      if (!section) {
        return undefined;
      }
      const dataEntry =
        section.type === "chart"
          ? (section.data as ChartConfiguration)
          : (section.data as { title: string; data: ChartConfiguration }[]).find((item) => item.title === title)?.data;
      const lineChart = dataEntry as { datasets?: { gradientStops?: { offset: number }[] }[] };
      return lineChart.datasets?.[0]?.gradientStops;
    };

    const hueStops = findGradientStops("Mean Hue");
    const saturationStops = findGradientStops("Mean Saturation");
    const brightnessStops = findGradientStops("Mean Brightness");

    const expectTwoStopsWithRange = (stops?: { offset: number }[]) => {
      expect(stops?.length).toBeGreaterThanOrEqual(2);
      expect(stops?.[0]?.offset).toBe(0);
      expect(stops?.[stops.length - 1]?.offset).toBe(1);
    };

    expectTwoStopsWithRange(hueStops);
    expectTwoStopsWithRange(saturationStops);
    expectTwoStopsWithRange(brightnessStops);
  });

  it("keeps non-bar bitrate chart widths unchanged", async () => {
    vi.resetModules();
    const customBitrateChart: ChartConfiguration = {
      datasets: [],
      height: 100,
      labels: ["a"],
      options: { width: 321 },
      type: "line"
    };
    vi.doMock("../../../src/templates/shared/bitrateCharts", () => ({
      buildBitrateCharts: () => ({
        bitrateValues: customBitrateChart
      })
    }));

    const { buildVideoAnalysisReport: buildReport } = await import("../../../src/templates/videoAnalysisReport");
    const report = buildReport(mockMetadata, 90, mockMetadata.length);

    const bitrateEntry = report.sections
      .flatMap((section) => {
        if (section.type === "chart-row" && Array.isArray(section.data)) {
          return section.data as { title: string; data: ChartConfiguration }[];
        }
        if (section.type === "chart" && section.title === "Bitrate (Mbps)") {
          return [{ data: section.data as ChartConfiguration, title: section.title }];
        }
        return [];
      })
      .find((entry) => entry.title === "Bitrate (Mbps)");
    const bitrateChart = bitrateEntry?.data as { options?: { width?: number } } | undefined;
    expect(bitrateChart?.options?.width).toBe(321);
  });

  it("omits encoding summaries when metadata is empty", async () => {
    vi.resetModules();
    const { buildVideoAnalysisReport: buildReport } = await import("../../../src/templates/videoAnalysisReport");
    const report = buildReport([], 0, 0);
    expect(report.sections[0]?.title).toBe("Duration");
    const encodingSections = report.sections.filter((section) => section.type === "text");
    expect(encodingSections).toHaveLength(0);
  });
});
