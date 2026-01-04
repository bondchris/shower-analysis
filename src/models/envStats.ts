export interface EnvStats {
  artifactsWithIssues: number;
  artifactsWithWarnings: number;
  invalidScanDateDetails: { id: string; scanDate: string }[];
  errorsByDate: Record<string, number>;
  warningsByDate: Record<string, number>;
  cleanScansByDate: Record<string, number>;
  totalScansByDate: Record<string, number>;
  missingCounts: Record<string, number>;
  warningCounts: Record<string, number>;
  processed: number;
  totalArtifacts: number;
  propertyCounts: Record<string, number>;
  propertyCountsByDate: Record<string, Record<string, number>>;
  missingProjectIdIds: string[];
  missingRequiredArtifacts: { id: string; missingFields: string[] }[];
  name: string;
  pageErrors: Record<number, string>;
}
