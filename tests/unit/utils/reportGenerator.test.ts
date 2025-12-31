import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { browser, chromiumMock, page } = vi.hoisted(() => {
  const page = {
    pdf: vi.fn(),
    setContent: vi.fn(),
    setViewportSize: vi.fn(),
    waitForFunction: vi.fn()
  };
  const browser = {
    close: vi.fn(),
    newPage: vi.fn(() => page)
  };
  const chromiumMock = { launch: vi.fn().mockResolvedValue(browser) };
  return { browser, chromiumMock, page };
});

vi.mock("playwright", () => ({
  chromium: chromiumMock
}));

vi.mock("react-dom/server", () => ({
  default: { renderToStaticMarkup: vi.fn(() => "<html><body>ok</body></html>") },
  renderToStaticMarkup: vi.fn(() => "<html><body>ok</body></html>")
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn()
  };
});

vi.mock("../../../src/utils/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import * as fs from "fs";
import { chromium } from "playwright";

import { logger } from "../../../src/utils/logger";
import { ReportData } from "../../../src/models/report";
import { generatePdfReport } from "../../../src/utils/reportGenerator";

describe("generatePdfReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue("/*css*/");
    (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    page.waitForFunction.mockResolvedValue(undefined);
    page.pdf.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates PDF with expected playwright calls", async () => {
    await generatePdfReport({} as unknown as ReportData, "x.pdf");

    expect(chromium.launch).toHaveBeenCalled();
    expect(browser.newPage).toHaveBeenCalled();
    expect(page.setViewportSize).toHaveBeenCalledWith({ height: 1123, width: 794 });
    expect(page.setContent).toHaveBeenCalled();
    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "A4",
        margin: { bottom: "40px", left: "40px", right: "40px", top: "40px" },
        printBackground: true
      })
    );
    expect(browser.close).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it("warns if css missing but continues", async () => {
    (fs.readFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("nope");
    });

    await generatePdfReport({} as unknown as ReportData, "x.pdf");

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Could not load print.css"));
    expect(page.pdf).toHaveBeenCalled();
  });

  it("warns if charts not ready but proceeds", async () => {
    page.waitForFunction.mockRejectedValueOnce(new Error("timeout"));

    await generatePdfReport({} as unknown as ReportData, "x.pdf");

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Charts did not report ready"));
    expect(page.pdf).toHaveBeenCalled();
  });

  it("logs and rethrows on failure", async () => {
    page.pdf.mockRejectedValueOnce(new Error("pdf fail"));

    await expect(generatePdfReport({} as unknown as ReportData, "x.pdf")).rejects.toThrow("pdf fail");
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to generate PDF report"));
    expect(browser.close).toHaveBeenCalled(); // Ensure cleanup happens
  });

  it("creates directory if missing", async () => {
    (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    await generatePdfReport({} as unknown as ReportData, "x.pdf");
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("reports"), { recursive: true });
  });

  it("exercises ensureSsrDom logic and measurement element", async () => {
    // Calling generatePdfReport will trigger ensureSsrDom
    await generatePdfReport({} as unknown as ReportData, "x.pdf");

    // After ensureSsrDom, global document should be defined
    const doc = globalThis.document;
    expect(doc).toBeDefined();

    // Test createElementNS for text
    interface SsrSvgTextElement extends Element {
      getComputedTextLength: () => number;
    }
    const textEl = doc.createElementNS("http://www.w3.org/2000/svg", "text") as unknown as SsrSvgTextElement;
    expect(textEl).toBeDefined();
    expect(textEl.getComputedTextLength).toBeDefined();

    textEl.textContent = "Hello";
    // averageCharWidthPx = 6. "Hello" length = 5. 5 * 6 = 30.
    expect(textEl.getComputedTextLength()).toBe(30);

    // Test createElementNS for other tags (svg/g)
    const svgEl = doc.createElementNS("http://www.w3.org/2000/svg", "svg") as unknown as SVGSVGElement;
    expect(svgEl).toBeDefined();
    expect(svgEl.appendChild).toBeDefined();

    // Test appendChild behavior
    const anotherTextEl = {
      getComputedTextLength: () => 12,
      textContent: "Hi"
    } as unknown as SsrSvgTextElement;
    svgEl.appendChild(anotherTextEl);

    // After appendChild, getElementById for measurement ID should return the appended element
    const measurementId = "__react_svg_text_measurement_id";
    expect(doc.getElementById(measurementId)).toBe(anotherTextEl as unknown as HTMLElement);
  });

  it("waits for charts to render (predicate coverage)", async () => {
    await generatePdfReport({} as unknown as ReportData, "x.pdf");
    expect(page.waitForFunction).toHaveBeenCalled();
    // Get the predicate function passed to waitForFunction
    const predicate = page.waitForFunction.mock.calls[0]?.[0] as unknown as () => boolean;

    // Setup fake window for the predicate to run against
    const fakeWindow = { _chartsRendered: true };
    vi.stubGlobal("window", fakeWindow);

    expect(predicate()).toBe(true);

    vi.stubGlobal("window", undefined); // Cleanup
  });
});
