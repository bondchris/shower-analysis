// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
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
    const markup = renderToStaticMarkup(<ReportShell data={mockData} css=".test {}" />);

    expect(markup).toContain("My Report");
    expect(markup).toContain("Draft Version");

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
    const customCss = ".my-custom-css { color: red; }";
    const markup = renderToStaticMarkup(<ReportShell css={customCss} data={mockData} />);

    expect(markup).toContain("<style");
    expect(markup).toContain(customCss);
  });
});
