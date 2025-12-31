import { describe, expect, it } from "vitest";
import { buildArDataAnalysisReport } from "../../../src/templates/arDataAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";

/**
 * Tests for the AR Data Analysis Report template.
 * - Verifies correct section generation.
 * - Tests lens data parsing and sorting logic.
 * - Ensures handling of empty/unknown device models.
 * - Tests AR data framerate and dropped frames charts.
 * - Tests dropped frames over time chart with multiple dates.
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
    // 18 sections: device, timezone, time-of-day, framerate/dropped row, dropped-over-time,
    // 4 headers + 4 KDE charts + 4 min/max chart rows = 18 total
    expect(report.sections.length).toBe(18);

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Device Model");
    expect(sectionTitles).toContain("Timezone (UTC Offset)");
    expect(sectionTitles).toContain("Time of Day (Hour)");
    expect(sectionTitles).toContain("Dropped Frames Over Time");
    expect(sectionTitles).toContain("Ambient Intensity (lux)");
    expect(sectionTitles).toContain("Color Temperature (Kelvin)");
    expect(sectionTitles).toContain("ISO Speed");
    expect(sectionTitles).toContain("Brightness Value (EV)");

    // Check that header sections exist
    const headerSections = report.sections.filter((s) => s.type === "header");
    expect(headerSections.length).toBe(4);

    // Check that min/max charts are in chart-rows
    // focal/aperture, framerate/dropped, ambient, temperature, iso, brightness
    const chartRows = report.sections.filter((s) => s.type === "chart-row" && Array.isArray(s.data));
    expect(chartRows.length).toBe(6);
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
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeDefined();
    expect(droppedOverTimeSection?.type).toBe("react-component");
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
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeUndefined();
    // Should have 17 sections instead of 18
    expect(report.sections.length).toBe(17);
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
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Dropped Frames Over Time");
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
      expect(chartTitles).toContain("Dropped Frames");
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

  it("should handle scanDateTime with no date part for dropped frames over time", () => {
    const noDatePartMetadata: ArtifactAnalysis[] = [
      {
        arDataFramerate: 30,
        avgAmbientIntensity: 1000,
        avgBrightness: 2,
        avgColorTemperature: 5000,
        avgIso: 400,
        deviceModel: "iPhone 13",
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
    const droppedOverTimeSection = report.sections.find((s) => s.title === "Dropped Frames Over Time");
    expect(droppedOverTimeSection).toBeUndefined();
  });
});
