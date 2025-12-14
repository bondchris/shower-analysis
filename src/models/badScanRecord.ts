/**
 * Represents a scan explicitly marked as invalid or problematic.
 */
export interface BadScanEntry {
  // (e.g., 'production', 'staging').
  environment: string;
  reason: string;
  date: string;
}

export type BadScanDatabase = Record<string, BadScanEntry>;
