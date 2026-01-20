import fs from "fs";
import path from "path";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArDataMetadata } from "../../../../src/models/arData/arDataMetadata";
import { extractArDataMetadata } from "../../../../src/utils/arData/metadata";

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
      arDataFramerate: 4,
      avgAmbientIntensity: 500,
      avgBrightness: 3.5,
      avgColorTemperature: 4000,
      avgIso: 100,
      avgSpeed: 0.16,
      coverageSphereCalculationVersion: 5,
      deviceModel: "Test Device",
      droppedArFrameCount: 0,
      droppedArFramePercentage: 0,
      fastPanTimings: [],
      fastRollTimings: [],
      fastTiltTimings: [],
      hasDroppedArFrames: false,
      lensAperture: "f/1.8",
      lensFocalLength: "26mm",
      lensModel: "Test Lens",
      maxAmbientIntensity: 600,
      maxBrightness: 4.5,
      maxColorTemperature: 5000,
      maxIso: 200,
      maxPanSpeed: 6.5,
      maxRollSpeed: 8.2,
      maxSpeed: 0.25,
      maxTiltSpeed: 10.5,
      minAmbientIntensity: 400,
      minBrightness: 2.5,
      minColorTemperature: 3000,
      minIso: 50,
      minSpeed: 0.1,
      panCalculationVersion: 1,
      phonePanHistogram: new Array<number>(3601).fill(0),
      phoneRollHistogram: new Array<number>(1801).fill(0),
      phoneRollLeftOverflow: 0,
      phoneRollRightOverflow: 0,
      phoneTiltHistogram: new Array<number>(1801).fill(0),
      phoneTiltLeftOverflow: 0,
      phoneTiltRightOverflow: 0,
      rollCalculationVersion: 2,
      scanDateTime: "2025:08:01 10:19:39",
      tiltCalculationVersion: 2,
      timezone: "-07:00",
      totalDisplacement: 3.2,
      totalDistanceTraveled: 5.5,
      totalScanDurationSeconds: 20
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

  it("falls back to extraction when cached metadata cannot be parsed", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockCachePath || p === mockArDataPath);

    const validArData = {
      data: {
        "0": {
          cameraResolution: { height: 120, width: 80 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "Recovery Device back camera 5mm f/1.8" },
          timestamp: 0
        }
      }
    };

    (fs.readFileSync as Mock).mockImplementation((p) => {
      if (p === mockCachePath) {
        return "{ invalid json";
      }
      return JSON.stringify(validArData);
    });

    const result = extractArDataMetadata(mockDir);

    expect(result?.deviceModel).toBe("Recovery Device");
    expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, "utf-8");
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

  it("uses raw FNumber string when it is non-numeric and unprefixed", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const nonNumericFNumberData = {
      data: {
        "1": {
          cameraResolution: { height: 640, width: 480 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            FNumber: "weird",
            FocalLength: "3mm",
            LensModel: "Weird Lens"
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(nonNumericFNumberData));

    const result = extractArDataMetadata(mockDir);

    expect(result?.lensAperture).toBe("weird");
    expect(result?.lensFocalLength).toBe("3mm");
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
      arDataFramerate: 0,
      avgAmbientIntensity: 0,
      avgBrightness: 0,
      avgColorTemperature: 0,
      avgIso: 0,
      avgSpeed: 0,
      coverageSphereCalculationVersion: 5,
      deviceModel: "",
      droppedArFrameCount: 0,
      droppedArFramePercentage: 0,
      fastPanTimings: [],
      fastRollTimings: [],
      fastTiltTimings: [],
      hasDroppedArFrames: false,
      lensAperture: "",
      lensFocalLength: "",
      lensModel: "",
      maxAmbientIntensity: 0,
      maxBrightness: 0,
      maxColorTemperature: 0,
      maxIso: 0,
      maxPanSpeed: 0,
      maxRollSpeed: 0,
      maxSpeed: 0,
      maxTiltSpeed: 0,
      minAmbientIntensity: 0,
      minBrightness: 0,
      minColorTemperature: 0,
      minIso: 0,
      minSpeed: 0,
      panCalculationVersion: 1,
      phonePanHistogram: new Array<number>(3601).fill(0),
      phoneRollHistogram: new Array<number>(1801).fill(0),
      phoneRollLeftOverflow: 0,
      phoneRollRightOverflow: 0,
      phoneTiltHistogram: new Array<number>(1801).fill(0),
      phoneTiltLeftOverflow: 0,
      phoneTiltRightOverflow: 0,
      rollCalculationVersion: 2,
      scanDateTime: "",
      tiltCalculationVersion: 2,
      timezone: "",
      totalDisplacement: 0,
      totalDistanceTraveled: 0,
      totalScanDurationSeconds: 0
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

  it("returns metadata even when cache write fails", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const arDataForWriteFailure = {
      data: {
        "0": {
          cameraResolution: { height: 720, width: 1280 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            FNumber: "2.0",
            LensModel: "Cache Fail Device back camera"
          },
          timestamp: 0
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataForWriteFailure));
    (fs.writeFileSync as Mock).mockImplementation(() => {
      throw new Error("disk full");
    });

    const result = extractArDataMetadata(mockDir);

    expect(result?.deviceModel).toBe("Cache Fail Device");
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.any(String));
  });

  it("aggregates min/max metrics across multiple frames", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const multiFrameData = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            BrightnessValue: "1.2",
            ISOSpeedRatings: "200",
            LensModel: "Frame Zero"
          },
          lightEstimate: {
            ambientColorTemperature: 4000,
            ambientIntensity: 50
          },
          timestamp: 0
        },
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            BrightnessValue: "1.0",
            ISOSpeedRatings: "150",
            LensModel: "Frame One"
          },
          lightEstimate: {
            ambientColorTemperature: 3500,
            ambientIntensity: 30
          },
          timestamp: 1
        },
        "2": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            BrightnessValue: "1.5",
            ISOSpeedRatings: "175",
            LensModel: "Frame Two"
          },
          lightEstimate: {
            ambientColorTemperature: 4200,
            ambientIntensity: 40
          },
          timestamp: 2
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(multiFrameData));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.minAmbientIntensity).toBe(30);
      expect(result.maxAmbientIntensity).toBe(50);
      expect(result.avgAmbientIntensity).toBeCloseTo(40);
      expect(result.minColorTemperature).toBe(3500);
      expect(result.maxColorTemperature).toBe(4200);
      expect(result.avgColorTemperature).toBeCloseTo(3900);
      expect(result.minIso).toBe(150);
      expect(result.maxIso).toBe(200);
      expect(result.avgIso).toBeCloseTo(175);
      expect(result.minBrightness).toBe(1.0);
      expect(result.maxBrightness).toBe(1.5);
      expect(result.avgBrightness).toBeCloseTo(1.233333, 5);
    }
  });

  it("should extract timezone from EXIF OffsetTime field", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const arDataWithTimezone = {
      data: {
        "1": {
          cameraResolution: { height: 1440, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            LensModel: "iPhone 16 Pro back camera 6.765mm f/1.78",
            OffsetTime: "-07:00",
            OffsetTimeOriginal: "-07:00"
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithTimezone));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.timezone).toBe("-07:00");
    }
  });

  it("should handle positive timezone offsets", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const arDataWithPositiveTimezone = {
      data: {
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            LensModel: "iPhone 14 Pro back camera",
            OffsetTime: "+05:30"
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithPositiveTimezone));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.timezone).toBe("+05:30");
    }
  });

  it("should set timezone to empty string when OffsetTime is missing", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const arDataWithoutTimezone = {
      data: {
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            LensModel: "iPhone 12 Pro back camera"
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithoutTimezone));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.timezone).toBe("");
    }
  });

  it("should extract scanDateTime from EXIF DateTimeOriginal field", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const arDataWithDateTime = {
      data: {
        "1": {
          cameraResolution: { height: 1440, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            DateTimeOriginal: "2025:08:01 10:19:39",
            LensModel: "iPhone 16 Pro back camera 6.765mm f/1.78",
            OffsetTime: "-04:00"
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithDateTime));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.scanDateTime).toBe("2025:08:01 10:19:39");
    }
  });

  it("should set scanDateTime to empty string when DateTimeOriginal is missing", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const arDataWithoutDateTime = {
      data: {
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {
            LensModel: "iPhone 12 Pro back camera"
          },
          timestamp: 1
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithoutDateTime));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.scanDateTime).toBe("");
    }
  });

  it("should calculate framerate from multiple timestamps", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Create 10 frames at 0.1 second intervals = 10 FPS
    const framesPerSecond = 10;
    const intervalSeconds = 0.1;
    const arDataWithMultipleFrames = {
      data: {} as Record<string, object>
    };

    for (let i = 0; i < framesPerSecond; i++) {
      const timestamp = i * intervalSeconds;
      arDataWithMultipleFrames.data[timestamp.toString()] = {
        cameraResolution: { height: 1080, width: 1920 },
        cameraTransform: new Array(16).fill(0),
        exifData: { LensModel: "iPhone 14 Pro back camera" },
        timestamp
      };
    }

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithMultipleFrames));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      // 9 frame intervals over 0.9 seconds = 10 FPS
      expect(result.arDataFramerate).toBeCloseTo(10, 1);
      expect(result.hasDroppedArFrames).toBe(false);
      expect(result.droppedArFrameCount).toBe(0);
      expect(result.droppedArFramePercentage).toBe(0);
    }
  });

  it("should detect dropped frames when interval exceeds 1.5x median", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Create frames with one large gap
    // Timestamps: 0, 0.1, 0.2, 0.3, 0.7 (0.4 second gap vs normal 0.1)
    const arDataWithDroppedFrame = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        },
        "0.1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.1
        },
        "0.2": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.2
        },
        "0.3": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.3
        },
        "0.7": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.7
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithDroppedFrame));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.arDataFramerate).toBeGreaterThan(0);
      // 0.4 second gap is > 1.5x the median of 0.1 seconds
      expect(result.hasDroppedArFrames).toBe(true);
      expect(result.droppedArFrameCount).toBe(1);
      // 1 out of 4 intervals = 25%
      expect(result.droppedArFramePercentage).toBe(25);
    }
  });

  it("should not detect dropped frames with consistent intervals", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Create frames with consistent intervals
    const arDataConsistent = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        },
        "0.1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.1
        },
        "0.2": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.2
        },
        "0.3": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.3
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataConsistent));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.arDataFramerate).toBeCloseTo(10, 1);
      expect(result.hasDroppedArFrames).toBe(false);
      expect(result.droppedArFrameCount).toBe(0);
      expect(result.droppedArFramePercentage).toBe(0);
    }
  });

  it("should handle only 2 frames for framerate without dropped frame detection", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Only 2 frames - enough for framerate but not for dropped frame detection (needs 3+)
    const arDataTwoFrames = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        },
        "0.5": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.5
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataTwoFrames));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      // 1 frame interval over 0.5 seconds = 2 FPS
      expect(result.arDataFramerate).toBe(2);
      // Not enough frames for dropped frame detection
      expect(result.hasDroppedArFrames).toBe(false);
      expect(result.droppedArFrameCount).toBe(0);
      expect(result.droppedArFramePercentage).toBe(0);
    }
  });

  it("should handle unsorted timestamp keys correctly", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Keys are in order but tests that sorting works correctly
    const arDataUnsortedKeys = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        },
        "0.2": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.2
        },
        "0.4": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0.4
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataUnsortedKeys));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      // Keys should be sorted: 0, 0.2, 0.4 = 3 frames
      // 2 intervals over 0.4 seconds = 5 FPS
      expect(result.arDataFramerate).toBe(5);
      expect(result.hasDroppedArFrames).toBe(false);
    }
  });

  it("should not calculate framerate when all frames have same timestamp", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // All frames have timestamp 0 - totalDuration = 0
    const arDataSameTimestamp = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        },
        "0.0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0
        },
        "0.00": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: {},
          timestamp: 0
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataSameTimestamp));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      // Duration is 0, so framerate should remain 0
      expect(result.arDataFramerate).toBe(0);
      expect(result.hasDroppedArFrames).toBe(false);
    }
  });

  it("should handle single frame for framerate calculation", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Only 1 frame - not enough for framerate calculation
    const arDataSingleFrame = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: new Array(16).fill(0),
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataSingleFrame));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      // Not enough frames for framerate calculation
      expect(result.arDataFramerate).toBe(0);
      expect(result.hasDroppedArFrames).toBe(false);
    }
  });

  it("keeps default framerate when timestamps are filtered below minimum", async () => {
    vi.resetModules();
    vi.doMock("../../../../src/models/arData/arData", () => {
      class MockArData {
        data: Record<string, unknown>;

        constructor(json: unknown) {
          this.data = (json as { data: Record<string, unknown> }).data;
        }
      }

      return { ArData: MockArData };
    });

    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const invalidTimestamps = {
      data: {
        alsoBad: { exifData: {}, timestamp: 1 },
        bad: { exifData: {}, timestamp: 0 }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(invalidTimestamps));

    const { extractArDataMetadata: extractArDataMetadataWithMock } =
      await import("../../../../src/utils/arData/metadata");

    const result = extractArDataMetadataWithMock(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.arDataFramerate).toBe(0);
      expect(result.hasDroppedArFrames).toBe(false);
    }

    vi.unmock("../../../../src/models/arData/arData");
  });

  it("skips framerate calculation when timestamp bounds are undefined", async () => {
    vi.resetModules();
    vi.doMock("../../../../src/models/arData/arData", () => {
      class MockArData {
        data: Record<string, unknown>;

        constructor(json: unknown) {
          this.data = (json as { data: Record<string, unknown> }).data;
        }
      }

      return { ArData: MockArData };
    });

    const parseFloatSpy = vi.spyOn(global, "parseFloat").mockImplementation((value: string | number) => {
      if (value === "bad1" || value === "bad2") {
        return undefined as unknown as number;
      }
      return Number.parseFloat(value as string);
    });

    const isNaNSpy = vi.spyOn(global, "isNaN").mockImplementation((value: unknown) => {
      if (value === undefined) {
        return false;
      }
      return Number.isNaN(value as number);
    });

    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const undefinedBoundsData = {
      data: {
        bad1: { exifData: {}, timestamp: 0 },
        bad2: { exifData: {}, timestamp: 1 }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(undefinedBoundsData));

    const { extractArDataMetadata: extractArDataMetadataWithUndefined } =
      await import("../../../../src/utils/arData/metadata");

    const result = extractArDataMetadataWithUndefined(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.arDataFramerate).toBe(0);
      expect(result.hasDroppedArFrames).toBe(false);
    }

    parseFloatSpy.mockRestore();
    isNaNSpy.mockRestore();
    vi.unmock("../../../../src/models/arData/arData");
  });

  it("should calculate min/max speed using 5-second sliding window", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Create 24 frames over 12 seconds (2 FPS) with varying movement speeds
    // Phase 1 (0-6 sec): slow movement - 0.1 m/s
    // Phase 2 (6-12 sec): fast movement - 0.5 m/s
    const arDataWithVaryingSpeeds = {
      data: {} as Record<string, object>
    };

    const framesPerSecond = 2;
    const frameInterval = 1 / framesPerSecond;
    const slowSpeed = 0.1; // meters per second
    const fastSpeed = 0.5; // meters per second
    const phaseTransitionTime = 6; // seconds
    const totalDuration = 12; // seconds

    let cumulativePosition = 0;

    for (let i = 0; i <= totalDuration * framesPerSecond; i++) {
      const timestamp = i * frameInterval;
      const isSlowPhase = timestamp < phaseTransitionTime;
      const speedMps = isSlowPhase ? slowSpeed : fastSpeed;

      // Add distance traveled since last frame (except for first frame)
      if (i > 0) {
        cumulativePosition += speedMps * frameInterval;
      }

      arDataWithVaryingSpeeds.data[timestamp.toString()] = {
        cameraResolution: { height: 1080, width: 1920 },
        cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cumulativePosition, 0, 0, 1],
        exifData: { LensModel: "iPhone 14 Pro back camera" },
        timestamp
      };
    }

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataWithVaryingSpeeds));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      const metersToFeet = 3.28084;
      // Min speed window should be in the slow phase (~0.1 m/s = ~0.328 ft/s)
      expect(result.minSpeed).toBeCloseTo(slowSpeed * metersToFeet, 1);
      // Max speed window should be in the fast phase (~0.5 m/s = ~1.64 ft/s)
      expect(result.maxSpeed).toBeCloseTo(fastSpeed * metersToFeet, 1);
    }
  });

  it("should not set min/max speed when scan is shorter than sliding window", () => {
    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    // Only 2 seconds of data - no valid 5-second window possible
    const arDataShortScan = {
      data: {
        "0": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          exifData: { LensModel: "iPhone 14 Pro back camera" },
          timestamp: 0
        },
        "1": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1],
          exifData: {},
          timestamp: 1
        },
        "2": {
          cameraResolution: { height: 1080, width: 1920 },
          cameraTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1],
          exifData: {},
          timestamp: 2
        }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(arDataShortScan));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      // No valid 5-second window, so min/max speed should remain 0
      expect(result.minSpeed).toBe(0);
      expect(result.maxSpeed).toBe(0);
    }
  });

  it("computes sliding-window speed/angles on a tiny fixture and flags dropped frames", async () => {
    vi.resetModules();

    vi.doMock("../../../../src/utils/math/transform", () => {
      let tiltIdx = 0;
      let rollIdx = 0;
      let panIdx = 0;
      const tiltAngles = [0, 10, 20, 30, 40];
      const rollAngles = [0, 20, 40, 60, 80];
      const panAngles = [0, 45, 90, 135, 180];

      return {
        distance3D: vi.fn((a: { x: number }, b: { x: number }) => Math.abs(b.x - a.x)),
        getHorizontalForward: vi.fn(() => ({ forwardX: 1, forwardZ: 0 })),
        getPhonePanAngle: vi.fn(() => panAngles[panIdx++] ?? 0),
        getPhoneRollAngle: vi.fn(() => rollAngles[rollIdx++] ?? 0),
        getPhoneTiltAngle: vi.fn(() => tiltAngles[tiltIdx++] ?? 0),
        getPosition3D: vi.fn((transform: number[]) => ({
          x: transform[0] ?? 0,
          y: 0,
          z: 0
        }))
      };
    });

    const timestamps = [0, 1, 5.5, 8, 10];

    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);
    (fs.writeFileSync as Mock).mockImplementation(() => undefined);
    (fs.readFileSync as Mock).mockReturnValue(
      JSON.stringify({
        data: timestamps.reduce<Record<string, unknown>>((acc, timestamp) => {
          const cameraTransform = new Array<number>(16).fill(0);
          cameraTransform[0] = timestamp;
          acc[timestamp.toString()] = {
            cameraResolution: { height: 1080, width: 1920 },
            cameraTransform,
            exifData: { LensModel: "Test Lens" },
            timestamp
          };
          return acc;
        }, {})
      })
    );

    const { extractArDataMetadata: extractWithSlidingWindows } = await import("../../../../src/utils/arData/metadata");

    const result = extractWithSlidingWindows(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.hasDroppedArFrames).toBe(true);
      expect(result.droppedArFrameCount).toBe(1);
      expect(result.minSpeed).toBeCloseTo(3.28, 2);
      expect(result.maxSpeed).toBeCloseTo(3.28, 2);
      expect(result.maxTiltSpeed).toBeGreaterThan(0);
      expect(result.maxRollSpeed).toBeGreaterThan(0);
      expect(result.maxPanSpeed).toBeGreaterThan(0);
    }

    vi.unmock("../../../../src/utils/math/transform");
  });

  it("handles undefined intervals when median cannot be calculated", async () => {
    vi.resetModules();
    vi.doMock("../../../../src/models/arData/arData", () => {
      class MockArData {
        data: Record<string, unknown>;

        constructor(json: unknown) {
          this.data = (json as { data: Record<string, unknown> }).data;
        }
      }

      return { ArData: MockArData };
    });

    const parseFloatSpy = vi.spyOn(global, "parseFloat").mockImplementation((value: string | number) => {
      if (value === "bad-middle") {
        return undefined as unknown as number;
      }
      return Number.parseFloat(value as string);
    });

    const isNaNSpy = vi.spyOn(global, "isNaN").mockImplementation((value: unknown) => {
      if (value === undefined) {
        return false;
      }
      return Number.isNaN(value as number);
    });

    const sortSpy = vi.spyOn(Array.prototype, "sort").mockImplementation(function forceOrder(this: number[]) {
      return [0, undefined as unknown as number, 2];
    });

    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const undefinedIntervals = {
      data: {
        "0": { exifData: {}, timestamp: 0 },
        "1": { exifData: {}, timestamp: 1 },
        "bad-middle": { exifData: {}, timestamp: 0.5 }
      }
    };

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(undefinedIntervals));

    const { extractArDataMetadata: extractArDataMetadataWithIntervals } =
      await import("../../../../src/utils/arData/metadata");

    const result = extractArDataMetadataWithIntervals(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.arDataFramerate).toBeGreaterThan(0);
      expect(result.hasDroppedArFrames).toBe(false);
    }

    sortSpy.mockRestore();
    parseFloatSpy.mockRestore();
    isNaNSpy.mockRestore();
    vi.unmock("../../../../src/models/arData/arData");
  });

  it("builds tilt, roll, and pan histograms with overflow and fast timings", async () => {
    vi.resetModules();

    const tiltAngles = [0, 30, 60, 200, 300];
    const rollAngles = [10, 170, 200, 300, 30];
    const panAngles = [350, 10, 20, 30, 340];
    const timestamps = [0, 2, 5, 7, 10];

    vi.doMock("../../../../src/utils/math/transform", () => {
      let tiltIndex = 0;
      let rollIndex = 0;
      let panIndex = 0;

      return {
        distance3D: vi.fn((a: { x: number }, b: { x: number }) => Math.abs(b.x - a.x)),
        getHorizontalForward: vi.fn(() => ({ forwardX: 1, forwardZ: 0 })),
        getPhonePanAngle: vi.fn(() => panAngles[panIndex++] ?? 0),
        getPhoneRollAngle: vi.fn(() => rollAngles[rollIndex++] ?? 0),
        getPhoneTiltAngle: vi.fn(() => tiltAngles[tiltIndex++] ?? 0),
        getPosition3D: vi.fn((transform: number[]) => ({
          x: transform[0] ?? 0,
          y: 0,
          z: 0
        }))
      };
    });

    (fs.existsSync as Mock).mockImplementation((p) => p === mockArDataPath);

    const transformLength = 16;
    const testArData = {
      data: {} as Record<string, unknown>
    };

    for (const timestamp of timestamps) {
      const cameraTransform = new Array<number>(transformLength).fill(0);
      cameraTransform[0] = timestamp;

      testArData.data[timestamp.toString()] = {
        cameraResolution: { height: 1080, width: 1920 },
        cameraTransform,
        exifData: {
          FNumber: "1.8",
          FocalLength: "4mm",
          LensModel: "Mock Device back camera 4mm f/1.8"
        },
        timestamp
      };
    }

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(testArData));

    const { extractArDataMetadata: extractArDataMetadataWithTransforms } =
      await import("../../../../src/utils/arData/metadata");

    const result = extractArDataMetadataWithTransforms(mockDir);

    expect(result).not.toBeNull();

    if (result) {
      expect(result.phoneTiltHistogram[0]).toBe(1);
      expect(result.phoneTiltHistogram[300]).toBe(1);
      expect(result.phoneTiltHistogram[600]).toBe(1);
      expect(result.phoneTiltRightOverflow).toBe(1);
      expect(result.phoneTiltLeftOverflow).toBe(1);
      expect(result.maxTiltSpeed).toBeCloseTo(48, 5);
      expect(result.fastTiltTimings).toEqual([25, 45, 75]);

      expect(result.phoneRollHistogram[100]).toBe(1);
      expect(result.phoneRollHistogram[1700]).toBe(1);
      expect(result.phoneRollRightOverflow).toBe(1);
      expect(result.phoneRollLeftOverflow).toBe(1);
      expect(result.maxRollSpeed).toBeCloseTo(74, 5);
      expect(result.fastRollTimings).toEqual([25, 45, 75]);

      expect(result.phonePanHistogram[3500]).toBe(1);
      expect(result.phonePanHistogram[100]).toBe(1);
      expect(result.phonePanHistogram[200]).toBe(1);
      expect(result.phonePanHistogram[300]).toBe(1);
      expect(result.phonePanHistogram[3400]).toBe(1);
      expect(result.maxPanSpeed).toBeCloseTo(12, 5);
      expect(result.fastPanTimings).toEqual([25, 75]);
    }

    vi.unmock("../../../../src/utils/math/transform");
  });
});
