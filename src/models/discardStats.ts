export type DiscardStage = "clean" | "filter";

export interface CleanDataStats {
  removedCount: number;
  quarantinedCount: number;
  skippedCleanCount: number;
  failedDeletes: string[];
}

export interface FilterStats {
  errors: number;
  processed: number;
  removed: number;
  skipped: number;
  skippedAmbiguous: number;
  skippedCached: number;
}

export interface DiscardStats {
  clean: CleanDataStats;
  filter: FilterStats;
}

export interface DiscardedArtifact {
  id: string;
  environment: string;
  reason: string;
  stage: DiscardStage;
  date?: string;
}

export interface BadScanHistoryEntry {
  id: string;
  environment: string;
  reason: string;
  scanDate?: string;
}

export interface EnvCounts {
  processed: number;
  validCached: number;
  validNew: number;
  tooShortCached: number;
  tooShortNew: number;
  notBathroomCached: number;
  notBathroomNew: number;
}

export interface DiscardReportInput {
  artifactCount: number;
  artifactsAfterClean: number;
  cleanStats: CleanDataStats;
  badScansByEnv?: Record<string, number>;
  badScanHistory: BadScanHistoryEntry[];
  countsByEnv: Record<string, EnvCounts>;
  discardedOnDiskCount?: number;
  filterStats: FilterStats;
  initialBadScanCount: number;
  finalBadScanCount: number;
  minDuration: number;
  newBadScans: DiscardedArtifact[];
  dryRun: boolean;
}
