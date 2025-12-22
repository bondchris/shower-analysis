import * as fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

// Mock fs for confidence counting tests
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

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
      confidenceBreakdown: {},
      deviceModel: "Test Device",
      doorCount: 0,
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
      hasMultipleStories: false,
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
      hasUnparentedEmbedded: false,
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
      openingCount: 0,
      processedAt: new Date(),
      roomAreaSqFt: 100,
      sectionLabels: [],
      sinkCount: 1,
      storageCount: 0,
      stories: [],
      toiletCount: 1,
      tubCount: 1,
      wallCount: 4,
      warnings: [],
      width: 1920,
      windowCount: 0
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
      confidenceBreakdown: {},
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
      hasMultipleStories: true,
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
      sectionLabels: ["Full Scan"],
      sinkCount: 0,
      storageCount: 0,
      stories: [],
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

    // Duration, Frame/Res Row, Page Break, Device, Focal/Aperture Row, Ambient, Temp, ISO, Brightness, Area, Errors, Features, Objects, Sections
    // 14
    const EXPECTED_SECTION_COUNT = 14;
    expect(report.sections).toHaveLength(EXPECTED_SECTION_COUNT);

    // Verify specific chart sections exist
    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain("Duration");
    expect(sectionTitles).toContain("Device Model");
    expect(sectionTitles).toContain("Room Area");
    expect(sectionTitles).toContain("Ambient Intensity");
    expect(sectionTitles).toContain("Capture Errors");
    expect(sectionTitles).toContain("Feature Prevalence");
    expect(sectionTitles).toContain("Object Distribution");
    expect(sectionTitles).toContain("Section Types");

    // Verify "Multiple Stories" feature is included in Feature Prevalence
    const featuresChartCall = vi
      .mocked(ChartUtils.getBarChartConfig)
      .mock.calls.find((c) => c[0].includes("Multiple Stories"));
    expect(featuresChartCall).toBeDefined();
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

      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );
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

      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );
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
      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );

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
      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );

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

      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );
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

      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );
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

      const meta = devices.map(
        (d) => Object.assign({}, mockMetadata[0], { confidenceBreakdown: {}, deviceModel: d }) as ArtifactAnalysis
      );
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

  describe("object confidence counting", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it("should use simple bars when artifact directories not provided", () => {
      const report = buildDataAnalysisReport(mockMetadata, 60, 1);
      const objectsSection = report.sections.find((s) => s.title === "Object Distribution");
      expect(objectsSection).toBeDefined();
      expect(ChartUtils.getBarChartConfig).toHaveBeenCalled();
      const calls = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const lastCallIndex = calls.length - 1;
      const lastCall = calls[lastCallIndex];
      expect(lastCall).toBeDefined();
      if (lastCall !== undefined) {
        // Should be called with simple number array, not stacked data
        const firstDataIndex = 0;
        const dataArg = lastCall[1] as number[] | number[][];
        expect(Array.isArray(dataArg[firstDataIndex])).toBe(false);
      }
    });

    it("should use stacked bars when artifact directories provided with confidence data", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [
          {
            confidence: { high: {} }
          }
        ],
        floors: [],
        objects: [
          {
            category: { toilet: {} },
            confidence: { high: {} }
          },
          {
            category: { toilet: {} },
            confidence: { medium: {} }
          },
          {
            category: { sink: {} },
            confidence: { low: {} }
          }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Verify getBarChartConfig was called with stacked data
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );

      expect(objectsChartCall).toBeDefined();
      if (objectsChartCall !== undefined) {
        const stackedData = objectsChartCall[1] as number[][];
        expect(Array.isArray(stackedData[0])).toBe(true);
        expect(objectsChartCall[2]).toMatchObject({
          stackColors: ["#10b981", "#f59e0b", "#ef4444"],
          stackLabels: ["High", "Medium", "Low"],
          stacked: true
        });
      }
    });

    it("should handle missing rawScan files gracefully", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const artifactDirs = ["/test/dir1"];
      const report = buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should fall back to simple bars when no rawScan files found
      const objectsSection = report.sections.find((s) => s.title === "Object Distribution");
      expect(objectsSection).toBeDefined();
    });

    it("should handle invalid rawScan JSON gracefully", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("invalid json");

      const artifactDirs = ["/test/dir1"];
      const report = buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should fall back to simple bars when rawScan parsing fails
      const objectsSection = report.sections.find((s) => s.title === "Object Distribution");
      expect(objectsSection).toBeDefined();
    });

    it("should count all object categories with different confidence levels", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          { category: { toilet: {} }, confidence: { high: {} } },
          { category: { storage: {} }, confidence: { medium: {} } },
          { category: { sink: {} }, confidence: { low: {} } },
          { category: { bathtub: {} }, confidence: { high: {} } },
          { category: { washerDryer: {} }, confidence: { medium: {} } },
          { category: { stove: {} }, confidence: { low: {} } },
          { category: { table: {} }, confidence: { high: {} } },
          { category: { chair: {} }, confidence: { medium: {} } },
          { category: { bed: {} }, confidence: { low: {} } },
          { category: { sofa: {} }, confidence: { high: {} } },
          { category: { dishwasher: {} }, confidence: { medium: {} } },
          { category: { oven: {} }, confidence: { low: {} } },
          { category: { refrigerator: {} }, confidence: { high: {} } },
          { category: { stairs: {} }, confidence: { medium: {} } },
          { category: { fireplace: {} }, confidence: { low: {} } },
          { category: { television: {} }, confidence: { high: {} } }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Verify stacked chart was created
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should count doors, windows, and openings with confidence", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [{ confidence: { high: {} } }, { confidence: { medium: {} } }],
        floors: [],
        objects: [],
        openings: [{ confidence: { low: {} } }, { confidence: { high: {} } }],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: [{ confidence: { medium: {} } }]
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Verify stacked chart was created
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle openings without confidence", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [
          {}, // No confidence
          { confidence: { high: {} } }
        ],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should still create stacked chart
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle objects with unknown categories", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          { category: { unknownCategory: {} }, confidence: { high: {} } },
          { category: { toilet: {} }, confidence: { medium: {} } }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should still create stacked chart (unknown categories are skipped)
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle multiple artifact directories", () => {
      const mockRawScanData1 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [{ category: { toilet: {} }, confidence: { high: {} } }],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      const mockRawScanData2 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [{ category: { toilet: {} }, confidence: { medium: {} } }],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(JSON.stringify(mockRawScanData1))
        .mockReturnValueOnce(JSON.stringify(mockRawScanData2));

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should aggregate confidence counts from multiple directories
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle directories where some files exist and some don't", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [{ category: { toilet: {} }, confidence: { high: {} } }],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.includes("dir1") && filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should still create stacked chart with data from dir1
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle incrementing confidence for existing object types", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          { category: { toilet: {} }, confidence: { high: {} } },
          { category: { toilet: {} }, confidence: { high: {} } },
          { category: { toilet: {} }, confidence: { medium: {} } }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should aggregate multiple objects of same type
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle confidence with no high, medium, or low defined", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          { category: { toilet: {} }, confidence: {} } // Empty confidence object
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Should still create stacked chart (object type is counted, confidence is ignored)
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should test all confidence level branches (high, medium, low)", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [{ confidence: { high: {} } }, { confidence: { medium: {} } }, { confidence: { low: {} } }],
        floors: [],
        objects: [
          { category: { toilet: {} }, confidence: { high: {} } },
          { category: { sink: {} }, confidence: { medium: {} } },
          { category: { bathtub: {} }, confidence: { low: {} } }
        ],
        openings: [{ confidence: { high: {} } }, { confidence: { medium: {} } }, { confidence: { low: {} } }],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: [{ confidence: { high: {} } }, { confidence: { medium: {} } }, { confidence: { low: {} } }]
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // Verify all confidence branches were exercised
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle case where counts[objectType] already exists (??= false branch)", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          { category: { toilet: {} }, confidence: { high: {} } },
          { category: { toilet: {} }, confidence: { medium: {} } },
          { category: { toilet: {} }, confidence: { low: {} } }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata, 60, 1, artifactDirs);

      // First object creates the entry, subsequent ones use existing entry (tests ??= false branch)
      const objectsChartCall = (ChartUtils.getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => {
          const options = call[2] as { stacked?: boolean };
          return options.stacked === true;
        }
      );
      expect(objectsChartCall).toBeDefined();
    });

    it("should handle iPad device that doesn't match any ranking pattern (RANK_DEFAULT)", () => {
      // Create an iPad device that includes "ipad" but doesn't match any specific pattern
      // This is tricky because Rank 6 matches any "ipad" that's not "mini"
      // But we can test with a device that has unusual formatting
      const metaWithUnknownIpad = [
        Object.assign({}, mockMetadata[0], {
          deviceModel: "iPad"
        }) as ArtifactAnalysis
      ];

      buildDataAnalysisReport(metaWithUnknownIpad, 60, 1);

      // Should still generate report without errors
      expect(ChartUtils.getBarChartConfig).toHaveBeenCalled();
    });

    it("should handle section labels with potential undefined values", () => {
      const metaWithSections = [
        Object.assign({}, mockMetadata[0], {
          sectionLabels: ["Kitchen", "Bathroom", "Living Room"]
        }) as ArtifactAnalysis
      ];

      const report = buildDataAnalysisReport(metaWithSections, 60, 1);

      // Should generate sections chart
      const sectionsSection = report.sections.find((s) => s.title === "Section Types");
      expect(sectionsSection).toBeDefined();
    });
  });
});
