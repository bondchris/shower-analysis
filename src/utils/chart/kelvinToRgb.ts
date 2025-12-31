/**
 * Converts color temperature in Kelvin to RGB hex color.
 * Based on Tanner Helland's algorithm:
 * https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
 */
export function kelvinToHex(kelvin: number): string {
  const minKelvin = 1000;
  const maxKelvin = 40000;
  const scaleFactor = 100;
  const maxColorValue = 255;
  const minColorValue = 0;

  // Clamp temperature to valid range
  const temp = Math.max(minKelvin, Math.min(maxKelvin, kelvin)) / scaleFactor;

  let red = 0;
  let green = 0;
  let blue = 0;

  // Calculate Red
  const redThreshold = 66;
  if (temp <= redThreshold) {
    red = maxColorValue;
  } else {
    const redCoeff = 329.698727446;
    const redExp = -0.1332047592;
    const redOffset = 60;
    red = redCoeff * Math.pow(temp - redOffset, redExp);
  }

  // Calculate Green
  const greenLowThreshold = 66;
  if (temp <= greenLowThreshold) {
    const greenLowCoeff = 99.4708025861;
    const greenLowOffset = 161.1195681661;
    const greenLogProduct = greenLowCoeff * Math.log(temp);
    green = greenLogProduct - greenLowOffset;
  } else {
    const greenHighCoeff = 288.1221695283;
    const greenHighExp = -0.0755148492;
    const greenHighOffset = 60;
    green = greenHighCoeff * Math.pow(temp - greenHighOffset, greenHighExp);
  }

  // Calculate Blue
  const blueHighThreshold = 66;
  const blueLowThreshold = 19;
  if (temp >= blueHighThreshold) {
    blue = maxColorValue;
  } else if (temp <= blueLowThreshold) {
    blue = minColorValue;
  } else {
    const blueCoeff = 138.5177312231;
    const blueOffset = 305.0447927307;
    const blueShift = 10;
    const blueLogProduct = blueCoeff * Math.log(temp - blueShift);
    blue = blueLogProduct - blueOffset;
  }

  // Clamp values to 0-255
  red = Math.max(minColorValue, Math.min(maxColorValue, Math.round(red)));
  green = Math.max(minColorValue, Math.min(maxColorValue, Math.round(green)));
  blue = Math.max(minColorValue, Math.min(maxColorValue, Math.round(blue)));

  // Convert to hex
  const hexBase = 16;
  const hexPadLength = 2;
  const redHex = red.toString(hexBase).padStart(hexPadLength, "0");
  const greenHex = green.toString(hexBase).padStart(hexPadLength, "0");
  const blueHex = blue.toString(hexBase).padStart(hexPadLength, "0");

  return `#${redHex}${greenHex}${blueHex}`;
}
