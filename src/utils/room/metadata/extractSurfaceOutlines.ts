import { SurfaceOutline } from "../../../models/shapeOutline";
import { RawScan } from "../../../models/rawScan/rawScan";

interface SurfaceWithOutline {
  polygonCorners?: number[][];
  dimensions?: number[];
}

const buildOutlineFromCorners = (corners?: number[][]): SurfaceOutline | null => {
  if (!Array.isArray(corners)) {
    return null;
  }
  const minPoints = 3;
  const points: SurfaceOutline = [];
  for (const corner of corners) {
    if (!Array.isArray(corner)) {
      continue;
    }
    const xIndex = 0;
    const yIndex = 1;
    const x = corner[xIndex];
    const y = corner[yIndex];
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  if (points.length < minPoints) {
    return null;
  }
  return points;
};

const buildOutlineFromDimensions = (dimensions?: number[]): SurfaceOutline | null => {
  const minDimensionsLength = 2;
  if (!Array.isArray(dimensions) || dimensions.length < minDimensionsLength) {
    return null;
  }
  const xIndex = 0;
  const yIndex = 1;
  const width = dimensions[xIndex];
  const height = dimensions[yIndex];
  const zeroValue = 0;
  if (width === undefined || height === undefined) {
    return null;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= zeroValue || height <= zeroValue) {
    return null;
  }
  const halfDivisor = 2;
  const halfWidth = width / halfDivisor;
  const halfHeight = height / halfDivisor;
  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];
};

const buildOutlines = (surfaces: SurfaceWithOutline[]): SurfaceOutline[] => {
  const outlines: SurfaceOutline[] = [];
  for (const surface of surfaces) {
    const outlineFromCorners = buildOutlineFromCorners(surface.polygonCorners);
    if (outlineFromCorners !== null) {
      outlines.push(outlineFromCorners);
      continue;
    }

    const outlineFromDimensions = buildOutlineFromDimensions(surface.dimensions);
    if (outlineFromDimensions !== null) {
      outlines.push(outlineFromDimensions);
    }
  }
  return outlines;
};

export interface SurfaceOutlines {
  floorOutlines: SurfaceOutline[];
  wallOutlines: SurfaceOutline[];
  windowOutlines: SurfaceOutline[];
  doorOutlines: SurfaceOutline[];
  openingOutlines: SurfaceOutline[];
}

export function extractSurfaceOutlines(rawScan: RawScan): SurfaceOutlines {
  return {
    doorOutlines: buildOutlines(rawScan.doors),
    floorOutlines: buildOutlines(rawScan.floors),
    openingOutlines: buildOutlines(rawScan.openings),
    wallOutlines: buildOutlines(rawScan.walls),
    windowOutlines: buildOutlines(rawScan.windows)
  };
}
