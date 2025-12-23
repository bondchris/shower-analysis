export interface MixedChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth?: number;
  backgroundColor?: string;
  type?: "line" | "bar";
  yAxisID?: string;
  fill?: boolean;
  order?: number;
}
