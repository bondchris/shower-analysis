import { describe, expect, it } from "vitest";

import { Confidence } from "../../../../src/models/rawScan/confidence";
import { Surface, SurfaceData } from "../../../../src/models/rawScan/surface";

// Concrete implementation for testing abstract class
class TestSurface extends Surface {}

describe("Surface (Abstract)", () => {
  const MOCK_CONFIDENCE = { high: {} } as Confidence;
  const BASE_DATA: SurfaceData = {
    confidence: MOCK_CONFIDENCE,
    dimensions: [10, 10, 0],
    parentIdentifier: "parent-1",
    polygonCorners: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 10, 0],
      [0, 10, 0]
    ]
  };

  describe("Constructor", () => {
    it("should instantiate with required fields", () => {
      const surface = new TestSurface(BASE_DATA);
      expect(surface.confidence).toBe(MOCK_CONFIDENCE);
      expect(surface.parentIdentifier).toBe("parent-1");
    });

    it("should handle optional fields", () => {
      const data: SurfaceData = {
        ...BASE_DATA,
        completedEdges: [],
        curve: { type: "bezier" },
        identifier: "surf-1",
        story: 2,
        transform: [1, 0, 0, 0]
      };
      const surface = new TestSurface(data);
      expect(surface.identifier).toBe("surf-1");
      expect(surface.story).toBe(2);
      expect(surface.transform).toEqual([1, 0, 0, 0]);
      expect(surface.completedEdges).toEqual([]);
      expect(surface.curve).toEqual({ type: "bezier" });
    });
  });

  describe("Area Calculation", () => {
    it("should calculate area from polygonCorners (Standard)", () => {
      const surface = new TestSurface(BASE_DATA);
      // 10x10 square = 100
      expect(surface.area).toBe(100);
    });

    it("should fallback to calculating area from dimensions if polygonCorners is missing/empty", () => {
      const data: SurfaceData = {
        ...BASE_DATA,
        dimensions: [5, 4, 0], // 5 * 4 = 20
        polygonCorners: [] // Empty
      };
      const surface = new TestSurface(data);
      expect(surface.area).toBe(20);
    });

    it("should fallback to calculating area from dimensions if polygonCorners is undefined", () => {
      const data = {
        ...BASE_DATA,
        dimensions: [3, 3, 0], // 3 * 3 = 9
        polygonCorners: undefined
      } as unknown as SurfaceData;
      const surface = new TestSurface(data);
      expect(surface.area).toBe(9);
    });

    it("should return 0 if both polygonCorners and dimensions are insufficient", () => {
      const data = {
        ...BASE_DATA,
        dimensions: undefined,
        polygonCorners: undefined
      } as unknown as SurfaceData;
      const surface = new TestSurface(data);
      expect(surface.area).toBe(0);
    });

    it("should skip points with insufficient length in polygonCorners", () => {
      const data: SurfaceData = {
        ...BASE_DATA,
        polygonCorners: [
          [0, 0, 0],
          [10, 0, 0],
          [10, 10] // Length 2 < 3
        ]
      };
      const surface = new TestSurface(data);
      // It will only process segments where both points have length >= 3
      // Here: [0,0,0]-[10,0,0] is processed.
      // [10,0,0]-[10,10] is skipped.
      // [10,10]-[0,0,0] is skipped.
      // area += 0*0 - 10*0 = 0.
      expect(surface.area).toBe(0);
    });

    it("should ignore segments when polygon points have missing coordinate values", () => {
      const data: SurfaceData = {
        ...BASE_DATA,
        polygonCorners: [
          [0, undefined as unknown as number, 0],
          [10, 0, 0],
          [0, 0, 0]
        ]
      };
      const surface = new TestSurface(data);
      expect(surface.area).toBe(0);
    });

    it("should return 0 if dimensions has undefined values", () => {
      const data = {
        ...BASE_DATA,
        dimensions: [undefined, 10, 0],
        polygonCorners: []
      } as unknown as SurfaceData;
      const surface = new TestSurface(data);
      expect(surface.area).toBe(0);
    });
  });
});
