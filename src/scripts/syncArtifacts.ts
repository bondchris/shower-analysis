import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

import { ENVIRONMENTS } from "../../config/config";
import { BadScanDatabase } from "../models/badScanRecord";
import { Artifact, SpatialService } from "../services/spatialService";
import { getBadScans } from "../utils/data/badScans";
import { downloadFile, downloadJsonFile } from "../utils/sync/downloadHelpers";

/**
 * Script to sync artifacts from the Spatial API.
 * - Downloads artifacts for configured environments.
 * - Skips artifacts already marked as "Bad Scans".
 * - Ensures valid synced artifacts have `video.mp4`, `arData.json`, and `rawScan.json`.
 * - Generates a sync report PDF.
 */

// --- Concurrency Helper ---

const INITIAL_ACTIVE = 0;

function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let active = INITIAL_ACTIVE;

  const next = () => {
    active--;
    if (queue.length > INITIAL_ACTIVE) {
      const job = queue.shift();
      if (job) {
        job();
      }
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    const res = await new Promise<T>((resolve, reject) => {
      const runTask = async () => {
        active++;
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        } finally {
          next();
        }
      };

      if (active < concurrency) {
        runTask().catch((err: unknown) => {
          console.error("pLimit task failed (unexpected):", err);
        });
      } else {
        // Wrap async task in void function to satisfy generic queue type and no-misused-promises
        queue.push(() => {
          runTask().catch((err: unknown) => {
            console.error("pLimit task failed (queue):", err);
          });
        });
      }
    });
    return res;
  };

  return run;
}

// Constants

const ZERO = 0;
const START_PAGE = 1;
const JSON_INDENT = 2;

interface SyncError {
  id: string;
  reason: string;
}

export interface SyncStats {
  env: string;
  found: number;
  new: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
}

interface ArtifactResult {
  new: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
}

// Extracted Artifact Processor
async function processArtifact(
  artifact: Artifact,
  dataDir: string,
  badScans: BadScanDatabase
): Promise<ArtifactResult> {
  const result: ArtifactResult = {
    errors: [],
    failed: 0,
    new: 0,
    skipped: 0
  };

  // Hardened check for badScans
  if (Object.prototype.hasOwnProperty.call(badScans, artifact.id)) {
    result.skipped = 1;
    return result;
  }

  const { video, rawScan, arData } = artifact;

  const hasAllFiles =
    typeof video === "string" &&
    video.length > ZERO &&
    typeof rawScan === "string" &&
    rawScan.length > ZERO &&
    typeof arData === "string" &&
    arData.length > ZERO;

  if (hasAllFiles) {
    // Sanitize ID for path safety
    const safeId = artifact.id.replace(/[^a-z0-9_-]/gi, "_");
    const artifactDir = path.join(dataDir, safeId);
    const exists = fs.existsSync(artifactDir);

    if (!exists) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Save meta.json
    fs.writeFileSync(path.join(artifactDir, "meta.json"), JSON.stringify(artifact, null, JSON_INDENT));

    // Download files
    const downloadResults = await Promise.all([
      downloadFile(video, path.join(artifactDir, "video.mp4"), "Video").then((err) => {
        if (err !== null) {
          result.errors.push({ id: artifact.id, reason: err });
        }
        return err === null;
      }),
      downloadJsonFile(rawScan, path.join(artifactDir, "rawScan.json"), "rawScan").then((err) => {
        if (err !== null) {
          result.errors.push({ id: artifact.id, reason: err });
        }
        return err === null;
      }),
      downloadJsonFile(arData, path.join(artifactDir, "arData.json"), "arData").then((err) => {
        if (err !== null) {
          result.errors.push({ id: artifact.id, reason: err });
        }
        return err === null;
      })
    ]);

    const artifactFailed = downloadResults.some((r) => !r);

    if (artifactFailed) {
      result.failed = 1;
      try {
        fs.rmSync(artifactDir, { force: true, recursive: true });
      } catch (e) {
        console.error(`Failed to delete incomplete artifact ${artifact.id}:`, e);
      }
    } else {
      if (!exists) {
        result.new = 1;
      }
      process.stdout.write(".");
    }
  }

  return result;
}

