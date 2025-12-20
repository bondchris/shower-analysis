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
  MixedChart: () => <div data-testid="mock-mixedchart" />
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
        }
      ],
      type: "chart-row"
    };
    render(<Section section={section} />);
    expect(screen.getByText("Chart 1")).toBeInTheDocument();
    expect(screen.getByText("Chart 2")).toBeInTheDocument();
    expect(screen.getByText("Chart 3")).toBeInTheDocument();
    expect(screen.getByText("Chart 4")).toBeInTheDocument();
    expect(screen.getByTestId("mock-barchart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-linechart")).toBeInTheDocument();
    expect(screen.getByTestId("mock-histogram")).toBeInTheDocument();
    expect(screen.getByTestId("mock-mixedchart")).toBeInTheDocument();
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
  });
});
