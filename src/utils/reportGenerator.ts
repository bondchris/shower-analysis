import * as fs from "fs";
import * as path from "path";
import { Browser, chromium } from "playwright";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { ReportData } from "../models/report";
import { ReportShell } from "../templates/components/ReportShell";
import { logger } from "./logger";

// Ensure a minimal DOM is available during server-side rendering so that
// visx text measurement code does not blow up when accessing `document`.
interface SsrSvgTextElement {
  textContent: string;
  style: Record<string, unknown>;
  setAttribute: (name: string, value: string) => void;
  getComputedTextLength: () => number;
}

interface SsrSvgElement {
  style: Record<string, unknown>;
  setAttribute: (name: string, value: string) => void;
  appendChild: (el: SsrSvgTextElement) => void;
}

interface SsrDocument {
  body: { appendChild: (el: SsrSvgElement) => void };
  createElementNS: (ns: string, tag: string) => SsrSvgElement | SsrSvgTextElement;
  getElementById: (id: string) => SsrSvgTextElement | null;
}

let ssrDomInitialized = false;
function ensureSsrDom(): void {
  if (ssrDomInitialized || typeof document !== "undefined") {
    ssrDomInitialized = true;
    return;
  }

  const measurementId = "__react_svg_text_measurement_id";
  let measurementEl: SsrSvgTextElement | null = null;

  const createTextElement = (): SsrSvgTextElement => ({
    getComputedTextLength: () => {
      const averageCharWidthPx = 6;
      const emptyLength = 0;
      if (measurementEl === null) {
        return emptyLength;
      }
      return measurementEl.textContent.length * averageCharWidthPx;
    },
    setAttribute: () => undefined,
    style: {},
    textContent: ""
  });

  const doc: SsrDocument = {
    body: { appendChild: () => undefined },
    createElementNS: (_ns: string, tag: string) => {
      if (tag === "text") {
        measurementEl = createTextElement();
        return measurementEl;
      }
      return {
        appendChild: (el: SsrSvgTextElement) => {
          measurementEl = el;
        },
        setAttribute: () => undefined,
        style: {}
      };
    },
    getElementById: (id: string) => (id === measurementId ? measurementEl : null)
  };

  const globalAny = globalThis as typeof globalThis & {
    document?: Document;
    window?: Window & typeof globalThis;
  };
  const fakeDocument = doc as unknown as Document;
  const fakeWindow = { document: doc } as unknown as Window & typeof globalThis;
  globalAny.document = fakeDocument;
  globalAny.window = fakeWindow;

  ssrDomInitialized = true;
}

export async function generatePdfReport(data: ReportData, filename: string): Promise<void> {
  ensureSsrDom();

  const cssPath = path.join(process.cwd(), "src", "templates", "styles", "print.css");
  let css = "";
  try {
    css = fs.readFileSync(cssPath, "utf-8");
  } catch (error) {
    logger.warn(`Could not load print.css from ${cssPath}: ${String(error)}`);
  }

  const html = ReactDOMServer.renderToStaticMarkup(React.createElement(ReportShell, { css, data }));
  const fullHtml = `<!DOCTYPE html>\n${html}`;

  const reportsDir = path.join(process.cwd(), "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, filename);

  let browser: Browser | undefined = undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    // Set viewport to A4 width (approx 794px at 96 DPI) to ensure charts render at correct aspect ratio
    await page.setViewportSize({ height: 1123, width: 794 });
    await page.setContent(fullHtml);

    // Wait for charts to render
    await page
      .waitForFunction(() => (window as Window & { _chartsRendered?: boolean })._chartsRendered === true, {
        timeout: 10000
      })
      .catch(() => {
        logger.warn("Charts did not report ready within timeout, proceeding anyway.");
      });

    await page.pdf({
      format: "A4",
      margin: {
        bottom: "40px",
        left: "40px",
        right: "40px",
        top: "40px"
      },
      path: reportPath,
      printBackground: true
    });
    logger.info(`PDF report generated at: ${reportPath}`);
  } catch (error) {
    logger.error(`Failed to generate PDF report: ${String(error)}`);
    throw error;
  } finally {
    await browser?.close();
  }
}
