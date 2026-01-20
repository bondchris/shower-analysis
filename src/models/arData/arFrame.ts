import { Matrix16 } from "../../utils/math/transform";
import { Intrinsics9 } from "./cameraIntrinsics";
import { CameraResolution } from "./cameraResolution";
import { ExifData } from "./exifData";
import { LightEstimate } from "./lightEstimate";

export interface ArFrame {
  cameraResolution: CameraResolution;
  cameraIntrinsics?: Intrinsics9;
  cameraTransform: Matrix16;
  lightEstimate?: LightEstimate;
  exifData: ExifData;
  timestamp: number;
}
