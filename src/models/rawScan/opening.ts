import { Confidence } from "./confidence";

export interface OpeningCategory {
  opening?: Record<string, never>;
}

export interface Opening {
  polygonCorners?: number[][];
  dimensions?: number[];
  transform?: number[];
  parentIdentifier?: string | null;
  story?: number;
  identifier?: string;
  completedEdges?: never[];
  category?: OpeningCategory;
  confidence?: Confidence;
  curve?: null;
}
