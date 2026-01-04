// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportSection } from "../../../../src/models/report";
import { Section } from "../../../../src/templates/components/Section";

// Mock child components to isolate Section testing
vi.mock("../../../../src/templates/components/Table", () => ({
  Table: ({ data }: { data: unknown }) => <div data-testid="mock-table">{JSON.stringify(data)}</div>
}));

vi.mock("../../../../src/templates/components/charts", () => ({
  BarChart: () => <div data-testid="mock-barchart" />,
  Histogram: () => <div data-testid="mock-histogram" />,
  LineChart: () => <div data-testid="mock-linechart" />,
  MixedChart: () => <div data-testid="mock-mixedchart" />,
  PieChart: () => <div data-testid="mock-piechart" />,
  ScatterChart: () => <div data-testid="mock-scatterchart" />
}));

describe("Section Component", () => {
  it("renders text content", () => {
    const section: ReportSection = {
      data: "This is intro text",
      title: "Introduction",
      type: "text"
    };
    render(<Section section={section} />);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("This is intro text")).toBeInTheDocument();
  });

  it("renders a list", () => {
    const section: ReportSection = {
      data: ["Item 1", "Item 2"],
      title: "My List",
      type: "list"
    };
    render(<Section section={section} />);
    expect(screen.getByText("My List")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });

  it("renders a table via mock", () => {
    const section: ReportSection = {
      data: [["1", "2"]],
      type: "table"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-table")).toBeInTheDocument();
  });

  it("renders a chart via mock (bar)", () => {
    const section: ReportSection = {
      data: { datasets: [], labels: [], type: "bar" },
      type: "chart"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-barchart")).toBeInTheDocument();
  });

  it("renders a chart via mock (line)", () => {
    const section: ReportSection = {
      data: { datasets: [], labels: [], type: "line" },
      type: "chart"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-linechart")).toBeInTheDocument();
  });

  it("renders a chart via mock (histogram)", () => {
    const section: ReportSection = {
      data: { datasets: [], labels: [], type: "histogram" },
      type: "chart"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-histogram")).toBeInTheDocument();
  });

  it("renders a chart via mock (mixed)", () => {
    const section: ReportSection = {
      data: { datasets: [], labels: [], type: "mixed" },
      type: "chart"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-mixedchart")).toBeInTheDocument();
  });

  it("renders a chart via mock (pie)", () => {
    const section: ReportSection = {
      data: {
        data: [10, 20],
        height: 160,
        labels: ["One", "Two"],
        options: {},
        type: "pie"
      },
      title: "Pie Chart",
      type: "chart"
    };
    render(<Section section={section} />);
    expect(screen.getByText("Pie Chart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-piechart")).toBeInTheDocument();
  });

  it("renders side notes next to a chart inside a chart-row", () => {
    const section: ReportSection = {
      data: [
        {
          data: {
            datasets: [],
            height: 100,
            labels: [],
            options: { sideNotes: ["Row Note A", "Row Note B"], width: 180 },
            type: "bar"
          },
          title: "Row Chart"
        }
      ],
      type: "chart-row"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-barchart")).toBeInTheDocument();
    expect(screen.getByText("Row Note A")).toBeInTheDocument();
    expect(screen.getByText("Row Note B")).toBeInTheDocument();
  });

  it("renders side notes next to a chart", () => {
    const section: ReportSection = {
      data: {
        datasets: [],
        height: 100,
        labels: [],
        options: { sideNotes: ["Note A", "Note B"], width: 200 },
        type: "bar"
      },
      title: "Chart With Notes",
      type: "chart"
    };
    render(<Section section={section} />);
    expect(screen.getByTestId("mock-barchart")).toBeInTheDocument();
    expect(screen.getByText("Note A")).toBeInTheDocument();
    expect(screen.getByText("Note B")).toBeInTheDocument();
  });
  it("renders summary type (same as text)", () => {
    const section: ReportSection = {
      data: "Summary content",
      type: "summary"
    };
    render(<Section section={section} />);
    expect(screen.getByText("Summary content")).toBeInTheDocument();
  });

  it("renders chart-row with multiple charts", () => {
    const section: ReportSection = {
      data: [
        {
          data: { datasets: [], labels: [], type: "bar" },
          title: "Chart 1"
        },
        {
          data: { datasets: [], labels: [], type: "line" },
          title: "Chart 2"
        },
        {
          data: { datasets: [], labels: [], type: "histogram" },
          title: "Chart 3"
        },
        {
          data: { datasets: [], labels: [], type: "mixed" },
          title: "Chart 4"
        },
        {
          data: { datasets: [], labels: [], type: "scatter" },
          title: "Chart 5"
        }
      ],
      type: "chart-row"
    };
    render(<Section section={section} />);
    expect(screen.getByText("Chart 1")).toBeInTheDocument();
    expect(screen.getByText("Chart 2")).toBeInTheDocument();
    expect(screen.getByText("Chart 3")).toBeInTheDocument();
    expect(screen.getByText("Chart 4")).toBeInTheDocument();
    expect(screen.getByText("Chart 5")).toBeInTheDocument();
    expect(screen.getByTestId("mock-barchart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-linechart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-histogram")).toBeInTheDocument();
    expect(screen.getByTestId("mock-mixedchart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-scatterchart")).toBeInTheDocument();
  });

  it("falls back to chart widths when scaling chart rows", () => {
    const floorSpy = vi.spyOn(Math, "floor");
    floorSpy.mockReturnValueOnce(undefined as unknown as number);

    const section: ReportSection = {
      data: [
        {
          data: { datasets: [], labels: [], options: { width: 240 }, type: "bar" },
          title: "Wide Bar"
        },
        {
          data: { data: [5, 15], height: 180, labels: ["A", "B"], options: {}, type: "pie" },
          title: "Pie Without Width"
        },
        {
          data: { datasets: [], height: 140, options: { width: 120 }, type: "scatter" },
          title: "Scatter"
        }
      ],
      type: "chart-row"
    };
    render(<Section section={section} />);
    const barContainer = screen.getByText("Wide Bar").closest("div");
    expect(barContainer?.style.flex).toBe("0 0 240px");
    expect(screen.getByTestId("mock-piechart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-scatterchart")).toBeInTheDocument();
    floorSpy.mockRestore();
  });

  it("renders side notes for each chart type inside a chart-row", () => {
    const section: ReportSection = {
      data: [
        {
          data: {
            datasets: [],
            height: 120,
            labels: [],
            options: { sideNotes: ["Line side notes"], width: 100 },
            type: "line"
          },
          title: "Line"
        },
        {
          data: {
            datasets: [],
            height: 120,
            labels: [],
            options: { sideNotes: ["Histogram side notes"], width: 110 },
            type: "histogram"
          },
          title: "Histogram"
        },
        {
          data: {
            datasets: [],
            height: 120,
            labels: [],
            options: { sideNotes: ["Mixed side notes"], width: 120 },
            type: "mixed"
          },
          title: "Mixed"
        },
        {
          data: {
            data: [1, 2],
            height: 150,
            labels: ["One", "Two"],
            options: { sideNotes: ["Pie side notes"], width: 130 },
            type: "pie"
          },
          title: "Pie"
        },
        {
          data: {
            datasets: [],
            height: 140,
            options: { sideNotes: ["Scatter side notes"], width: 140 },
            type: "scatter"
          },
          title: "Scatter"
        }
      ],
      type: "chart-row"
    };
    render(<Section section={section} />);
    expect(screen.getByText("Line side notes")).toBeInTheDocument();
    expect(screen.getByText("Histogram side notes")).toBeInTheDocument();
    expect(screen.getByText("Mixed side notes")).toBeInTheDocument();
    expect(screen.getByText("Pie side notes")).toBeInTheDocument();
    expect(screen.getByText("Scatter side notes")).toBeInTheDocument();
    expect(screen.getAllByTestId("mock-linechart").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("mock-histogram").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("mock-mixedchart").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("mock-piechart").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("mock-scatterchart").length).toBeGreaterThan(0);
  });

  it("renders page-break as a styled div", () => {
    const section: ReportSection = {
      data: null,
      type: "page-break"
    };
    const { container } = render(<Section section={section} />);
    // Verify the style is applied (breakBefore: "page" -> css break-before: page)
    // Note: JSDOM might not reflect computed styles perfectly, but we can check the element.
    const pageBreak = container.querySelector('div[style*="break-before: page"]');
    expect(pageBreak).toBeInTheDocument();
  });

  it("renders header type (returns null - typically handled by Report wrapper but checking safe return)", () => {
    const section: ReportSection = {
      data: "Header Content",
      type: "header"
    };
    const { container } = render(<Section section={section} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it("handles default fallback for unknown type with string data", () => {
    const section: ReportSection = {
      data: "Fallback content",
      type: "unknown-type" as unknown as ReportSection["type"]
    };
    render(<Section section={section} />);
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it("handles default fallback for unknown type with undefined data (returns null)", () => {
    const section: ReportSection = {
      data: undefined,
      type: "unknown-type" as unknown as ReportSection["type"]
    };
    const { container } = render(<Section section={section} />);
    expect(container.textContent).toBe("");
  });

  it("renders text type with missing data (fallback)", () => {
    const section: ReportSection = {
      data: undefined,
      type: "text"
    };
    const { container } = render(<Section section={section} />);
    expect(container.querySelector("p")).toBeEmptyDOMElement();
  });

  it("renders summary type with missing data (fallback)", () => {
    const section: ReportSection = {
      data: undefined,
      type: "summary"
    };
    const { container } = render(<Section section={section} />);
    expect(container.querySelector("p")).toBeEmptyDOMElement();
  });

  describe("Defensive Checks", () => {
    it("returns null for list type with invalid data (not an array)", () => {
      const section: ReportSection = {
        data: "Not an array",
        type: "list"
      };
      const { container } = render(<Section section={section} />);
      expect(container.textContent).toBe("");
    });

    it("returns null for chart-row type with invalid data (not an array)", () => {
      const section: ReportSection = {
        data: { not: "an array" },
        type: "chart-row"
      };
      const { container } = render(<Section section={section} />);
      expect(container.textContent).toBe("");
    });

    it("handles default fallback for unknown type with null data", () => {
      const section: ReportSection = {
        data: null,
        type: "unknown-type" as unknown as ReportSection["type"]
      };
      const { container } = render(<Section section={section} />);
      expect(container.querySelector("p")).toBeEmptyDOMElement();
    });

    it("returns null when react-component section has no component", () => {
      const section: ReportSection = {
        data: undefined,
        type: "react-component"
      };
      const { container } = render(<Section section={section} />);
      const wrapper = container.firstElementChild;
      expect(wrapper).not.toBeNull();
      expect(wrapper?.childElementCount).toBe(0);
      expect(wrapper?.textContent).toBe("");
    });
  });
});
