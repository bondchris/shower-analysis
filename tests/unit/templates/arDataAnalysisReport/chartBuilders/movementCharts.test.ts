import { describe, expect, it } from "vitest";

import { ArtifactAnalysis } from "../../../../../src/models/artifactAnalysis";
import { buildMovementCharts } from "../../../../../src/templates/arDataAnalysisReport/chartBuilders/movementCharts";

describe("movementCharts", () => {
  const createArtifact = (overrides: Partial<ArtifactAnalysis>): ArtifactAnalysis => {
    const artifact = new ArtifactAnalysis();
    Object.assign(artifact, {
      arDataFramerate: 30,
      avgAmbientIntensity: 1000,
      avgBrightness: 2,
      avgColorTemperature: 5000,
      avgIso: 400,
      avgSpeed: 0,
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
      maxSpeed: 0,
      minAmbientIntensity: 800,
      minBrightness: 1,
      minColorTemperature: 4500,
      minIso: 300,
      minSpeed: 0,
      scanDateTime: "2025:08:01 10:19:39",
      timezone: "-07:00",
      totalDisplacement: 0,
      totalDistanceTraveled: 0,
      ...overrides
    });
    return artifact;
  };

  describe("buildMovementCharts", () => {
    it("should handle empty metadata list", () => {
      const charts = buildMovementCharts([]);

      expect(charts.scanEfficiency).toBeDefined();
      expect(charts.movementSpeed).toBeDefined();

      if ("datasets" in charts.scanEfficiency) {
        const scatterDatasets = charts.scanEfficiency.datasets as { data: unknown[] }[];
        expect(scatterDatasets[0]?.data).toEqual([]);
      }
    });

    it("should filter out zero distance values from scan efficiency", () => {
      const artifacts = [
        createArtifact({ totalDisplacement: 4, totalDistanceTraveled: 20 }),
        createArtifact({ totalDisplacement: 5, totalDistanceTraveled: 0 }),
        createArtifact({ totalDisplacement: 0, totalDistanceTraveled: 30 }),
        createArtifact({ totalDisplacement: 6, totalDistanceTraveled: 45 })
      ];

      const charts = buildMovementCharts(artifacts);

      if ("datasets" in charts.scanEfficiency) {
        const scatterDatasets = charts.scanEfficiency.datasets as { data: { x: number; y: number }[] }[];
        const points = scatterDatasets[0]?.data ?? [];
        expect(points).toEqual([
          { x: 20, y: 4 },
          { x: 45, y: 6 }
        ]);
      }
    });

    it("should handle artifacts with all zero speed values", () => {
      const artifacts = [
        createArtifact({ avgSpeed: 0, maxSpeed: 0, minSpeed: 0 }),
        createArtifact({ avgSpeed: 0, maxSpeed: 0, minSpeed: 0 }),
        createArtifact({ avgSpeed: -1, maxSpeed: -1, minSpeed: -1 })
      ];

      const charts = buildMovementCharts(artifacts);

      expect(charts.movementSpeed).toBeDefined();
      if ("datasets" in charts.movementSpeed) {
        const lineDatasets = charts.movementSpeed.datasets as { data: number[] }[];
        expect(lineDatasets.length).toBe(3);
        lineDatasets.forEach((dataset) => {
          expect(dataset.data.every((v) => v === 0)).toBe(true);
        });
      }
    });

    it("should build speed datasets with valid speed values", () => {
      const artifacts = [
        createArtifact({ avgSpeed: 0.5, maxSpeed: 1.0, minSpeed: 0.2 }),
        createArtifact({ avgSpeed: 0.8, maxSpeed: 1.5, minSpeed: 0.3 }),
        createArtifact({ avgSpeed: 0.6, maxSpeed: 1.2, minSpeed: 0.1 })
      ];

      const charts = buildMovementCharts(artifacts);

      if ("datasets" in charts.movementSpeed) {
        const lineDatasets = charts.movementSpeed.datasets as { data: number[]; label: string }[];
        expect(lineDatasets.length).toBe(3);
        expect(lineDatasets[0]?.label).toBe("Minimum Speed");
        expect(lineDatasets[1]?.label).toBe("Average Speed");
        expect(lineDatasets[2]?.label).toBe("Maximum Speed");

        lineDatasets.forEach((dataset) => {
          expect(dataset.data.some((v) => v > 0)).toBe(true);
        });
      }
    });

    it("should filter speed values correctly with mixed data", () => {
      const artifacts = [
        createArtifact({ avgSpeed: 0.5, maxSpeed: 1.0, minSpeed: 0 }),
        createArtifact({ avgSpeed: 0, maxSpeed: 0, minSpeed: 0.3 }),
        createArtifact({ avgSpeed: 0.6, maxSpeed: 1.2, minSpeed: 0 })
      ];

      const charts = buildMovementCharts(artifacts);

      expect(charts.movementSpeed).toBeDefined();
      if ("datasets" in charts.movementSpeed && "labels" in charts.movementSpeed) {
        const lineDatasets = charts.movementSpeed.datasets as { data: number[] }[];
        const labels = charts.movementSpeed.labels;
        expect(labels.length).toBeGreaterThan(0);
        expect(lineDatasets.length).toBe(3);
      }
    });

    it("should include zoom box configuration for scan efficiency", () => {
      const artifacts = [createArtifact({ totalDisplacement: 4, totalDistanceTraveled: 20 })];

      const charts = buildMovementCharts(artifacts);

      if ("options" in charts.scanEfficiency) {
        const options = charts.scanEfficiency.options as { zoomBox?: { xMax: number; xMin: number } };
        expect(options.zoomBox).toBeDefined();
        expect(options.zoomBox?.xMin).toBe(10);
        expect(options.zoomBox?.xMax).toBe(60);
      }
    });
  });
});
