import axios, { HttpStatusCode } from "axios";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import * as stream from "stream";
import { promisify } from "util";

import { ENVIRONMENTS } from "../../config/config";
import { Artifact, SpatialService } from "../services/spatialService";
import { getBadScans } from "../utils/data/badScans";

const finished = promisify(stream.finished);

// Constants

interface SyncError {
  id: string;
  reason: string;
}

interface SyncStats {
  env: string;
  found: number;
  new: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
}

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
  const TIMEOUT_MS = 30000;
  if (fs.existsSync(outputPath)) {
    return true; // Skip if exists
  }
  const writer = fs.createWriteStream(outputPath);
  try {
    const response = await axios.get<stream.Readable>(url, {
      responseType: "stream",
      timeout: TIMEOUT_MS
    });
    response.data.pipe(writer);
    await finished(writer);
    return true;
  } catch (error: unknown) {
    writer.close();
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath); // Delete partial file
    }
    // Enhance error message for context
    if (axios.isAxiosError(error) && error.response?.status === HttpStatusCode.Forbidden) {
      return false;
    }
    return false;
  }
}

async function syncEnvironment(env: { domain: string; name: string }): Promise<SyncStats> {
  console.log(`\nStarting sync for: ${env.name}`);
  const dataDir = path.join(process.cwd(), "data", "artifacts", env.name.replace(/[^a-z0-9]/gi, "_").toLowerCase());

  const stats: SyncStats = {
    env: env.name,
    errors: [],
    failed: 0,
    found: 0,
    new: 0,
    skipped: 0
  };

  const NOT_FOUND = -1;
  const PROMISE_REMOVE_COUNT = 1;
  const CONCURRENCY_LIMIT = 5;
  const TIMEOUT_MS = 30000;
  const JSON_INDENT = 2;

  /* eslint-enable no-magic-numbers */

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const badScans = getBadScans();
  console.log(`Loaded ${Object.keys(badScans).length.toString()} known bad scans to skip.`);

  const service = new SpatialService(env.domain, env.name);

  // Get initial page to determine total pages
  const page = 1;
  try {
    const initialRes = await service.fetchScanArtifacts(page);
    const totalArtifacts = initialRes.pagination.total;
    const lastPage = initialRes.pagination.lastPage;

    stats.found = totalArtifacts;

    console.log(`Found ${totalArtifacts.toString()} total artifacts. (Pages: ${lastPage.toString()})`);

    const pages = Array.from({ length: lastPage }, (_, i) => i + page);

    const activePromises: Promise<void>[] = [];
    let completed = 0;
    const totalPages = pages.length;

    const processPage = async (pageNum: number) => {
      try {
        const res = await service.fetchScanArtifacts(pageNum);

        const artifacts: Artifact[] = res.data;

        for (const artifact of artifacts) {
          if (artifact.id in badScans) {
            stats.skipped++;
            continue;
          }

          // Filter: must have all 3 files
          if (
            typeof artifact.video === "string" &&
            typeof artifact.rawScan === "string" &&
            typeof artifact.arData === "string"
          ) {
            const artifactDir = path.join(dataDir, artifact.id);
            const exists = fs.existsSync(artifactDir);

            if (!exists) {
              fs.mkdirSync(artifactDir, { recursive: true });
            }

            // Save meta.json
            fs.writeFileSync(path.join(artifactDir, "meta.json"), JSON.stringify(artifact, null, JSON_INDENT));

            // Download files
            const downloadJsonFile = async (url: string, outputPath: string): Promise<boolean> => {
              if (fs.existsSync(outputPath)) {
                return true;
              }
              try {
                const response = await axios.get(url, { responseType: "json", timeout: TIMEOUT_MS });
                fs.writeFileSync(outputPath, JSON.stringify(response.data, null, JSON_INDENT));
                return true;
              } catch {
                if (fs.existsSync(outputPath)) {
                  fs.unlinkSync(outputPath);
                }
                return false;
              }
            };

            const results = await Promise.all([
              downloadFile(artifact.video, path.join(artifactDir, "video.mp4")).then((success) => {
                if (!success) {
                  stats.errors.push({ id: artifact.id, reason: "Video download failed" });
                }
                return success;
              }),
              downloadJsonFile(artifact.rawScan, path.join(artifactDir, "rawScan.json")).then((success) => {
                if (!success) {
                  stats.errors.push({ id: artifact.id, reason: "rawScan download failed" });
                }
                return success;
              }),
              downloadJsonFile(artifact.arData, path.join(artifactDir, "arData.json")).then((success) => {
                if (!success) {
                  stats.errors.push({ id: artifact.id, reason: "arData download failed" });
                }
                return success;
              })
            ]);

            const artifactFailed = results.some((r) => !r);

            if (artifactFailed) {
              stats.failed++;
              try {
                fs.rmSync(artifactDir, { force: true, recursive: true });
              } catch (e) {
                console.error(`Failed to delete incomplete artifact ${artifact.id}:`, e);
              }
            } else {
              if (!exists) {
                stats.new++;
              }
              process.stdout.write(".");
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching page ${pageNum.toString()}:`, e);
      } finally {
        completed++;
        process.stdout.write(`\rProcessed pages ${completed.toString()}/${totalPages.toString()}...`);
      }
    };

    const NO_PAGES_LEFT = 0;

    while (pages.length > NO_PAGES_LEFT) {
      if (activePromises.length < CONCURRENCY_LIMIT) {
        const pageNum = pages.shift();
        if (pageNum !== undefined) {
          const p = processPage(pageNum).then(() => {
            const idx = activePromises.indexOf(p);
            if (idx !== NOT_FOUND) {
              activePromises.splice(idx, PROMISE_REMOVE_COUNT).forEach(() => {
                /** no-op */
              });
            }
          });
          activePromises.push(p);
        }
      } else {
        await Promise.race(activePromises);
      }
    }

    await Promise.all(activePromises);
    console.log(`\n${env.name} complete.`);
  } catch (e) {
    console.error(`Failed to sync ${env.name}:`, e);
  }

  return stats;
}

async function generateSyncReport(allStats: SyncStats[]) {
  const doc = new PDFDocument();
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, "sync-report.pdf");
  const writeStream = fs.createWriteStream(reportPath);
  doc.pipe(writeStream);

  const PDF_SPACING = 2;
  const PDF_SPACING_SMALL = 0.5;
  const PDF_MARGIN = 50;
  const PDF_HEADER_SIZE = 20;
  const PDF_SUBHEADER_SIZE = 16;
  const PDF_BODY_SIZE = 12;
  const COL_WIDTH_LG = 150;
  const COL_WIDTH_SM = 80;
  const DEFAULT_WIDTH = 0;
  const ZERO_FAILURES = 0;

  // Title
  doc.fontSize(PDF_HEADER_SIZE).text("Sync Report", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(PDF_SPACING);

  // Summary Table
  const tableTop = doc.y;
  const colWidths = [COL_WIDTH_LG, COL_WIDTH_SM, COL_WIDTH_SM, COL_WIDTH_SM, COL_WIDTH_SM];
  const headers = ["Environment", "Found", "New", "Skipped", "Failed"];
  let currentX = PDF_MARGIN;

  // Header Row
  doc.font("Helvetica-Bold");
  headers.forEach((header, i) => {
    doc.text(header, currentX, tableTop, { align: "left", width: colWidths[i] ?? DEFAULT_WIDTH });
    currentX += colWidths[i] ?? DEFAULT_WIDTH;
  });
  doc.moveDown();
  doc.font("Helvetica");

  // Data Rows
  allStats.forEach((stats) => {
    let rowX = PDF_MARGIN;
    const rowY = doc.y;
    const data = [
      stats.env,
      stats.found.toString(),
      stats.new.toString(),
      stats.skipped.toString(),
      stats.failed.toString()
    ];
    data.forEach((text, i) => {
      doc.text(text, rowX, rowY, { align: "left", width: colWidths[i] ?? DEFAULT_WIDTH });
      rowX += colWidths[i] ?? DEFAULT_WIDTH;
    });
    doc.moveDown();
  });

  doc.moveDown(PDF_SPACING);

  // Failures Section
  const failedStats = allStats.filter((s) => s.failed > ZERO_FAILURES);
  if (failedStats.length > ZERO_FAILURES) {
    doc.x = PDF_MARGIN; // Reset X to margin
    doc.font("Helvetica-Bold").fontSize(PDF_SUBHEADER_SIZE).text("Sync Failures");
    doc.moveDown();
    doc.font("Helvetica").fontSize(PDF_BODY_SIZE);

    failedStats.forEach((stats) => {
      if (stats.errors.length > ZERO_FAILURES) {
        doc.font("Helvetica-Bold").text(`Environment: ${stats.env}`);
        doc.font("Helvetica");
        stats.errors.forEach((err) => {
          doc.text(`- ID: ${err.id}`);
          doc.text(`  Reason: ${err.reason}`);
          doc.moveDown(PDF_SPACING_SMALL);
        });
        doc.moveDown();
      }
    });
  } else {
    doc.x = PDF_MARGIN;
    doc.text("No failures occurred during sync.");
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  console.log(`\nSync report generated at: ${reportPath}`);
}

async function main() {
  const allStats: SyncStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await syncEnvironment(env);
    allStats.push(stats);
  }
  await generateSyncReport(allStats);
}

main().catch(console.error);
