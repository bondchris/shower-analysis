import * as fs from "fs";
import * as path from "path";

function findArDataFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findArDataFiles(fullPath));
    } else if (file === "arData.json") {
      results.push(fullPath);
    }
  }
  return results;
}

interface ArData {
  data?: Record<string, unknown>;
}

function main() {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const JSON_INDENT = 2;
  const UPDATE_INTERVAL = 10;
  const INITIAL_COUNT = 0;

  console.log("Finding arData.json files...");
  const files = findArDataFiles(DATA_DIR);
  console.log(`Found ${files.length.toString()} files.`);

  let processed = 0;
  for (const file of files) {
    try {
      const newPath = path.join(path.dirname(file), "arDataFormatted.json");
      if (fs.existsSync(newPath)) {
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      const json = JSON.parse(content) as ArData;

      if (json.data === undefined) {
        // Skip valid check or warn? assuming valid structure if it parses
        continue;
      }

      // Sort keys
      const sortedKeys = Object.keys(json.data).sort((a, b) => parseFloat(a) - parseFloat(b));
      const sortedData: Record<string, unknown> = {};
      for (const key of sortedKeys) {
        sortedData[key] = json.data[key];
      }

      const newJson = {
        ...json,
        data: sortedData
      };

      fs.writeFileSync(newPath, JSON.stringify(newJson, null, JSON_INDENT));
      processed++;

      if (processed % UPDATE_INTERVAL === INITIAL_COUNT) {
        process.stdout.write(".");
      }
    } catch (e) {
      console.error(`\nFailed to process ${file}:`, e);
    }
  }

  console.log(`\nSorted ${processed.toString()} files. Skipped ${(files.length - processed).toString()} existing.`);
}

main();
