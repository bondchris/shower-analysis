import { Confidence } from "./confidence";

export interface DoorCategory {
  door?: { isOpen: boolean };
}

export interface Door {
  polygonCorners: number[][];
  dimensions: number[];
  transform: number[];
  parentIdentifier: string | null;
  story: number;
  identifier: string;
  completedEdges: never[];
  category: DoorCategory;
  curve: null;
  confidence: Confidence;
}
