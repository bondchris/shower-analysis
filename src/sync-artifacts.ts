import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as stream from "stream";
import { promisify } from "util";

const finished = promisify(stream.finished);

import { fetchScanArtifacts } from './api';
import { ENVIRONMENTS } from './config';

const INITIAL_PAGE = 1;
const MAX_PAGES_CHECK = Infinity;
const CONCURRENCY_LIMIT = 5;

async function downloadFile(url: string, outputPath: string): Promise<void> {
  if (fs.existsSync(outputPath)) {
    return; // Skip if exists
  }
  const writer = fs.createWriteStream(outputPath);
  try {
    const response = await axios.get<stream.Readable>(url, {
      responseType: "stream"
    });
    response.data.pipe(writer);
    await finished(writer);
  } catch (error) {
    writer.close();
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath); // Delete partial file
    }
    throw error;
  }
}

async function syncEnvironment(env: { domain: string; name: string }) {
  console.log(`\nStarting sync for: ${env.name}`);
  const dataDir = path.join(process.cwd(), "data", env.name.replace(/[^a-z0-9]/gi, "_").toLowerCase());

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let lastPage = 1;

  // Get initial page to determine total pages
  try {
    const initialRes = await fetchScanArtifacts(env.domain, INITIAL_PAGE);
    lastPage = initialRes.pagination.lastPage;
  } catch (e) {
    console.error(`Failed to get initial page for ${env.name}:`, e);
    return;
  }

  const OFFSET_ONE = 1;
  const pages = Array.from(
    { length: Math.min(lastPage, MAX_PAGES_CHECK) - INITIAL_PAGE + OFFSET_ONE },
    (_, i) => i + INITIAL_PAGE
  );
  const activePagePromises: Promise<void>[] = [];

  const processPage = async (pageNum: number): Promise<void> => {
    try {
      const res = await fetchScanArtifacts(env.domain, pageNum);
      const artifacts = res.data;

      for (const artifact of artifacts) {
        // Filter: must have all 3 files
        if (
          typeof artifact.video === "string" &&
          typeof artifact.rawScan === "string" &&
          typeof artifact.arData === "string"
        ) {
          const artifactDir = path.join(dataDir, artifact.id);
          if (!fs.existsSync(artifactDir)) {
            fs.mkdirSync(artifactDir, { recursive: true });
          }

          // Save meta.json
          const INDENT = 2;
          fs.writeFileSync(path.join(artifactDir, "meta.json"), JSON.stringify(artifact, null, INDENT));

          // Download files
          const downloads = [
            downloadFile(artifact.video, path.join(artifactDir, "video.mp4")).catch((e: unknown) => {
              console.error(`Failed to download video for ${artifact.id}:`, e instanceof Error ? e.message : String(e));
            }),
            downloadFile(artifact.rawScan, path.join(artifactDir, "rawScan.json")).catch((e: unknown) => {
              console.error(
                `Failed to download rawScan for ${artifact.id}:`,
                e instanceof Error ? e.message : String(e)
              );
            }),
            downloadFile(artifact.arData, path.join(artifactDir, "arData.json")).catch((e: unknown) => {
              console.error(
                `Failed to download arData for ${artifact.id}:`,
                e instanceof Error ? e.message : String(e)
              );
            })
          ];

          // We could limit download concurrency here too if needed, but per-artifact concurrency (3) is probably fine
          await Promise.all(downloads);
          process.stdout.write(".");
        }
      }
    } catch (e) {
      console.error(`\nError fetching page ${pageNum.toString()} for ${env.name}:`, e instanceof Error ? e.message : e);
    }
  };

  // Page Concurrency Loop
  const ZERO = 0;
  const NOT_FOUND = -1;
  const DELETE_COUNT = 1;

  while (pages.length > ZERO) {
    if (activePagePromises.length < CONCURRENCY_LIMIT) {
      const pageNum = pages.shift();
      if (pageNum !== undefined) {
        const p = processPage(pageNum).then(() => {
          const idx = activePagePromises.indexOf(p);
          if (idx !== NOT_FOUND) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            activePagePromises.splice(idx, DELETE_COUNT);
          }
        });
        activePagePromises.push(p);
      }
    } else {
      await Promise.race(activePagePromises);
    }
  }
  await Promise.all(activePagePromises);
  console.log(`\nCompleted sync for ${env.name}`);
}

async function main() {
  for (const env of ENVIRONMENTS) {
    await syncEnvironment(env);
  }
}

main().catch(console.error);
