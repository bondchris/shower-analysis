import { Surface, SurfaceData } from "./surface";

export interface FloorCategory {
  floor?: Record<string, never>;
}

export interface FloorData extends SurfaceData {
  category: FloorCategory;
}

export class Floor extends Surface {
  public category: FloorCategory;

  constructor(data: FloorData) {
    super(data);
    this.category = data.category;
  }
}
