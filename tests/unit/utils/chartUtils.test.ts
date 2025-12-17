import { vi } from "vitest";

import {
  calculateHistogramBinCenter,
  calculateHistogramBins,
  getBarChartConfig,
  getHistogramConfig,
  getLineChartConfig,
  kelvinToRgb
} from "../../../src/utils/chartUtils";

describe("chartUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pure Functions (Logic)", () => {
    describe("calculateHistogramBins", () => {
      const DEFAULT_OPTIONS = { binSize: 2, max: 10, min: 0 };

      it("should bucket data correctly", () => {
        const data = [-1, 0, 1.9, 2, 9.999, 10, 100];
        const { buckets, labels } = calculateHistogramBins(data, { ...DEFAULT_OPTIONS, max: 10, min: 0 });

        // Indices logic:
        // 0 (underflow): -1
        // 1 (0-2): 0, 1.9
        // 2 (2-4): 2
        // ...
        // 6 (overflow): 10, 100
        expect(buckets).toEqual([1, 2, 1, 0, 0, 1, 2]);
        expect(labels[0]).toBe("< 0");
        expect(labels[6]).toBe(">= 10");
      });

      it("should format boundary labels consistency with decimalPlaces", () => {
        const { labels } = calculateHistogramBins([], { ...DEFAULT_OPTIONS, decimalPlaces: 2 });
        expect(labels[0]).toBe("< 0.00");
        expect(labels[labels.length - 1]).toBe(">= 10.00");
        expect(labels[1]).toBe("0.00-2.00");
      });

      it("should hide underflow if requested", () => {
        const data = [-1, 0];
        const { buckets, labels } = calculateHistogramBins(data, { ...DEFAULT_OPTIONS, hideUnderflow: true });
        expect(buckets).toHaveLength(6);
        expect(buckets[0]).toBe(1); // count for 0
        // First label should be the first main bin
        expect(labels[0]).toBe("0-2");
      });

      it("should throw on invalid inputs", () => {
        expect(() => calculateHistogramBins([], { binSize: 0, max: 10, min: 0 })).toThrow(/Invalid binSize/);
        expect(() => calculateHistogramBins([], { binSize: 1, max: 0, min: 10 })).toThrow(/Invalid range/);
        expect(() => calculateHistogramBins([], { binSize: 0.0000001, max: 10000, min: 0 })).toThrow(/safety limit/);
      });
    });

    describe("calculateHistogramBinCenter", () => {
      const OPS = { binSize: 2, max: 10, min: 0 };

      it("should return correct center for buckets", () => {
        const totalBuckets = 7;
        expect(calculateHistogramBinCenter(0, OPS.min, OPS.max, OPS.binSize, false, totalBuckets)).toBe(-1);
        expect(calculateHistogramBinCenter(1, OPS.min, OPS.max, OPS.binSize, false, totalBuckets)).toBe(1);
        expect(calculateHistogramBinCenter(6, OPS.min, OPS.max, OPS.binSize, false, totalBuckets)).toBe(11);
      });

      it("should return correct center when underflow is hidden", () => {
        const totalBuckets = 6;
        const hide = true;
        // Index 0 (Visual bin 0, original bin 1) -> 0-2 -> Center 1
        expect(calculateHistogramBinCenter(0, OPS.min, OPS.max, OPS.binSize, hide, totalBuckets)).toBe(1);
      });
    });

    describe("kelvinToRgb", () => {
      it("should return a string for valid input", () => {
        expect(kelvinToRgb(5000)).toMatch(/^rgba/);
      });
      it("should handle invalid inputs gracefully", () => {
        expect(kelvinToRgb(-100)).toBe("rgba(0, 0, 0, 0.8)");
        // @ts-expect-error
        expect(kelvinToRgb("foo")).toBe("rgba(0, 0, 0, 0.8)");
      });
    });
  });

  describe("Config Getters", () => {
    describe("getLineChartConfig", () => {
      it("validates inputs", () => {
        expect(() => getLineChartConfig(["A"], [{ borderColor: "r", data: [], label: "L" }])).toThrow(/mismatch/);
      });

      it("creates correct structure", () => {
        const config = getLineChartConfig(["A"], [{ borderColor: "r", data: [1], label: "L" }]);
        expect(config.type).toBe("line");
        expect(config.data.datasets).toHaveLength(1);
        expect(config.options?.responsive).toBe(true);
        expect(config.options?.animation).toBe(false);
      });
    });

    describe("getHistogramConfig", () => {
      it("creates correct structure", () => {
        const config = getHistogramConfig([1, 2, 5], { binSize: 5, max: 10, min: 0 });
        expect(config.type).toBe("bar");
        const dataset = config.data.datasets[0];
        if (!dataset) {
          throw new Error("Dataset missing");
        }
        expect(dataset.data).toHaveLength(4); // Underflow + 2 bins + Overflow
      });
    });

    describe("getBarChartConfig", () => {
      it("validates inputs", () => {
        expect(() => getBarChartConfig(["A"], [1, 2])).toThrow(/does not match/);
      });

      it("creates correct structure (horizontal)", () => {
        const config = getBarChartConfig(["A"], [1], { horizontal: true, totalForPercentages: 100 });
        expect(config.type).toBe("bar");
        expect(config.options?.indexAxis).toBe("y");
        expect(config.options?.layout?.padding).toHaveProperty("right", 80);

        // Check for custom hydration property
        const plugins = config.options?.plugins as unknown as { datalabels: { _percentageTotal: number } };
        expect(plugins.datalabels._percentageTotal).toBe(100);
      });

      it("creates correct structure (vertical)", () => {
        const config = getBarChartConfig(["A"], [1], { horizontal: false, totalForPercentages: 100 });
        expect(config.options?.indexAxis).toBe("x");
        expect(config.options?.layout?.padding).toHaveProperty("top", 20);
      });

      it("enables datalabels by default", () => {
        const config = getBarChartConfig(["A"], [1], { horizontal: false });
        const plugins = config.options?.plugins as unknown as { datalabels: { display: boolean } };
        expect(plugins.datalabels.display).toBe(true);
      });
    });
  });
});
