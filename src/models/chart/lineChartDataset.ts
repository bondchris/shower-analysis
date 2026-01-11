export interface LineChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  borderWidth?: number;
  fill?: boolean;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientStops?: { offset: number; color: string }[];
  gradientDirection?: "vertical" | "horizontal";
  verticalLines?: boolean;
}
