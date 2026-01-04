export type DiscardStage = "clean" | "filter" | "duplicates";

export interface DateMismatch {
  id: string;
  scanDate: string;
  videoDate: string;
  diffHours: number;
  environment: string;
  isNew?: boolean;
}

export interface VideoHeaderAnomaly {
  id: string;
  environment: string;
  isNew?: boolean;
}

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

export interface DuplicateStats {
  processed: number;
  duplicateCount: number;
  newDuplicateCount: number;
  skippedCached: number;
  errors: number;
}

export interface DuplicateVideo {
  artifactId: string;
  hash: string;
  duplicateIds: string[];
  environment: string;
  isNew?: boolean;
  scanDate?: string;
}

export interface DiscardStats {
  clean: CleanDataStats;
  filter: FilterStats;
  duplicates: DuplicateStats;
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
  duplicateCached: number;
  duplicateNew: number;
}

export interface DiscardReportInput {
  artifactCount: number;
  artifactsAfterClean: number;
  cleanStats: CleanDataStats;
  badScansByEnv?: Record<string, number>;
  badScanHistory: BadScanHistoryEntry[];
  countsByEnv: Record<string, EnvCounts>;
  dateMismatches: DateMismatch[];
  videoHeaderAnomalies: VideoHeaderAnomaly[];
  discardedOnDiskCount?: number;
  filterStats: FilterStats;
  duplicateStats: DuplicateStats;
  duplicates: DuplicateVideo[];
  initialBadScanCount: number;
  finalBadScanCount: number;
  minDuration: number;
  newBadScans: DiscardedArtifact[];
  dryRun: boolean;
}
