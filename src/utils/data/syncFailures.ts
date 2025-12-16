import * as fs from "fs";
import * as path from "path";

export interface SyncFailureRecord {
  date: string;
  environment: string;
  reason: string;
}

export type SyncFailureDatabase = Record<string, SyncFailureRecord>;

/**
 * Loads the database of known sync failures.
 * Backed by `config/syncFailures.json` by default.
 */
export function getSyncFailures(filePath?: string): SyncFailureDatabase {
  const FAILURES_FILE = filePath ?? path.join(process.cwd(), "config", "syncFailures.json");
  try {
    const content = fs.readFileSync(FAILURES_FILE, "utf-8");
    const json: unknown = JSON.parse(content);
    return json as SyncFailureDatabase;
  } catch {
    return {};
  }
}

export function saveSyncFailures(database: SyncFailureDatabase, filePath?: string) {
  const FAILURES_FILE = filePath ?? path.join(process.cwd(), "config", "syncFailures.json");
  const JSON_INDENT = 2;

  // deterministic sort by ID
  const sortedKeys = Object.keys(database).sort();
  const sortedDatabase: SyncFailureDatabase = {};
  for (const key of sortedKeys) {
    const val = database[key];
    if (val !== undefined) {
      sortedDatabase[key] = val;
    }
  }

  // Ensure directory exists (though config/ should exist)
  const dir = path.dirname(FAILURES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(FAILURES_FILE, JSON.stringify(sortedDatabase, null, JSON_INDENT));
}
