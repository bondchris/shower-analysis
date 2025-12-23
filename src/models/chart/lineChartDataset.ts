export interface LineChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth?: number;
  fill?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: "vertical" | "horizontal";
}
