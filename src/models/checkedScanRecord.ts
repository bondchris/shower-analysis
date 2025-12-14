/**
 * Represents the processing state of a scan.
 * Tracks when a particular scan was last successfully processed or filtered.
 */
export interface CheckedScanEntry {
  cleanedDate?: string;
  filteredDate?: string;
  // (e.g., 'gemini-1.5-pro')
  filteredModel?: string;
}

export type CheckedScanDatabase = Record<string, CheckedScanEntry>;
