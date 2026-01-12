import { describe, expect, it } from "vitest";

import {
  filterValidOutlines,
  normalizeOutline,
  normalizeOutlines,
  sampleOutlines
} from "../../../../src/utils/chart/shapeOverlay";

type Outline = { x: number; y: number }[];
type FilterFn = (outlineList: Outline[]) => Outline[];
type NormalizeFn = (outline: Outline) => Outline | null;
type NormalizeManyFn = (outlineList: Outline[]) => Outline[];
type SampleFn = (outlineList: Outline[], max: number) => Outline[];

describe("shapeOverlay utilities", () => {
  const filterOutlines: FilterFn = filterValidOutlines as FilterFn;
  const normalizeSingle: NormalizeFn = normalizeOutline as NormalizeFn;
  const normalizeMany: NormalizeManyFn = normalizeOutlines as NormalizeManyFn;
  const sampleMany: SampleFn = sampleOutlines as SampleFn;
  const validOutline: Outline = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ];

  it("filters out outlines with too few or invalid points", () => {
    const outlines: Outline[] = [
      validOutline,
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ],
      [
        { x: Number.NaN, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    ];

    const result: Outline[] = filterOutlines(outlines);
    expect(result).toEqual([validOutline]);
  });

  it("normalizes outlines to a unit frame centered at origin", () => {
    const normalized: Outline | null = normalizeSingle(validOutline);
    expect(normalized).not.toBeNull();
    if (normalized !== null) {
      const xs: number[] = normalized.map((p) => p.x);
      const ys: number[] = normalized.map((p) => p.y);
      const maxX = Math.max(...xs);
      const minX = Math.min(...xs);
      const maxY = Math.max(...ys);
      const minY = Math.min(...ys);

      expect(maxX).toBeCloseTo(0.5);
      expect(minX).toBeCloseTo(-0.5);
      expect(maxY).toBeCloseTo(0.5);
      expect(minY).toBeCloseTo(-0.5);
    }
  });

  it("normalizes multiple outlines and drops invalid ones", () => {
    const outlines: Outline[] = [
      validOutline,
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ]
    ];

    const normalized: Outline[] = normalizeMany(outlines);
    expect(normalized.length).toBe(1);
  });

  it("samples outlines to a maximum count", () => {
    const outlines: Outline[] = Array.from({ length: 10 }, () => validOutline);
    const sampled: Outline[] = sampleMany(outlines, 3);
    expect(sampled.length).toBe(3);
  });
});
