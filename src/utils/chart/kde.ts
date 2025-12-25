import { scaleLinear } from "@visx/scale";
import { std } from "mathjs";

import { KdeResult } from "../../models/chart/kdeResult";

export function calculateKde(data: number[], options: { min: number; max: number; resolution?: number }): KdeResult {
  const defaultResolution = 100;
  const { min, max, resolution = defaultResolution } = options;
  const validData = data.filter((d) => Number.isFinite(d));
  const n = validData.length;

  const zeroValue = 0;
  const minLength = 2;
  if (n === zeroValue) {
    return { labels: [], values: [] };
  }

  const stdValue = n < minLength ? zeroValue : Number(std(validData));

  // Silverman's Rule of Thumb for bandwidth
  // Fallback to non-zero bandwidth if std is 0 (all points same)
  const defaultBandwidth = 1.0;
  const hMult = 1.06;
  const hPow = -0.2;
  let h = hMult * stdValue * Math.pow(n, hPow);
  if (h === zeroValue) {
    h = defaultBandwidth;
  }

  const labels: string[] = [];
  const values: number[] = [];

  const resolutionOffset = 1;
  const step = (max - min) / (resolution - resolutionOffset);
  const PI_FACTOR = 2;
  const sqrt2Pi = Math.sqrt(PI_FACTOR * Math.PI);
  const EXP_FACTOR = -0.5;

  for (let i = 0; i < resolution; i++) {
    const offset = i * step;
    const x = min + offset;
    let sumKernel = 0;
    for (const d of validData) {
      const u = (x - d) / h;
      sumKernel += Math.exp(EXP_FACTOR * u * u) / sqrt2Pi;
    }
    // Density * N gives approximate count density per unit
    // We multiply by N so the magnitude reflects point counts roughly
    // value = (1/h) * sumKernel
    // This is the sum of kernels.
    // If we want Density: (1 / (n * h)) * sumKernel
    // If we want "Sum of kernels": (1/h) * sumKernel
    // We'll return Sum of Kernels (scaled density) for nicer Y-axis values
    const unit = 1;
    const value = (unit / h) * sumKernel;

    const labelDecimalPlaces = 1;
    labels.push(x.toFixed(labelDecimalPlaces));
    values.push(value);
  }

  return { labels, values };
}

/**
 * Calculates dynamic min/max bounds for a KDE chart based on the data.
 * Finds the range where values are above half of the first meaningful y-axis tick.
 */
