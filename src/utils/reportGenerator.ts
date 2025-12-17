import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { ReportData } from "../models/report";
import { ReportShell } from "../templates/components/ReportShell";
import { logger } from "./logger";

// Re-export types for backward compatibility with existing scripts (or update scripts to import from models)
export { ReportData, ReportSection } from "../models/report";

export async function generatePdfReport(data: ReportData, filename: string): Promise<void> {
  const cssPath = path.join(process.cwd(), "src", "templates", "styles", "print.css");
  let css = "";
  try {
    css = fs.readFileSync(cssPath, "utf-8");
  } catch (error) {
    logger.warn(`Could not load print.css from ${cssPath}: ${String(error)}`);
  }

  let chartLib = "";
  let datalabelsLib = "";
  try {
    chartLib = fs.readFileSync(path.join(process.cwd(), "node_modules/chart.js/dist/chart.umd.js"), "utf-8");
    datalabelsLib = fs.readFileSync(
      path.join(process.cwd(), "node_modules/chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.js"),
      "utf-8"
    );
  } catch (error) {
    logger.warn(`Could not load chart libraries: ${String(error)}`);
  }

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReportShell, { chartLib, css, data, datalabelsLib })
  );
  // Add doctype as renderToStaticMarkup doesn't add it
  const fullHtml = `<!DOCTYPE html>\n${html}`;

  const reportsDir = path.join(process.cwd(), "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, filename);

  try {
    const browser = await chromium.launch();
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
    await browser.close();
    logger.info(`PDF report generated at: ${reportPath}`);
  } catch (error) {
    logger.error(`Failed to generate PDF report: ${String(error)}`);
    throw error;
  }
}
