import { Surface, SurfaceData } from "./surface";

export interface WallCategory {
  wall?: Record<string, never>;
}

export interface WallData extends SurfaceData {
  category: WallCategory;
}

export class Wall extends Surface {
  public category: WallCategory;

  constructor(data: WallData) {
    super(data);
    this.category = data.category;
  }
}
