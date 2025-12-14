import * as fs from "fs";
import * as path from "path";

import { BadScanDatabase, LegacyBadScanRecord } from "../../models/badScanRecord";

export function getBadScans(): BadScanDatabase {
  const BAD_SCANS_FILE = path.join(process.cwd(), "config", "badScans.json");
  try {
    const content = fs.readFileSync(BAD_SCANS_FILE, "utf-8");
    const json: unknown = JSON.parse(content);

    if (Array.isArray(json)) {
      const database: BadScanDatabase = {};
      const legacyRecords = json as LegacyBadScanRecord[];
      for (const record of legacyRecords) {
        database[record.id] = {
          date: record.date,
          environment: record.environment,
          reason: record.reason
        };
      }
      return database;
    }

    return json as BadScanDatabase;
  } catch {
    return {};
  }
}

export function saveBadScans(database: BadScanDatabase) {
  const BAD_SCANS_FILE = path.join(process.cwd(), "config", "badScans.json");
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
