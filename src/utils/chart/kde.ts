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
