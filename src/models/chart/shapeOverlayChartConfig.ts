import { SurfaceOutline } from "../shapeOutline";
import { ShapeOverlayChartOptions } from "./shapeOverlayChartOptions";

export interface ShapeOverlayChartConfig {
  type: "shape-overlay";
  shapes: SurfaceOutline[];
  options: ShapeOverlayChartOptions;
  height: number;
}
