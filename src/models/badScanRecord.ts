export interface LegacyBadScanRecord {
  id: string;
  environment: string;
  reason: string;
  date: string;
}

export interface BadScanEntry {
  environment: string;
  reason: string;
  date: string;
}

export type BadScanDatabase = Record<string, BadScanEntry>;
