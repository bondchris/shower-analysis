export interface ReportSection {
  type: "summary" | "table" | "chart" | "list" | "text" | "header" | "chart-row";
  title?: string;
  level?: number;
  data?: unknown;
  options?: unknown;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
}
