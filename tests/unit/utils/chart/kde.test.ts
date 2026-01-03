import { scaleLinear } from "@visx/scale";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    const bounds = calculateDynamicKdeBounds([1, 2, 3], 0, 10, 20);
    expect(bounds.min).toBeLessThan(bounds.max);
  });

  it("uses the last tick when the scale has no positive ticks", () => {
    const scaleWithoutPositiveTicks = (() => ({ ticks: () => [-1, 0] })) as unknown as typeof scaleLinear;
    const bounds = calculateDynamicKdeBounds([1, 2, 3], 0, 6, 3, { scaleLinearFn: scaleWithoutPositiveTicks });

    expect(bounds.min).toBeGreaterThan(0);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });

  it("falls back to the KDE maximum when ticks are empty", () => {
    const scaleWithoutTicks = (() => ({ ticks: () => [] })) as unknown as typeof scaleLinear;
    const bounds = calculateDynamicKdeBounds([1, 2, 3], 0, 6, 3, { scaleLinearFn: scaleWithoutTicks });

    expect(bounds.min).toBeGreaterThan(0);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });

  it("skips undefined KDE points when scanning for bounds", () => {
    const kdeWithGaps = () => ({
      labels: ["0", "1", "2"],
      values: [undefined as unknown as number, 0.5, undefined as unknown as number]
    });
    const stubScale = (() => ({ ticks: () => [1, 2, 3] })) as unknown as typeof scaleLinear;
    const bounds = calculateDynamicKdeBounds([1, 2, 3], 0, 10, 3, {
      calculateKdeFn: kdeWithGaps,
      scaleLinearFn: stubScale
    });

    expect(bounds.min).toBeGreaterThan(0);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });

  it("uses the provided initial minimum when the actual minimum is non-positive", () => {
    const data = [0, 5];
    const originalFilter = data.filter.bind(data);
    vi.spyOn(data, "filter").mockImplementation((predicate) => {
      const filtered = originalFilter(predicate as (value: number, index: number, array: number[]) => boolean);
      return [0, ...filtered];
    });

    const flatKde = () => ({
      labels: Array.from({ length: 11 }, (_, index) => index.toString()),
      values: Array(11).fill(0.1)
    });
    const singleTickScale = (() => ({ ticks: () => [1] })) as unknown as typeof scaleLinear;

    const bounds = calculateDynamicKdeBounds(data, -2, 8, 11, {
      calculateKdeFn: flatKde,
      scaleLinearFn: singleTickScale
    });

    expect(bounds.min).toBeLessThan(0);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });

  it("uses the initial minimum during padding when the actual minimum is zero", () => {
    const data = [0, 4];
    const originalFilter = data.filter.bind(data);
    vi.spyOn(data, "filter").mockImplementation((predicate) => {
      const filtered = originalFilter(predicate as (value: number, index: number, array: number[]) => boolean);
      return [0, ...filtered];
    });

    const bounds = calculateDynamicKdeBounds(data, -3, 6, 5);

    expect(bounds.min).toBeLessThan(1);
    expect(bounds.max).toBeGreaterThan(bounds.min);
  });
});
