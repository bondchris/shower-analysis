import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

export interface PdfReport {
  doc: PDFKit.PDFDocument;
  waitForWrite: () => Promise<void>;
  reportPath: string;
}

export function createPdfDocument(filename: string): PdfReport {
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, filename);
  const DEFAULT_MARGIN = 50;
  const doc = new PDFDocument({ margin: DEFAULT_MARGIN });
  const writeStream = fs.createWriteStream(reportPath);
  doc.pipe(writeStream);

  const waitForWrite = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  };

  return { doc, reportPath, waitForWrite };
}

export function writePdfHeader(doc: PDFKit.PDFDocument, title: string): void {
  const HEADER_SIZE = 24;
  const BODY_SIZE = 12;

  doc.fontSize(HEADER_SIZE).text(title, { align: "center" });
  doc.fontSize(BODY_SIZE).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown();
}

export interface TableOptions {
  headers: string[];
  data: string[][]; // Rows -> Columns
  colWidths: number[];
  startX?: number;
}

export function drawTable(doc: PDFKit.PDFDocument, options: TableOptions): void {
  const DEFAULT_START_X = 50;
  const { headers, data, colWidths, startX = DEFAULT_START_X } = options;
  const tableTop = doc.y;
  let currentY = tableTop;
  const DEFAULT_WIDTH = 0;

  // Header
  // Note: Assuming doc font is currently set by caller or defaults
  // We force bold for header
  doc.font("Helvetica-Bold");
  let currentX = startX;
  headers.forEach((header, i) => {
    const width = colWidths[i] ?? DEFAULT_WIDTH;
    doc.text(header, currentX, currentY, { align: "left", width });
    currentX += width;
  });

  doc.moveDown();
  currentY = doc.y;
  doc.font("Helvetica");

  // Rows
  data.forEach((row) => {
    // Check page break
    const PAGE_BREAK_BUFFER = 20;
    const PAGE_MARGIN = 50;
    if (doc.y + PAGE_BREAK_BUFFER > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
      currentY = doc.y;
    }

    let rowX = startX;
    const rowY = doc.y;

    row.forEach((text, i) => {
      const width = colWidths[i] ?? DEFAULT_WIDTH;
      doc.text(text, rowX, rowY, { align: "left", width });
      rowX += width;
    });
    doc.moveDown();
  });
}
