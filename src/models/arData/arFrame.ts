import { CameraResolution } from "./cameraResolution";
import { ExifData } from "./exifData";
import { LightEstimate } from "./lightEstimate";

export interface ArFrame {
  cameraResolution: CameraResolution;
  cameraTransform: number[];
  lightEstimate?: LightEstimate;
  exifData: ExifData;
  timestamp: number;
}
