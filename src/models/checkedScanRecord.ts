export interface CheckedScanEntry {
  cleanedDate?: string;
  filteredDate?: string;
  filteredModel?: string;
}

export type CheckedScanDatabase = Record<string, CheckedScanEntry>;
