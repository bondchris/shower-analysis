import { CameraResolution } from "./cameraResolution";
import { ExifData } from "./exifData";
import { LightEstimate } from "./lightEstimate";

export interface ArFrame {
  cameraResolution: CameraResolution;
  cameraIntrinsics?: number[];
  cameraTransform: number[];
  lightEstimate?: LightEstimate;
  exifData: ExifData;
  timestamp: number;
}