export function calculateDynamicKdeBounds(
  data: number[],
  initialMin: number,
  initialMax: number,
  resolution: number
): { max: number; min: number } {
  const zeroValue = 0;
  const thresholdDivisor = 2;
  const resolutionOffset = 1;
  const paddingRatio = 0.05;
  const decrementStep = 1;

  const validData = data.filter((d) => Number.isFinite(d) && d > zeroValue);
  if (validData.length === zeroValue) {
    return { max: initialMax, min: initialMin };
  }

  // Get actual data range as a sanity check
  const actualDataMin = Math.min(...validData);
  const actualDataMax = Math.max(...validData);

  // Calculate KDE with initial wide range
  const initialKde = calculateKde(data, { max: initialMax, min: initialMin, resolution });

  // Calculate the first y-axis tick using the actual scale library (same as chart)
  // The yScale uses domain [0, maxDataValue] with nice: true
  const maxKdeValue = Math.max(...initialKde.values.filter((v) => Number.isFinite(v)));
  if (maxKdeValue <= zeroValue) {
    return { max: initialMax, min: initialMin };
  }

  // Use the actual scale library to calculate ticks (same as LineChart component)
  const yScale = scaleLinear<number>({
    domain: [zeroValue, maxKdeValue],
    nice: true
  });

  // Get the actual ticks that would be generated (default ~10 ticks)
  const ticks: number[] = yScale.ticks();

  // Find the first tick above zero
  const firstTickAboveZero = ticks.find((t: number) => t > zeroValue);
  const indexOffset = 1;
  const lastTickIndex = ticks.length - indexOffset;
  const firstTickValue = firstTickAboveZero ?? ticks[lastTickIndex] ?? maxKdeValue;
  const threshold = firstTickValue / thresholdDivisor;

  // Find where data starts: look for the first crossing from below threshold to above threshold
  // This is where the line first crosses half a tick going up
  let minIndex = zeroValue;
  let foundMinCrossing = false;
  for (let i = zeroValue; i < initialKde.values.length - decrementStep; i++) {
    const currentValue = initialKde.values[i];
    const nextValue = initialKde.values[i + decrementStep];
    if (currentValue !== undefined && nextValue !== undefined) {
      // Check if we're crossing from below threshold to above threshold
      if (currentValue < threshold && nextValue >= threshold) {
        minIndex = i + decrementStep;
        foundMinCrossing = true;
        break;
      }
    }
  }

  // Find where data ends: look for the last crossing from above threshold to below threshold
  // This is where the line last crosses half a tick going down
  const lastIndex = initialKde.values.length - decrementStep;
  let maxIndex = lastIndex;
  let foundMaxCrossing = false;
  for (let i = lastIndex; i >= decrementStep; i--) {
    const currentValue = initialKde.values[i];
    const prevValue = initialKde.values[i - decrementStep];
    if (currentValue !== undefined && prevValue !== undefined) {
      // Check if we're crossing from above threshold to below threshold
      // (prevValue is above, currentValue is below - going right to left, this is the last crossing down)
      if (prevValue >= threshold && currentValue < threshold) {
        maxIndex = i - decrementStep;
        foundMaxCrossing = true;
        break;
      }
    }
  }

  // If we didn't find meaningful bounds (all values below threshold or edge cases),
  // fall back to using the actual data range
  const minKdeLengthForFallback = 10;
  if (
    minIndex >= maxIndex ||
    (!foundMinCrossing && !foundMaxCrossing && initialKde.values.length > minKdeLengthForFallback)
  ) {
    const dataRange = actualDataMax - actualDataMin;
    const dataPadding = dataRange * paddingRatio;
    // Don't clamp minimum to initialMin if actual data minimum is greater than 0
    // This prevents showing density at 0 when there are no actual 0 values
    const effectiveInitialMin = actualDataMin > zeroValue ? actualDataMin : initialMin;
    const fallbackBounds = {
      max: Math.min(initialMax, actualDataMax + dataPadding),
      min: Math.max(effectiveInitialMin, actualDataMin - dataPadding)
    };
    return fallbackBounds;
  }

  // Convert indices back to actual values
  const resolutionMinusOne = resolution - resolutionOffset;
  const step = (initialMax - initialMin) / resolutionMinusOne;
  const minIndexTimesStep = minIndex * step;
  const maxIndexTimesStep = maxIndex * step;
  const calculatedMin = initialMin + minIndexTimesStep;
  const calculatedMax = initialMin + maxIndexTimesStep;

  // Use the calculated bounds from crossings (where KDE crosses threshold)
  // Don't clamp to data range - the crossings tell us where the density is meaningful
  let finalMin = calculatedMin;
  const finalMax = calculatedMax;

  // Don't allow minimum to be 0 or below if actual data minimum is greater than 0
  // This prevents showing density at 0 when there are no actual 0 values
  if (actualDataMin > zeroValue && finalMin <= zeroValue) {
    finalMin = actualDataMin;
  }

  // Add a small padding to ensure we show the full range
  const range = finalMax - finalMin;
  const padding = range * paddingRatio;
  // Don't clamp minimum to initialMin if actual data minimum is greater than 0
  // This prevents showing density at 0 when there are no actual 0 values
  const effectiveInitialMin = actualDataMin > zeroValue ? actualDataMin : initialMin;
  const paddedMin = Math.max(effectiveInitialMin, finalMin - padding);
  const paddedMax = Math.min(initialMax, finalMax + padding);
  return { max: paddedMax, min: paddedMin };
}
