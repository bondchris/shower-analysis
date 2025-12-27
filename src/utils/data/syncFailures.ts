import * as fs from "fs";
import * as path from "path";

export interface SyncFailureRecord {
  date: string;
  environment: string;
  reasons: string[];
}

type RawSyncFailureRecord = Partial<SyncFailureRecord> & { reason?: unknown };

export type SyncFailureDatabase = Record<string, SyncFailureRecord>;

function normalizeRecord(record: RawSyncFailureRecord | undefined | null): SyncFailureRecord | null {
  if (record === undefined || record === null || typeof record !== "object") {
    return null;
  }

  const { date, environment } = record;
  if (typeof date !== "string" || typeof environment !== "string") {
    return null;
  }

  const collectedReasons: string[] = [];

  if (Array.isArray(record.reasons)) {
    record.reasons.forEach((reason) => {
      if (typeof reason === "string") {
        const trimmed = reason.trim();
        if (trimmed !== "") {
          collectedReasons.push(trimmed);
        }
      }
    });
  } else if (typeof record.reason === "string") {
    const trimmed = record.reason.trim();
    if (trimmed !== "") {
      collectedReasons.push(trimmed);
    }
  }

  const uniqueReasons = Array.from(new Set(collectedReasons));

  return {
    date,
    environment,
    reasons: uniqueReasons
  };
}

/**
 * Loads the database of known sync failures.
 * Backed by `config/syncFailures.json` by default.
 */
export function getSyncFailures(filePath?: string): SyncFailureDatabase {
  const FAILURES_FILE = filePath ?? path.join(process.cwd(), "config", "syncFailures.json");
  try {
    const content = fs.readFileSync(FAILURES_FILE, "utf-8");
    const json: unknown = JSON.parse(content);
    const normalized: SyncFailureDatabase = {};

    if (json !== null && typeof json === "object") {
      Object.entries(json as Record<string, RawSyncFailureRecord>).forEach(([id, value]) => {
        const record = normalizeRecord(value);
        if (record !== null) {
          normalized[id] = record;
        }
      });
    }

    return normalized;
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
  sortedKeys.forEach((key) => {
    const normalized = normalizeRecord(database[key]);
    if (normalized !== null) {
      sortedDatabase[key] = normalized;
    }
  });

  // Ensure directory exists (though config/ should exist)
  const dir = path.dirname(FAILURES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(FAILURES_FILE, JSON.stringify(sortedDatabase, null, JSON_INDENT));
}
