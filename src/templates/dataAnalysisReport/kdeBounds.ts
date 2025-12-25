import { calculateDynamicKdeBounds, calculateKde } from "../../utils/chart/kde";

/**
 * Builds a KDE chart with dynamic bounds calculation and optional refinement.
 * Calculates initial bounds, computes KDE, then refines bounds if needed.
 */
export function buildDynamicKde(
  data: number[],
  initialMin: number,
  initialMax: number,
  resolution: number,
  diffThreshold?: number
): { bounds: { max: number; min: number }; kde: ReturnType<typeof calculateKde> } {
  const defaultDiffThreshold = 0.1;
  const threshold = diffThreshold ?? defaultDiffThreshold;
  const bounds1 = calculateDynamicKdeBounds(data, initialMin, initialMax, resolution);
  let kde = calculateKde(data, { max: bounds1.max, min: bounds1.min, resolution });

  const bounds2 = calculateDynamicKdeBounds(data, bounds1.min, bounds1.max, resolution);
  if (Math.abs(bounds2.min - bounds1.min) > threshold || Math.abs(bounds2.max - bounds1.max) > threshold) {
    kde = calculateKde(data, { max: bounds2.max, min: bounds2.min, resolution });
    return { bounds: bounds2, kde };
  }
  return { bounds: bounds1, kde };
}
