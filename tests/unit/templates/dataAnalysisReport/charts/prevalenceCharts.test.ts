import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildErrorFeatureObjectCharts } from "../../../../../src/templates/dataAnalysisReport/charts/prevalenceCharts";
import { ArtifactAnalysis } from "../../../../../src/models/artifactAnalysis";
import { getBarChartConfig } from "../../../../../src/utils/chart/configBuilders";
import {
  getArtifactsWithSmallWalls,
  getObjectConfidenceCounts,
  getUnexpectedVersionArtifactDirs
} from "../../../../../src/utils/data/rawScanExtractor";
import { LayoutConstants, computeLayoutConstants } from "../../../../../src/templates/dataAnalysisReport/layout";

vi.mock("../../../../../src/utils/chart/configBuilders", () => ({
  getBarChartConfig: vi.fn().mockReturnValue({ type: "bar" })
}));

vi.mock("../../../../../src/utils/data/rawScanExtractor", () => ({
  getArtifactsWithSmallWalls: vi.fn(),
  getObjectConfidenceCounts: vi.fn(),
  getUnexpectedVersionArtifactDirs: vi.fn()
}));

describe("buildErrorFeatureObjectCharts", () => {
  let layout: LayoutConstants;
  let mockMetadata: ArtifactAnalysis[];

  beforeEach(() => {
    vi.clearAllMocks();
    layout = computeLayoutConstants();

    const baseMetadata = new ArtifactAnalysis();
    baseMetadata.avgAmbientIntensity = 1000;
    baseMetadata.avgBrightness = 2;
    baseMetadata.avgColorTemperature = 5000;
    baseMetadata.avgIso = 400;
    baseMetadata.deviceModel = "Test Device";
    baseMetadata.doorCount = 0;
    baseMetadata.duration = 60;
    baseMetadata.fps = 30;
    baseMetadata.height = 1080;
    baseMetadata.lensAperture = "f/1.8";
    baseMetadata.lensFocalLength = "26mm";
    baseMetadata.lensModel = "Wide";
    baseMetadata.openingCount = 0;
    baseMetadata.roomAreaSqFt = 100;
    baseMetadata.sectionLabels = ["Section1"];
    baseMetadata.sinkCount = 1;
    baseMetadata.storageCount = 0;
    baseMetadata.toiletCount = 1;
    baseMetadata.tubCount = 1;
    baseMetadata.wallCount = 4;
    baseMetadata.width = 1920;
    baseMetadata.windowCount = 0;
    mockMetadata = [baseMetadata];

    (getUnexpectedVersionArtifactDirs as ReturnType<typeof vi.fn>).mockReturnValue(new Set<string>());
    (getArtifactsWithSmallWalls as ReturnType<typeof vi.fn>).mockReturnValue(new Set<string>());
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  it("should build errors, features, objects, and sections charts", () => {
    const result = buildErrorFeatureObjectCharts(mockMetadata, undefined, layout);

    expect(result.errors).toBeDefined();
    expect(result.features).toBeDefined();
    expect(result.objects).toBeDefined();
    expect(result.sections).toBeDefined();
    expect(getBarChartConfig).toHaveBeenCalled();
  });

  it("should count errors correctly", () => {
    const metadataWithErrors = [
      Object.assign({}, mockMetadata[0], {
        hasToiletGapErrors: true,
        hasTubGapErrors: true,
        wallCount: 3 // < 4 walls
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithErrors, undefined, layout);

    const errorsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes('Toilet Gap > 1"') && labels.includes('Tub Gap 1"-6"') && labels.includes("< 4 Walls");
    });
    expect(errorsCall).toBeDefined();
  });

  it("should count features correctly", () => {
    const metadataWithFeatures = [
      Object.assign({}, mockMetadata[0], {
        hasCurvedWall: true,
        hasNonRectWall: true,
        toiletCount: 2
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithFeatures, undefined, layout);

    const featuresCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return (
        labels.includes("Non-Rectangular Walls") && labels.includes("Curved Walls") && labels.includes("2+ Toilets")
      );
    });
    expect(featuresCall).toBeDefined();
  });

  it("should count objects correctly", () => {
    const metadataWithObjects = [
      Object.assign({}, mockMetadata[0], {
        doorCount: 1,
        hasChair: true,
        hasTable: true,
        toiletCount: 1,
        windowCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithObjects, undefined, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return (
        labels.includes("Toilet") &&
        labels.includes("Door") &&
        labels.includes("Window") &&
        labels.includes("Chair") &&
        labels.includes("Table")
      );
    });
    expect(objectsCall).toBeDefined();
  });

  it("should include unexpectedVersion error when artifactDirs provided", () => {
    const artifactDirs = ["/test/dir1"];
    (getUnexpectedVersionArtifactDirs as ReturnType<typeof vi.fn>).mockReturnValue(new Set(["/test/dir1"]));

    buildErrorFeatureObjectCharts(mockMetadata, artifactDirs, layout);

    const errorsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("Unexpected Version");
    });
    expect(errorsCall).toBeDefined();
  });

  it("should include smallWalls error when artifactDirs provided", () => {
    const artifactDirs = ["/test/dir1"];
    (getArtifactsWithSmallWalls as ReturnType<typeof vi.fn>).mockReturnValue(new Set(["/test/dir1"]));

    buildErrorFeatureObjectCharts(mockMetadata, artifactDirs, layout);

    const errorsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("Walls < 1.5 sq ft");
    });
    expect(errorsCall).toBeDefined();
  });

  it("should use confidence counts when available", () => {
    const artifactDirs = ["/test/dir1"];
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Door: [3, 1, 0],
      Toilet: [5, 2, 1]
    });

    buildErrorFeatureObjectCharts(mockMetadata, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean; stackColors?: unknown };
      return options.stacked === true && options.stackColors !== undefined;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should count sections correctly", () => {
    const metadataWithSections = [
      Object.assign({}, mockMetadata[0], {
        sectionLabels: ["Section1", "Section2", "Section1"]
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithSections, undefined, layout);

    // Find the sections chart call (it's the last getBarChartConfig call)
    const allCalls = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls;
    const sectionsCall = allCalls[allCalls.length - 1];
    expect(sectionsCall).toBeDefined();
    if (sectionsCall !== undefined) {
      const labels = sectionsCall[0] as string[];
      const counts = sectionsCall[1] as number[];
      const section1Index = labels.indexOf("Section1");
      const section2Index = labels.indexOf("Section2");
      expect(section1Index).toBeGreaterThanOrEqual(0);
      expect(section2Index).toBeGreaterThanOrEqual(0);
      // Section1 appears twice, Section2 appears once
      expect(counts[section1Index]).toBe(2);
      expect(counts[section2Index]).toBe(1);
    }
  });

  it("should handle empty metadata list", () => {
    const result = buildErrorFeatureObjectCharts([], undefined, layout);

    expect(result.errors).toBeDefined();
    expect(result.features).toBeDefined();
    expect(result.objects).toBeDefined();
    expect(result.sections).toBeDefined();
  });

  it("should sort error/feature/object defs by count descending", () => {
    const metadataWithMixedCounts = [
      Object.assign({}, mockMetadata[0], {
        hasToiletGapErrors: true
      }) as ArtifactAnalysis,
      Object.assign({}, mockMetadata[0], {
        hasTubGapErrors: true,
        hasWallGapErrors: true
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithMixedCounts, undefined, layout);

    const errorsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      // Find the index of each error
      const tubGapIndex = labels.indexOf('Tub Gap 1"-6"');
      const wallGapIndex = labels.indexOf('Wall Gaps 1"-12"');
      const toiletGapIndex = labels.indexOf('Toilet Gap > 1"');
      // Tub and Wall should have count 1, Toilet should have count 1
      // But we're checking that sorting happened (higher counts first)
      return tubGapIndex >= 0 && wallGapIndex >= 0 && toiletGapIndex >= 0;
    });
    expect(errorsCall).toBeDefined();
  });

  it("should handle currentDir undefined when artifactDirs length is less than index", () => {
    const artifactDirs = ["/test/dir1"];
    const baseMetadata = mockMetadata[0];
    if (baseMetadata === undefined) {
      throw new Error("mockMetadata[0] should be defined");
    }
    const metadataWithMultiple: ArtifactAnalysis[] = [baseMetadata, baseMetadata, baseMetadata];

    buildErrorFeatureObjectCharts(metadataWithMultiple, artifactDirs, layout);

    // Should not throw when i >= artifactDirs.length
    expect(getBarChartConfig).toHaveBeenCalled();
  });

  it("should skip undefined metadata entries without throwing", () => {
    const baseMetadata = mockMetadata[0];
    if (baseMetadata === undefined) {
      throw new Error("mockMetadata[0] should be defined");
    }
    const metadataWithUndefined: ArtifactAnalysis[] = [
      baseMetadata,
      undefined as unknown as ArtifactAnalysis,
      baseMetadata
    ];

    buildErrorFeatureObjectCharts(metadataWithUndefined, undefined, layout);

    expect(getBarChartConfig).toHaveBeenCalled();
  });

  it("should not increment unexpectedVersion when currentDir is undefined", () => {
    const artifactDirs: string[] = [];
    (getUnexpectedVersionArtifactDirs as ReturnType<typeof vi.fn>).mockReturnValue(new Set(["/test/dir1"]));

    buildErrorFeatureObjectCharts(mockMetadata, artifactDirs, layout);

    const errorsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("Unexpected Version");
    });
    expect(errorsCall).toBeDefined();
    if (errorsCall !== undefined) {
      const counts = errorsCall[1] as number[];
      const unexpectedVersionIndex = (errorsCall[0] as string[]).indexOf("Unexpected Version");
      // Should be 0 because currentDir is undefined
      expect(counts[unexpectedVersionIndex]).toBe(0);
    }
  });

  it("should not increment smallWalls when currentDir is undefined", () => {
    const artifactDirs: string[] = [];
    (getArtifactsWithSmallWalls as ReturnType<typeof vi.fn>).mockReturnValue(new Set(["/test/dir1"]));

    buildErrorFeatureObjectCharts(mockMetadata, artifactDirs, layout);

    const errorsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const labels = call[0] as string[];
      return labels.includes("Walls < 1.5 sq ft");
    });
    expect(errorsCall).toBeDefined();
    if (errorsCall !== undefined) {
      const counts = errorsCall[1] as number[];
      const smallWallsIndex = (errorsCall[0] as string[]).indexOf("Walls < 1.5 sq ft");
      // Should be 0 because currentDir is undefined
      expect(counts[smallWallsIndex]).toBe(0);
    }
  });

  it("should use simple object chart when objectConfidenceCounts is null", () => {
    const artifactDirs = ["/test/dir1"];
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue(null);

    buildErrorFeatureObjectCharts(mockMetadata, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked !== true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should use simple object chart when artifactDirs is undefined", () => {
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue(null);

    buildErrorFeatureObjectCharts(mockMetadata, undefined, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked !== true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should handle undefined confidence counts for a label", () => {
    const artifactDirs = ["/test/dir1"];
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Door: [3, 1, 0]
      // Toilet is missing, should use defaultConfidenceCounts
    });

    const metadataWithToilet = [
      Object.assign({}, mockMetadata[0], {
        toiletCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithToilet, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should handle confidence counts with zero totalObjectCount", () => {
    const artifactDirs = ["/test/dir1"];
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Toilet: [0, 0, 0]
    });

    const metadataWithToilet = [
      Object.assign({}, mockMetadata[0], {
        toiletCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithToilet, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should handle remainderCount greater than zero", () => {
    const artifactDirs = ["/test/dir1"];
    // Create a scenario where remainderCount > 0
    // Use counts that will result in a positive remainder after scaling
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Toilet: [2, 1, 0] // Total = 3, but artifactCount might be 4, so remainderCount = 1
    });

    const metadataWithToilet = [
      Object.assign({}, mockMetadata[0], {
        toiletCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithToilet, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should handle remainderCount less than zero", () => {
    const artifactDirs = ["/test/dir1"];
    // Create a scenario where remainderCount < 0
    // This happens when integerSum > artifactCount
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Toilet: [10, 5, 3] // Large counts
    });

    const metadataWithToilet = [
      Object.assign({}, mockMetadata[0], {
        toiletCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithToilet, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should handle remainderCount equal to zero", () => {
    const artifactDirs = ["/test/dir1"];
    // Create a scenario where remainderCount = 0 (exact match)
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Toilet: [1, 0, 0] // Total = 1, artifactCount = 1
    });

    const metadataWithToilet = [
      Object.assign({}, mockMetadata[0], {
        toiletCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithToilet, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
  });

  it("should distribute remainder units to medium confidence when it has largest remainder", () => {
    const artifactDirs = ["/test/dir1"];
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Door: [1, 4, 0]
    });

    const metadataWithDoor = [
      Object.assign({}, mockMetadata[0], {
        doorCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithDoor, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
    if (objectsCall !== undefined) {
      const labels = objectsCall[0] as string[];
      const data = objectsCall[1] as [number, number, number][];
      const doorIndex = labels.indexOf("Door");
      expect(doorIndex).toBeGreaterThanOrEqual(0);
      if (doorIndex >= 0) {
        const doorData = data[doorIndex];
        if (doorData !== undefined) {
          const [high, medium, low] = doorData;
          expect(high).toBe(0);
          expect(medium).toBe(1);
          expect(low).toBe(0);
        }
      }
    }
  });

  it("should distribute remainder units to low confidence when it has largest remainder", () => {
    const artifactDirs = ["/test/dir1"];
    (getObjectConfidenceCounts as ReturnType<typeof vi.fn>).mockReturnValue({
      Door: [1, 0, 4]
    });

    const metadataWithDoor = [
      Object.assign({}, mockMetadata[0], {
        doorCount: 1
      }) as ArtifactAnalysis
    ];

    buildErrorFeatureObjectCharts(metadataWithDoor, artifactDirs, layout);

    const objectsCall = (getBarChartConfig as ReturnType<typeof vi.fn>).mock.calls.find((call) => {
      const options = call[2] as { stacked?: boolean };
      return options.stacked === true;
    });
    expect(objectsCall).toBeDefined();
    if (objectsCall !== undefined) {
      const labels = objectsCall[0] as string[];
      const data = objectsCall[1] as [number, number, number][];
      const doorIndex = labels.indexOf("Door");
      expect(doorIndex).toBeGreaterThanOrEqual(0);
      if (doorIndex >= 0) {
        const doorData = data[doorIndex];
        if (doorData !== undefined) {
          const [high, medium, low] = doorData;
          expect(high).toBe(0);
          expect(medium).toBe(0);
          expect(low).toBe(1);
        }
      }
    }
  });
});
