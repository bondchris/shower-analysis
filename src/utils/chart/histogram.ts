import { HistogramOptions } from "../../models/chart/histogramOptions";
import { HistogramResult } from "../../models/chart/histogramResult";

/**
 * Calculations for histogram bins.
 */
export function calculateHistogramBins(data: number[], options: HistogramOptions): HistogramResult {
  const defaultDecimals = 0;
  const zeroValue = 0;
  const incrementStep = 1;

  const { binSize, decimalPlaces = defaultDecimals, hideUnderflow, max, min } = options;

  if (!Number.isFinite(binSize) || binSize <= zeroValue) {
    throw new Error(`Invalid binSize: ${String(binSize)}. Must be > 0.`);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`Invalid min/max: ${String(min)}/${String(max)}. Must be finite.`);
  }
  if (max <= min) {
    throw new Error(`Invalid range: max (${String(max)}) must be > min (${String(min)}).`);
  }

  const maxBins = 50000;
  const numMainBins = Math.ceil((max - min) / binSize);

  if (numMainBins > maxBins) {
    throw new Error(
      `Bucket count ${String(numMainBins)} exceeds safety limit of ${String(maxBins)}. Increase binSize or reduce range.`
    );
  }

  const initialCount = 0;
  const extraBuckets = 2; // Underflow + Overflow
  const underflowIndex = 0;
  const offset = 1;

  const buckets: number[] = new Array(numMainBins + extraBuckets).fill(initialCount) as number[];
  const labels: string[] = [];

  labels.push(`< ${min.toFixed(decimalPlaces)}`);
  for (let i = 0; i < numMainBins; i++) {
    const startOffset = i * binSize;
    const start = min + startOffset;
    const endOffset = (i + incrementStep) * binSize;
    const end = min + endOffset;
    labels.push(`${start.toFixed(decimalPlaces)}-${end.toFixed(decimalPlaces)}`);
  }
  labels.push(`>= ${max.toFixed(decimalPlaces)}`);

  for (const val of data) {
    if (!Number.isFinite(val)) {
      continue;
    }

    if (val < min) {
      if (buckets[underflowIndex] !== undefined) {
        buckets[underflowIndex] += incrementStep;
      }
    } else if (val >= max) {
      const idxOver = buckets.length - incrementStep;
      if (buckets[idxOver] !== undefined) {
        buckets[idxOver] += incrementStep;
      }
    } else {
      const binIdx = Math.floor((val - min) / binSize) + offset;
      if (buckets[binIdx] !== undefined) {
        buckets[binIdx] += incrementStep;
      }
    }
  }

  if (hideUnderflow === true) {
    const startIndex = 1;
    return {
      buckets: buckets.slice(startIndex),
      labels: labels.slice(startIndex)
    };
  }

  return { buckets, labels };
}

export function calculateHistogramBinCenter(
  index: number,
  min: number,
  max: number,
  binSize: number,
  hideUnderflow = false,
  totalBuckets: number
): number {
  const underflowIndex = 0;
  const underflowShift = 1;
  const noShift = 0;
  const half = 2;
  const offsetAdjust = 1;
  const oneValue = 1;

  const effectiveIndex = index + (hideUnderflow ? underflowShift : noShift);

  if (effectiveIndex === underflowIndex) {
    const halfBin = binSize / half;
    return min - halfBin;
  }

  const noValue = 0;
  const originalLength = totalBuckets + (hideUnderflow ? oneValue : noValue);

  if (effectiveIndex === originalLength - offsetAdjust) {
    const halfBin = binSize / half;
    return max + halfBin;
  }

  const binOffset = effectiveIndex - offsetAdjust;
  const offsetVal = binOffset * binSize;
  const halfBin = binSize / half;
  return min + offsetVal + halfBin;
}