export async function syncEnvironment(env: { domain: string; name: string }): Promise<SyncStats> {
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

  // Limits
  const PAGE_CONCURRENCY = 5;
  const ARTIFACT_CONCURRENCY = 20;

  const limitPage = pLimit(PAGE_CONCURRENCY);
  const limitArtifact = pLimit(ARTIFACT_CONCURRENCY);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const badScans = getBadScans();
  console.log(`Loaded ${Object.keys(badScans).length.toString()} known bad scans to skip.`);

  const service = new SpatialService(env.domain, env.name);

  // Get initial page to determine total pages
  const initialPage = START_PAGE;
  try {
    const initialRes = await service.fetchScanArtifacts(initialPage);
    const totalArtifacts = initialRes.pagination.total;
    const lastPage = initialRes.pagination.lastPage;

    stats.found = totalArtifacts;

    console.log(`Found ${totalArtifacts.toString()} total artifacts. (Pages: ${lastPage.toString()})`);

    const pages = Array.from({ length: lastPage }, (_, i) => i + initialPage);
    let completed = ZERO;
    const totalPages = pages.length;

    const processPageTask = async (pageNum: number) => {
      try {
        const res = await service.fetchScanArtifacts(pageNum);
        const artifacts: Artifact[] = res.data;

        // Queue all artifacts for processing and wait for results
        const pageResults = await Promise.all(
          artifacts.map(async (a) => {
            const r = await limitArtifact(async () => {
              const pa = await processArtifact(a, dataDir, badScans);
              return pa;
            });
            return r;
          })
        );

        // Aggregate results safely (page level aggregation is single threaded in `processPageTask` scope)
        // Note: processPageTask itself is concurrent with other pages, so we shouldn't mutate `stats` directly?
        // Wait, multiple `processPageTask` run concurrently. `stats` IS shared.
        // But `stats.errors.push` is array push (safe in JS).
        // `stats.failed +=` is safe (no preemption).
        // The issue is ordering.
        // To be safer, we can return `pageResults` from `processPageTask` and aggregate at top level?
        // But `processPageTask` is void return in current design.
        // I will aggregate here for now (user: "safe in Node... non-deterministic").
        // Given I deduplicate errors later, it is mostly fine.

        for (const r of pageResults) {
          stats.new += r.new;
          stats.skipped += r.skipped;
          stats.failed += r.failed;
          stats.errors.push(...r.errors);
        }
      } catch (e) {
        console.error(`Error fetching page ${pageNum.toString()}:`, e);
      } finally {
        completed++;
        process.stdout.write(`\rProcessed pages ${completed.toString()}/${totalPages.toString()}...`);
      }
    };

    // Run all pages with concurrency limit
    await Promise.all(
      pages.map(async (pageNum) => {
        await limitPage(async () => {
          await processPageTask(pageNum);
        });
      })
    );

    console.log(`\n${env.name} complete.`);
  } catch (e) {
    console.error(`Failed to sync ${env.name}:`, e);
  }

  return stats;
}

export async function generateSyncReport(allStats: SyncStats[]) {
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
  const DEFAULT_WIDTH = ZERO;
  const ZERO_FAILURES = ZERO;

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
  // Filter by errors length, not just failed count
  const failedStats = allStats.filter((s) => s.errors.length > ZERO_FAILURES);
  if (failedStats.length > ZERO_FAILURES) {
    doc.x = PDF_MARGIN; // Reset X to margin
    doc.font("Helvetica-Bold").fontSize(PDF_SUBHEADER_SIZE).text("Sync Failures");
    doc.moveDown();
    doc.font("Helvetica").fontSize(PDF_BODY_SIZE);

    failedStats.forEach((stats) => {
      if (stats.errors.length > ZERO_FAILURES) {
        doc.font("Helvetica-Bold").text(`Environment: ${stats.env}`);
        doc.font("Helvetica");

        // Group errors by ID and deduplicate reasons
        const errorsById = new Map<string, Set<string>>();
        stats.errors.forEach((err) => {
          if (!errorsById.has(err.id)) {
            errorsById.set(err.id, new Set());
          }
          errorsById.get(err.id)?.add(err.reason);
        });

        // Print grouped errors
        errorsById.forEach((reasons, id) => {
          doc.text(`- ID: ${id}`);
          reasons.forEach((reason) => {
            doc.text(`  ${reason}`);
          });
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

export async function main() {
  const allStats: SyncStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await syncEnvironment(env);
    allStats.push(stats);
  }
  await generateSyncReport(allStats);
}

if (require.main === module) {
  main().catch(console.error);
}
