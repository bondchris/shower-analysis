import { Confidence } from "./confidence";

export interface WindowCategory {
  window?: Record<string, never>;
}

export interface Window {
  polygonCorners: number[][];
  dimensions: number[];
  transform: number[];
  parentIdentifier: string | null;
  story: number;
  identifier: string;
  completedEdges: never[];
  category: WindowCategory;
  curve: null;
  confidence: Confidence;
}
