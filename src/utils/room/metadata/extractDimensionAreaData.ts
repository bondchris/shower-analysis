import { RawScan } from "../../../models/rawScan/rawScan";
import { getVanityLengths } from "../vanity/vanityAnalysis";

export interface DimensionAreaData {
  wallHeights: number[];
  wallWidths: number[];
  wallAreas: number[];
  wallWidthHeightPairs: { height: number; width: number }[];
  windowHeights: number[];
  windowWidths: number[];
  windowAreas: number[];
  windowWidthHeightPairs: { height: number; width: number }[];
  doorHeights: number[];
  doorWidths: number[];
  doorAreas: number[];
  doorWidthHeightPairs: { height: number; width: number }[];
  openingHeights: number[];
  openingWidths: number[];
  openingAreas: number[];
  openingWidthHeightPairs: { height: number; width: number }[];
  floorLengths: number[];
  floorWidths: number[];
  floorWidthHeightPairs: { height: number; width: number }[];
  tubLengths: number[];
  vanityLengths: number[];
}

/**
 * Extracts dimension and area data from a RawScan.
 * These compute the same data as the extractor functions in rawScanExtractor.ts
 * but operate on a single RawScan instead of iterating over artifact directories.
 */
export function extractDimensionAreaData(rawScan: RawScan): DimensionAreaData {
  const dimensionIndexLength = 0;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minValue = 0;
  const minPolygonCorners = 3;
  const pointIndexX = 0;
  const pointIndexZ = 1;
  const initialCount = 0;
  const nextOffset = 1;
  const floorDimensionIndexWidth = 1;
  const floorPointIndexY = 1;
  const minDimensionsLengthForTub = 1;

  const wallHeights: number[] = [];
  const wallWidths: number[] = [];
  const wallAreas: number[] = [];
  const wallWidthHeightPairs: { height: number; width: number }[] = [];

  for (const wall of rawScan.walls) {
    const hasPolygonCorners =
      wall.polygonCorners !== undefined &&
      Array.isArray(wall.polygonCorners) &&
      wall.polygonCorners.length >= minPolygonCorners;

    let width: number | undefined = undefined;
    let height: number | undefined = undefined;

    if (hasPolygonCorners && wall.polygonCorners !== undefined) {
      const corners = wall.polygonCorners;
      let perimeter = initialCount;

      for (let i = initialCount; i < corners.length; i++) {
        const j = (i + nextOffset) % corners.length;
        const p1 = corners[i];
        const p2 = corners[j];

        if (p1 !== undefined && p2 !== undefined && p1.length >= minPolygonCorners && p2.length >= minPolygonCorners) {
          const x1 = p1[pointIndexX] ?? initialCount;
          const z1 = p1[pointIndexZ] ?? initialCount;
          const x2 = p2[pointIndexX] ?? initialCount;
          const z2 = p2[pointIndexZ] ?? initialCount;

          const dx = x2 - x1;
          const dz = z2 - z1;
          const dxSquared = dx * dx;
          const dzSquared = dz * dz;
          const segmentLength = Math.sqrt(dxSquared + dzSquared);
          perimeter += segmentLength;
        }
      }

      width = perimeter;
      if (Array.isArray(wall.dimensions) && wall.dimensions.length > dimensionIndexHeight) {
        height = wall.dimensions[dimensionIndexHeight];
      }

      if (width > minValue && height !== undefined && height > minValue) {
        wallAreas.push(width * height);
      }
    } else if (Array.isArray(wall.dimensions) && wall.dimensions.length >= minDimensionsLength) {
      width = wall.dimensions[dimensionIndexLength];
      height = wall.dimensions[dimensionIndexHeight];

      if (width !== undefined && width > minValue && height !== undefined && height > minValue) {
        wallAreas.push(width * height);
      }
    }

    if (width !== undefined && width > minValue) {
      wallWidths.push(width);
    }
    if (height !== undefined && height > minValue) {
      wallHeights.push(height);
      if (width !== undefined && width > minValue) {
        wallWidthHeightPairs.push({ height, width });
      }
    }
  }

  const windowHeights: number[] = [];
  const windowWidths: number[] = [];
  const windowAreas: number[] = [];
  const windowWidthHeightPairs: { height: number; width: number }[] = [];

  for (const window of rawScan.windows) {
    if (Array.isArray(window.dimensions) && window.dimensions.length >= minDimensionsLength) {
      const width = window.dimensions[dimensionIndexLength];
      const height = window.dimensions[dimensionIndexHeight];
      if (width !== undefined && height !== undefined && width > minValue && height > minValue) {
        windowHeights.push(height);
        windowWidths.push(width);
        windowAreas.push(width * height);
        windowWidthHeightPairs.push({ height, width });
      }
    }
  }

  const doorHeights: number[] = [];
  const doorWidths: number[] = [];
  const doorAreas: number[] = [];
  const doorWidthHeightPairs: { height: number; width: number }[] = [];

  for (const door of rawScan.doors) {
    if (Array.isArray(door.dimensions) && door.dimensions.length >= minDimensionsLength) {
      const width = door.dimensions[dimensionIndexLength];
      const height = door.dimensions[dimensionIndexHeight];
      if (width !== undefined && height !== undefined && width > minValue && height > minValue) {
        doorHeights.push(height);
        doorWidths.push(width);
        doorAreas.push(width * height);
        doorWidthHeightPairs.push({ height, width });
      }
    }
  }

  const openingHeights: number[] = [];
  const openingWidths: number[] = [];
  const openingAreas: number[] = [];
  const openingWidthHeightPairs: { height: number; width: number }[] = [];

  for (const opening of rawScan.openings) {
    if (
      opening.dimensions !== undefined &&
      Array.isArray(opening.dimensions) &&
      opening.dimensions.length >= minDimensionsLength
    ) {
      const width = opening.dimensions[dimensionIndexLength];
      const height = opening.dimensions[dimensionIndexHeight];
      if (width !== undefined && height !== undefined && width > minValue && height > minValue) {
        openingHeights.push(height);
        openingWidths.push(width);
        openingAreas.push(width * height);
        openingWidthHeightPairs.push({ height, width });
      }
    }
  }

  const floorLengths: number[] = [];
  const floorWidths: number[] = [];
  const floorWidthHeightPairs: { height: number; width: number }[] = [];

  for (const floor of rawScan.floors) {
    const hasPolygonCorners =
      floor.polygonCorners !== undefined &&
      Array.isArray(floor.polygonCorners) &&
      floor.polygonCorners.length >= minPolygonCorners;

    let length: number | undefined = undefined;
    let width: number | undefined = undefined;

    if (hasPolygonCorners && floor.polygonCorners !== undefined) {
      const corners = floor.polygonCorners;
      const yValues: number[] = [];

      for (let i = initialCount; i < corners.length; i++) {
        const corner = corners[i];
        if (corner !== undefined && corner.length >= minPolygonCorners) {
          const y = corner[floorPointIndexY];
          if (y !== undefined) {
            yValues.push(y);
          }
        }
      }

      if (yValues.length > initialCount) {
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        width = maxY - minY;
      }

      // For length with polygon corners, use area / width, or calculate from X dimension
      const xValues: number[] = [];
      for (let i = initialCount; i < corners.length; i++) {
        const corner = corners[i];
        if (corner !== undefined && corner.length >= minPolygonCorners) {
          const x = corner[pointIndexX];
          if (x !== undefined) {
            xValues.push(x);
          }
        }
      }

      if (xValues.length > initialCount) {
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        length = maxX - minX;
      }
    } else if (Array.isArray(floor.dimensions) && floor.dimensions.length >= minDimensionsLength) {
      length = floor.dimensions[dimensionIndexLength];
      width = floor.dimensions[floorDimensionIndexWidth];
    }

    if (length !== undefined && length > minValue) {
      floorLengths.push(length);
    }
    if (width !== undefined && width > minValue) {
      floorWidths.push(width);
      if (length !== undefined && length > minValue) {
        floorWidthHeightPairs.push({ height: length, width });
      }
    }
  }

  const tubLengths: number[] = [];

  for (const obj of rawScan.objects) {
    if (obj.category.bathtub !== undefined) {
      if (Array.isArray(obj.dimensions) && obj.dimensions.length >= minDimensionsLengthForTub) {
        const length = obj.dimensions[dimensionIndexLength];
        if (length !== undefined && length > minValue) {
          tubLengths.push(length);
        }
      }
    }
  }

  // Extract vanity lengths using the vanity analysis module
  const vanityLengths = getVanityLengths(rawScan);

  return {
    doorAreas,
    doorHeights,
    doorWidthHeightPairs,
    doorWidths,
    floorLengths,
    floorWidthHeightPairs,
    floorWidths,
    openingAreas,
    openingHeights,
    openingWidthHeightPairs,
    openingWidths,
    tubLengths,
    vanityLengths,
    wallAreas,
    wallHeights,
    wallWidthHeightPairs,
    wallWidths,
    windowAreas,
    windowHeights,
    windowWidthHeightPairs,
    windowWidths
  };
}
