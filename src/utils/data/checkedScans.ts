import * as fs from "fs";
import * as path from "path";

import { CheckedScanDatabase } from "../../models/checkedScanRecord";

/**
 * Loads the database of "Checked Scans" (previously verified artifacts).
 * Backed by `config/checkedScans.json` by default.
 * Used to track review progress and filter already-reviewed items.
 */
export function getCheckedScans(filePath?: string): CheckedScanDatabase {
  const CHECKED_SCANS_FILE = filePath ?? path.join(process.cwd(), "config", "checkedScans.json");
  try {
    const content = fs.readFileSync(CHECKED_SCANS_FILE, "utf-8");
    const json: unknown = JSON.parse(content);

    return json as CheckedScanDatabase;
  } catch {
    return {};
  }
}

export function saveCheckedScans(database: CheckedScanDatabase, filePath?: string) {
  const CHECKED_SCANS_FILE = filePath ?? path.join(process.cwd(), "config", "checkedScans.json");
  const JSON_INDENT = 2;
  // Use a sorted version of keys for deterministic output if possible, but JSON.stringify doesn't guarantee order.
  // For better diffs, we could sort keys.
  const sortedKeys = Object.keys(database).sort();
  const sortedDatabase: CheckedScanDatabase = {};
  for (const key of sortedKeys) {
    const val = database[key];
    if (val !== undefined) {
      sortedDatabase[key] = val;
    }
  }
  fs.writeFileSync(CHECKED_SCANS_FILE, JSON.stringify(sortedDatabase, null, JSON_INDENT));
}
