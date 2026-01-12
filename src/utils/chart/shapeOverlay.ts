import { SurfaceOutline } from "../../models/shapeOutline";

export function filterValidOutlines(outlines: SurfaceOutline[]): SurfaceOutline[] {
  return outlines.filter((outline) => {
    const minPoints = 3;
    if (outline.length < minPoints) {
      return false;
    }
    return outline.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  });
}

export function normalizeOutline(outline: SurfaceOutline): SurfaceOutline | null {
  const minPoints = 3;
  const zeroSpan = 0;
  const halfDivisor = 2;
  const scaleBaseline = 1;
  if (outline.length < minPoints) {
    return null;
  }

  const finitePoints = outline.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (finitePoints.length < minPoints) {
    return null;
  }

  const xs = finitePoints.map((point) => point.x);
  const ys = finitePoints.map((point) => point.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= zeroSpan || height <= zeroSpan) {
    return null;
  }

  const centerX = (minX + maxX) / halfDivisor;
  const centerY = (minY + maxY) / halfDivisor;
  const maxDimension = Math.max(width, height);
  const scale = scaleBaseline / maxDimension;

  return finitePoints.map((point) => ({
    x: (point.x - centerX) * scale,
    y: (point.y - centerY) * scale
  }));
}

export function normalizeOutlines(outlines: SurfaceOutline[]): SurfaceOutline[] {
  return outlines
    .map((outline) => normalizeOutline(outline))
    .filter((outline): outline is SurfaceOutline => outline !== null);
}

export function sampleOutlines(outlines: SurfaceOutline[], maxCount: number): SurfaceOutline[] {
  const zeroValue = 0;
  if (maxCount <= zeroValue) {
    return [];
  }
  if (outlines.length <= maxCount) {
    return outlines;
  }

  const step = Math.ceil(outlines.length / maxCount);
  const sampled: SurfaceOutline[] = [];
  for (let i = zeroValue; i < outlines.length; i += step) {
    const outline = outlines[i];
    if (outline !== undefined) {
      sampled.push(outline);
    }
    if (sampled.length >= maxCount) {
      break;
    }
  }
  return sampled;
}
