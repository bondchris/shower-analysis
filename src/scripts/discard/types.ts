import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { BadScanDatabase } from "../../models/badScanRecord";
import { CheckedScanDatabase } from "../../models/checkedScanRecord";
import { GeminiService } from "../../services/geminiService";
import {
  BlackFrameFinding,
  CleanDataStats,
  DateMismatch,
  DuplicateStats,
  DuplicateVideo,
  FilterStats,
  VideoHeaderAnomaly
} from "../../models/discardStats";
import { VideoHashDatabase } from "../../utils/data/videoHashes";

export interface CleanDataOptions {
  dataDir?: string;
  badScansFile?: string;
  checkedScansFile?: string;
  dryRun?: boolean;
  quarantineDir?: string;
  minDuration?: number;
  now?: () => Date;
  logger?: (msg: string) => void;
  fs?: Pick<
    typeof fs,
    "existsSync" | "readdirSync" | "statSync" | "renameSync" | "mkdirSync" | "rmSync" | "writeFileSync"
  >;
  ffprobe?: typeof ffmpeg.ffprobe;
}

export interface FilterOptions {
  concurrency?: number;
  dryRun?: boolean;
}

export interface DiscardConfig {
  dataDir: string;
  badScansFile?: string;
  checkedScansFile?: string;
  videoHashesFile?: string;
  saveResults: boolean;
  dryRun: boolean;
  concurrency: number;
  minDuration: number;
  quarantineDir?: string;
  now?: () => Date;
  logger?: (msg: string) => void;
  fs?: Pick<
    typeof fs,
    "existsSync" | "readdirSync" | "statSync" | "renameSync" | "mkdirSync" | "rmSync" | "writeFileSync"
  >;
  ffprobe?: typeof ffmpeg.ffprobe;
  service?: GeminiService;
}

export interface DiscardDatabases {
  badScans: BadScanDatabase;
  checkedScans: CheckedScanDatabase;
}

export interface CleanPhaseOptions extends CleanDataOptions {
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  saveResults?: boolean;
}

export interface CleanPhaseResult {
  stats: CleanDataStats;
  databases: DiscardDatabases;
  remainingArtifacts: string[];
}

export interface FilterPhaseOptions extends FilterOptions {
  dataDir?: string;
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  badScansFile?: string;
  checkedScansFile?: string;
  service?: GeminiService;
  saveInterval?: number;
  saveResults?: boolean;
}

export interface FilterPhaseResult {
  stats: FilterStats;
  databases: DiscardDatabases;
  processedArtifacts: string[];
}

export interface DuplicatesPhaseOptions {
  dataDir?: string;
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  videoHashes?: VideoHashDatabase;
  badScansFile?: string;
  videoHashesFile?: string;
  dryRun?: boolean;
  saveResults?: boolean;
}

export interface DuplicatesPhaseResult {
  stats: DuplicateStats;
  databases: DiscardDatabases;
  videoHashes: VideoHashDatabase;
  duplicates: DuplicateVideo[];
  remainingArtifacts: string[];
}

export interface MismatchStats {
  processed: number;
  mismatchCount: number;
  newMismatchCount: number;
  skippedCached: number;
  headerAnomalyCount: number;
  newHeaderAnomalyCount: number;
  blackFrameCount: number;
  newBlackFrameCount: number;
  errors: number;
}

export interface MismatchPhaseOptions {
  dataDir?: string;
  artifactDirs?: string[];
  databases?: DiscardDatabases;
  checkedScansFile?: string;
  dryRun?: boolean;
  saveResults?: boolean;
}

export interface MismatchPhaseResult {
  stats: MismatchStats;
  databases: DiscardDatabases;
  dateMismatches: DateMismatch[];
  videoHeaderAnomalies: VideoHeaderAnomaly[];
  blackFrameFindings: BlackFrameFinding[];
}

export interface DiscardOptions
  extends CleanPhaseOptions, FilterPhaseOptions, DuplicatesPhaseOptions, MismatchPhaseOptions {
  skipClean?: boolean;
  skipFilter?: boolean;
  skipDuplicates?: boolean;
  skipMismatch?: boolean;
}
