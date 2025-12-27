import fs from "fs";
import path from "path";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArDataMetadata, extractArDataMetadata } from "../../../../src/utils/arData/metadata";

// Mock module
vi.mock("fs");

describe("extractArDataMetadata", () => {
  const mockDir = "/mock/dir";
  const mockArDataPath = path.join(mockDir, "arData.json");
  const mockCachePath = path.join(mockDir, "arDataMetadata.json");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return cached metadata if it exists and is valid", () => {
    const cachedData: ArDataMetadata = {
      avgAmbientIntensity: 500,
      avgBrightness: 3.5,
      avgColorTemperature: 4000,
      avgIso: 100,
      deviceModel: "Test Device",
      lensAperture: "f/1.8",
      lensFocalLength: "26mm",
      lensModel: "Test Lens"
    };

    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(cachedData));

    const result = extractArDataMetadata(mockDir);

    expect(result).toEqual(cachedData);
  });

  it("should ignore stale cache if deviceModel is missing and re-extract", () => {
    // Stale cache (missing deviceModel)
    const staleData = {
      avgAmbientIntensity: 500,
      lensModel: "Test Lens"
    };

    (fs.existsSync as Mock).mockImplementation((p) => {
      if (p === mockCachePath || p === mockArDataPath) {
        return true;
      }
      return false;
    });

    (fs.readFileSync as Mock).mockImplementation((p) => {
      if (p === mockCachePath) {
        return JSON.stringify(staleData);
      }
      if (p === mockArDataPath) {
        // Mock minimal valid ArData to allow extraction
        return JSON.stringify({
          data: {
            "1": {
              cameraResolution: { height: 100, width: 100 },
              cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
              exifData: { LensModel: "New Device front" },
              timestamp: 1
            }
          }
        });
      }
      return "";
    });

    const result = extractArDataMetadata(mockDir);
    expect(result?.deviceModel).toBe("New Device");
  });

  it("should extract metadata from arData.json if cache is missing", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockCachePath) {
        return false;
      }
      if (p === mockArDataPath) {
        return true;
      }
      return false;
    });

    const richArData = {
      data: {
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            BrightnessValue: "2.5",
            FNumber: "1.6",
            FocalLength: "5.1 mm",
            ISOSpeedRatings: "125",
            LensModel: "iPhone 12 Pro back triple camera 5.1mm f/1.6"
          },
          lightEstimate: {
            ambientColorTemperature: 3000,
            ambientIntensity: 1000
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(richArData));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.avgAmbientIntensity).toBe(1000);
      expect(result.lensModel).toBe("iPhone 12 Pro back triple camera 5.1mm f/1.6");
      // Parsed fields
      expect(result.deviceModel).toBe("iPhone 12 Pro");
      expect(result.lensFocalLength).toBe("5.1 mm");
      expect(result.lensAperture).toBe("f/1.6");
    }
  });

  it("should handle minimal lens model string", () => {
    (fs.existsSync as Mock).mockReturnValue(true); // For arData
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const simpleData = {
      data: {
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            LensModel: "iPad Pro"
          },
          timestamp: 1
        }
      }
    };
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(simpleData));
    const result = extractArDataMetadata(mockDir);

    expect(result?.deviceModel).toBe("iPad Pro");
  });

  it("should return null if arData.json does not exist", () => {
    (fs.existsSync as Mock).mockReturnValue(false);
    const result = extractArDataMetadata(mockDir);
    expect(result).toBeNull();
  });

  it("should return null if parsing fails/ArData throws", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);
    (fs.readFileSync as Mock).mockReturnValue("INVALID JSON");

    const result = extractArDataMetadata(mockDir);
    expect(result).toBeNull();
  });

  it("should handle empty or minimal data gracefully", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const minimalData = { data: {} };
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(minimalData));

    const result = extractArDataMetadata(mockDir);

    expect(result).toEqual({
      avgAmbientIntensity: 0,
      avgBrightness: 0,
      avgColorTemperature: 0,
      avgIso: 0,
      deviceModel: "",
      lensAperture: "",
      lensFocalLength: "",
      lensModel: ""
    });
  });
  it("should extract metadata from LensModel string when EXIF fields are missing", () => {
    // Setup specific mock for this test
    const specificMockExif = {
      BrightnessValue: "2",
      DateTimeOriginal: "2023-01-01T00:00:00.000Z",
      ExposureBiasValue: "0",
      ExposureTime: "1/60",
      FNumber: undefined,
      FocalLength: undefined,
      ISOSpeedRatings: "400",
      LensModel: "iPhone 13 Pro back triple camera 5.7mm f/1.5",
      ShutterSpeedValue: "1/60",
      WhiteBalance: "0"
    };

    const specificArData = {
      data: {
        "1234567890": {
          cameraResolution: { height: 1920, width: 1440 }, // Required by ArData
          cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Required by ArData
          exifData: specificMockExif,
          lightEstimate: { ambientColorTemperature: 5000, ambientIntensity: 1000 },
          timestamp: 1234567890 // Required by ArData
        }
      }
    };

    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(specificArData));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.deviceModel).toBe("iPhone 13 Pro");
      expect(result.lensFocalLength).toBe("5.7 mm");
      expect(result.lensAperture).toBe("f/1.5");
    }
  });

  it("skips lens model parsing when LensModel is missing", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const missingLensModelData = {
      data: {
        "7": {
          cameraResolution: { height: 800, width: 600 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            BrightnessValue: "1.1",
            FNumber: "2.0",
            FocalLength: "4.5mm",
            ISOSpeedRatings: "100"
          },
          timestamp: 7
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(missingLensModelData));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.deviceModel).toBe("");
      expect(result.lensModel).toBe("");
      expect(result.lensFocalLength).toBe("4.5mm");
      expect(result.lensAperture).toBe("f/2.0");
    }
  });

  it("normalizes prefixed FNumber and ignores invalid ISO/brightness values", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const prefixedExifData = {
      BrightnessValue: "not-a-number",
      FNumber: "f/2.2",
      FocalLength: "4.2mm",
      ISOSpeedRatings: "ISO-ABC",
      LensModel: "Pixel 8 back camera 4.2mm f/1.8"
    };

    const prefixedArData = {
      data: {
        "42": {
          cameraResolution: { height: 720, width: 1280 },
          cameraTransform: new Array(16).fill(0),
          exifData: prefixedExifData,
          timestamp: 42
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(prefixedArData));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.deviceModel).toBe("Pixel 8");
      expect(result.lensModel).toBe("Pixel 8 back camera 4.2mm f/1.8");
      expect(result.lensFocalLength).toBe("4.2mm");
      expect(result.lensAperture).toBe("f/2.2");
      expect(result.avgIso).toBe(0);
      expect(result.avgBrightness).toBe(0);
    }
  });
});
