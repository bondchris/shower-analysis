export interface EnvStats {
  artifactsWithIssues: number;
  artifactsWithWarnings: number;
  errorsByDate: Record<string, number>;
  warningsByDate: Record<string, number>;
  cleanScansByDate: Record<string, number>;
  totalScansByDate: Record<string, number>;
  missingCounts: Record<string, number>;
  warningCounts: Record<string, number>;
  processed: number;
  totalArtifacts: number;
  propertyCounts: Record<string, number>;
  name: string;
  pageErrors: Record<number, string>;
}
