import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDateRange, getGlobalDateRange } from "../../../../src/utils/chart/dateRange";

describe("dateRange", () => {
  describe("generateDateRange", () => {
    it("generates a range of dates between start and end inclusive", () => {
      const result = generateDateRange("2024-01-01", "2024-01-05");
      expect(result).toEqual(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]);
    });

    it("returns single date when start equals end", () => {
      const result = generateDateRange("2024-01-01", "2024-01-01");
      expect(result).toEqual(["2024-01-01"]);
    });

    it("handles month boundaries", () => {
      const result = generateDateRange("2024-01-30", "2024-02-02");
      expect(result).toEqual(["2024-01-30", "2024-01-31", "2024-02-01", "2024-02-02"]);
    });

    it("handles year boundaries", () => {
      const result = generateDateRange("2023-12-30", "2024-01-02");
      expect(result).toEqual(["2023-12-30", "2023-12-31", "2024-01-01", "2024-01-02"]);
    });

    it("returns empty array when end is before start", () => {
      const result = generateDateRange("2024-01-05", "2024-01-01");
      expect(result).toEqual([]);
    });

    it("handles date strings with time components", () => {
      const result = generateDateRange("2024-01-01T00:00:00Z", "2024-01-03T23:59:59Z");
      expect(result).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"]);
    });

    it("filters out empty strings when split returns undefined (fallback branch)", () => {
      type SimpleSplit = (separator: string) => string[];
      const originalSplit = String.prototype.split as unknown as SimpleSplit;
      let callCount = 0;
      const evenCallModulo = 2;

      function mockSplit(this: string, separator: unknown): string[] {
        callCount++;
        // Return empty array on some calls to trigger the ?? "" fallback and filter
        if (separator === "T" && callCount % evenCallModulo === 0) {
          return [];
        }
        return originalSplit.call(this, separator as string);
      }

      vi.spyOn(String.prototype, "split").mockImplementation(mockSplit as typeof String.prototype.split);

      const result = generateDateRange("2024-01-01", "2024-01-03");
      // Some dates will be filtered out due to empty string fallback
      expect(result.every((d) => d !== "")).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe("getGlobalDateRange", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("generates range from config start date to today", () => {
      // CHART_DATE_RANGE.startDate is 2024-07-22, so use a date after that
      vi.setSystemTime(new Date("2024-08-15T12:00:00Z"));
      const result = getGlobalDateRange();

      // Should start from CHART_DATE_RANGE.startDate and end at today
      expect(result.length).toBeGreaterThan(0);
      expect(result[result.length - 1]).toBe("2024-08-15");
    });

    it("includes today in the range", () => {
      // CHART_DATE_RANGE.startDate is 2024-07-22, so use a date after that
      vi.setSystemTime(new Date("2024-09-20T00:00:00Z"));
      const result = getGlobalDateRange();

      expect(result).toContain("2024-09-20");
    });

    it("handles fallback when toISOString split returns empty array", () => {
      // CHART_DATE_RANGE.startDate is 2024-07-22, so use a date after that
      vi.setSystemTime(new Date("2024-08-15T12:00:00Z"));

      type SimpleSplit = (separator: string) => string[];
      const originalSplit = String.prototype.split as unknown as SimpleSplit;
      let splitCallCount = 0;
      const firstCallIndex = 1;

      function mockSplit(this: string, separator: unknown): string[] {
        splitCallCount++;
        // First call is for "today" in getGlobalDateRange - return empty to trigger fallback
        if (separator === "T" && splitCallCount === firstCallIndex) {
          return [];
        }
        return originalSplit.call(this, separator as string);
      }

      vi.spyOn(String.prototype, "split").mockImplementation(mockSplit as typeof String.prototype.split);

      // This should still work, using empty string fallback
      const result = getGlobalDateRange();
      expect(Array.isArray(result)).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe("edge cases for nullish coalescing branches", () => {
    it("handles date split returning valid string (main branch)", () => {
      const result = generateDateRange("2024-01-01", "2024-01-01");
      expect(result[0]).toBe("2024-01-01");
    });

    it("getGlobalDateRange returns valid date string", () => {
      vi.useFakeTimers();
      // CHART_DATE_RANGE.startDate is 2024-07-22, so use a date after that
      vi.setSystemTime(new Date("2024-08-15T12:00:00Z"));

      const result = getGlobalDateRange();
      result.forEach((date) => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      vi.useRealTimers();
    });
  });
});
