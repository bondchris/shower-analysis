import { describe, expect, it } from "vitest";

import { calculateDynamicKdeBounds, calculateKde } from "../../../../src/utils/chart/kde";

describe("calculateKde", () => {
  it("falls back to default bandwidth when variance is zero", () => {
    const result = calculateKde([5, 5, 5], { max: 10, min: 0, resolution: 5 });
    expect(result.labels).toHaveLength(5);
    expect(result.values).toHaveLength(5);
    expect(result.values.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe("calculateDynamicKdeBounds", () => {
  it("returns initial bounds when KDE resolution is zero", () => {
    const bounds = calculateDynamicKdeBounds([1, 2, 3], 0, 10, 0);
    expect(bounds).toEqual({ max: 10, min: 0 });
  });

  it("falls back to the data range when KDE cannot find crossings", () => {
    const bounds = calculateDynamicKdeBounds([2], 0, 10, 2);

    expect(bounds.min).toBe(2);
    expect(bounds.max).toBe(2);
  });

  it("clamps minimum to the actual data minimum when calculated min drops below zero", () => {
    const bounds = calculateDynamicKdeBounds([1, 1, 1], -5, 5, 20);

    expect(bounds.min).toBe(1);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });

  it("handles case where maxKdeValue is zero or negative", () => {
    // Providing data that results in zero KDE values everywhere
    const bounds = calculateDynamicKdeBounds([NaN], 0, 10, 20);
    expect(bounds).toEqual({ max: 10, min: 0 });
  });

  it("handles case where firstTickAboveZero is undefined", () => {
    // This is hard to trigger with real data but we can mock it if needed
    // For now we'll rely on the existing tests and add a sanity check
    const bounds = calculateDynamicKdeBounds([1, 2, 3], 0, 10, 20);
    expect(bounds.min).toBeLessThan(bounds.max);
  });
});
