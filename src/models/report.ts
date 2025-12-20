export interface ReportSection {
  type: "summary" | "table" | "chart" | "list" | "text" | "header" | "chart-row" | "page-break" | "react-component";
  title?: string;
  level?: number;
  data?: unknown;
  options?: unknown;
  component?: React.ComponentType;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
}
