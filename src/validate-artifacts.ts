import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const ENVIRONMENTS = [
  { domain: "bondxlowes.com", name: "Lowe's Staging" },
  { domain: "studioxlowes.com", name: "Lowe's Production" },
  { domain: "arcstudio.ai", name: "Bond Production" },
  { domain: "usedemo.io", name: "Bond Demo" }
];

const REQUIRED_FIELDS = ["id", "projectId", "scanDate", "rawScan", "arData", "video"];

const INITIAL_PAGE = 1;
const MAX_PAGES_CHECK = Infinity;
const ZERO = 0;
const INCREMENT = 1;

interface Artifact {
  [key: string]: unknown;
  id: string;
  projectId?: string;
  scanDate?: string;
  rawScan?: unknown;
  arData?: unknown;
  video?: unknown;
}

interface Pagination {
  currentPage: number;
  from: number;
  lastPage: number;
  perPage: number;
  to: number;
  total: number;
}

interface ApiResponse {
  data: Artifact[];
  pagination: Pagination;
}

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

  let page = INITIAL_PAGE;

  try {
    const initialUrl = `https://api.${env.domain}/spatial/v1/scan-artifacts?page=${page.toString()}`;
    const initialRes = await axios.get<ApiResponse>(initialUrl);
    const { pagination } = initialRes.data;
    stats.totalArtifacts = pagination.total;
    const lastPage = pagination.lastPage;

    console.log(`Total artifacts to process: ${stats.totalArtifacts.toString()} (Pages: ${lastPage.toString()})`);

    const CONCURRENCY_LIMIT = 5;
    const pages = Array.from(
      { length: Math.min(lastPage, MAX_PAGES_CHECK) - INITIAL_PAGE + 1 },
      (_, i) => i + INITIAL_PAGE
    );

    let activePromises: Promise<void>[] = [];
    let completed = 0;
    const totalToProcess = pages.length;

    const processPage = async (pageNum: number) => {
      const url = `https://api.${env.domain}/spatial/v1/scan-artifacts?page=${pageNum.toString()}`;
      try {
        const res = await axios.get<ApiResponse>(url);
        for (const item of res.data.data) {
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

    while (pages.length > 0) {
      if (activePromises.length < CONCURRENCY_LIMIT) {
        const pageNum = pages.shift();
        if (pageNum) {
          const p = processPage(pageNum).then(() => {
            activePromises = activePromises.filter((param) => param !== p);
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
