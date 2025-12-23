import React from "react";

export interface PieChartOptions {
  width?: number;
  height?: number;
  title?: string;
  colors?: string[];
  legendIcons?: Record<string, string>; // Map of label to SVG file path
  legendIconComponents?: Record<
    string,
    React.ComponentType<{ color: string; x: number; y: number; legendBoxSize: number }>
  >; // Map of label to icon component
}
