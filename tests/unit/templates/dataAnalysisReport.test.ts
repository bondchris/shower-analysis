import { describe, expect, it, vi } from "vitest";
import { buildDataAnalysisReport } from "../../../src/templates/dataAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";

// Mock ChartUtils to isolate test
vi.mock("../../../src/utils/chartUtils", async () => {
  const actual = await vi.importActual("../../../src/utils/chartUtils");
  return {
    ...actual,
    getBarChartConfig: vi.fn().mockReturnValue({ type: "bar" }),
    getHistogramConfig: vi.fn().mockReturnValue({ type: "histogram" })
  };
});

describe("buildDataAnalysisReport", () => {
  const mockMetadata: ArtifactAnalysis[] = [
    {
      audioChannels: 2,
      audioSampleRate: 44100,
      avgAmbientIntensity: 1000,
      avgBrightness: 2,
      avgColorTemperature: 5000,
      avgIso: 400,
      bitrate: 5000,
      captureDate: new Date(),
      duration: 60,
      environment: "Test",
      errors: [],
      fileSize: 1000,
      fps: 30,
      hasArData: true,
      hasAudio: true,
      hasBed: false,
      hasChair: false,
      hasColinearWallErrors: false,
      hasCrookedWallErrors: false,
      hasCurvedWall: false,
      hasDishwasher: false,
      hasDoorBlockingError: false,
      hasExternalOpening: false,
      hasFireplace: false,
      hasNibWalls: false,
      hasNonRectWall: false,
      hasObjectIntersectionErrors: false,
      hasOven: false,
      hasRawScan: true,
      hasRefrigerator: false,
      hasSofa: false,
      hasSoffit: false,
      hasStairs: false,
      hasStove: false,
      hasTable: false,
      hasTelevision: false,
      hasToiletGapErrors: false,
      hasTubGapErrors: false,
      hasVideo: true,
      hasWallGapErrors: false,
      hasWallObjectIntersectionErrors: false,
      hasWallWallIntersectionErrors: false,
      hasWasherDryer: false,
      height: 1080,
      id: "1",
      lensModel: "Wide",
      processedAt: new Date(),
      roomAreaSqFt: 100,
      sinkCount: 1,
      storageCount: 0,
      toiletCount: 1,
      tubCount: 1,
      wallCount: 4,
      warnings: [],
      width: 1920
    } as unknown as ArtifactAnalysis,
    {
      audioChannels: 2,
      audioSampleRate: 44100,
      avgAmbientIntensity: 2000,
      avgBrightness: 4,
      avgColorTemperature: 6000,
      avgIso: 800,
      bitrate: 10000,
      captureDate: new Date(),
      duration: 120,
      environment: "Test",
      errors: [],
      fileSize: 2000,
      fps: 60,
      hasArData: true,
      hasAudio: true,
      hasBed: true,
      hasChair: true,
      hasColinearWallErrors: true,
      hasCrookedWallErrors: true,
      hasCurvedWall: true,
      hasDishwasher: true,
      hasDoorBlockingError: true,
      hasExternalOpening: true,
      hasFireplace: true,
      hasNibWalls: true,
      hasNonRectWall: true,
      hasObjectIntersectionErrors: true,
      hasOven: true,
      hasRawScan: true,
      hasRefrigerator: true,
      hasSofa: true,
      hasSoffit: true,
      hasStairs: true,
      hasStove: true,
      hasTable: true,
      hasTelevision: true,
      hasToiletGapErrors: true,
      hasTubGapErrors: true,
      hasVideo: true,
      hasWallGapErrors: true,
      hasWallObjectIntersectionErrors: true,
      hasWallWallIntersectionErrors: true,
      hasWasherDryer: true,
      height: 2160,
      id: "2",
      lensModel: "Ultra Wide",
      processedAt: new Date(),
      roomAreaSqFt: 200,
      sinkCount: 0,
      storageCount: 0,
      toiletCount: 2,
      tubCount: 2,
      wallCount: 3,
      warnings: [],
      width: 3840
    } as unknown as ArtifactAnalysis
  ];

  it("should generate a report with all expected sections", () => {
    const report = buildDataAnalysisReport(mockMetadata, 60, 1);

    expect(report.title).toBe("Artifact Data Analysis");
    expect(report.subtitle).toContain("Avg Duration: 60");

    // Duration, Frame/Res Row, Page Break, Lens, Ambient, Temp, ISO, Brightness, Area, Errors, Features
    // 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 11 sections added to metadata sections (which is 0)
    const EXPECTED_SECTION_COUNT = 11;
    expect(report.sections).toHaveLength(EXPECTED_SECTION_COUNT);

    // Verify specific chart sections exist
    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Duration");
    expect(sectionTitles).toContain("Lens Model");
    expect(sectionTitles).toContain("Room Area (Sq Ft)");
    expect(sectionTitles).toContain("Ambient Intensity");
    expect(sectionTitles).toContain("Capture Errors");
    expect(sectionTitles).toContain("Feature Prevalence");
  });

  it("should handle mixed data gracefully", () => {
    // ... test with mixed valid/invalid data
    const mixedMeta = [
      new ArtifactAnalysis(), // Empty/Invalid
      Object.assign(new ArtifactAnalysis(), { duration: 30, height: 1080, width: 1920 }) // Valid
    ];

    const report = buildDataAnalysisReport(mixedMeta, 2, 1);
    const MIN_SECTIONS = 5;
    expect(report.sections.length).toBeGreaterThanOrEqual(MIN_SECTIONS);
  });
});
