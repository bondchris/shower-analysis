import { Confidence } from "./confidence";

export interface SurfaceData {
  polygonCorners: number[][];
  confidence: Confidence;
  parentIdentifier: string | null;
  dimensions: number[];
  transform?: number[];
  story?: number;
  identifier?: string;
  completedEdges?: never[];
  curve?: unknown;
}

export abstract class Surface {
  public polygonCorners?: number[][];
  public confidence: Confidence;
  public parentIdentifier: string | null;
  public dimensions?: number[];
  public transform?: number[];
  public story?: number;
  public identifier?: string;
  public completedEdges?: never[];
  public curve?: unknown;

  constructor(data: SurfaceData) {
    this.polygonCorners = data.polygonCorners;
    this.confidence = data.confidence;
    this.parentIdentifier = data.parentIdentifier;
    this.dimensions = data.dimensions;
    if (data.transform !== undefined) {
      this.transform = data.transform;
    }
    if (data.story !== undefined) {
      this.story = data.story;
    }
    if (data.identifier !== undefined) {
      this.identifier = data.identifier;
    }
    if (data.completedEdges !== undefined) {
      this.completedEdges = data.completedEdges;
    }
    if (data.curve !== undefined) {
      this.curve = data.curve;
    }
  }

  get area(): number {
    const MIN_CORNERS = 3;
    const INDEX_X = 0;
    const INDEX_Y = 1;
    const DIVISOR = 2.0;
    const INITIAL_COUNT = 0;
    const NEXT_OFFSET = 1;
    const DIMENSIONS_LENGTH = 3;

    if (
      this.polygonCorners !== undefined &&
      Array.isArray(this.polygonCorners) &&
      this.polygonCorners.length >= MIN_CORNERS
    ) {
      let area = INITIAL_COUNT;
      const corners = this.polygonCorners;
      for (let i = INITIAL_COUNT; i < corners.length; i++) {
        const j = (i + NEXT_OFFSET) % corners.length;
        const p1 = corners[i];
        const p2 = corners[j];
        if (p1 !== undefined && p2 !== undefined && p1.length >= MIN_CORNERS && p2.length >= MIN_CORNERS) {
          const x1 = p1[INDEX_X];
          const y1 = p1[INDEX_Y];
          const x2 = p2[INDEX_X];
          const y2 = p2[INDEX_Y];
          if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
            area += x1 * y2;
            area -= x2 * y1;
          }
        }
      }
      return Math.abs(area) / DIVISOR;
    } else if (
      this.dimensions !== undefined &&
      Array.isArray(this.dimensions) &&
      this.dimensions.length === DIMENSIONS_LENGTH
    ) {
      const dimX = this.dimensions[INDEX_X];
      const dimY = this.dimensions[INDEX_Y];
      if (dimX !== undefined && dimY !== undefined) {
        return dimX * dimY;
      }
    }
    return INITIAL_COUNT;
  }
}
