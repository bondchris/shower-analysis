import { ChartJSNodeCanvas } from "chartjs-node-canvas";

import {
  buildBarChartConfig,
  buildLineChartConfig,
  calculateHistogramBinCenter,
  calculateHistogramBins,
  createBarChart,
  createHistogram,
  createLineChart,
  formatPercentageLabel,
  kelvinToRgb
} from "../../../src/utils/chartUtils";

// Mock chartjs-node-canvas
jest.mock("chartjs-node-canvas");

const MockChartJSNodeCanvas = ChartJSNodeCanvas as jest.MockedClass<typeof ChartJSNodeCanvas>;

describe("chartUtils", () => {
  let renderToBufferMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    renderToBufferMock = jest.fn().mockResolvedValue(Buffer.from("ok"));
    MockChartJSNodeCanvas.mockImplementation(() => {
      return {
        renderToBuffer: renderToBufferMock
      } as unknown as ChartJSNodeCanvas;
    });
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

    describe("formatPercentageLabel", () => {
      it("should format percentages correctly", () => {
        expect(formatPercentageLabel(10, 100)).toBe("10%");
        expect(formatPercentageLabel(1, 3)).toBe("33.33%"); // Truncated to 2 decimals
        expect(formatPercentageLabel(0.5, 100)).toBe("0.5%"); // Trailing zeros trimmed
      });
    });

    describe("kelvinToRgb", () => {
      it("should return a string for valid input", () => {
        expect(kelvinToRgb(5000)).toMatch(/^rgba/);
      });
      it("should handle invalid inputs gracefully", () => {
        expect(kelvinToRgb(-100)).toBe("rgba(0, 0, 0, 0.8)");
        // @ts-ignore
        expect(kelvinToRgb("foo")).toBe("rgba(0, 0, 0, 0.8)");
      });
    });
  });

  describe("Config Builders", () => {
    it("buildLineChartConfig validates inputs", () => {
      expect(() => buildLineChartConfig(["A"], [{ borderColor: "r", data: [], label: "L" }])).toThrow(/mismatch/);
    });

    it("buildLineChartConfig creates correct structure", () => {
      const config = buildLineChartConfig(["A"], [{ borderColor: "r", data: [1], label: "L" }]);
      expect(config.type).toBe("line");
      expect(config.data.datasets).toHaveLength(1);
    });

    it("buildBarChartConfig validates inputs", () => {
      expect(() => buildBarChartConfig(["A"], [1, 2])).toThrow(/does not match/);
    });

    it("buildBarChartConfig creates correct structure (horizontal)", () => {
      const config = buildBarChartConfig(["A"], [1], { horizontal: true, totalForPercentages: 100 });
      expect(config.options?.indexAxis).toBe("y");
      expect(config.options?.layout?.padding).toHaveProperty("right", 60);
    });

    it("buildBarChartConfig creates correct structure (vertical)", () => {
      const config = buildBarChartConfig(["A"], [1], { horizontal: false, totalForPercentages: 100 });
      expect(config.options?.indexAxis).toBe("x");
      expect(config.options?.layout?.padding).toHaveProperty("top", 20);
    });
  });

  describe("Integration (create functions)", () => {
    // Smoke tests for rendering calls
    it("createLineChart calls render", async () => {
      await createLineChart(["A"], [{ borderColor: "red", data: [1], label: "L" }]);
      expect(renderToBufferMock).toHaveBeenCalled();
    });

    it("createHistogram calls render", async () => {
      await createHistogram([1], "L", "T", { binSize: 5, max: 10, min: 0 });
      expect(renderToBufferMock).toHaveBeenCalled();
    });

    it("createBarChart calls render", async () => {
      await createBarChart(["A"], [10], "T");
      expect(renderToBufferMock).toHaveBeenCalled();
    });
  });
});
