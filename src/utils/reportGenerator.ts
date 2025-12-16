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

  const html = ReactDOMServer.renderToStaticMarkup(React.createElement(ReportShell, { css, data }));
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
    await page.setContent(fullHtml);
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
