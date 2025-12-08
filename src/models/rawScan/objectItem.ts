import { Confidence } from "./confidence";

export interface ObjectCategory {
  toilet?: Record<string, never>;
  storage?: Record<string, never>;
  sink?: Record<string, never>;
  bathtub?: Record<string, never>;
  washerDryer?: Record<string, never>;
  stove?: Record<string, never>;
  table?: Record<string, never>;
  chair?: Record<string, never>;
  bed?: Record<string, never>;
  sofa?: Record<string, never>;
  dishwasher?: Record<string, never>;
  oven?: Record<string, never>;
  refrigerator?: Record<string, never>;
  stairs?: Record<string, never>;
  fireplace?: Record<string, never>;
  television?: Record<string, never>;
}

export interface ObjectItem {
  transform: number[];
  parentIdentifier: string | null;
  dimensions: number[];
  story: number;
  identifier: string;
  attributes: Record<string, string>;
  category: ObjectCategory;
  confidence: Confidence;
}
