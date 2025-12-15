import * as fs from "fs";
import * as path from "path";

import { BadScanDatabase } from "../../models/badScanRecord";

/**
 * Loads the database of "Bad Scans" (previously flagged artifacts to exclude).
 * Backed by `config/badScans.json` by default.
 */
export function getBadScans(filePath?: string): BadScanDatabase {
  const BAD_SCANS_FILE = filePath ?? path.join(process.cwd(), "config", "badScans.json");
  try {
    const content = fs.readFileSync(BAD_SCANS_FILE, "utf-8");
    const json: unknown = JSON.parse(content);
    return json as BadScanDatabase;
  } catch {
    return {};
  }
}

export function saveBadScans(database: BadScanDatabase, filePath?: string) {
  const BAD_SCANS_FILE = filePath ?? path.join(process.cwd(), "config", "badScans.json");
  const JSON_INDENT = 2;

  // deterministic sort
  const sortedKeys = Object.keys(database).sort();
  const sortedDatabase: BadScanDatabase = {};
  for (const key of sortedKeys) {
    const val = database[key];
    if (val !== undefined) {
      sortedDatabase[key] = val;
    }
  }

  fs.writeFileSync(BAD_SCANS_FILE, JSON.stringify(sortedDatabase, null, JSON_INDENT));
}
