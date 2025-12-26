import { vi } from "vitest";

import { calculateHistogramBinCenter, calculateHistogramBins } from "../../../src/utils/chart/histogram";
import {
  getBarChartConfig,
  getHistogramConfig,
  getLineChartConfig,
  getMixedChartConfig
} from "../../../src/utils/chart/configBuilders";
import { kelvinToRgb } from "../../../src/utils/chart/colors";

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
        if (config.type === "line") {
          expect(config.datasets).toHaveLength(1);
          expect(config.labels).toEqual(["A"]);
        }
        expect(config.height).toBe(300);
      });
    });

    describe("getHistogramConfig", () => {
      it("creates correct structure", () => {
        const config = getHistogramConfig([1, 2, 5], { binSize: 5, max: 10, min: 0 });
        expect(config.type).toBe("histogram");
        if (config.type === "histogram") {
          expect(config.buckets).toHaveLength(4);
          expect(config.labels).toHaveLength(4);
        }
      });

      it("propagates all options (colorByValue, decimalPlaces, hideUnderflow, title, xLabel, width)", () => {
        const colorFn = (v: number) => (v > 5 ? "red" : "blue");
        const config = getHistogramConfig([1, 2, 8], {
          binSize: 5,
          colorByValue: colorFn,
          decimalPlaces: 1,
          height: 100,
          hideUnderflow: true,
          max: 10,
          min: 0,
          title: "My Histo",
          width: 200,
          xLabel: "X Axis"
        });

        if (config.type === "histogram") {
          expect(config.options.title).toBe("My Histo");
          expect(config.options.xLabel).toBe("X Axis");
          expect(config.options.width).toBe(200);
          expect(config.options.hideUnderflow).toBe(true);
          expect(config.options.decimalPlaces).toBe(1);
          expect(config.colors).toHaveLength(config.labels.length);
        }
      });
    });

    describe("getBarChartConfig", () => {
      it("propagates separatorLabel", () => {
        const config = getBarChartConfig(["A"], [1], { separatorLabel: "---" });
        if (config.type === "bar") {
          expect(config.options.separatorLabel).toBe("---");
        }
      });
      it("validates inputs", () => {
        expect(() => getBarChartConfig(["A"], [1, 2])).toThrow(/does not match/);
      });

      it("creates correct structure (horizontal)", () => {
        const config = getBarChartConfig(["A"], [1], { horizontal: true, totalForPercentages: 100 });
        expect(config.type).toBe("bar");
        if (config.type === "bar") {
          expect(config.options.horizontal).toBe(true);
          expect(config.options.totalForPercentages).toBe(100);
        }
      });

      it("creates correct structure (vertical)", () => {
        const config = getBarChartConfig(["A"], [1], { horizontal: false, totalForPercentages: 100 });
        if (config.type === "bar") {
          expect(config.options.horizontal).toBe(false);
          expect(config.options.totalForPercentages).toBe(100);
        }
      });

      it("includes percentage data when provided", () => {
        const config = getBarChartConfig(["A"], [1], { horizontal: false, totalForPercentages: 100 });
        if (config.type === "bar") {
          expect(config.options.totalForPercentages).toBe(100);
        }
      });

      it("propagates showCount option", () => {
        const config = getBarChartConfig(["A"], [1], { showCount: true });
        if (config.type === "bar") {
          expect(config.options.showCount).toBe(true);
        }
      });
    });

    describe("getMixedChartConfig", () => {
      it("propagates width", () => {
        const config = getMixedChartConfig(["A"], [], { width: 400 });
        if (config.type === "mixed") {
          expect(config.options.width).toBe(400);
        }
      });
    });
  });

  describe("kelvinToRgb", () => {
    it("should return a string for valid input (normal range)", () => {
      expect(kelvinToRgb(5000)).toMatch(/^rgba/);
    });

    it("should handle low temp (< 1900K)", () => {
      // Temp < 19 covers line 500 branch
      const rgb = kelvinToRgb(1000);
      expect(rgb).toMatch(/^rgba/);
    });

    it("should handle high temp (> 6600K)", () => {
      // Temp > 66 covers lines 507-513
      const rgb = kelvinToRgb(8000);
      expect(rgb).toMatch(/^rgba/);
      expect(rgb).not.toBe("rgba(0, 0, 0, 0.8)");
    });

    it("should handle invalid inputs gracefully", () => {
      expect(kelvinToRgb(-100)).toBe("rgba(0, 0, 0, 0.8)");
      // @ts-expect-error
      expect(kelvinToRgb("foo")).toBe("rgba(0, 0, 0, 0.8)");
    });
  });
});
