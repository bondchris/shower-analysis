import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { buildArDataAnalysisReport } from "../../../src/templates/arDataAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { LineChartConfig } from "../../../src/models/chart/lineChartConfig";
import { ProtractorChartConfig } from "../../../src/models/chart/protractorChartConfig";

/**
 * Tests for the AR Data Analysis Report template.
 * - Verifies correct section generation.
 * - Tests lens data parsing and sorting logic.
 * - Ensures handling of empty/unknown device models.
 * - Tests AR data framerate and dropped frames charts.
 * - Tests dropped frames over time chart with multiple dates.
 * - Covers phone tilt profile aggregation and react component rendering.
 */
describe("arDataAnalysisReport", () => {
  const mockMetadata: ArtifactAnalysis[] = [
    {
      arDataFramerate: 30,
      avgAmbientIntensity: 1000,
      avgBrightness: 2,
      avgColorTemperature: 5000,
      avgIso: 400,
      deviceModel: "iPhone 13",
      droppedArFrameCount: 0,
      droppedArFramePercentage: 0,
      hasDroppedArFrames: false,
      lensAperture: "f/1.8",
      lensFocalLength: "26mm",
      maxAmbientIntensity: 1200,
      maxBrightness: 3,
      maxColorTemperature: 5500,
      maxIso: 500,
      minAmbientIntensity: 800,
      minBrightness: 1,
      minColorTemperature: 4500,
      minIso: 300,
      scanDateTime: "2025:08:01 10:19:39",
      timezone: "-07:00"
    } as ArtifactAnalysis,
    {
      arDataFramerate: 25,
      avgAmbientIntensity: 2000,
      avgBrightness: 4,
      avgColorTemperature: 6000,
      avgIso: 800,
      deviceModel: "", // Should become "Unknown"
      droppedArFrameCount: 5, // Has 5 dropped frames
      droppedArFramePercentage: 2.5, // 5 dropped out of 200 total frames = 2.5%
      hasDroppedArFrames: true, // Has dropped frames
      lensAperture: "f/2.4",
      lensFocalLength: "13mm",
      maxAmbientIntensity: 2500,
      maxBrightness: 5,
      maxColorTemperature: 6500,
      maxIso: 1000,
      minAmbientIntensity: 1500,
      minBrightness: 3,
      minColorTemperature: 5500,
      minIso: 600,
      scanDateTime: "2025:08:02 14:30:00", // Different date for over-time chart
      timezone: "-05:00"
    } as ArtifactAnalysis,
    {
      arDataFramerate: -1, // Should be filtered from framerate KDE
      avgAmbientIntensity: 0, // Should be filtered out of KDE
      avgBrightness: 0, // Should NOT be filtered out of Brightness KDE (uses !== noResults)
      avgColorTemperature: 0, // Should be filtered out
      avgIso: 0, // Should be filtered out
      deviceModel: "Unknown",
      droppedArFrameCount: 0,
      droppedArFramePercentage: 0,
      hasDroppedArFrames: false,
      lensAperture: "invalid", // Should be handled by parseFloat
      lensFocalLength: "invalid", // Should be handled by parseFloat
      maxAmbientIntensity: 0, // Should be filtered out of KDE
      maxBrightness: 0,
      maxColorTemperature: 0,
      maxIso: 0,
      minAmbientIntensity: 0, // Should be filtered out of KDE
      minBrightness: 0,
      minColorTemperature: 0,
      minIso: 0,
      scanDateTime: "", // Should not add to any hour bucket
      timezone: "" // Should become "Unknown"
    } as ArtifactAnalysis
  ];

  it("should generate a report with all expected sections", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);

    expect(report.title).toBe("AR Data Analysis");
    expect(report.subtitle).toBe("Artifacts: 3");
    // 29 sections: device, timezone, time-of-day, framerate/dropped row, dropped-over-time,
    // avg-dropped-over-time, scan-efficiency, 5 headers + combined movement speed chart, phone-tilt,
    // max-tilt-speed/fast-tilts row, fast-tilt-timing, max-roll-speed/fast-rolls row,
    // fast-roll-timing, max-pan-speed/fast-pans row, fast-pan-timing, full-rotation/partial-coverage row,
    // and lighting KDE/min/max sections (phone-roll and phone-pan sections not included when mock data has no roll/pan histogram)
    expect(report.sections.length).toBe(29);

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Device Model");
    expect(sectionTitles).toContain("Timezone (UTC Offset)");
    expect(sectionTitles).toContain("Time of Day (Hour)");
    expect(sectionTitles).toContain("Artifacts with Dropped Frames Over Time");
    expect(sectionTitles).toContain("Average Dropped Frame Percentage Over Time");
    expect(sectionTitles).toContain("Movement Speed");
    expect(sectionTitles).toContain("Ambient Intensity");
    expect(sectionTitles).toContain("Color Temperature");
    expect(sectionTitles).toContain("ISO Speed");
    expect(sectionTitles).toContain("Brightness Value");

    // Check that header sections exist
    const headerSections = report.sections.filter((s) => s.type === "header");
    expect(headerSections.length).toBe(5);

    // focal/aperture, framerate/dropped, max-tilt-speed/fast-tilts, max-roll-speed/fast-rolls, max-pan-speed/fast-pans, fullRotation/partialCoverage, ambient, temperature, iso, brightness
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    expect(chartRows.length).toBe(10);
  });

  it("should handle lens data parsing and sorting", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);

    // Check Focal Length chart (in chart-row section)
    const focalRow = report.sections.find((s) => s.type === "chart-row");
    expect(focalRow).toBeDefined();

    if (focalRow && Array.isArray(focalRow.data)) {
      const focalChart = (focalRow.data as { title: string; data: ChartConfiguration }[]).find(
        (c) => c.title === "Focal Length"
      );
      expect(focalChart).toBeDefined();
      if (focalChart && "labels" in focalChart.data) {
        expect(focalChart.data.labels).toEqual(["13.0 mm", "26.0 mm", "invalid"]);
      }

      const apertureChart = (focalRow.data as { title: string; data: ChartConfiguration }[]).find(
        (c) => c.title === "Max Aperture"
      );
      expect(apertureChart).toBeDefined();
      if (apertureChart && "labels" in apertureChart.data) {
        expect(apertureChart.data.labels).toEqual(["f/1.8", "f/2.4", "invalid"]);
      }
    }
  });

  it("should bucket unknown lens focal length and aperture when not set", () => {
    const unknownLensMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "",
        lensFocalLength: "",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "2025:08:01 10:19:39",
        timezone: "-07:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(unknownLensMetadata, unknownLensMetadata.length);
    const focalRow = report.sections.find((s) => s.type === "chart-row");
    expect(focalRow).toBeDefined();
    if (focalRow && Array.isArray(focalRow.data)) {
      const focalChart = (focalRow.data as { title: string; data: ChartConfiguration }[]).find(
        (c) => c.title === "Focal Length"
      );
      expect(focalChart).toBeDefined();
      if (focalChart && "labels" in focalChart.data) {
        expect(focalChart.data.labels).toContain("Unknown");
      }

      const apertureChart = (focalRow.data as { title: string; data: ChartConfiguration }[]).find(
        (c) => c.title === "Max Aperture"
      );
      expect(apertureChart).toBeDefined();
      if (apertureChart && "labels" in apertureChart.data) {
        expect(apertureChart.data.labels).toContain("Unknown");
      }
    }
  });

  it("should handle empty or unknown device models", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);
    const deviceSection = report.sections.find((s) => s.title === "Device Model");
    expect(deviceSection).toBeDefined();
    if (deviceSection && "labels" in (deviceSection.data as ChartConfiguration)) {
      const deviceChart = deviceSection.data as { labels: string[] };
      expect(deviceChart.labels).toContain("Unknown");
    }
  });

  it("should generate timezone chart with labels sorted by UTC offset and abbreviations", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);
    const timezoneSection = report.sections.find((s) => s.title === "Timezone (UTC Offset)");
    expect(timezoneSection).toBeDefined();
    if (timezoneSection && "labels" in (timezoneSection.data as ChartConfiguration)) {
      const timezoneChart = timezoneSection.data as { labels: string[] };
      // Should be sorted by offset with abbreviations on second line: -07:00\nMT, -05:00\nET, Unknown
      expect(timezoneChart.labels).toEqual(["-07:00\nMT", "-05:00\nET", "Unknown"]);
    }
  });

  it("should handle empty timezone as Unknown", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);
    const timezoneSection = report.sections.find((s) => s.title === "Timezone (UTC Offset)");
    expect(timezoneSection).toBeDefined();
    if (timezoneSection && "labels" in (timezoneSection.data as ChartConfiguration)) {
      const timezoneChart = timezoneSection.data as { labels: string[] };
      expect(timezoneChart.labels).toContain("Unknown");
    }
  });

  it("sorts invalid timezone labels using fallback equality", () => {
    const [firstMetadata] = mockMetadata;
    if (firstMetadata === undefined) {
      throw new Error("mockMetadata must include at least one entry");
    }

    const createArtifact = (timezone: string): ArtifactAnalysis => {
      const artifact = new ArtifactAnalysis();
      Object.assign(artifact, firstMetadata, { timezone });
      return artifact;
    };

    const invalidTimezoneMetadata: ArtifactAnalysis[] = [
      createArtifact("-07:00"),
      createArtifact("invalid"),
      createArtifact("+07:00"),
      createArtifact("")
    ];

    const report = buildArDataAnalysisReport(invalidTimezoneMetadata, invalidTimezoneMetadata.length);
    const timezoneSection = report.sections.find((s) => s.title === "Timezone (UTC Offset)");
    expect(timezoneSection).toBeDefined();
    if (timezoneSection && "labels" in (timezoneSection.data as ChartConfiguration)) {
      const timezoneChart = timezoneSection.data as { labels: string[] };
      expect(timezoneChart.labels).toEqual(["-07:00\nMT", "invalid", "+07:00\nICT", "Unknown"]);
    }
  });

  it("should generate time of day chart with hour buckets from scanDateTime", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);
    const timeOfDaySection = report.sections.find((s) => s.title === "Time of Day (Hour)");
    expect(timeOfDaySection).toBeDefined();
    if (timeOfDaySection && "labels" in (timeOfDaySection.data as ChartConfiguration)) {
      const timeOfDayChart = timeOfDaySection.data as { data: number[]; labels: string[] };
      // Should have all 24 hours
      expect(timeOfDayChart.labels.length).toBe(24);
      expect(timeOfDayChart.labels[0]).toBe("00");
      expect(timeOfDayChart.labels[10]).toBe("10");
      expect(timeOfDayChart.labels[23]).toBe("23");
      // Hour 10 should have 1 scan, hour 14 should have 1 scan
      expect(timeOfDayChart.data[10]).toBe(1);
      expect(timeOfDayChart.data[14]).toBe(1);
      // Hour 00 should have 0 scans
      expect(timeOfDayChart.data[0]).toBe(0);
    }
  });

  it("should generate dropped frames over time section when multiple dates present", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Artifacts with Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeDefined();
    expect(droppedOverTimeSection?.type).toBe("react-component");
  });

  it("should render react components for dropped frame time series charts", () => {
    const report = buildArDataAnalysisReport(mockMetadata, mockMetadata.length);

    const droppedOverTimeSection = report.sections.find((s) => s.title === "Artifacts with Dropped Frames Over Time");
    expect(droppedOverTimeSection?.component).toBeDefined();
    if (droppedOverTimeSection?.component !== undefined) {
      expect(createElement(droppedOverTimeSection.component)).toBeTruthy();
      if (typeof droppedOverTimeSection.component === "function") {
        const renderDropped = droppedOverTimeSection.component as () => React.ReactElement;
        expect(renderDropped()).toBeTruthy();
      }
    }

    const avgDroppedSection = report.sections.find((s) => s.title === "Average Dropped Frame Percentage Over Time");
    expect(avgDroppedSection?.component).toBeDefined();
    if (avgDroppedSection?.component !== undefined) {
      expect(createElement(avgDroppedSection.component)).toBeTruthy();
      if (typeof avgDroppedSection.component === "function") {
        const renderAverage = avgDroppedSection.component as () => React.ReactElement;
        expect(renderAverage()).toBeTruthy();
      }
    }
  });

  it("should not generate dropped frames over time when less than 2 dates", () => {
    const singleDateMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 3,
        droppedArFramePercentage: 1.5,
        hasDroppedArFrames: true,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "2025:08:01 10:19:39",
        timezone: "-07:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(singleDateMetadata, 1);
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Artifacts with Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeUndefined();
    // Should have 27 sections instead of 29 (no dropped-frames-over-time or avg-dropped-over-time)
    // Note: includes combined movement speed chart below the header, max-tilt-speed/fast-tilts row, fast-tilt-timing,
    // max-roll-speed/fast-rolls row, fast-roll-timing, max-pan-speed/fast-pans row, fast-pan-timing, full-rotation/partial-coverage (phone-roll/pan not included without histogram data)
    expect(report.sections.length).toBe(27);
  });

  it("should handle artifacts with invalid scanDateTime for dropped frames over time", () => {
    const invalidDateMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 2,
        droppedArFramePercentage: 1.0,
        hasDroppedArFrames: true,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "", // Empty date
        timezone: "-07:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 25,
        avgAmbientIntensity: 2000,
        avgBrightness: 4,
        avgColorTemperature: 6000,
        avgIso: 800,
        deviceModel: "iPhone 14",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/2.4",
        lensFocalLength: "13mm",
        maxAmbientIntensity: 2500,
        maxBrightness: 5,
        maxColorTemperature: 6500,
        maxIso: 1000,
        minAmbientIntensity: 1500,
        minBrightness: 3,
        minColorTemperature: 5500,
        minIso: 600,
        scanDateTime: "0001:01:01 00:00:00", // Invalid year (filtered out)
        timezone: "-05:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(invalidDateMetadata, 2);
    // Should not have dropped frames over time section due to invalid dates
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Artifacts with Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeUndefined();
  });

  it("should include framerate and dropped frames charts in chart row", () => {
    const report = buildArDataAnalysisReport(mockMetadata, 3);

    // Find the chart row containing the framerate chart
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const framerateRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) &&
        (row.data as { title: string }[]).some((c) => c.title === "AR Data Capture Rate (FPS)")
    );

    expect(framerateRow).toBeDefined();
    if (framerateRow && Array.isArray(framerateRow.data)) {
      const chartTitles = (framerateRow.data as { title: string }[]).map((c) => c.title);
      expect(chartTitles).toContain("AR Data Capture Rate (FPS)");
      expect(chartTitles).toContain("Artifacts with Dropped Frames");
    }
  });

  it("should populate scan efficiency points when distance data is present", () => {
    const createEfficiencyMetadata = (
      base: ArtifactAnalysis,
      totalDistanceTraveled: number,
      totalDisplacement: number
    ): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        totalDisplacement,
        totalDistanceTraveled
      });
      return instance;
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const efficiencyMetadata: ArtifactAnalysis[] = [
      createEfficiencyMetadata(firstMetadata, 20, 4),
      createEfficiencyMetadata(secondMetadata, 45, 6)
    ];

    const report = buildArDataAnalysisReport(efficiencyMetadata, efficiencyMetadata.length);
    const scanEfficiencySection = report.sections.find((s) => s.title === "Scan Efficiency");

    expect(scanEfficiencySection).toBeDefined();
    if (scanEfficiencySection === undefined) {
      return;
    }

    if (!("datasets" in (scanEfficiencySection.data as { datasets?: unknown[] }))) {
      throw new Error("Scan efficiency section must include datasets");
    }

    const chartConfig = scanEfficiencySection.data as { datasets: { data: { x: number; y: number }[] }[] };
    const points = chartConfig.datasets[0]?.data ?? [];
    expect(points).toEqual([
      { x: 20, y: 4 },
      { x: 45, y: 6 }
    ]);
  });

  it("should include max tilt speed and fast tilts charts in chart row", () => {
    const fastTiltMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        maxTiltSpeed: 3,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "2025:08:01 10:19:39",
        timezone: "-07:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 25,
        avgAmbientIntensity: 2000,
        avgBrightness: 4,
        avgColorTemperature: 6000,
        avgIso: 800,
        deviceModel: "iPhone 14",
        droppedArFrameCount: 5,
        droppedArFramePercentage: 2.5,
        hasDroppedArFrames: true,
        lensAperture: "f/2.4",
        lensFocalLength: "13mm",
        maxAmbientIntensity: 2500,
        maxBrightness: 5,
        maxColorTemperature: 6500,
        maxIso: 1000,
        maxTiltSpeed: 8,
        minAmbientIntensity: 1500,
        minBrightness: 3,
        minColorTemperature: 5500,
        minIso: 600,
        scanDateTime: "2025:08:02 14:30:00",
        timezone: "-05:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 20,
        avgAmbientIntensity: 1500,
        avgBrightness: 3,
        avgColorTemperature: 5500,
        avgIso: 600,
        deviceModel: "iPhone 15",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1800,
        maxBrightness: 4,
        maxColorTemperature: 6000,
        maxIso: 700,
        maxTiltSpeed: 6,
        minAmbientIntensity: 1200,
        minBrightness: 2,
        minColorTemperature: 5000,
        minIso: 500,
        scanDateTime: "2025:08:03 12:00:00",
        timezone: "-06:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(fastTiltMetadata, 3);

    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const tiltSpeedRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) && (row.data as { title: string }[]).some((c) => c.title === "Maximum Tilt Speed")
    );

    expect(tiltSpeedRow).toBeDefined();
    if (tiltSpeedRow && Array.isArray(tiltSpeedRow.data)) {
      const chartTitles = (tiltSpeedRow.data as { title: string }[]).map((c) => c.title);
      expect(chartTitles[0]).toBe("Scans with Fast Tilts (>5 °/s)");
      expect(chartTitles[1]).toBe("Maximum Tilt Speed");

      const fastTiltsChart = (
        tiltSpeedRow.data as { title: string; data: { data: number[]; labels: string[] } }[]
      ).find((c) => c.title === "Scans with Fast Tilts (>5 °/s)");
      if (fastTiltsChart !== undefined) {
        expect(fastTiltsChart.data.labels).toEqual(["Fast Tilts", "No Fast Tilts"]);
        expect(fastTiltsChart.data.data[0]).toBe(2);
        expect(fastTiltsChart.data.data[1]).toBe(1);
      }
    }
  });

  it("should sort timezones with Unknown appearing after known timezones", () => {
    // Create metadata with multiple known timezones and Unknown to ensure all sort branches are hit
    // The sort algorithm compares pairs, so we need enough entries to trigger both (a=Unknown) and (b=Unknown)
    const createArtifact = (timezone: string, date: string): ArtifactAnalysis =>
      ({
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: date,
        timezone
      }) as ArtifactAnalysis;

    const mixedTimezoneMetadata: ArtifactAnalysis[] = [
      createArtifact("", "2025:08:01 10:00:00"), // Unknown (first in input order to force b=Unknown comparisons)
      createArtifact("-05:00", "2025:08:02 11:00:00"), // ET
      createArtifact("-07:00", "2025:08:03 12:00:00"), // MT
      createArtifact("+00:00", "2025:08:04 13:00:00"), // GMT/UTC
      createArtifact("invalid-tz", "2025:08:05 14:00:00") // Invalid format
    ];

    const report = buildArDataAnalysisReport(mixedTimezoneMetadata, 5);
    const timezoneSection = report.sections.find((s) => s.title === "Timezone (UTC Offset)");
    expect(timezoneSection).toBeDefined();

    if (timezoneSection && "labels" in (timezoneSection.data as ChartConfiguration)) {
      const timezoneChart = timezoneSection.data as { labels: string[] };
      // Unknown should appear last; valid timezones sorted by offset
      const labels = timezoneChart.labels;
      expect(labels[labels.length - 1]).toBe("Unknown");
      // Check proper ordering: -07:00, -05:00, +00:00, invalid-tz (sorted as 0), Unknown
      expect(labels[0]).toBe("-07:00\nMT");
    }
  });

  it("should handle scanDateTime with invalid hour format", () => {
    const invalidHourMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "2025:08:01", // Missing time portion - invalid format
        timezone: "-07:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 25,
        avgAmbientIntensity: 2000,
        avgBrightness: 4,
        avgColorTemperature: 6000,
        avgIso: 800,
        deviceModel: "iPhone 14",
        droppedArFrameCount: 2,
        droppedArFramePercentage: 1.0,
        hasDroppedArFrames: true,
        lensAperture: "f/2.4",
        lensFocalLength: "13mm",
        maxAmbientIntensity: 2500,
        maxBrightness: 5,
        maxColorTemperature: 6500,
        maxIso: 1000,
        minAmbientIntensity: 1500,
        minBrightness: 3,
        minColorTemperature: 5500,
        minIso: 600,
        scanDateTime: "2025:08:02 invalid:time:format", // Invalid time format
        timezone: "-05:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(invalidHourMetadata, 2);
    const timeOfDaySection = report.sections.find((s) => s.title === "Time of Day (Hour)");
    expect(timeOfDaySection).toBeDefined();
    // Should still generate chart even with invalid hours (they just don't add to counts)
    if (timeOfDaySection && "data" in (timeOfDaySection.data as ChartConfiguration)) {
      const timeOfDayChart = timeOfDaySection.data as { data: number[] };
      // All hours should be 0 since both entries have invalid time formats
      const totalScans = timeOfDayChart.data.reduce((sum, count) => sum + count, 0);
      expect(totalScans).toBe(0);
    }
  });

  it("should ignore scanDateTime hours outside valid range", () => {
    const outOfRangeHourMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "2025:08:01 25:00:00", // hour beyond max
        timezone: "-07:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(outOfRangeHourMetadata, 1);
    const timeOfDaySection = report.sections.find((s) => s.title === "Time of Day (Hour)");
    expect(timeOfDaySection).toBeDefined();
    if (timeOfDaySection && "data" in (timeOfDaySection.data as ChartConfiguration)) {
      const timeOfDayChart = timeOfDaySection.data as { data: number[] };
      const totalScans = timeOfDayChart.data.reduce((sum, count) => sum + count, 0);
      expect(totalScans).toBe(0);
    }
  });

  it("should handle scanDateTime with no date part for dropped frames over time", () => {
    const noDatePartMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 1,
        droppedArFramePercentage: 0.5,
        hasDroppedArFrames: true,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: " 10:19:39", // Starts with space - empty date part after split
        timezone: "-07:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 25,
        avgAmbientIntensity: 2000,
        avgBrightness: 4,
        avgColorTemperature: 6000,
        avgIso: 800,
        deviceModel: "iPhone 14",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/2.4",
        lensFocalLength: "13mm",
        maxAmbientIntensity: 2500,
        maxBrightness: 5,
        maxColorTemperature: 6500,
        maxIso: 1000,
        minAmbientIntensity: 1500,
        minBrightness: 3,
        minColorTemperature: 5500,
        minIso: 600,
        scanDateTime: "10:30:00", // No space at all - no date part
        timezone: "-05:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(noDatePartMetadata, 2);
    // Should not generate dropped frames over time section with no valid dates
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Artifacts with Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeUndefined();
  });

  it("should include phone tilt profile when histogram data is present", () => {
    const createTiltMetadata = (
      base: ArtifactAnalysis,
      histogram: number[],
      leftOverflow: number,
      rightOverflow: number
    ): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        phoneTiltHistogram: histogram,
        phoneTiltLeftOverflow: leftOverflow,
        phoneTiltRightOverflow: rightOverflow
      });
      return instance;
    };

    const isProtractorChartConfig = (config: unknown): config is ProtractorChartConfig => {
      if (typeof config !== "object" || config === null) {
        return false;
      }
      const candidate = config as { histogram?: unknown };
      return Array.isArray(candidate.histogram);
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const phoneTiltMetadata: ArtifactAnalysis[] = [
      createTiltMetadata(firstMetadata, [0, 3, 2], 1, 2),
      createTiltMetadata(secondMetadata, [1, 0, 1], 0, 1)
    ];

    const report = buildArDataAnalysisReport(phoneTiltMetadata, phoneTiltMetadata.length);
    const phoneTiltSection = report.sections.find((s) => s.title === "Phone Tilt Profile");

    expect(phoneTiltSection).toBeDefined();
    if (phoneTiltSection === undefined) {
      return;
    }

    expect(phoneTiltSection.type).toBe("react-component");
    expect(isProtractorChartConfig(phoneTiltSection.data)).toBe(true);
    if (isProtractorChartConfig(phoneTiltSection.data)) {
      const chartConfig = phoneTiltSection.data;
      expect(chartConfig.histogram.slice(0, 3)).toEqual([1, 3, 3]);
      expect(chartConfig.histogram.length).toBe(1801);
      expect(chartConfig.leftOverflowCount).toBe(1);
      expect(chartConfig.rightOverflowCount).toBe(3);
    }

    if (phoneTiltSection.component !== undefined) {
      expect(createElement(phoneTiltSection.component)).toBeTruthy();
      if (typeof phoneTiltSection.component === "function") {
        const renderTilt = phoneTiltSection.component as () => React.ReactElement;
        expect(renderTilt()).toBeTruthy();
      }
    }
  });

  it("should aggregate fast tilt timing by unique artifact bins", () => {
    const createTiltTimingMetadata = (base: ArtifactAnalysis, timings: number[]): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        fastTiltTimings: timings
      });
      return instance;
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const tiltTimingMetadata: ArtifactAnalysis[] = [
      createTiltTimingMetadata(firstMetadata, [0, 0.4, 10.2, 10.7, 99.9]),
      createTiltTimingMetadata(secondMetadata, [50.2, 75.8, 101])
    ];

    const report = buildArDataAnalysisReport(tiltTimingMetadata, tiltTimingMetadata.length);
    const fastTiltTimingSection = report.sections.find((s) => s.title === "Fast Tilt Timing During Scan");

    expect(fastTiltTimingSection).toBeDefined();
    if (fastTiltTimingSection === undefined) {
      return;
    }

    if (!("datasets" in (fastTiltTimingSection.data as LineChartConfig))) {
      throw new Error("Fast tilt timing section must include datasets");
    }

    const chartConfig = fastTiltTimingSection.data as LineChartConfig;
    const dataset = chartConfig.datasets[0];
    expect(dataset).toBeDefined();
    if (dataset === undefined) {
      return;
    }
    const counts = dataset.data as number[];

    // With 0.1% granularity (1001 bins), bin index = percentage * 10
    // Input: [0, 0.4, 10.2, 10.7, 99.9] -> bins [0, 4, 102, 107, 999] (artifact 1)
    // Input: [50.2, 75.8, 101] -> bins [502, 758, 1000 (clamped)] (artifact 2)
    expect(counts[0]).toBe(1); // 0% -> bin 0
    expect(counts[4]).toBe(1); // 0.4% -> bin 4
    expect(counts[102]).toBe(1); // 10.2% -> bin 102
    expect(counts[107]).toBe(1); // 10.7% -> bin 107
    expect(counts[502]).toBe(1); // 50.2% -> bin 502
    expect(counts[758]).toBe(1); // 75.8% -> bin 758
    expect(counts[999]).toBe(1); // 99.9% -> bin 999
    expect(counts[1000]).toBe(1); // 101% clamped -> bin 1000 (Scan End)
  });

  it("should include phone roll profile when histogram data is present", () => {
    const createRollMetadata = (
      base: ArtifactAnalysis,
      histogram: number[],
      leftOverflow: number,
      rightOverflow: number
    ): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        phoneRollHistogram: histogram,
        phoneRollLeftOverflow: leftOverflow,
        phoneRollRightOverflow: rightOverflow
      });
      return instance;
    };

    const isProtractorChartConfig = (config: unknown): config is ProtractorChartConfig => {
      if (typeof config !== "object" || config === null) {
        return false;
      }
      const candidate = config as { histogram?: unknown };
      return Array.isArray(candidate.histogram);
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const phoneRollMetadata: ArtifactAnalysis[] = [
      createRollMetadata(firstMetadata, [0, 5, 1], 0, 1),
      createRollMetadata(secondMetadata, [2, 0, 2], 1, 0)
    ];

    const report = buildArDataAnalysisReport(phoneRollMetadata, phoneRollMetadata.length);
    const phoneRollSection = report.sections.find((s) => s.title === "Phone Roll Profile");

    expect(phoneRollSection).toBeDefined();
    if (phoneRollSection === undefined) {
      return;
    }

    expect(phoneRollSection.type).toBe("react-component");
    expect(isProtractorChartConfig(phoneRollSection.data)).toBe(true);
    if (isProtractorChartConfig(phoneRollSection.data)) {
      const chartConfig = phoneRollSection.data;
      expect(chartConfig.histogram.slice(0, 3)).toEqual([2, 5, 3]);
      expect(chartConfig.histogram.length).toBe(1801);
      expect(chartConfig.leftOverflowCount).toBe(1);
      expect(chartConfig.rightOverflowCount).toBe(1);
    }

    if (phoneRollSection.component !== undefined) {
      expect(createElement(phoneRollSection.component)).toBeTruthy();
      if (typeof phoneRollSection.component === "function") {
        const renderRoll = phoneRollSection.component as () => React.ReactElement;
        expect(renderRoll()).toBeTruthy();
      }
    }
  });

  it("should aggregate fast roll timing by unique artifact bins", () => {
    const createRollTimingMetadata = (base: ArtifactAnalysis, timings: number[]): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        fastRollTimings: timings
      });
      return instance;
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const rollTimingMetadata: ArtifactAnalysis[] = [
      createRollTimingMetadata(firstMetadata, [0, 0.5, 10.1, 10.6, 99.9]),
      createRollTimingMetadata(secondMetadata, [50.2, 75.8, 101])
    ];

    const report = buildArDataAnalysisReport(rollTimingMetadata, rollTimingMetadata.length);
    const fastRollTimingSection = report.sections.find((s) => s.title === "Fast Roll Timing During Scan");

    expect(fastRollTimingSection).toBeDefined();
    if (fastRollTimingSection === undefined) {
      return;
    }

    if (!("datasets" in (fastRollTimingSection.data as LineChartConfig))) {
      throw new Error("Fast roll timing section must include datasets");
    }

    const chartConfig = fastRollTimingSection.data as LineChartConfig;
    const dataset = chartConfig.datasets[0];
    expect(dataset).toBeDefined();
    if (dataset === undefined) {
      return;
    }
    const counts = dataset.data as number[];

    // With 0.1% granularity (1001 bins), bin index = percentage * 10
    // Input: [0, 0.5, 10.1, 10.6, 99.9] -> bins [0, 5, 101, 106, 999] (artifact 1)
    // Input: [50.2, 75.8, 101] -> bins [502, 758, 1000 (clamped)] (artifact 2)
    expect(counts[0]).toBe(1); // 0% -> bin 0
    expect(counts[5]).toBe(1); // 0.5% -> bin 5
    expect(counts[101]).toBe(1); // 10.1% -> bin 101
    expect(counts[106]).toBe(1); // 10.6% -> bin 106
    expect(counts[502]).toBe(1); // 50.2% -> bin 502
    expect(counts[758]).toBe(1); // 75.8% -> bin 758
    expect(counts[999]).toBe(1); // 99.9% -> bin 999
    expect(counts[1000]).toBe(1); // 101% clamped -> bin 1000 (Scan End)
  });

  it("should include phone pan profile when histogram data is present", () => {
    const createPanMetadata = (base: ArtifactAnalysis, histogram: number[]): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        phonePanHistogram: histogram
      });
      return instance;
    };

    const isProtractorChartConfig = (config: unknown): config is ProtractorChartConfig => {
      if (typeof config !== "object" || config === null) {
        return false;
      }
      const candidate = config as { histogram?: unknown };
      return Array.isArray(candidate.histogram);
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const phonePanMetadata: ArtifactAnalysis[] = [
      createPanMetadata(firstMetadata, [0, 1, 2]),
      createPanMetadata(secondMetadata, [2, 0, 1])
    ];

    const report = buildArDataAnalysisReport(phonePanMetadata, phonePanMetadata.length);
    const phonePanSection = report.sections.find((s) => s.title === "Phone Pan Profile");

    expect(phonePanSection).toBeDefined();
    if (phonePanSection === undefined) {
      return;
    }

    expect(phonePanSection.type).toBe("react-component");
    expect(isProtractorChartConfig(phonePanSection.data)).toBe(true);
    if (isProtractorChartConfig(phonePanSection.data)) {
      const chartConfig = phonePanSection.data;
      expect(chartConfig.histogram.slice(0, 3)).toEqual([2, 1, 3]);
      expect(chartConfig.histogram.length).toBe(3601);
      expect(chartConfig.options.angleOffsetDegrees).toBe(90);
    }

    if (phonePanSection.component !== undefined) {
      expect(createElement(phonePanSection.component)).toBeTruthy();
      if (typeof phonePanSection.component === "function") {
        const renderPan = phonePanSection.component as () => React.ReactElement;
        expect(renderPan()).toBeTruthy();
      }
    }
  });

  it("should treat sparse tilt, roll, and pan histograms as zero-filled", () => {
    const baseTilt = new ArtifactAnalysis();
    const baseRoll = new ArtifactAnalysis();

    const tiltHistogram1 = new Array<number>(3);
    tiltHistogram1[0] = 1;
    tiltHistogram1[2] = 2;
    const rollHistogram1 = new Array<number>(3);
    rollHistogram1[0] = 2;
    rollHistogram1[2] = 1;
    const panHistogram1 = new Array<number>(3);
    panHistogram1[0] = 3;
    panHistogram1[2] = 0;

    const tiltHistogram2 = new Array<number>(2);
    tiltHistogram2[1] = 1;
    const rollHistogram2 = new Array<number>(2);
    rollHistogram2[1] = 2;
    const panHistogram2 = new Array<number>(2);
    panHistogram2[1] = 1;

    Object.assign(baseTilt, mockMetadata[0], {
      phonePanHistogram: panHistogram1,
      phoneRollHistogram: rollHistogram1,
      phoneTiltHistogram: tiltHistogram1
    });

    Object.assign(baseRoll, mockMetadata[1], {
      phonePanHistogram: panHistogram2,
      phoneRollHistogram: rollHistogram2,
      phoneTiltHistogram: tiltHistogram2
    });

    const sparseMetadata: ArtifactAnalysis[] = [baseTilt, baseRoll];

    const report = buildArDataAnalysisReport(sparseMetadata, sparseMetadata.length);

    const tiltSection = report.sections.find((s) => s.title === "Phone Tilt Profile");
    expect(tiltSection).toBeDefined();
    if (tiltSection && "histogram" in (tiltSection.data as ProtractorChartConfig)) {
      const hist = (tiltSection.data as ProtractorChartConfig).histogram;
      expect(hist.slice(0, 3)).toEqual([1, 1, 2]);
    }

    const rollSection = report.sections.find((s) => s.title === "Phone Roll Profile");
    expect(rollSection).toBeDefined();
    if (rollSection && "histogram" in (rollSection.data as ProtractorChartConfig)) {
      const hist = (rollSection.data as ProtractorChartConfig).histogram;
      expect(hist.slice(0, 3)).toEqual([2, 2, 1]);
    }

    const panSection = report.sections.find((s) => s.title === "Phone Pan Profile");
    expect(panSection).toBeDefined();
    if (panSection && "histogram" in (panSection.data as ProtractorChartConfig)) {
      const hist = (panSection.data as ProtractorChartConfig).histogram;
      expect(hist.slice(0, 3)).toEqual([3, 1, 0]);
    }
  });

  it("should aggregate fast pan timing by unique artifact bins", () => {
    const createPanTimingMetadata = (base: ArtifactAnalysis, timings: number[]): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        fastPanTimings: timings
      });
      return instance;
    };

    const [firstMetadata, secondMetadata] = mockMetadata;
    if (firstMetadata === undefined || secondMetadata === undefined) {
      throw new Error("mockMetadata must include at least two entries");
    }

    const panTimingMetadata: ArtifactAnalysis[] = [
      createPanTimingMetadata(firstMetadata, [0, 0.4, 10.2, 10.7, 99.9]),
      createPanTimingMetadata(secondMetadata, [50.2, 75.8, 101])
    ];

    const report = buildArDataAnalysisReport(panTimingMetadata, panTimingMetadata.length);
    const fastPanTimingSection = report.sections.find((s) => s.title === "Fast Pan Timing During Scan");

    expect(fastPanTimingSection).toBeDefined();
    if (fastPanTimingSection === undefined) {
      return;
    }

    if (!("datasets" in (fastPanTimingSection.data as LineChartConfig))) {
      throw new Error("Fast pan timing section must include datasets");
    }

    const chartConfig = fastPanTimingSection.data as LineChartConfig;
    const dataset = chartConfig.datasets[0];
    expect(dataset).toBeDefined();
    if (dataset === undefined) {
      return;
    }
    const counts = dataset.data as number[];

    // With 0.1% granularity (1001 bins), bin index = percentage * 10
    // Input: [0, 0.4, 10.2, 10.7, 99.9] -> bins [0, 4, 102, 107, 999] (artifact 1)
    // Input: [50.2, 75.8, 101] -> bins [502, 758, 1000 (clamped)] (artifact 2)
    expect(counts[0]).toBe(1); // 0% -> bin 0
    expect(counts[4]).toBe(1); // 0.4% -> bin 4
    expect(counts[102]).toBe(1); // 10.2% -> bin 102
    expect(counts[107]).toBe(1); // 10.7% -> bin 107
    expect(counts[502]).toBe(1); // 50.2% -> bin 502
    expect(counts[758]).toBe(1); // 75.8% -> bin 758
    expect(counts[999]).toBe(1); // 99.9% -> bin 999
    expect(counts[1000]).toBe(1); // 101% clamped -> bin 1000 (Scan End)
  });

  it("should include full rotation pie chart and partial coverage chart in chart-row", () => {
    const report = buildArDataAnalysisReport(mockMetadata, mockMetadata.length);
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const fullRotationRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) &&
        (row.data as { title: string }[]).some((c) => c.title === "Scans with Full 360° Rotation")
    );

    expect(fullRotationRow).toBeDefined();
    if (fullRotationRow && Array.isArray(fullRotationRow.data)) {
      const chartTitles = (fullRotationRow.data as { title: string }[]).map((c) => c.title);
      expect(chartTitles).toContain("Scans with Full 360° Rotation");
      expect(chartTitles).toContain("Partial Rotation Coverage");

      const fullRotationChart = (
        fullRotationRow.data as { title: string; data: { labels: string[]; data: number[] } }[]
      ).find((c) => c.title === "Scans with Full 360° Rotation");
      if (fullRotationChart !== undefined) {
        expect(fullRotationChart.data.labels).toEqual(["Full 360° Rotation", "Partial Rotation"]);
      }
    }
  });

  it("should count full rotation when all 36 ten-degree sectors have coverage", () => {
    const createPanMetadata = (base: ArtifactAnalysis, histogram: number[]): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        phonePanHistogram: histogram
      });
      return instance;
    };

    const [firstMetadata] = mockMetadata;
    if (firstMetadata === undefined) {
      throw new Error("mockMetadata must include at least one entry");
    }

    // Create a histogram with full coverage: at least one reading in each 10-degree sector
    // 36 sectors, 100 bins per sector, 3601 total bins
    const binsPerSector = 100;
    const sectorMidpoint = 50;
    const fullCoverageHistogram = new Array<number>(3601).fill(0);
    for (let sector = 0; sector < 36; sector++) {
      const sectorBase = sector * binsPerSector;
      const binIndex = sectorBase + sectorMidpoint;
      fullCoverageHistogram[binIndex] = 1;
    }

    // Create a histogram with partial coverage: missing one sector
    const partialCoverageHistogram = new Array<number>(3601).fill(0);
    for (let sector = 0; sector < 35; sector++) {
      const sectorBase = sector * binsPerSector;
      const binIndex = sectorBase + sectorMidpoint;
      partialCoverageHistogram[binIndex] = 1;
    }

    const testMetadata: ArtifactAnalysis[] = [
      createPanMetadata(firstMetadata, fullCoverageHistogram),
      createPanMetadata(firstMetadata, partialCoverageHistogram)
    ];

    const report = buildArDataAnalysisReport(testMetadata, testMetadata.length);
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const fullRotationRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) &&
        (row.data as { title: string }[]).some((c) => c.title === "Scans with Full 360° Rotation")
    );

    expect(fullRotationRow).toBeDefined();
    if (fullRotationRow && Array.isArray(fullRotationRow.data)) {
      const fullRotationChart = (fullRotationRow.data as { title: string; data: { data: number[] } }[]).find(
        (c) => c.title === "Scans with Full 360° Rotation"
      );
      if (fullRotationChart !== undefined) {
        expect(fullRotationChart.data.data[0]).toBe(1);
        expect(fullRotationChart.data.data[1]).toBe(1);
      }
    }
  });

  it("should count partial rotation when histogram is missing or wrong length", () => {
    const createPanMetadata = (base: ArtifactAnalysis, histogram: number[]): ArtifactAnalysis => {
      const instance = new ArtifactAnalysis();
      Object.assign(instance, base, {
        phonePanHistogram: histogram
      });
      return instance;
    };

    const [firstMetadata] = mockMetadata;
    if (firstMetadata === undefined) {
      throw new Error("mockMetadata must include at least one entry");
    }

    // Empty histogram
    const emptyHistogram: number[] = [];

    // Wrong length histogram (should be 3601)
    const wrongLengthHistogram = new Array<number>(100).fill(1);

    const testMetadata: ArtifactAnalysis[] = [
      createPanMetadata(firstMetadata, emptyHistogram),
      createPanMetadata(firstMetadata, wrongLengthHistogram)
    ];

    const report = buildArDataAnalysisReport(testMetadata, testMetadata.length);
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const fullRotationRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) &&
        (row.data as { title: string }[]).some((c) => c.title === "Scans with Full 360° Rotation")
    );

    expect(fullRotationRow).toBeDefined();
    if (fullRotationRow && Array.isArray(fullRotationRow.data)) {
      const fullRotationChart = (fullRotationRow.data as { title: string; data: { data: number[] } }[]).find(
        (c) => c.title === "Scans with Full 360° Rotation"
      );
      if (fullRotationChart !== undefined) {
        expect(fullRotationChart.data.data[0]).toBe(0);
        expect(fullRotationChart.data.data[1]).toBe(2);
      }
    }
  });
  it("builds a smooth partial rotation coverage distribution for partial scans", () => {
    const [firstMetadata] = mockMetadata;
    if (firstMetadata === undefined) {
      throw new Error("mockMetadata must include at least one entry");
    }

    const histogramLength = 3601;
    const binsPerSector = 100;
    const sectorCount = 36;

    const createPanHistogramWithCoverage = (sectorsCovered: number): number[] => {
      const histogram = new Array<number>(histogramLength).fill(0);
      const cappedCoverage = Math.min(sectorsCovered, sectorCount);
      for (let sector = 0; sector < cappedCoverage; sector++) {
        const sectorBase = sector * binsPerSector;
        histogram[sectorBase] = 1;
      }
      return histogram;
    };

    const partialMetadata: ArtifactAnalysis[] = [
      Object.assign(new ArtifactAnalysis(), firstMetadata, {
        phonePanHistogram: createPanHistogramWithCoverage(30)
      }),
      Object.assign(new ArtifactAnalysis(), firstMetadata, {
        phonePanHistogram: createPanHistogramWithCoverage(25)
      })
    ];

    const report = buildArDataAnalysisReport(partialMetadata, partialMetadata.length);
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const partialRotationRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) &&
        (row.data as { title: string }[]).some((c) => c.title === "Partial Rotation Coverage")
    );

    expect(partialRotationRow).toBeDefined();
    if (partialRotationRow && Array.isArray(partialRotationRow.data)) {
      const coverageChart = (partialRotationRow.data as { title: string; data: LineChartConfig }[]).find(
        (c) => c.title === "Partial Rotation Coverage"
      );
      expect(coverageChart).toBeDefined();
      if (coverageChart !== undefined) {
        const { labels, datasets } = coverageChart.data;
        expect(labels.length).toBeGreaterThan(150);
        expect(labels.some((label) => label.includes("%"))).toBe(false);

        const [dataset] = datasets;
        expect(dataset).toBeDefined();
        if (dataset !== undefined) {
          const coverageData = dataset.data.filter((value): value is number => value !== null);
          expect(coverageData.length).toBeGreaterThan(0);
          const maxCoverageValue = coverageData.length > 0 ? Math.max(...coverageData) : 0;
          expect(maxCoverageValue).toBeGreaterThan(0);
        }
      }
    }
  });
  it("should include max roll speed and fast rolls charts in chart row", () => {
    const fastRollMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1200,
        maxBrightness: 3,
        maxColorTemperature: 5500,
        maxIso: 500,
        maxRollSpeed: 3,
        minAmbientIntensity: 800,
        minBrightness: 1,
        minColorTemperature: 4500,
        minIso: 300,
        scanDateTime: "2025:08:01 10:19:39",
        timezone: "-07:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 25,
        avgAmbientIntensity: 2000,
        avgBrightness: 4,
        avgColorTemperature: 6000,
        avgIso: 800,
        deviceModel: "iPhone 14",
        droppedArFrameCount: 5,
        droppedArFramePercentage: 2.5,
        hasDroppedArFrames: true,
        lensAperture: "f/2.4",
        lensFocalLength: "13mm",
        maxAmbientIntensity: 2500,
        maxBrightness: 5,
        maxColorTemperature: 6500,
        maxIso: 1000,
        maxRollSpeed: 8,
        minAmbientIntensity: 1500,
        minBrightness: 3,
        minColorTemperature: 5500,
        minIso: 600,
        scanDateTime: "2025:08:02 14:30:00",
        timezone: "-05:00"
      } as ArtifactAnalysis,
      {
        arDataFramerate: 20,
        avgAmbientIntensity: 1500,
        avgBrightness: 3,
        avgColorTemperature: 5500,
        avgIso: 600,
        deviceModel: "iPhone 15",
        droppedArFrameCount: 0,
        droppedArFramePercentage: 0,
        hasDroppedArFrames: false,
        lensAperture: "f/1.8",
        lensFocalLength: "26mm",
        maxAmbientIntensity: 1800,
        maxBrightness: 4,
        maxColorTemperature: 6000,
        maxIso: 700,
        maxRollSpeed: 6,
        minAmbientIntensity: 1200,
        minBrightness: 2,
        minColorTemperature: 5000,
        minIso: 500,
        scanDateTime: "2025:08:03 12:00:00",
        timezone: "-06:00"
      } as ArtifactAnalysis
    ];

    const report = buildArDataAnalysisReport(fastRollMetadata, 3);

    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    const rollSpeedRow = chartRows.find(
      (row) =>
        Array.isArray(row.data) && (row.data as { title: string }[]).some((c) => c.title === "Maximum Roll Speed")
    );

    expect(rollSpeedRow).toBeDefined();
    if (rollSpeedRow && Array.isArray(rollSpeedRow.data)) {
      const chartTitles = (rollSpeedRow.data as { title: string }[]).map((c) => c.title);
      expect(chartTitles[0]).toBe("Scans with Fast Rolls (>5 °/s)");
      expect(chartTitles[1]).toBe("Maximum Roll Speed");

      const fastRollsChart = (
        rollSpeedRow.data as { title: string; data: { data: number[]; labels: string[] } }[]
      ).find((c) => c.title === "Scans with Fast Rolls (>5 °/s)");
      if (fastRollsChart !== undefined) {
        expect(fastRollsChart.data.labels).toEqual(["Fast Rolls", "No Fast Rolls"]);
        expect(fastRollsChart.data.data[0]).toBe(2);
        expect(fastRollsChart.data.data[1]).toBe(1);
      }
    }
  });
});
