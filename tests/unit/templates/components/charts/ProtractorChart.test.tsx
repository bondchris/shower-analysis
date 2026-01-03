/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtractorChartConfig } from "../../../../../src/models/chart/protractorChartConfig";
import { ProtractorChart } from "../../../../../src/templates/components/charts/ProtractorChart";

vi.mock("@visx/group", () => ({
  Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g>
}));

describe("ProtractorChart", () => {
  const HEIGHT = 300;
  const DEFAULT_WIDTH = 650;
  const CUSTOM_WIDTH = 800;
  const HISTOGRAM_SIZE = 1801;

  const createHistogram = (entries: { angle: number; count: number }[]): number[] => {
    const noCount = 0;
    const minAngle = 0;
    const maxAngle = 180;
    const binsPerDegree = 10;
    const histogram = new Array<number>(HISTOGRAM_SIZE).fill(noCount);
    for (const { angle, count } of entries) {
      if (angle >= minAngle && angle <= maxAngle) {
        const binIndex = Math.round(angle * binsPerDegree);
        histogram[binIndex] = count;
      }
    }
    return histogram;
  };

  const baseConfig: ProtractorChartConfig = {
    height: HEIGHT,
    histogram: createHistogram([
      { angle: 45, count: 10 },
      { angle: 85, count: 50 },
      { angle: 90, count: 100 },
      { angle: 95, count: 50 },
      { angle: 135, count: 10 }
    ]),
    leftOverflowCount: 0,
    options: {},
    rightOverflowCount: 0,
    type: "protractor"
  };

  it("should render without crashing with minimal config", () => {
    const { container } = render(<ProtractorChart config={baseConfig} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("height", String(HEIGHT));
    expect(container.querySelector("svg")).toHaveAttribute("width", String(DEFAULT_WIDTH));
  });

  it("should use custom width when provided", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      options: { width: CUSTOM_WIDTH }
    };
    const { container } = render(<ProtractorChart config={config} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", String(CUSTOM_WIDTH));
  });

  it("should render lines for angles with non-zero counts", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      histogram: createHistogram([
        { angle: 30, count: 5 },
        { angle: 60, count: 10 },
        { angle: 90, count: 20 },
        { angle: 120, count: 10 },
        { angle: 150, count: 5 }
      ])
    };
    const { container } = render(<ProtractorChart config={config} />);
    const lines = container.querySelectorAll("line");
    const angleLineCount = 5;
    const baseLineCount = 1;
    const tickLineCount = 5;
    const averageLineCount = 1;
    const expectedTotalLines = angleLineCount + baseLineCount + tickLineCount + averageLineCount;
    expect(lines.length).toBe(expectedTotalLines);
  });

  it("should not render lines for angles with zero counts", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      histogram: createHistogram([{ angle: 90, count: 100 }])
    };
    const { container } = render(<ProtractorChart config={config} />);
    const lines = container.querySelectorAll("line");
    const angleLineCount = 1;
    const baseLineCount = 1;
    const tickLineCount = 5;
    const averageLineCount = 1;
    const expectedTotalLines = angleLineCount + baseLineCount + tickLineCount + averageLineCount;
    expect(lines.length).toBe(expectedTotalLines);
  });

  it("should handle empty histogram", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      histogram: new Array<number>(HISTOGRAM_SIZE).fill(0)
    };
    const { container } = render(<ProtractorChart config={config} />);
    expect(container.querySelector("svg")).not.toBeNull();
    const lines = container.querySelectorAll("line");
    const baseLineCount = 1;
    const tickLineCount = 5;
    expect(lines.length).toBe(baseLineCount + tickLineCount);
  });

  it("should render with custom line color", () => {
    const customColor = "#ff0000";
    const config: ProtractorChartConfig = {
      ...baseConfig,
      histogram: createHistogram([{ angle: 90, count: 50 }]),
      options: { lineColor: customColor }
    };
    const { container } = render(<ProtractorChart config={config} />);
    const lines = container.querySelectorAll("line");
    const angleLine = lines[0];
    expect(angleLine).toHaveAttribute("stroke", customColor);
  });

  it("should render tick marks at 30, 60, 90, 120, 150 degrees", () => {
    render(<ProtractorChart config={baseConfig} />);
    expect(screen.getByText("30°")).toBeInTheDocument();
    expect(screen.getByText("60°")).toBeInTheDocument();
    expect(screen.getByText("90°")).toBeInTheDocument();
    expect(screen.getByText("120°")).toBeInTheDocument();
    expect(screen.getByText("150°")).toBeInTheDocument();
  });

  it("should render the arc outline", () => {
    const { container } = render(<ProtractorChart config={baseConfig} />);
    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute("fill", "none");
  });

  it("should render center indicator circle", () => {
    const { container } = render(<ProtractorChart config={baseConfig} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(1);
    expect(circles[0]).toHaveAttribute("r", "4");
  });

  it("should render base horizontal line", () => {
    const { container } = render(<ProtractorChart config={baseConfig} />);
    const lines = container.querySelectorAll("line");
    const baseLine = Array.from(lines).find(
      (line) => line.getAttribute("stroke") === "#374151" && line.getAttribute("stroke-width") === "2"
    );
    expect(baseLine).not.toBeNull();
  });

  it("should vary line opacity based on count", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      histogram: createHistogram([
        { angle: 45, count: 10 },
        { angle: 90, count: 100 }
      ])
    };
    const { container } = render(<ProtractorChart config={config} />);
    const lines = Array.from(container.querySelectorAll("line")).filter(
      (line) => line.getAttribute("stroke") === "#8b5cf6"
    );
    expect(lines.length).toBe(2);
    const opacities = lines.map((line) => parseFloat(line.getAttribute("stroke-opacity") ?? "0"));
    const firstOpacity = opacities[0] ?? 0;
    const secondOpacity = opacities[1] ?? 0;
    expect(secondOpacity).toBeGreaterThan(firstOpacity);
  });

  it("should display left overflow as percentage when present", () => {
    // baseConfig histogram total = 220, left overflow = 42, total = 262
    // 42/262 = 16.0%
    const config: ProtractorChartConfig = {
      ...baseConfig,
      leftOverflowCount: 42
    };
    render(<ProtractorChart config={config} />);
    expect(screen.getByText("+16.0%")).toBeInTheDocument();
    expect(screen.getByText("⤵")).toBeInTheDocument();
  });

  it("should display right overflow as percentage when present", () => {
    // baseConfig histogram total = 220, right overflow = 17, total = 237
    // 17/237 = 7.2%
    const config: ProtractorChartConfig = {
      ...baseConfig,
      rightOverflowCount: 17
    };
    render(<ProtractorChart config={config} />);
    expect(screen.getByText("+7.2%")).toBeInTheDocument();
    expect(screen.getByText("⤵")).toBeInTheDocument();
  });

  it("should not display overflow counts when zero", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      leftOverflowCount: 0,
      rightOverflowCount: 0
    };
    const { container } = render(<ProtractorChart config={config} />);
    const textElements = container.querySelectorAll("text");
    const overflowTexts = Array.from(textElements).filter((el) => el.textContent.startsWith("+"));
    expect(overflowTexts.length).toBe(0);
  });

  it("should display both overflow counts as percentages when both present", () => {
    // baseConfig histogram total = 220, left = 100, right = 50, total = 370
    // left: 100/370 = 27.0%, right: 50/370 = 13.5%
    const config: ProtractorChartConfig = {
      ...baseConfig,
      leftOverflowCount: 100,
      rightOverflowCount: 50
    };
    render(<ProtractorChart config={config} />);
    expect(screen.getByText("+27.0%")).toBeInTheDocument();
    expect(screen.getByText("+13.5%")).toBeInTheDocument();
  });

  it("renders both overflow markers with arrows when counts exist", () => {
    const config: ProtractorChartConfig = {
      ...baseConfig,
      leftOverflowCount: 5,
      rightOverflowCount: 7
    };

    const { container } = render(<ProtractorChart config={config} />);

    expect(screen.getByText("+2.2%")).toBeInTheDocument();
    expect(screen.getByText("+3.0%")).toBeInTheDocument();
    const overflowArrows = Array.from(container.querySelectorAll("text")).filter((el) => el.textContent === "⤵");
    expect(overflowArrows).toHaveLength(2);
  });

  it("should calculate overflow percentages when histogram is empty", () => {
    const zeroHistogram = new Array<number>(HISTOGRAM_SIZE).fill(0);
    const config: ProtractorChartConfig = {
      ...baseConfig,
      histogram: zeroHistogram,
      leftOverflowCount: 2,
      rightOverflowCount: 3
    };

    render(<ProtractorChart config={config} />);
    expect(screen.getByText("+40.0%")).toBeInTheDocument();
    expect(screen.getByText("+60.0%")).toBeInTheDocument();
  });

  describe("Full Circle Mode", () => {
    const FULL_CIRCLE_HISTOGRAM_SIZE = 3601;

    const createFullCircleHistogram = (entries: { angle: number; count: number }[]): number[] => {
      const noCount = 0;
      const minAngle = 0;
      const maxAngle = 360;
      const binsPerDegree = 10;
      const histogram = new Array<number>(FULL_CIRCLE_HISTOGRAM_SIZE).fill(noCount);
      for (const { angle, count } of entries) {
        if (angle >= minAngle && angle <= maxAngle) {
          const binIndex = Math.round(angle * binsPerDegree);
          histogram[binIndex] = count;
        }
      }
      return histogram;
    };

    const fullCircleConfig: ProtractorChartConfig = {
      height: HEIGHT,
      histogram: createFullCircleHistogram([
        { angle: 0, count: 50 },
        { angle: 90, count: 100 },
        { angle: 180, count: 50 },
        { angle: 270, count: 100 }
      ]),
      leftOverflowCount: 0,
      options: { fullCircle: true },
      rightOverflowCount: 0,
      type: "protractor"
    };

    it("should render without crashing in full circle mode", () => {
      const { container } = render(<ProtractorChart config={fullCircleConfig} />);
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("should render a full circle instead of semicircle arc", () => {
      const { container } = render(<ProtractorChart config={fullCircleConfig} />);
      const circles = container.querySelectorAll("circle");
      const circleOutline = Array.from(circles).find((circle) => circle.getAttribute("stroke") === "#d1d5db");
      expect(circleOutline).not.toBeNull();
    });

    it("should render tick marks for full 360 degrees", () => {
      render(<ProtractorChart config={fullCircleConfig} />);
      expect(screen.getByText("Starting")).toBeInTheDocument();
      expect(screen.getByText("Position")).toBeInTheDocument();
      expect(screen.getByText("30°")).toBeInTheDocument();
      expect(screen.getByText("90°")).toBeInTheDocument();
      expect(screen.getByText("180°")).toBeInTheDocument();
      expect(screen.getByText("270°")).toBeInTheDocument();
      expect(screen.getByText("330°")).toBeInTheDocument();
    });

    it("should not render base horizontal line in full circle mode", () => {
      const { container } = render(<ProtractorChart config={fullCircleConfig} />);
      const lines = container.querySelectorAll("line");
      const baseLine = Array.from(lines).find((line) => {
        const stroke = line.getAttribute("stroke");
        const strokeWidth = line.getAttribute("stroke-width");
        const y1 = line.getAttribute("y1");
        const y2 = line.getAttribute("y2");
        return stroke === "#374151" && strokeWidth === "2" && y1 === y2;
      });
      expect(baseLine).toBeUndefined();
    });

    it("should not display overflow counts in full circle mode", () => {
      const config: ProtractorChartConfig = {
        ...fullCircleConfig,
        leftOverflowCount: 50,
        rightOverflowCount: 50
      };
      const { container } = render(<ProtractorChart config={config} />);
      const textElements = container.querySelectorAll("text");
      const overflowTexts = Array.from(textElements).filter((el) => el.textContent.startsWith("+"));
      expect(overflowTexts.length).toBe(0);
    });

    it("should render lines for angles around the full circle", () => {
      const { container } = render(<ProtractorChart config={fullCircleConfig} />);
      const lines = Array.from(container.querySelectorAll("line")).filter((line) => {
        const strokeOpacity = line.getAttribute("stroke-opacity");
        return strokeOpacity !== null;
      });
      const expectedAngleLines = 4;
      expect(lines.length).toBe(expectedAngleLines);
    });

    it("should render two circles in full circle mode (center + outline)", () => {
      const { container } = render(<ProtractorChart config={fullCircleConfig} />);
      const circles = container.querySelectorAll("circle");
      const centerCircle = Array.from(circles).find((c) => c.getAttribute("r") === "4");
      const outlineCircle = Array.from(circles).find((c) => c.getAttribute("stroke") === "#d1d5db");
      expect(centerCircle).not.toBeNull();
      expect(outlineCircle).not.toBeNull();
    });

    it("adjusts average angle when circular mean is negative", () => {
      const config: ProtractorChartConfig = {
        ...fullCircleConfig,
        histogram: createFullCircleHistogram([{ angle: 270, count: 50 }])
      };

      render(<ProtractorChart config={config} />);

      expect(screen.getByText("avg: 270.0°")).toBeInTheDocument();
    });

    it("computes circular mean across wraparound angles", () => {
      const config: ProtractorChartConfig = {
        ...fullCircleConfig,
        histogram: createFullCircleHistogram([
          { angle: 350, count: 5 },
          { angle: 10, count: 5 }
        ])
      };

      render(<ProtractorChart config={config} />);

      expect(screen.getByText(/avg: (0\.0|360\.0)°/)).toBeInTheDocument();
    });

    it("applies angle offsets to rotate the 0° indicator", () => {
      const config: ProtractorChartConfig = {
        ...fullCircleConfig,
        options: { ...fullCircleConfig.options, angleOffsetDegrees: 90 }
      };

      const { container } = render(<ProtractorChart config={config} />);
      const zeroLine = container.querySelector('line[stroke="#ef4444"][stroke-dasharray="2 2"]');

      expect(zeroLine).not.toBeNull();
      if (zeroLine === null) {
        return;
      }

      const x1 = Number(zeroLine.getAttribute("x1"));
      const x2 = Number(zeroLine.getAttribute("x2"));
      const y1 = Number(zeroLine.getAttribute("y1"));
      const y2 = Number(zeroLine.getAttribute("y2"));

      expect(x1).toBeCloseTo(x2);
      expect(y2).toBeLessThan(y1);

      const startingTspan = screen.getByText("Starting");
      const startingLabel = startingTspan.closest("text");
      expect(startingLabel?.getAttribute("text-anchor")).toBe("middle");
    });
  });
});
