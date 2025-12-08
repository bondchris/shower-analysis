import { ArFrame } from "./arFrame";

export * from "./arFrame";
export * from "./cameraResolution";
export * from "./exifData";
export * from "./lightEstimate";

export interface ArDataContent {
  data: Record<string, ArFrame>;
}

interface UnsafeCameraResolution {
  width?: unknown;
  height?: unknown;
}

interface UnsafeLightEstimate {
  ambientIntensity?: unknown;
  ambientColorTemperature?: unknown;
}

interface UnsafeArFrame {
  cameraResolution?: UnsafeCameraResolution | null;
  cameraTransform?: unknown;
  lightEstimate?: UnsafeLightEstimate | null;
  exifData?: unknown;
  timestamp?: unknown;
}

export class ArData {
  public data: Record<string, ArFrame>;

  constructor(json: unknown) {
    const TRANSFORM_LENGTH = 16;
    if (typeof json !== "object" || json === null) {
      throw new Error("Invalid ArData: must be an object");
    }

    if ((json as { data?: unknown }).data === undefined || typeof (json as { data: unknown }).data !== "object") {
      throw new Error("Invalid ArData: missing 'data' object");
    }

    const typedJson = json as ArDataContent;
    this.data = typedJson.data;

    const entries = Object.entries(this.data);
    for (const [key, frame] of entries) {
      // Validate Timestamp Key
      if (isNaN(parseFloat(key))) {
        throw new Error(`Invalid ArData: key "${key}" is not a valid timestamp/number`);
      }

      // Validate Frame Object
      if (typeof frame !== "object" || (frame as unknown) === null) {
        throw new Error(`Invalid ArData: frame "${key}" is not an object`);
      }

      const unsafeFrame = frame as unknown as UnsafeArFrame;

      // Validate CameraResolution
      if (
        typeof unsafeFrame.cameraResolution !== "object" ||
        unsafeFrame.cameraResolution === null ||
        typeof unsafeFrame.cameraResolution.width !== "number" ||
        typeof unsafeFrame.cameraResolution.height !== "number"
      ) {
        throw new Error(`Invalid ArData: frame "${key}" has invalid cameraResolution`);
      }

      // Validate CameraTransform
      if (!Array.isArray(unsafeFrame.cameraTransform) || unsafeFrame.cameraTransform.length !== TRANSFORM_LENGTH) {
        throw new Error(
          `Invalid ArData: frame "${key}" has invalid cameraTransform (must be ${TRANSFORM_LENGTH.toString()}-element array)`
        );
      }

      // Validate LightEstimate (Optional)
      if (unsafeFrame.lightEstimate !== undefined && unsafeFrame.lightEstimate !== null) {
        if (
          typeof unsafeFrame.lightEstimate !== "object" ||
          typeof unsafeFrame.lightEstimate.ambientIntensity !== "number" ||
          typeof unsafeFrame.lightEstimate.ambientColorTemperature !== "number"
        ) {
          throw new Error(`Invalid ArData: frame "${key}" has invalid lightEstimate`);
        }
      }

      // Validate ExifData
      if (typeof unsafeFrame.exifData !== "object" || unsafeFrame.exifData === null) {
        throw new Error(`Invalid ArData: frame "${key}" has invalid exifData`);
      }

      // Validate Timestamp
      if (typeof unsafeFrame.timestamp !== "number") {
        throw new Error(`Invalid ArData: frame "${key}" has invalid timestamp`);
      }
    }
  }
}
