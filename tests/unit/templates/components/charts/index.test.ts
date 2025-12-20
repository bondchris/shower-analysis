import { describe, expect, it } from "vitest";

import { BarChart, Histogram, LineChart, MixedChart } from "../../../../../src/templates/components/charts";

describe("Charts Index", () => {
  it("exports BarChart", () => {
    expect(BarChart).toBeDefined();
  });

  it("exports Histogram", () => {
    expect(Histogram).toBeDefined();
  });

  it("exports LineChart", () => {
    expect(LineChart).toBeDefined();
  });

  it("exports MixedChart", () => {
    expect(MixedChart).toBeDefined();
  });
});
