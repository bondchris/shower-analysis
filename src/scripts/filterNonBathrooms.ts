import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

import { GeminiService } from "../services/geminiService";
import { getBadScans, saveBadScans } from "../utils/data/badScans";
import { getCheckedScans, saveCheckedScans } from "../utils/data/checkedScans";

dotenv.config();

function findArtifactDirectories(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (fs.existsSync(path.join(fullPath, "meta.json"))) {
        results.push(fullPath);
      } else {
        results.push(...findArtifactDirectories(fullPath));
      }
    }
  }
  return results;
}

async function processArtifact(
  dir: string,
  service: GeminiService,
  badScanIds: Set<string>,
  badScans: ReturnType<typeof getBadScans>,
  checkedScanIds: Set<string>,
  checkedScans: ReturnType<typeof getCheckedScans>
): Promise<{ processed: number; removed: number; skipped: number }> {
  let processed = 0;
  let removed = 0;
  const skipped = 0;
  const artifactId = path.basename(dir);

  // Skip if we already know it's bad
  if (badScanIds.has(artifactId)) {
    return { processed, removed, skipped };
  }

  // Skip if we already checked it and it was good
  if (checkedScanIds.has(artifactId)) {
    return { processed, removed, skipped: 1 };
  }

  const videoPath = path.join(dir, "video.mp4");
  if (!fs.existsSync(videoPath)) {
    return { processed, removed, skipped };
  }

  const parentDir = path.dirname(dir);
  const environment = path.basename(parentDir);

  console.log(`Checking ${artifactId} [${environment}]...`);

  try {
    const videoBuffer = fs.readFileSync(videoPath);
    const prompt = "Is this video showing a bathroom? Reply YES or NO.";

    const text = (
      await service.generateContent(prompt, [
        {
          inlineData: {
            data: videoBuffer.toString("base64"),
            mimeType: "video/mp4"
          }
        }
      ])
    )
      .trim()
      .toUpperCase();

    console.log(`  -> ${artifactId}: Gemini says: ${text}`);

    if (text.includes("NO")) {
      console.log(`  -> ${artifactId}: NOT A BATHROOM. Removing...`);

      badScans.push({
        date: new Date().toISOString(),
        environment,
        id: artifactId,
        reason: `Not a bathroom (Gemini gemini-3-pro-preview)`
      });
      badScanIds.add(artifactId);

      try {
        fs.rmSync(dir, { force: true, recursive: true });
        removed++;
      } catch (e) {
        console.error(`  -> ${artifactId}: Failed to delete: ${String(e)}`);
      }
    } else {
      console.log(`  -> ${artifactId}: Kept.`);
      checkedScans.push({
        date: new Date().toISOString(),
        id: artifactId,
        model: "gemini-3-pro-preview"
      });
      checkedScanIds.add(artifactId);
    }

    processed++;
  } catch (err) {
    console.error(`  -> ${artifactId}: Error processing video: ${String(err)}`);
  }

  return { processed, removed, skipped };
}

async function main() {
  const CONCURRENCY = 16;
  const service = new GeminiService();

  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");

  const artifactDirs = findArtifactDirectories(DATA_DIR);
  console.log(`Found ${artifactDirs.length.toString()} artifacts.`);

  const badScans = getBadScans();
  const badScanIds = new Set(badScans.map((b) => b.id));

  const checkedScans = getCheckedScans();
  const checkedScanIds = new Set(checkedScans.map((c) => c.id));

  console.log(`Loaded ${checkedScans.length.toString()} checked scans.`);

  let totalProcessed = 0;
  let totalRemoved = 0;
  let totalSkipped = 0;

  // Process in chunks/queue
  const queue = [...artifactDirs];
  const QUEUE_EMPTY = 0;
  const workers = Array(CONCURRENCY)
    .fill(null)
    .map(async () => {
      while (queue.length > QUEUE_EMPTY) {
        const dir = queue.shift();
        if (dir !== undefined) {
          const { processed, removed, skipped } = await processArtifact(
            dir,
            service,
            badScanIds,
            badScans,
            checkedScanIds,
            checkedScans
          );
          totalProcessed += processed;
          totalRemoved += removed;
          totalSkipped += skipped;
        }
      }
    });

  await Promise.all(workers);

  saveBadScans(badScans);
  saveCheckedScans(checkedScans);
  console.log(
    `\nScan complete. Processed ${totalProcessed.toString()}. Removed ${totalRemoved.toString()}. Skipped ${totalSkipped.toString()} (Cached).`
  );
}

main().catch(console.error);
