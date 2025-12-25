import * as fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDataAnalysisReport } from "../../../src/templates/dataAnalysisReport";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { calculateKde } from "../../../src/utils/chart/kde";
import { getBarChartConfig, getLineChartConfig, getPieChartConfig } from "../../../src/utils/chart/configBuilders";

// Mock ChartUtils to isolate test
vi.mock("../../../src/utils/chart/kde", async () => {
  const actual = await vi.importActual("../../../src/utils/chart/kde");
  return {
    ...actual,
    calculateKde: vi.fn().mockReturnValue({ labels: [0, 1, 2], values: [0, 1, 0] })
  };
});
vi.mock("../../../src/utils/chart/configBuilders", async () => {
  const actual = await vi.importActual("../../../src/utils/chart/configBuilders");
  return {
    ...actual,
    getBarChartConfig: vi.fn().mockReturnValue({ type: "bar" }),
    getHistogramConfig: vi.fn().mockReturnValue({ type: "histogram" }),
    getLineChartConfig: vi.fn().mockReturnValue({ type: "line" }),
    getPieChartConfig: vi.fn().mockReturnValue({ type: "pie" })
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
      hasCurvedEmbedded: false,
      hasCurvedWall: false,
      hasDishwasher: false,
      hasDoorBlockingError: false,
      hasExternalOpening: false,
      hasFireplace: false,
      hasMultipleStories: false,
      hasNibWalls: false,
      hasNonRectWall: false,
      hasNonRectangularEmbedded: false,
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
      hasCurvedEmbedded: true,
      hasCurvedWall: true,
      hasDishwasher: true,
      hasDoorBlockingError: true,
      hasExternalOpening: true,
      hasFireplace: true,
      hasMultipleStories: true,
      hasNibWalls: true,
      hasNonRectWall: true,
      hasNonRectangularEmbedded: true,
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
    // 14 (window/door/opening area charts only added when artifactDirs provided)
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
    const featuresChartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].includes("Multiple Stories"));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].some((l) => l.includes("iPhone")));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].some((l) => l.includes("iPad")));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].includes("iPhone 14"));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].includes("iPhone 14"));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].some((l) => l.includes("iPhone")));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].some((l) => l.includes("iPad")));
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

      const chartCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].some((l) => l.includes("iPad")));
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
        .mocked(getBarChartConfig)
        .mock.calls.find((c) => c[0].includes("invalid-focal") || c[0].includes("24.00 mm"));
      const focalLabels = focalCall?.[0] ?? [];
      expect(focalLabels).toContain("invalid-focal");
      // Note: "24 mm" parses to 24.

      // Check Aperture Config
      // Should contain "f/unknown" (fallback)
      const apertureCall = vi.mocked(getBarChartConfig).mock.calls.find((c) => c[0].includes("f/unknown"));
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
      expect(getBarChartConfig).toHaveBeenCalled();
      const calls = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls;
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });

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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      const objectsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const options = call[2] as { stacked?: boolean };
        return options.stacked === true;
      });
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
      expect(getBarChartConfig).toHaveBeenCalled();
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

  describe("unexpected version error", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it("should not add unexpected version error when artifact directories not provided", () => {
      const report = buildDataAnalysisReport(mockMetadata, 60, 1);
      const errorsSection = report.sections.find((s) => s.title === "Capture Errors");
      expect(errorsSection).toBeDefined();

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Unexpected Version");
      });
      expect(errorsChartCall).toBeUndefined();
    });

    it("should count unexpected versions when artifact directories provided", () => {
      const mockRawScanDataVersion1 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 1,
        walls: [],
        windows: []
      };

      const mockRawScanDataVersion2 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      const mockRawScanDataVersion3 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 3,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      // Return the correct version based on directory path
      // This handles both getUnexpectedVersionArtifactDirs and getObjectConfidenceCounts calls
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        // Use path.basename or check the full path
        const normalizedPath = filePath.replace(/\\/g, "/");
        if (normalizedPath.includes("/dir1/") || normalizedPath.endsWith("/dir1/rawScan.json")) {
          return JSON.stringify(mockRawScanDataVersion1);
        }
        if (normalizedPath.includes("/dir2/") || normalizedPath.endsWith("/dir2/rawScan.json")) {
          return JSON.stringify(mockRawScanDataVersion2);
        }
        if (normalizedPath.includes("/dir3/") || normalizedPath.endsWith("/dir3/rawScan.json")) {
          return JSON.stringify(mockRawScanDataVersion3);
        }
        // Fallback for other calls
        return JSON.stringify(mockRawScanDataVersion2);
      });

      // Use exactly 3 metadata items to match 3 directories
      const metadataForTest: ArtifactAnalysis[] = [
        Object.assign({}, mockMetadata[0]),
        Object.assign({}, mockMetadata[0]),
        Object.assign({}, mockMetadata[0])
      ];
      const artifactDirs = ["/test/dir1", "/test/dir2", "/test/dir3"];
      buildDataAnalysisReport(metadataForTest, 60, 1, artifactDirs);

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Unexpected Version");
      });

      expect(errorsChartCall).toBeDefined();
      if (errorsChartCall !== undefined) {
        const labels = errorsChartCall[0] as string[];
        const counts = errorsChartCall[1] as number[];
        const unexpectedVersionIndex = labels.indexOf("Unexpected Version");
        expect(unexpectedVersionIndex).toBeGreaterThanOrEqual(0);
        // Should count 2 unexpected versions (version 1 and version 3)
        expect(counts[unexpectedVersionIndex]).toBe(2);
      }
    });

    it("should count zero unexpected versions when all are version 2", () => {
      const mockRawScanDataVersion2 = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanDataVersion2));

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      buildDataAnalysisReport(mockMetadata.slice(0, 2), 60, 1, artifactDirs);

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Unexpected Version");
      });

      expect(errorsChartCall).toBeDefined();
      if (errorsChartCall !== undefined) {
        const labels = errorsChartCall[0] as string[];
        const counts = errorsChartCall[1] as number[];
        const unexpectedVersionIndex = labels.indexOf("Unexpected Version");
        expect(unexpectedVersionIndex).toBeGreaterThanOrEqual(0);
        // Should count 0 unexpected versions
        expect(counts[unexpectedVersionIndex]).toBe(0);
      }
    });

    it("should handle missing rawScan files when counting unexpected versions", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Unexpected Version");
      });

      expect(errorsChartCall).toBeDefined();
      if (errorsChartCall !== undefined) {
        const labels = errorsChartCall[0] as string[];
        const counts = errorsChartCall[1] as number[];
        const unexpectedVersionIndex = labels.indexOf("Unexpected Version");
        expect(unexpectedVersionIndex).toBeGreaterThanOrEqual(0);
        // Should count 0 when file is missing
        expect(counts[unexpectedVersionIndex]).toBe(0);
      }
    });

    it("should count artifacts with walls smaller than 1.5 sq ft", () => {
      // Wall with area < 1.5 sq ft: length 0.3m * height 0.3m = 0.09 sq m = ~0.97 sq ft
      const mockRawScanWithSmallWall = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0.3, 0.3, 0.2], // length, height, width
            identifier: "w1",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      // Wall with area >= 1.5 sq ft: length 2m * height 2m = 4 sq m = ~43 sq ft
      const mockRawScanWithLargeWall = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [2, 2, 0.2],
            identifier: "w1",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, "/");
        if (normalizedPath.includes("/dir1/")) {
          return JSON.stringify(mockRawScanWithSmallWall);
        }
        if (normalizedPath.includes("/dir2/")) {
          return JSON.stringify(mockRawScanWithLargeWall);
        }
        return JSON.stringify(mockRawScanWithSmallWall);
      });

      const metadataForTest: ArtifactAnalysis[] = [
        Object.assign({}, mockMetadata[0]),
        Object.assign({}, mockMetadata[0])
      ];
      const artifactDirs = ["/test/dir1", "/test/dir2"];
      buildDataAnalysisReport(metadataForTest, 60, 1, artifactDirs);

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Walls < 1.5 sq ft");
      });

      expect(errorsChartCall).toBeDefined();
      if (errorsChartCall !== undefined) {
        const labels = errorsChartCall[0] as string[];
        const counts = errorsChartCall[1] as number[];
        const smallWallsIndex = labels.indexOf("Walls < 1.5 sq ft");
        expect(smallWallsIndex).toBeGreaterThanOrEqual(0);
        // Should count 1 artifact with small walls (dir1)
        expect(counts[smallWallsIndex]).toBe(1);
      }
    });

    it("should count zero artifacts with small walls when all walls are large", () => {
      const mockRawScanWithLargeWall = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [2, 2, 0.2], // Large wall
            identifier: "w1",
            parentIdentifier: null,
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanWithLargeWall));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Walls < 1.5 sq ft");
      });

      expect(errorsChartCall).toBeDefined();
      if (errorsChartCall !== undefined) {
        const labels = errorsChartCall[0] as string[];
        const counts = errorsChartCall[1] as number[];
        const smallWallsIndex = labels.indexOf("Walls < 1.5 sq ft");
        expect(smallWallsIndex).toBeGreaterThanOrEqual(0);
        // Should count 0 when all walls are large
        expect(counts[smallWallsIndex]).toBe(0);
      }
    });

    it("should not include small walls error when artifact directories not provided", () => {
      buildDataAnalysisReport(mockMetadata, 60, 1);

      // Find the errors chart call
      const errorsChartCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
        const labels = call[0] as string[];
        return labels.includes("Walls < 1.5 sq ft");
      });

      expect(errorsChartCall).toBeUndefined();
    });
  });

  describe("window, door, opening, and wall area charts", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it("should not add area charts when artifact directories not provided", () => {
      const report = buildDataAnalysisReport(mockMetadata, 60, 1);
      const sectionTitles = report.sections.map((s) => s.title);
      expect(sectionTitles).not.toContain("Window Areas");
      expect(sectionTitles).not.toContain("Door Areas");
      expect(sectionTitles).not.toContain("Opening Areas");
      expect(sectionTitles).not.toContain("Wall Areas");
    });

    it("should add area charts when artifact directories provided with window, door, opening, and wall data", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [
          {
            confidence: { high: {} },
            dimensions: [0.9, 2.1, 0]
          }
        ],
        floors: [],
        objects: [],
        openings: [
          {
            dimensions: [1.2, 0.8, 0]
          }
        ],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [3.0, 2.5, 0.2],
            polygonCorners: []
          }
        ],
        windows: [
          {
            confidence: { high: {} },
            dimensions: [1.5, 1.2, 0]
          }
        ]
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      const report = buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      const sectionTitles = report.sections.map((s) => s.title);
      expect(sectionTitles).toContain("Window Areas");
      expect(sectionTitles).toContain("Door Areas");
      expect(sectionTitles).toContain("Opening Areas");
      expect(sectionTitles).toContain("Wall Areas");

      // Verify line charts were created for area charts
      const lineChartCalls = (getLineChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const windowAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "windowArea";
      });
      const doorAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "doorArea";
      });
      const openingAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "openingArea";
      });
      const wallAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "wallArea";
      });

      expect(windowAreaCall).toBeDefined();
      expect(doorAreaCall).toBeDefined();
      expect(openingAreaCall).toBeDefined();
      expect(wallAreaCall).toBeDefined();
    });

    it("should handle missing dimensions gracefully", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [{}],
        floors: [],
        objects: [],
        openings: [{}],
        sections: [],
        story: 1,
        version: 2,
        walls: [{}],
        windows: [{}]
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      const report = buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Should still create charts even with empty data
      const sectionTitles = report.sections.map((s) => s.title);
      expect(sectionTitles).toContain("Window Areas");
      expect(sectionTitles).toContain("Door Areas");
      expect(sectionTitles).toContain("Opening Areas");
      expect(sectionTitles).toContain("Wall Areas");
    });

    it("should calculate wall areas from dimensions for rectangular walls", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [4.0, 2.5, 0.2],
            polygonCorners: []
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Verify that getLineChartConfig was called for wallArea
      const lineChartCalls = (getLineChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const wallAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "wallArea";
      });

      expect(wallAreaCall).toBeDefined();
    });

    it("should calculate wall areas from polygon corners for non-rectangular walls", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0, 2.5, 0.2],
            polygonCorners: [
              [0, 0],
              [3, 0],
              [3, 1],
              [0, 1]
            ]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Verify that getLineChartConfig was called for wallArea
      const lineChartCalls = (getLineChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const wallAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "wallArea";
      });

      expect(wallAreaCall).toBeDefined();
    });

    it("should handle walls with polygon corners but missing or invalid height", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0, 0, 0.2],
            polygonCorners: [
              [0, 0],
              [3, 0],
              [3, 1],
              [0, 1]
            ]
          },
          {
            category: { wall: {} },
            confidence: { high: {} },
            polygonCorners: [
              [0, 0],
              [3, 0],
              [3, 1],
              [0, 1]
            ]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Should still create the chart section even if some walls are invalid
      const lineChartCalls = (getLineChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const wallAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "wallArea";
      });

      expect(wallAreaCall).toBeDefined();
    });

    it("should handle polygon corners with invalid point data", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [0, 2.5, 0.2],
            polygonCorners: [[0, 0], [3, 0], undefined, [3, 1], [0, 1, 0, 0]]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Should still create the chart section
      const lineChartCalls = (getLineChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const wallAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "wallArea";
      });

      expect(wallAreaCall).toBeDefined();
    });

    it("should skip walls with invalid polygon corners (less than 3 points)", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [4.0, 2.5, 0.2],
            polygonCorners: [
              [0, 0],
              [1, 0]
            ]
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Should still create the chart section
      const lineChartCalls = (getLineChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const wallAreaCall = lineChartCalls.find((call: unknown[]) => {
        const options = call[2] as { chartId?: string };
        return options.chartId === "wallArea";
      });

      expect(wallAreaCall).toBeDefined();
    });

    it("should handle invalid rawScan JSON files gracefully", () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("invalid json");

      const artifactDirs = ["/test/dir1"];
      const report = buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Should still create charts even if some files are invalid
      const sectionTitles = report.sections.map((s) => s.title);
      expect(sectionTitles).toContain("Wall Areas");
    });

    it("should skip directories without rawScan.json files", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [4.0, 2.5, 0.2],
            polygonCorners: []
          }
        ],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        // First directory has rawScan.json, second doesn't
        return filePath.includes("/test/dir1") && filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1", "/test/dir2"];
      const report = buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Should still create charts
      const sectionTitles = report.sections.map((s) => s.title);
      expect(sectionTitles).toContain("Wall Areas");
    });
  });

  describe("Object Attributes and Door Status Pie Charts", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it("should generate object attributes pie charts when artifact directories provided", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          {
            attributes: {
              ChairArmType: "armless",
              ChairBackType: "high",
              ChairLegType: "four",
              ChairType: "dining",
              SofaType: "sectional",
              StorageType: "cabinet",
              TableShapeType: "rectangular",
              TableType: "dining"
            }
          }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      const report = buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      const sectionTitles = report.sections.map((s) => s.title);
      expect(sectionTitles).toContain("Object Attributes");

      // Verify pie chart configs were created
      const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      expect(pieChartCalls.length).toBeGreaterThan(0);
    });

    it("should generate door status pie chart when artifact directories provided", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [
          {
            category: {
              door: {
                isOpen: true
              }
            }
          },
          {
            category: {
              door: {
                isOpen: false
              }
            }
          },
          {
            category: {
              door: {
                isOpen: false
              }
            }
          }
        ],
        floors: [],
        objects: [],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Verify door status chart was created - check for any pie chart calls
      const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      expect(pieChartCalls.length).toBeGreaterThan(0);

      // Check if any call has legendIconComponents with Closed/Open
      const doorChartCall = pieChartCalls.find((call: unknown[]) => {
        const options = call[2] as { legendIconComponents?: Record<string, unknown> };
        if (options.legendIconComponents === undefined) {
          return false;
        }
        const icons = options.legendIconComponents;
        return "Closed" in icons || "Open" in icons;
      });
      expect(doorChartCall).toBeDefined();
    });

    it("should handle circularElliptic with CircularEllipticIcon", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          {
            attributes: {
              TableShapeType: "circularElliptic"
            }
          }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Verify CircularEllipticIcon was added for "Circular" (converted from circularElliptic)
      const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const tableShapeCall = pieChartCalls.find((call: unknown[]) => {
        const options = call[2] as { legendIconComponents?: Record<string, unknown> };
        return options.legendIconComponents?.["Circular"] !== undefined;
      });
      expect(tableShapeCall).toBeDefined();
    });

    it("should handle unidentified labels with UnidentifiedIcon", () => {
      const mockRawScanData = {
        coreModel: "test",
        doors: [],
        floors: [],
        objects: [
          {
            attributes: {
              ChairType: "unidentified"
            }
          }
        ],
        openings: [],
        sections: [],
        story: 1,
        version: 2,
        walls: [],
        windows: []
      };

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        return filePath.endsWith("rawScan.json");
      });
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockRawScanData));

      const artifactDirs = ["/test/dir1"];
      buildDataAnalysisReport(mockMetadata.slice(0, 1), 60, 1, artifactDirs);

      // Verify UnidentifiedIcon was added for "Unidentified" (converted from unidentified)
      const pieChartCalls = (getPieChartConfig as ReturnType<typeof vi.fn>).mock.calls;
      const unidentifiedCall = pieChartCalls.find((call: unknown[]) => {
        const options = call[2] as { legendIconComponents?: Record<string, unknown> };
        return options.legendIconComponents?.["Unidentified"] !== undefined;
      });
      expect(unidentifiedCall).toBeDefined();
    });
  });

  describe("Aperture label fallback coverage", () => {
    it("should handle aperture labels that don't exist in map (line 204)", () => {
      // Create metadata with aperture values that will be sorted but may have missing entries
      const metaWithAperture = [
        Object.assign({}, mockMetadata[0], {
          lensAperture: "f/2.8"
        }) as ArtifactAnalysis
      ];

      buildDataAnalysisReport(metaWithAperture, 60, 1);

      // Verify aperture chart was created
      expect(getBarChartConfig).toHaveBeenCalled();
    });
  });

  describe("Resolution and KDE coverage", () => {
    it("should handle resolution calculation (line 234)", () => {
      const metaWithRes = [
        Object.assign({}, mockMetadata[0], {
          height: 1080,
          width: 1920
        }) as ArtifactAnalysis
      ];

      buildDataAnalysisReport(metaWithRes, 60, 1);

      // Verify resolution chart was created
      expect(getBarChartConfig).toHaveBeenCalled();
    });

    it("should handle ambient KDE with resolution parameter (line 261)", () => {
      const metaWithAmbient = [
        Object.assign({}, mockMetadata[0], {
          avgAmbientIntensity: 1000
        }) as ArtifactAnalysis
      ];

      buildDataAnalysisReport(metaWithAmbient, 60, 1);

      // Verify ambient chart was created with KDE
      expect(calculateKde).toHaveBeenCalled();
      expect(getLineChartConfig).toHaveBeenCalled();
    });

    it("should handle temperature KDE (line 288)", () => {
      const metaWithTemp = [
        Object.assign({}, mockMetadata[0], {
          avgColorTemperature: 5000
        }) as ArtifactAnalysis
      ];

      buildDataAnalysisReport(metaWithTemp, 60, 1);

      // Verify temperature chart was created with KDE
      expect(calculateKde).toHaveBeenCalled();
      expect(getLineChartConfig).toHaveBeenCalled();
    });
  });
});
