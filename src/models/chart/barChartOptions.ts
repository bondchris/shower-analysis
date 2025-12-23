export interface BarChartOptions {
  width?: number;
  height?: number;
  horizontal?: boolean;
  totalForPercentages?: number;
  title?: string;
  showCount?: boolean;
  separatorLabel?: string;
  stacked?: boolean;
  stackLabels?: string[];
  stackColors?: string[];
  // For stacked bars: artifact counts per label (for percentage calculation)
  // Maps label to number of artifacts that have this object type
  artifactCountsPerLabel?: Record<string, number>;
}
