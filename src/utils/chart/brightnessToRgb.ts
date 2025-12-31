/**
 * Converts brightness value to grayscale hex color.
 * Maps brightness from -6 (pure black) to 15 (pure white).
 */
export function brightnessToHex(brightness: number): string {
  const minBrightness = -6;
  const maxBrightness = 15;
  const maxColorValue = 255;
  const minColorValue = 0;

  // Clamp brightness to valid range and normalize to 0-1
  const clampedBrightness = Math.max(minBrightness, Math.min(maxBrightness, brightness));
  const brightnessRange = maxBrightness - minBrightness;
  const normalizedBrightness = (clampedBrightness - minBrightness) / brightnessRange;

  // Convert to grayscale value (0-255)
  const colorRange = maxColorValue - minColorValue;
  const scaledBrightness = normalizedBrightness * colorRange;
  const grayValue = Math.round(scaledBrightness + minColorValue);

  // Convert to hex
  const hexBase = 16;
  const hexPadLength = 2;
  const grayHex = grayValue.toString(hexBase).padStart(hexPadLength, "0");

  return `#${grayHex}${grayHex}${grayHex}`;
}
