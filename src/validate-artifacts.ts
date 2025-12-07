import * as fs from "fs";
import * as path from "path";

import { fetchScanArtifacts } from "./api";
import { ENVIRONMENTS } from "./config";

const REQUIRED_FIELDS = ["id", "projectId", "scanDate", "rawScan", "arData", "video"];

const INITIAL_PAGE = 1;
const MAX_PAGES_CHECK = Infinity;
const ZERO = 0;
const INCREMENT = 1;

interface EnvStats {
  artifactsWithIssues: number;
  missingCounts: Record<string, number>;
  name: string;
  processed: number;
  totalArtifacts: number;
}

async function validateEnvironment(env: { domain: string; name: string }): Promise<EnvStats> {
  console.log(`\nStarting validation for: ${env.name} (${env.domain})`);
  const stats: EnvStats = {
    artifactsWithIssues: 0,
    missingCounts: {},
    name: env.name,
    processed: 0,
    totalArtifacts: 0
  };

  const page = INITIAL_PAGE;

  try {
    const initialRes = await fetchScanArtifacts(env.domain, page);
    const { pagination } = initialRes;
    stats.totalArtifacts = pagination.total;
    const lastPage = pagination.lastPage;

    console.log(`Total artifacts to process: ${stats.totalArtifacts.toString()} (Pages: ${lastPage.toString()})`);

    const CONCURRENCY_LIMIT = 5;
    const OFFSET_ONE = 1;
    const pages = Array.from(
      { length: Math.min(lastPage, MAX_PAGES_CHECK) - INITIAL_PAGE + OFFSET_ONE },
      (_, i) => i + INITIAL_PAGE
    );

    const activePromises: Promise<void>[] = [];
    let completed = 0;
    const totalToProcess = pages.length;

    const processPage = async (pageNum: number) => {
      try {
        const res = await fetchScanArtifacts(env.domain, pageNum);
        for (const item of res.data) {
          stats.processed++;
          const missingFields = REQUIRED_FIELDS.filter((field) => item[field] === undefined || item[field] === null);

          if (missingFields.length > ZERO) {
            stats.artifactsWithIssues++;
            for (const field of missingFields) {
              stats.missingCounts[field] = (stats.missingCounts[field] ?? ZERO) + INCREMENT;
            }
          }
        }
      } catch (e) {
        console.error(`\nError fetching page ${pageNum.toString()}:`, e instanceof Error ? e.message : e);
      } finally {
        completed++;
        process.stdout.write(`\rProcessed pages ${completed.toString()}/${totalToProcess.toString()}...`);
      }
    };

    const ZERO = 0;
    const NOT_FOUND = -1;
    const DELETE_COUNT = 1;

    while (pages.length > ZERO) {
      if (activePromises.length < CONCURRENCY_LIMIT) {
        const pageNum = pages.shift();
        if (pageNum !== undefined) {
          const p = processPage(pageNum).then(() => {
            const idx = activePromises.indexOf(p);
            if (idx !== NOT_FOUND) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              activePromises.splice(idx, DELETE_COUNT);
            }
          });
          activePromises.push(p);
        }
      } else {
        // Wait for at least one to finish
        await Promise.race(activePromises);
      }
    }

    // Wait for remaining
    await Promise.all(activePromises);

    console.log(`\n${env.name} complete.`);
  } catch (error) {
    console.error(`\nFailed to fetch from ${env.name}:`, error instanceof Error ? error.message : error);
  }

  return stats;
}

function generateReport(allStats: EnvStats[]) {
  let report = "# Validation Report\n\n";

  report += "| Environment | Total Artifacts | Processed | Issues Found | Missing Properties |\n";
  report += "| :--- | :--- | :--- | :--- | :--- |\n";

  for (const stats of allStats) {
    let missingPropsStr = "";
    if (stats.artifactsWithIssues > ZERO) {
      const sortedFields = Object.keys(stats.missingCounts).sort();
      missingPropsStr = sortedFields
        .map((field) => `${field}: ${(stats.missingCounts[field] ?? ZERO).toString()}`)
        .join(", ");
    } else {
      missingPropsStr = "None";
    }

    report += `| ${stats.name} | ${stats.totalArtifacts.toString()} | ${stats.processed.toString()} | ${stats.artifactsWithIssues.toString()} | ${missingPropsStr} |\n`;
  }
  report += "\n";

  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const reportPath = path.join(reportsDir, "validation-report.md");
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport generated at: ${reportPath}`);
}

async function main() {
  const allStats: EnvStats[] = [];
  for (const env of ENVIRONMENTS) {
    const stats = await validateEnvironment(env);
    allStats.push(stats);
  }
  generateReport(allStats);
}

main().catch(console.error);
