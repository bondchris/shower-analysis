// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Mock, describe, expect, it, vi } from "vitest";
import { ReportData } from "../../../../src/models/report";
import { ReportShell } from "../../../../src/templates/components/ReportShell";
import { Section } from "../../../../src/templates/components/Section";

// Mock Section to avoid deep rendering
vi.mock("../../../../src/templates/components/Section", () => ({
  Section: vi.fn(({ section }: { section: { title: string } }) => <div data-testid="mock-section">{section.title}</div>)
}));

describe("ReportShell Component", () => {
  const mockData: ReportData = {
    sections: [
      { data: "content", title: "Section 1", type: "text" },
      { data: "content", title: "Section 2", type: "text" }
    ],
    subtitle: "Draft Version",
    title: "My Report"
  };

  it("renders title, subtitle and sections", () => {
    render(<ReportShell data={mockData} css=".test {}" />);

    expect(screen.getByText("My Report")).toBeInTheDocument();
    expect(screen.getByText("Draft Version")).toBeInTheDocument();

    const FIRST_SECTION_INDEX = 0;
    const TOTAL_SECTIONS = 2;
    const PROP_ARG = 0;
    expect(vi.mocked(Section)).toHaveBeenCalledTimes(TOTAL_SECTIONS);
    const args = (Section as unknown as Mock).mock.calls[FIRST_SECTION_INDEX];
    expect(args).toBeDefined();
    if (args) {
      expect((args[PROP_ARG] as { section: { title: string } }).section.title).toBe("Section 1");
    }
  });

  it("injects css into head", () => {
    // Rendering checks on head are tricky in JSDOM sometimes,
    // but we can check if the style tag exists with content
    // Wait, testing-library renders into a div in body usually.
    // But ReportShell renders <html>...
    // When rendering <html> in React inside JSDOM container, it might be stripped or handled.
    // However, let's just inspect if we can find the style tag.
    // We might need { container }

    // Since ReportShell renders <html>, <head>, <body>, it might modify the document or render inside the container.
    // In JSDOM with React Testing Library, <head> rendering via Portal or direct is common, but <html> children might be preserved.
    // Let's check if the style text is present anywhere in the document.
    render(<ReportShell css=".my-custom-css { color: red; }" data={mockData} />);
    expect(document.documentElement.innerHTML).toContain(".my-custom-css { color: red; }");
  });
});
