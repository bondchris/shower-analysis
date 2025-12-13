import * as fs from "fs";
import * as path from "path";

import { BadScanRecord } from "../../models/badScanRecord";

export function getBadScans(): BadScanRecord[] {
  const BAD_SCANS_FILE = path.join(process.cwd(), "config", "badScans.json");
  try {
    const content = fs.readFileSync(BAD_SCANS_FILE, "utf-8");
    return JSON.parse(content) as BadScanRecord[];
  } catch {
    return [];
  }
}

export function saveBadScans(records: BadScanRecord[]) {
  const BAD_SCANS_FILE = path.join(process.cwd(), "config", "badScans.json");
  const JSON_INDENT = 2;
  fs.writeFileSync(BAD_SCANS_FILE, JSON.stringify(records, null, JSON_INDENT));
}
