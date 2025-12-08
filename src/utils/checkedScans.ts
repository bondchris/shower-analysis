import * as fs from "fs";
import * as path from "path";

import { CheckedScanRecord } from "../models/checkedScanRecord";

export function getCheckedScans(): CheckedScanRecord[] {
  const CHECKED_SCANS_FILE = path.join(process.cwd(), "config", "checkedScans.json");
  try {
    const content = fs.readFileSync(CHECKED_SCANS_FILE, "utf-8");
    return JSON.parse(content) as CheckedScanRecord[];
  } catch {
    return [];
  }
}

export function saveCheckedScans(records: CheckedScanRecord[]) {
  const CHECKED_SCANS_FILE = path.join(process.cwd(), "config", "checkedScans.json");
  const JSON_INDENT = 2;
  fs.writeFileSync(CHECKED_SCANS_FILE, JSON.stringify(records, null, JSON_INDENT));
}
