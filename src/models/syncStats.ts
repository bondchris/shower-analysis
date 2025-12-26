export interface SyncError {
  id: string;
  reason: string;
  date?: string | undefined;
}

export interface SyncStats {
  env: string;
  found: number;
  new: number;
  failed: number;
  skipped: number;
  newFailures: number;
  knownFailures: number;
  errors: SyncError[];
  processedIds: Set<string>;
  videoSize: number;
  arDataSize: number;
  rawScanSize: number;
  newVideoSize: number;
  newArDataSize: number;
  newRawScanSize: number;
  videoHistory: Record<string, { totalSize: number; count: number }>;
  dateMismatches: DateMismatch[];
  duplicates: DuplicateVideo[];
  duplicateCount: number;
  newDuplicateCount: number;
}

export interface DuplicateVideo {
  artifactId: string;
  hash: string;
  duplicateIds: string[];
  environment: string;
  isNew?: boolean;
  scanDate?: string;
}

export interface DateMismatch {
  id: string;
  scanDate: string;
  videoDate: string;
  diffHours: number;
  environment: string;
  isNew?: boolean;
}
