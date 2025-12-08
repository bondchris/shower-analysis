import { Confidence } from "./confidence";

export interface FloorCategory {
  floor?: Record<string, never>;
}

export interface Floor {
  polygonCorners: number[][];
  confidence: Confidence;
  parentIdentifier: string | null;
  category: FloorCategory;
  dimensions: number[];
  transform?: number[];
  story?: number;
  identifier?: string;
  completedEdges?: never[];
  curve?: null;
}
