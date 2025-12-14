import * as fs from "fs";
import * as path from "path";

import { CheckedScanDatabase } from "../../models/checkedScanRecord";

// Legacy interface for migration
interface LegacyCheckedScanRecord {
  id: string;
  date: string;
  model?: string;
  type?: "bathroom" | "clean";
}

export function getCheckedScans(): CheckedScanDatabase {
  const CHECKED_SCANS_FILE = path.join(process.cwd(), "config", "checkedScans.json");
  try {
    const content = fs.readFileSync(CHECKED_SCANS_FILE, "utf-8");
    const json: unknown = JSON.parse(content);

    if (Array.isArray(json)) {
      // Migrate legacy array to new object structure
      const database: CheckedScanDatabase = {};
      const legacyRecords = json as LegacyCheckedScanRecord[];

      for (const record of legacyRecords) {
        let entry = database[record.id];
        if (entry === undefined) {
          entry = {};
          database[record.id] = entry;
        }

        if (record.type === "clean") {
          entry.cleanedDate = record.date;
        } else {
          // Default to 'bathroom' filter check if type is missing or 'bathroom'
          entry.filteredDate = record.date;
          if (record.model !== undefined && record.model !== "") {
            entry.filteredModel = record.model;
          }
        }
      }
      return database;
    }

    return json as CheckedScanDatabase;
  } catch {
    return {};
  }
}

export function saveCheckedScans(database: CheckedScanDatabase) {
  const CHECKED_SCANS_FILE = path.join(process.cwd(), "config", "checkedScans.json");
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
