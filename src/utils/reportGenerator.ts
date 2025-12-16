import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";

import { logger } from "./logger";

export interface ReportSection {
  type: "summary" | "table" | "chart" | "list" | "text" | "header" | "chart-row";
  title?: string;
  level?: number;
  data?: unknown;
  options?: unknown;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
}

const CSS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

  body {
    font-family: 'Inter', sans-serif;
    color: #1f2937;
    margin: 0;
    padding: 40px;
    background: #fff;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 10px;
    color: #111827;
  }

  .report-meta {
    text-align: center;
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 20px;
  }

  .report-subtitle {
     text-align: center;
     font-size: 16px;
     font-weight: 500;
     margin-bottom: 40px;
     color: #000000;
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-top: 30px;
    margin-bottom: 15px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
    color: #374151;
    page-break-after: avoid;
    break-after: avoid;
  }

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-top: 20px;
    margin-bottom: 10px;
    color: #4b5563;
    page-break-after: avoid;
    break-after: avoid;
  }

  h4 {
    font-size: 13px;
    font-weight: 600;
    margin-top: 15px;
    margin-bottom: 8px;
    color: #4b5563;
    page-break-after: avoid;
    break-after: avoid;
  }

  .avoid-page-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  p {
    font-size: 12px;
    line-height: 1.5;
    margin-bottom: 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 20px;
  }

  th {
    text-align: left;
    background: #000000;
    color: #ffffff;
    font-weight: 600;
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #374151;
  }

  th:last-child {
    border-right: none;
  }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
    border-right: 1px solid #e5e7eb;
    color: #4b5563;
  }

  td:last-child {
    border-right: none;
  }

  tr:last-child td {
    border-bottom: none;
  }

  .chart-container {
    width: 100%;
    margin-bottom: 30px;
    display: flex;
    justify-content: center;
  }

  .chart-container img {
    max-width: 100%;
    max-height: 600px;
  }

  .chart-row-container {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 30px;
  }

  .chart-item {
    flex: 1;
    text-align: center;
  }

  .chart-item img {
    max-width: 100%;
    height: auto;
  }

  h5 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #374151;
    text-align: center;
  }

  .list-item {
    font-size: 12px;
    margin-bottom: 4px;
    position: relative;
    padding-left: 15px;
  }

  .list-item::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #9ca3af;
  }
  
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }
  
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }

  .bg-error td, .bg-error { background: #fee2e2 !important; font-weight: 600; color: #991b1b; }
  .bg-error-light td, .bg-error-light { background: #fef2f2 !important; color: #991b1b; }
  .bg-warning td, .bg-warning { background: #fef9c3 !important; font-weight: 600; color: #854d0e; }
  .bg-warning-light td, .bg-warning-light { background: #fefce8 !important; color: #854d0e; }
  .bg-info td, .bg-info { background: #e0f2fe !important; font-weight: 600; color: #075985; }
  .bg-success td, .bg-success { background: #dcfce7 !important; font-weight: 600; color: #166534; }

  th:not(:first-child), td:not(:first-child) { text-align: center; }
`;

function generateHtml(data: ReportData): string {
  const sectionsHtml = data.sections.map(renderSection).join("\n");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${CSS_STYLES}</style>
      </head>
      <body>
        <h1>${data.title}</h1>
        <div class="report-meta">Generated: ${new Date().toLocaleString()}</div>
        ${data.subtitle !== undefined ? `<div class="report-subtitle">${data.subtitle}</div>` : ""}
        ${sectionsHtml}
      </body>
    </html>
  `;
}

function renderSection(section: ReportSection): string {
  let html = "";
  const MIN_TITLE_LENGTH = 0;
  if (section.title !== undefined && section.title.length > MIN_TITLE_LENGTH) {
    const DEFAULT_HEADER_LEVEL = 2;
    const level = section.level ?? DEFAULT_HEADER_LEVEL;
    html += `<h${String(level)}>${section.title}</h${String(level)}>`;
  }

  switch (section.type) {
    case "text":
      html += `<p>${String(section.data)}</p>`;
      break;
    case "table":
      if (Array.isArray(section.data)) {
        html += renderTable(section.data as string[][], section.options as { headers: string[] } | undefined);
      }
      break;
    case "list":
      if (Array.isArray(section.data)) {
        html += renderList(section.data as string[]);
      }
      break;
    case "chart":
      html += `<div class="chart-container"><img src="${section.data as string}" /></div>`;
      break;
    case "chart-row":
      if (Array.isArray(section.data)) {
        html += `<div class="chart-row-container">`;
        (section.data as { title?: string; data: string }[]).forEach((chart) => {
          html += `<div class="chart-item">`;
          const MIN_TITLE_LEN = 0;
          if (chart.title !== undefined && chart.title.length > MIN_TITLE_LEN) {
            html += `<h5>${chart.title}</h5>`;
          }
          html += `<img src="${chart.data}" />`;
          html += `</div>`;
        });
        html += `</div>`;
      }
      break;
    case "summary":
      if (section.data !== undefined) {
        html += `<p>${section.data as string}</p>`;
      }
      break;
    case "header":
      // Title is handled above; no data to render
      break;
    default:
      // Not implemented or just pass through data as text
      if (section.data !== undefined) {
        html += `<p>${section.data as string}</p>`;
      }
      break;
  }

  const wrapperClass = ["chart", "summary", "chart-row"].includes(section.type) ? "avoid-page-break" : "";
  return `<div class="${wrapperClass}">${html}</div>`;
}

function renderTable(data: string[][], options?: { headers: string[]; rowClasses?: Record<number, string> }): string {
  const headers = options?.headers ?? [];
  const rowClasses = options?.rowClasses ?? {};

  let html = "<table>";

  const MIN_HEADERS = 0;
  if (headers.length > MIN_HEADERS) {
    html += "<thead><tr>";
    headers.forEach((h) => (html += `<th>${h}</th>`));
    html += "</tr></thead>";
  }

  html += "<tbody>";
  data.forEach((row, index) => {
    const className = rowClasses[index] ?? "";
    html += `<tr class="${className}">`;
    row.forEach((cell) => (html += `<td>${cell}</td>`));
    html += "</tr>";
  });
  html += "</tbody></table>";

  return html;
}

function renderList(items: string[]): string {
  return `<div>${items.map((i) => `<div class="list-item">${i}</div>`).join("")}</div>`;
}

export async function generatePdfReport(data: ReportData, filename: string): Promise<void> {
  const html = generateHtml(data);
  const reportsDir = path.join(process.cwd(), "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, filename);

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html);
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
