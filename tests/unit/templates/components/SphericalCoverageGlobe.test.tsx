// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SphericalCoverageGlobe } from "../../../../src/templates/components/SphericalCoverageGlobe";

describe("SphericalCoverageGlobe", () => {
  it("renders an empty state when there is no data", () => {
    render(<SphericalCoverageGlobe coveragePercent={0} grid={[]} maxSeconds={0} nonZeroBins={0} totalSeconds={0} />);

    expect(screen.getByText("No coverage data available.")).toBeInTheDocument();
  });

  it("renders multiple globe views with coverage dots and shows stats", () => {
    const grid = [
      [1, 2, 3, 4],
      [5, 6, 7, 8]
    ];

    render(
      <SphericalCoverageGlobe coveragePercent={42.5} grid={grid} maxSeconds={3} nonZeroBins={3} totalSeconds={10} />
    );

    expect(screen.getByText("Spherical Coverage (multi-view)")).toBeInTheDocument();
    expect(screen.getByText("Avg Coverage: 42.5% of sphere")).toBeInTheDocument();
    expect(screen.getByText("Front")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Top-down")).toBeInTheDocument();
    expect(screen.getByText("Bottom-up")).toBeInTheDocument();

    const frontDots = screen.getByTestId("front-globe").querySelectorAll("[data-coverage-dot]");
    const backDots = screen.getByTestId("back-globe").querySelectorAll("[data-coverage-dot]");
    const topDots = screen.getByTestId("top-globe").querySelectorAll("[data-coverage-dot]");
    const bottomDots = screen.getByTestId("bottom-globe").querySelectorAll("[data-coverage-dot]");

    expect(frontDots.length).toBeGreaterThan(0);
    expect(backDots.length).toBeGreaterThan(0);
    expect(topDots.length).toBeGreaterThan(0);
    expect(bottomDots.length).toBeGreaterThan(0);
  });
});
