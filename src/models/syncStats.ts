export interface SyncError {
  id: string;
  reason: string;
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
}
