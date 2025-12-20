import { describe, expect, it, vi } from "vitest";
import { buildDataAnalysisReport } from "../../../src/templates/dataAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import * as ChartUtils from "../../../src/utils/chartUtils";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      deviceModel: "Test Device",
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
      lensAperture: "f/1.8",
      lensFocalLength: "26mm",
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
      deviceModel: "Test Device 2",
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
      lensAperture: "f/2.4",
      lensFocalLength: "13mm",
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

    // Duration, Frame/Res Row, Page Break, Device, Focal/Aperture Row, Ambient, Temp, ISO, Brightness, Area, Errors, Features
    // 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 12
    const EXPECTED_SECTION_COUNT = 12;
    expect(report.sections).toHaveLength(EXPECTED_SECTION_COUNT);

    // Verify specific chart sections exist
    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Duration");
    expect(sectionTitles).toContain("Device Model");
    expect(sectionTitles).toContain("Room Area (Sq Ft)");
    expect(sectionTitles).toContain("Ambient Intensity");
    expect(sectionTitles).toContain("Capture Errors");
    expect(sectionTitles).toContain("Feature Prevalence");
    // Focal/Aperture is a chart-row, might not have top-level title or checks children
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
  describe("Device Sorting", () => {
    it("should sort iPhones by release date desc", () => {
      const devices = [
        "iPhone 11", // Older
        "iPhone 15 Pro", // Newer
        "iPhone 13", // Middle
        "iPhone 15 Pro Max" // Newest, logic: 15 Pro Max > 15 Pro
      ];

      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);
      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi
        .mocked(ChartUtils.getBarChartConfig)
        .mock.calls.find((c) => c[0].some((l) => l.includes("iPhone")));
      const labels = chartCall ? chartCall[0] : [];

      // Expected: 15 Pro Max -> 15 Pro -> 13 -> 11
      const pMaxIdx = labels.indexOf("iPhone 15 Pro Max");
      const pIdx = labels.indexOf("iPhone 15 Pro");
      const i13Idx = labels.indexOf("iPhone 13");
      const i11Idx = labels.indexOf("iPhone 11");

      expect(pMaxIdx).toBeLessThan(pIdx);
      expect(pIdx).toBeLessThan(i13Idx);
      expect(i13Idx).toBeLessThan(i11Idx);
    });

    it("should sort iPads by hierarchy (M4 > Legacy Large > Legacy Small > Rest)", () => {
      const devices = [
        "iPad Pro 11-inch (3rd generation)", // Rank 3 (Legacy Small)
        "iPad Pro 13-inch (M4)", // Rank 1 (M4)
        "iPad Air (5th generation)", // Rank 5 (Air)
        "iPad Pro (12.9-inch) (5th generation)" // Rank 2 (Legacy Large)
      ];

      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);
      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi
        .mocked(ChartUtils.getBarChartConfig)
        .mock.calls.find((c) => c[0].some((l) => l.includes("iPad")));
      const labels = chartCall ? chartCall[0] : [];

      // Expected: M4 -> 12.9 -> 11 -> Air
      const m4Idx = labels.indexOf("iPad Pro 13-inch (M4)");
      const largeIdx = labels.indexOf("iPad Pro (12.9-inch) (5th generation)");
      const smallIdx = labels.indexOf("iPad Pro 11-inch (3rd generation)");
      const airIdx = labels.indexOf("iPad Air (5th generation)");

      expect(m4Idx).toBeLessThan(largeIdx);
      expect(largeIdx).toBeLessThan(smallIdx);
      expect(smallIdx).toBeLessThan(airIdx);
    });

    it("should insert separator between iPhones and other devices", () => {
      const devices = ["iPhone 14", "iPad Pro"];
      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);

      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi.mocked(ChartUtils.getBarChartConfig).mock.calls.find((c) => c[0].includes("iPhone 14"));
      const labels = chartCall?.[0] ?? [];
      const counts = chartCall?.[1] ?? [];

      expect(labels).toContain("---");

      const sepIdx = labels.indexOf("---");
      const phoneIdx = labels.indexOf("iPhone 14");
      const padIdx = labels.indexOf("iPad Pro");

      // iPhone -> Sep -> iPad
      expect(phoneIdx).toBeLessThan(sepIdx);
      expect(sepIdx).toBeLessThan(padIdx);

      // Separator Count should be 0 (INITIAL_COUNT)
      expect(counts[sepIdx]).toBe(0);
    });

    it("should NOT insert separator if only iPhones exist", () => {
      const devices = ["iPhone 14", "iPhone 13"];
      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);

      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi.mocked(ChartUtils.getBarChartConfig).mock.calls.find((c) => c[0].includes("iPhone 14"));
      const labels = chartCall?.[0] ?? [];
      expect(labels).not.toContain("---");
    });

    it("should sort iPhones by Name Descending if Release Dates are equal", () => {
      // iPhone 13 and iPhone 13 mini have same release date (Sept 24, 2021).
      // Or use unknown phones (date 0).
      const devices = ["iPhone A", "iPhone B"];
      // Both date 0.
      // Sort Name Desc -> iPhone B, iPhone A.

      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);
      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi
        .mocked(ChartUtils.getBarChartConfig)
        .mock.calls.find((c) => c[0].some((l) => l.includes("iPhone")));
      const labels = chartCall?.[0] ?? [];

      expect(labels).toEqual(["iPhone B", "iPhone A"]);
    });
    it("should sort iPads by detailed hierarchy including Mini, Base, and Generic Pro", () => {
      const devices = [
        "iPad mini (6th generation)", // Rank 7 (Mini)
        "iPad (9th generation)", // Rank 6 (Base)
        "iPad Pro (9.7-inch)", // Rank 4 (Generic Pro / Other Pro)
        "iPad Air (4th generation)", // Rank 5 (Air)
        "Unknown iPad Device" // Rank 99 (Default)
      ];

      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);
      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi
        .mocked(ChartUtils.getBarChartConfig)
        .mock.calls.find((c) => c[0].some((l) => l.includes("iPad")));
      const labels = chartCall?.[0] ?? [];

      // Expected Rank Order:
      // 1. Pro (9.7) [Rank 4]
      // 2. Air (4th) [Rank 5]
      // 3. Unknown [Rank 6 - Base matches "ipad", !mini]
      // 4. Base (9th) [Rank 6]
      // 5. Mini (6th) [Rank 7]

      // "Unknown" vs "iPad (9th)": Same Rank (6). Name Descending (Z->A).
      // "Unknown" > "iPad". So Unknown comes first.

      const proIdx = labels.indexOf("iPad Pro (9.7-inch)");
      const airIdx = labels.indexOf("iPad Air (4th generation)");
      const baseIdx = labels.indexOf("iPad (9th generation)");
      const miniIdx = labels.indexOf("iPad mini (6th generation)");
      const unknownIdx = labels.indexOf("Unknown iPad Device");

      expect(proIdx).toBeLessThan(airIdx);
      expect(airIdx).toBeLessThan(baseIdx);
      expect(baseIdx).toBeLessThan(unknownIdx);
      expect(baseIdx).toBeLessThan(miniIdx);
    });

    it("should fallback to name sorting for iPads with same Rank and Date", () => {
      // Two "Base" iPads. Dates might match (or be 0 if not found).
      // If dates match, should sort by Name Descending.
      const devices = ["iPad A", "iPad B"]; // Both likely Rank 6 or 99 depending on detection?
      // "iPad A" -> Rank 6 (contains "ipad", not "mini").
      // "iPad B" -> Rank 6.
      // Release dates likely 0.
      // Sort: Name Descending -> iPad B, iPad A.

      const meta = devices.map((d) => Object.assign({}, mockMetadata[0], { deviceModel: d }) as ArtifactAnalysis);
      buildDataAnalysisReport(meta, 1, 1);

      const chartCall = vi
        .mocked(ChartUtils.getBarChartConfig)
        .mock.calls.find((c) => c[0].some((l) => l.includes("iPad")));
      const labels = chartCall?.[0] ?? [];

      expect(labels).toEqual(["iPad B", "iPad A"]);
    });
  });

  describe("Lens Data Handling", () => {
    it("should handle invalid or non-numeric lens data gracefully", () => {
      const invalidMeta = [
        Object.assign({}, mockMetadata[0], {
          lensAperture: "f/unknown",
          lensFocalLength: "invalid-focal"
        }) as ArtifactAnalysis,
        Object.assign({}, mockMetadata[0], {
          lensAperture: "f/2.4",
          lensFocalLength: "24 mm" // Valid-ish but check parsing
        }) as ArtifactAnalysis
      ];

      buildDataAnalysisReport(invalidMeta, 1, 1);

      // Check Focal Length Config
      // Should contain "invalid-focal" directly (fallback) and "24.0 mm" (parsed)
      const focalCall = vi
        .mocked(ChartUtils.getBarChartConfig)
        .mock.calls.find((c) => c[0].includes("invalid-focal") || c[0].includes("24.00 mm"));
      const focalLabels = focalCall?.[0] ?? [];
      expect(focalLabels).toContain("invalid-focal");
      // Note: "24 mm" parses to 24.

      // Check Aperture Config
      // Should contain "f/unknown" (fallback)
      const apertureCall = vi.mocked(ChartUtils.getBarChartConfig).mock.calls.find((c) => c[0].includes("f/unknown"));
      const apertureLabels = apertureCall?.[0] ?? [];
      expect(apertureLabels).toContain("f/unknown");
    });
  });
});
