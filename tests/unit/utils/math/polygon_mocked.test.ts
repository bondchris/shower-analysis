import { afterEach, describe, expect, it, vi } from "vitest";

import { Point } from "../../../../src/models/point";

const vectorPath = "../../../../src/utils/math/vector";

describe("polygon angle clamping", () => {
  afterEach(() => {
    vi.doUnmock(vectorPath);
    vi.resetModules();
  });

  it("clamps cosTheta to the upper bound when dot product overshoots", async () => {
    vi.resetModules();
    vi.doMock(vectorPath, () => ({
      crossProduct: vi.fn(() => 0),
      dotProduct: vi.fn(() => 2),
      magnitudeSquared: vi.fn(() => 1),
      subtract: vi.fn(() => new Point(1, 0))
    }));

    const { checkPolygonIntegrity } = await import("../../../../src/utils/math/polygon");
    const poly = [new Point(0, 0), new Point(1, 0), new Point(1, 1)];

    expect(checkPolygonIntegrity(poly)).toBe(false);
  });

  it("clamps cosTheta to the lower bound when dot product undershoots", async () => {
    vi.resetModules();
    vi.doMock(vectorPath, () => ({
      crossProduct: vi.fn(() => 0),
      dotProduct: vi.fn(() => -2),
      magnitudeSquared: vi.fn(() => 1),
      subtract: vi.fn(() => new Point(1, 0))
    }));

    const { checkPolygonIntegrity } = await import("../../../../src/utils/math/polygon");
    const poly = [new Point(0, 0), new Point(1, 0), new Point(1, -1)];

    expect(checkPolygonIntegrity(poly)).toBe(false);
  });
});
