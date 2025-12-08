import { Confidence } from "./confidence";

export interface WallCategory {
  wall?: Record<string, never>;
}

export interface Wall {
  polygonCorners: number[][];
  dimensions: number[];
  transform: number[];
  parentIdentifier: string | null;
  story: number;
  identifier: string;
  completedEdges: never[];
  category: WallCategory;
  curve: null;
  confidence: Confidence;
}
