import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import * as stream from "stream";
import { promisify } from "util";

import { ENVIRONMENTS } from "../config/config";
import {
  ApiResponse,
  fetchScanArtifacts,
  getCacheMeta,
  loadPageFromCache,
  saveCacheMeta,
  savePageToCache
} from "./api";

const finished = promisify(stream.finished);

// Constants
const TIMEOUT_MS = 30000;
const FORBIDDEN_STATUS = 403;
const JSON_INDENT = 2;
const INITIAL_COUNT = 0;
const PAGE_INCREMENT = 1;
const PDF_SPACING = 2;
const PDF_SPACING_SMALL = 0.5;
const NOT_FOUND = -1;
const DELETE_COUNT = 1;
const INITIAL_PAGE = 1;
const MAX_PAGES_CHECK = Infinity;
const CONCURRENCY_LIMIT = 5;
const BAD_SCANS_FILE = path.join(process.cwd(), "config", "badScans.json");
const PDF_MARGIN = 50;
const PDF_HEADER_SIZE = 20;
const PDF_SUBHEADER_SIZE = 16;
const PDF_BODY_SIZE = 12;
const COL_WIDTH_LG = 150;
const COL_WIDTH_SM = 80;

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

function getBadScanIds(): Set<string> {
  try {
    if (fs.existsSync(BAD_SCANS_FILE)) {
      const content = fs.readFileSync(BAD_SCANS_FILE, "utf-8");
      const records = JSON.parse(content) as { id: string }[];
      return new Set(records.map((r) => r.id));
    }
  } catch {
    // ignore
  }
  return new Set();
}

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
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
    if (axios.isAxiosError(error) && error.response?.status === FORBIDDEN_STATUS) {
      // throw new Error(`403 Forbidden: The URL may be expired or access denied.`);
      return false;
    }
    // throw error;
    return false;
  }
}

interface PageArtifact {
  [key: string]: unknown;
  id: string;
  video: unknown;
  rawScan: unknown;
  arData: unknown;
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

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const badScanIds = getBadScanIds();
  console.log(`Loaded ${badScanIds.size.toString()} known bad scans to skip.`);

  // Get initial page to determine total pages
  try {
    const initialRes = await fetchScanArtifacts(env.domain, INITIAL_PAGE);
    const totalArtifacts = initialRes.pagination.total;
    const lastPage = initialRes.pagination.lastPage;

    stats.found = totalArtifacts;

    console.log(`Found ${totalArtifacts.toString()} total artifacts. (Pages: ${lastPage.toString()})`);

    // Cache Validation
    const cacheMeta = getCacheMeta(env.name);
    const useCache = cacheMeta !== null && cacheMeta.total === totalArtifacts;
    if (useCache) {
      console.log("Cache is valid. Using cached pages.");
    } else {
      console.log("Cache is invalid or missing. Fetching fresh data.");
      saveCacheMeta(env.name, totalArtifacts);
    }
    // Always save page 1
    savePageToCache(env.name, INITIAL_PAGE, initialRes);

    const pages = Array.from(
      { length: Math.min(lastPage, MAX_PAGES_CHECK) - INITIAL_PAGE + PAGE_INCREMENT },
      (_, i) => i + INITIAL_PAGE
    );

    const activePromises: Promise<void>[] = [];

    const processPage = async (pageNum: number) => {
      try {
        let res: ApiResponse | null = null;
        if (useCache) {
          res = loadPageFromCache(env.name, pageNum);
        }

        if (res === null) {
          res = await fetchScanArtifacts(env.domain, pageNum);
          savePageToCache(env.name, pageNum, res);
        }

        const artifacts: PageArtifact[] = res.data.map((item) => ({
          arData: item.arData,
          rawScan: item.rawScan,
          video: item.video,
          ...item // Include any other properties
        }));

        for (const artifact of artifacts) {
          if (badScanIds.has(artifact.id)) {
            // console.log(`Skipping bad scan: ${artifact.id}`);
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
            if (fs.existsSync(artifactDir)) {
              // Exists
            } else {
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
                // console.log(`Deleted incomplete artifact: ${artifact.id}`);
              } catch (e) {
                console.error(`Failed to delete incomplete artifact ${artifact.id}:`, e);
              }
            } else {
              process.stdout.write(".");
            }
          }
        }
      } catch (e) {
        console.error(
          `\nError fetching page ${pageNum.toString()} for ${env.name}:`,
          e instanceof Error ? e.message : e
        );
      }
    };

    while (pages.length > INITIAL_COUNT) {
      if (activePromises.length < CONCURRENCY_LIMIT) {
        const pageNum = pages.shift();
        if (pageNum !== undefined) {
          const p = processPage(pageNum).then(async () => {
            const idx = activePromises.indexOf(p);
            if (idx !== NOT_FOUND) {
              const _removed = activePromises.splice(idx, DELETE_COUNT);
              await Promise.all(
                _removed.map(async (rp) => {
                  await rp.catch(console.error);
                })
              );
            }
          });
          activePromises.push(p);
        }
      } else {
        await Promise.race(activePromises);
      }
    }

    await Promise.all(activePromises);
    console.log(`\nCompleted sync for ${env.name}`);

    return stats;
  } catch (e) {
    console.error(`Failed to get initial page for ${env.name}:`, e);
    return stats;
  }
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
    doc.text(header, currentX, tableTop, { align: "left", width: colWidths[i] ?? INITIAL_COUNT });
    currentX += colWidths[i] ?? INITIAL_COUNT;
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
      doc.text(text, rowX, rowY, { align: "left", width: colWidths[i] ?? INITIAL_COUNT });
      rowX += colWidths[i] ?? INITIAL_COUNT;
    });
    doc.moveDown();
  });

  doc.moveDown(PDF_SPACING);

  // Failures Section
  const failedStats = allStats.filter((s) => s.failed > INITIAL_COUNT);
  if (failedStats.length > INITIAL_COUNT) {
    doc.x = PDF_MARGIN; // Reset X to margin
    doc.font("Helvetica-Bold").fontSize(PDF_SUBHEADER_SIZE).text("Sync Failures");
    doc.moveDown();
    doc.font("Helvetica").fontSize(PDF_BODY_SIZE);

    failedStats.forEach((stats) => {
      if (stats.errors.length > INITIAL_COUNT) {
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
