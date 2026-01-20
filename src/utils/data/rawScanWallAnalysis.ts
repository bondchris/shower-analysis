import convert from "convert-units";

import { SurfaceOutline } from "../../models/shapeOutline";
import { forEachRawScan } from "./rawScanIterators";

/**
 * Checks if a wall outline has notches (re-entrant corners with interior angle > 180°).
 */
function hasNotch(outline: SurfaceOutline): boolean {
  const minOutlinePoints = 3;
  if (outline.length < minOutlinePoints) {
    return false;
  }

  const angleNormalizerZero = 0;
  const fullCircleDeg = 360;
  const reentrantAngleThreshold = 180;
  const offsetPrev = 1;
  const offsetNext = 1;

  for (let i = 0; i < outline.length; i++) {
    const pPrev = outline[(i - offsetPrev + outline.length) % outline.length];
    const pCurr = outline[i];
    const pNext = outline[(i + offsetNext) % outline.length];

    if (!pPrev || !pCurr || !pNext) {
      continue;
    }

    // Vector BA (Curr -> Prev)
    const v1x = pPrev.x - pCurr.x;
    const v1y = pPrev.y - pCurr.y;

    // Vector BC (Curr -> Next)
    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;

    // Angle of BA
    const angle1 = Math.atan2(v1y, v1x);
    // Angle of BC
    const angle2 = Math.atan2(v2y, v2x);

    // Interior angle difference
    let angleDiff = convert(angle2 - angle1)
      .from("rad")
      .to("deg");

    // Normalize to [0, 360)
    if (angleDiff < angleNormalizerZero) {
      angleDiff += fullCircleDeg;
    }

    // A re-entrant corner (notch) has an interior angle > 180°
    if (angleDiff > reentrantAngleThreshold) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts maximum ceiling height differences per artifact.
 * For each artifact, finds the maximum difference between the highest point on the top of walls
 * and the lowest point on the top of walls in the same artifact.
 * Returns an array of differences in meters.
 */
export function getCeilingHeightDifferences(artifactDirs: string[]): number[] {
  const differences: number[] = [];
  const minPolygonCorners = 3;
  const minPointCoordinates = 3;
  const polygonCornerYIndex = 1;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minHeightValue = 0;
  const minCeilingDifferenceInches = 2;
  const minCeilingDifferenceMeters = convert(minCeilingDifferenceInches).from("in").to("m");

  forEachRawScan(artifactDirs, (rawScan) => {
    const maxTopHeights: number[] = [];
    const minTopHeights: number[] = [];

    for (const wall of rawScan.walls) {
      // For walls with polygonCorners, find the maximum and minimum Y values on the top edge
      if (
        wall.polygonCorners !== undefined &&
        Array.isArray(wall.polygonCorners) &&
        wall.polygonCorners.length >= minPolygonCorners
      ) {
        let minY = Number.POSITIVE_INFINITY;

        for (const corner of wall.polygonCorners) {
          if (Array.isArray(corner) && corner.length >= minPointCoordinates) {
            const yValue = corner[polygonCornerYIndex];
            if (yValue !== undefined && yValue < minY) {
              minY = yValue;
            }
          }
        }

        // Find the maximum and minimum Y values on the top edge
        // Top edge points are those with Y > minY (on the top portion of the wall)
        if (minY !== Number.POSITIVE_INFINITY) {
          let maxTopY = Number.NEGATIVE_INFINITY;
          let minTopY = Number.POSITIVE_INFINITY;
          for (const corner of wall.polygonCorners) {
            if (Array.isArray(corner) && corner.length >= minPointCoordinates) {
              const yValue = corner[polygonCornerYIndex];
              if (yValue !== undefined && yValue > minY) {
                if (yValue > maxTopY) {
                  maxTopY = yValue;
                }
                if (yValue < minTopY) {
                  minTopY = yValue;
                }
              }
            }
          }
          // Store the highest and lowest points on the top edge of this wall
          if (maxTopY !== Number.NEGATIVE_INFINITY) {
            maxTopHeights.push(maxTopY);
          }
          if (minTopY !== Number.POSITIVE_INFINITY) {
            minTopHeights.push(minTopY);
          }
        }
      } else if (Array.isArray(wall.dimensions) && wall.dimensions.length >= minDimensionsLength) {
        // For rectangular walls, the height is uniform, so top edge is at a single height
        const height = wall.dimensions[dimensionIndexHeight];
        if (height !== undefined && height > minHeightValue) {
          // For rectangular walls, Y values in polygonCorners are relative to center
          // So the top would be at height/2 from center
          const heightDivisor = 2;
          const topEdgeHeight = height / heightDivisor;
          maxTopHeights.push(topEdgeHeight);
          minTopHeights.push(topEdgeHeight);
        }
      }
    }

    if (maxTopHeights.length > minHeightValue && minTopHeights.length > minHeightValue) {
      const maxAcrossWalls = Math.max(...maxTopHeights);
      const minAcrossWalls = Math.min(...minTopHeights);
      const difference = maxAcrossWalls - minAcrossWalls;
      // Only include artifacts where ceiling heights differ by at least 2 inches
      if (difference > minCeilingDifferenceMeters) {
        differences.push(difference);
      }
    }
  });

  return differences;
}

/**
 * Extracts non-rectangular slanted wall outlines from raw scan files.
 * Slanted walls are non-rectangular walls with angled profiles but no notches (re-entrant corners).
 * Returns an array of SurfaceOutline objects.
 */
export function getSlantedWallOutlines(artifactDirs: string[]): SurfaceOutline[] {
  const outlines: SurfaceOutline[] = [];
  const minNonRectCorners = 4;
  const minPolygonCorners = 3;

  forEachRawScan(artifactDirs, (rawScan) => {
    for (const wall of rawScan.walls) {
      // Check if wall has polygonCorners with more than 4 corners (non-rectangular)
      if (
        wall.polygonCorners !== undefined &&
        Array.isArray(wall.polygonCorners) &&
        wall.polygonCorners.length > minNonRectCorners &&
        wall.polygonCorners.length >= minPolygonCorners
      ) {
        // Build outline from corners
        const points: SurfaceOutline = [];
        const xIndex = 0;
        const yIndex = 1;

        for (const corner of wall.polygonCorners) {
          if (Array.isArray(corner) && corner.length >= minPolygonCorners) {
            const x = corner[xIndex];
            const y = corner[yIndex];
            if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
              points.push({ x, y });
            }
          }
        }

        // Only include if it has no notches (slanted walls have angles but no re-entrant corners)
        if (points.length >= minPolygonCorners && !hasNotch(points)) {
          outlines.push(points);
        }
      }
    }
  });

  return outlines;
}

/**
 * Extracts non-rectangular notched wall outlines from raw scan files.
 * Notched walls are non-rectangular walls with vertical steps/notches (re-entrant corners).
 * Returns an array of SurfaceOutline objects.
 */
export function getNotchedWallOutlines(artifactDirs: string[]): SurfaceOutline[] {
  const outlines: SurfaceOutline[] = [];
  const minNonRectCorners = 4;
  const minPolygonCorners = 3;

  forEachRawScan(artifactDirs, (rawScan) => {
    for (const wall of rawScan.walls) {
      // Check if wall has polygonCorners with more than 4 corners (non-rectangular)
      if (
        wall.polygonCorners !== undefined &&
        Array.isArray(wall.polygonCorners) &&
        wall.polygonCorners.length > minNonRectCorners &&
        wall.polygonCorners.length >= minPolygonCorners
      ) {
        // Build outline from corners
        const points: SurfaceOutline = [];
        const xIndex = 0;
        const yIndex = 1;

        for (const corner of wall.polygonCorners) {
          if (Array.isArray(corner) && corner.length >= minPolygonCorners) {
            const x = corner[xIndex];
            const y = corner[yIndex];
            if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
              points.push({ x, y });
            }
          }
        }

        // Only include if it has notches (re-entrant corners)
        if (points.length >= minPolygonCorners && hasNotch(points)) {
          outlines.push(points);
        }
      }
    }
  });

  return outlines;
}
