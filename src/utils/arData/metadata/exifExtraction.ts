import { ArFrame } from "../../../models/arData/arFrame";

/**
 * EXIF metadata extracted from camera frame data.
 */
export interface ExifMetadata {
  deviceModel: string;
  lensAperture: string;
  lensFocalLength: string;
  lensModel: string;
  scanDateTime: string;
  timezone: string;
}

/**
 * Extracts EXIF metadata from the first frame including device info, lens specs, and timestamps.
 */
export function extractExifMetadata(firstFrame: ArFrame): ExifMetadata {
  const emptyString = "";
  const result: ExifMetadata = {
    deviceModel: emptyString,
    lensAperture: emptyString,
    lensFocalLength: emptyString,
    lensModel: emptyString,
    scanDateTime: emptyString,
    timezone: emptyString
  };

  const exif = firstFrame.exifData;

  if (exif.OffsetTime !== undefined && exif.OffsetTime !== emptyString) {
    result.timezone = exif.OffsetTime.trim();
  }

  if (exif.DateTimeOriginal !== undefined && exif.DateTimeOriginal !== emptyString) {
    result.scanDateTime = exif.DateTimeOriginal.trim();
  }

  if (exif.FocalLength !== undefined && exif.FocalLength !== emptyString) {
    result.lensFocalLength = exif.FocalLength.trim();
  }

  if (exif.FNumber !== undefined && exif.FNumber !== emptyString) {
    const trimmedFNumber = exif.FNumber.trim();
    const hasPrefix = trimmedFNumber.toLowerCase().startsWith("f/");
    const parsedFNumber = parseFloat(trimmedFNumber);
    result.lensAperture = !hasPrefix && !isNaN(parsedFNumber) ? `f/${trimmedFNumber}` : trimmedFNumber;
  }

  const rawModel = exif.LensModel;
  if (rawModel !== undefined && rawModel !== emptyString) {
    result.lensModel = rawModel;

    const deviceRegex = /^(.+?)\s+(?:front|back)/i;
    const matchDevice = deviceRegex.exec(rawModel);
    const captureGroupIndex = 1;

    if (matchDevice !== null && typeof matchDevice[captureGroupIndex] === "string") {
      result.deviceModel = matchDevice[captureGroupIndex].trim();
    } else {
      result.deviceModel = rawModel;
    }

    const focalRegex = /([\d.]+)\s*mm/i;
    const matchFocal = focalRegex.exec(rawModel);
    if (matchFocal?.[captureGroupIndex] !== undefined && result.lensFocalLength === emptyString) {
      result.lensFocalLength = `${matchFocal[captureGroupIndex]} mm`;
    }

    const apertureRegex = /f\/?([\d.]+)/i;
    const matchAperture = apertureRegex.exec(rawModel);
    if (matchAperture?.[captureGroupIndex] !== undefined && result.lensAperture === emptyString) {
      result.lensAperture = `f/${matchAperture[captureGroupIndex]}`;
    }
  }

  return result;
}

/**
 * Parses a numeric value from an EXIF string field.
 * Returns undefined if the field is missing, empty, or not a valid number.
 */
export function parseExifNumeric(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const numericOnly = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(numericOnly);
  return isNaN(parsed) ? undefined : parsed;
}
