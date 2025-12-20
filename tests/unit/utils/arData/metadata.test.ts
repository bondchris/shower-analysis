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

  const validArDataJson = {
    data: {
      "1234567890": {
        anchors: [],
        cameraResolution: { height: 1080, width: 1920 },
        cameraTransform: new Array(16).fill(0),
        exifData: {
          BrightnessValue: "2.5",
          ISOSpeedRatings: "125",
          LensModel: "iPhone 12 Pro"
        },
        lightEstimate: {
          ambientColorTemperature: 3000,
          ambientIntensity: 1000
        },
        timestamp: 1234567890
      },
      "1234567891": {
        anchors: [],
        cameraResolution: { height: 1080, width: 1920 },
        cameraTransform: new Array(16).fill(0),
        // lightEstimate undefined
        exifData: {
          BrightnessValue: "1.5",
          ISOSpeedRatings: "200",
          LensModel: "iPhone 12 Pro"
        },
        timestamp: 1234567891
      }
    }
  };

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
      lensModel: "Test Lens"
    };

    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(cachedData));

    const result = extractArDataMetadata(mockDir);

    expect(fs.existsSync).toHaveBeenCalledWith(mockCachePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, "utf-8");
    expect(result).toEqual(cachedData);
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

    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(validArDataJson));

    const result = extractArDataMetadata(mockDir);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.avgAmbientIntensity).toBe(1000);
      expect(result.avgBrightness).toBe(2.0);
      expect(result.avgColorTemperature).toBe(3000);
      expect(result.avgIso).toBe(162.5);
      expect(result.lensModel).toBe("iPhone 12 Pro");
    }

    expect(fs.writeFileSync).toHaveBeenCalledWith(mockCachePath, expect.any(String));
  });

  it("should return null if arData.json does not exist", () => {
    (fs.existsSync as Mock).mockReturnValue(false);
    const result = extractArDataMetadata(mockDir);
    expect(result).toBeNull();
  });

  it("should return null if parsing fails/ArData throws", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockArDataPath) {
        return true;
      }
      return false;
    });
    (fs.readFileSync as Mock).mockReturnValue("INVALID JSON");

    const result = extractArDataMetadata(mockDir);
    expect(result).toBeNull();
  });

  it("should handle empty or minimal data gracefully", () => {
    (fs.existsSync as Mock).mockImplementation((p: string) => {
      if (p === mockArDataPath) {
        return true;
      }
      return false;
    });

    const minimalData = { data: {} };
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify(minimalData));

    const result = extractArDataMetadata(mockDir);

    expect(result).toEqual({
      avgAmbientIntensity: 0,
      avgBrightness: 0,
      avgColorTemperature: 0,
      avgIso: 0,
      lensModel: ""
    });
  });
});
