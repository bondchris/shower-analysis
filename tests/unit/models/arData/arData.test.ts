import { describe, expect, it } from "vitest";

import { ArData } from "../../../../src/models/arData/arData";

describe("ArData Model", () => {
  const VALID_TRANSFORM = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const VALID_FRAME = {
    cameraResolution: { height: 1920, width: 1080 },
    cameraTransform: VALID_TRANSFORM,
    exifData: { aperture: 1.8 },
    lightEstimate: { ambientColorTemperature: 6500, ambientIntensity: 1000 },
    timestamp: 1234567890
  };

  const VALID_PAYLOAD = {
    data: {
      "1234567890": VALID_FRAME
    }
  };

  describe("Happy Path", () => {
    it("should instantiate successfully with valid data", () => {
      const arData = new ArData(VALID_PAYLOAD);
      expect(arData.data).toBeDefined();
      expect(Object.keys(arData.data)).toHaveLength(1);
    });

    it("should allow missing lightEstimate", () => {
      const payload = {
        data: {
          "1234567890": {
            ...VALID_FRAME,
            lightEstimate: undefined
          }
        }
      };
      const arData = new ArData(payload);
      expect(arData.data["1234567890"]?.lightEstimate).toBeUndefined();
    });
  });

  describe("Top-level Validation", () => {
    it("should throw if input is not an object", () => {
      expect(() => new ArData(null)).toThrow("Invalid ArData: must be an object");
      expect(() => new ArData("string")).toThrow("Invalid ArData: must be an object");
      expect(() => new ArData(123)).toThrow("Invalid ArData: must be an object");
    });

    it("should throw if 'data' property is missing or not an object", () => {
      expect(() => new ArData({})).toThrow("Invalid ArData: missing 'data' object");
      expect(() => new ArData({ data: "invalid" })).toThrow("Invalid ArData: missing 'data' object");
    });
  });

  describe("Frame Key Validation", () => {
    it("should throw if keys are not numeric timestamps", () => {
      const payload = {
        data: {
          "not-a-number": VALID_FRAME
        }
      };
      expect(() => new ArData(payload)).toThrow('Invalid ArData: key "not-a-number" is not a valid timestamp/number');
    });
  });

  describe("Frame Structure Validation", () => {
    it("should throw if frame is not an object", () => {
      const payload = {
        data: {
          "1234567890": "not-an-object"
        }
      };
      expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" is not an object');
    });

    it("should throw if frame is null", () => {
      const payload = {
        data: {
          "1234567890": null
        }
      };
      expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" is not an object');
    });
  });

  describe("Component Validation", () => {
    describe("CameraResolution", () => {
      it("should throw on missing cameraResolution", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, cameraResolution: undefined }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid cameraResolution');
      });

      it("should throw on invalid format (not object)", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, cameraResolution: "bad" }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid cameraResolution');
      });

      it("should throw on missing width/height", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, cameraResolution: { width: 100 } } // Missing height
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid cameraResolution');
      });
    });

    describe("CameraTransform", () => {
      it("should throw if not an array", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, cameraTransform: "not-array" }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid cameraTransform');
      });

      it("should throw if array length is incorrect", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, cameraTransform: [1, 2, 3] }
          }
        };
        expect(() => new ArData(payload)).toThrow("invalid cameraTransform (must be 16-element array)");
      });
    });

    describe("LightEstimate", () => {
      it("should throw if present but invalid structure", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, lightEstimate: "bad" }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid lightEstimate');
      });

      it("should throw if properties missing", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, lightEstimate: { ambientIntensity: 100 } }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid lightEstimate');
      });
    });

    describe("ExifData", () => {
      it("should throw on invalid ExifData", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, exifData: null }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid exifData');
      });
    });

    describe("Timestamp", () => {
      it("should throw if timestamp property is missing or not a number", () => {
        const payload = {
          data: {
            "1234567890": { ...VALID_FRAME, timestamp: "string" }
          }
        };
        expect(() => new ArData(payload)).toThrow('Invalid ArData: frame "1234567890" has invalid timestamp');
      });
    });
  });
});
