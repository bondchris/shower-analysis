import { RawScan } from "../../../models/rawScan/rawScan";

const INITIAL_COUNT = 0;
const MIN_POLYGON_CORNERS_LENGTH = 0;
const RECTANGULAR_CORNER_COUNT = 4;

/**
 * Checks if any embedded entities (doors/windows/openings) have curved shapes.
 */
export function hasCurvedEmbedded(rawScan: RawScan): boolean {
  return (
    rawScan.doors.some((d) => {
      if (d.parentIdentifier === null) {
        return false;
      }
      const curveValue = d.curve as unknown;
      return curveValue !== null && curveValue !== undefined;
    }) ||
    rawScan.windows.some((w) => {
      if (w.parentIdentifier === null) {
        return false;
      }
      const curveValue = w.curve as unknown;
      return curveValue !== null && curveValue !== undefined;
    }) ||
    rawScan.openings.some((o) => {
      if (o.parentIdentifier === null || o.parentIdentifier === undefined) {
        return false;
      }
      const curveValue = o.curve as unknown;
      return curveValue !== null && curveValue !== undefined;
    })
  );
}

/**
 * Checks if any embedded entities (doors/windows/openings) have non-rectangular shapes.
 */
export function hasNonRectangularEmbedded(rawScan: RawScan): boolean {
  return (
    rawScan.doors.some(
      (d) =>
        d.parentIdentifier !== null &&
        d.polygonCorners.length > MIN_POLYGON_CORNERS_LENGTH &&
        d.polygonCorners.length !== RECTANGULAR_CORNER_COUNT
    ) ||
    rawScan.windows.some(
      (w) =>
        w.parentIdentifier !== null &&
        w.polygonCorners.length > MIN_POLYGON_CORNERS_LENGTH &&
        w.polygonCorners.length !== RECTANGULAR_CORNER_COUNT
    ) ||
    rawScan.openings.some(
      (o) =>
        o.parentIdentifier !== null &&
        o.parentIdentifier !== undefined &&
        o.polygonCorners !== undefined &&
        o.polygonCorners.length > MIN_POLYGON_CORNERS_LENGTH &&
        o.polygonCorners.length !== RECTANGULAR_CORNER_COUNT
    )
  );
}

/**
 * Checks if any embedded entities (doors/windows/openings) are unparented (no parent wall).
 */
export function hasUnparentedEmbedded(rawScan: RawScan): boolean {
  return (
    rawScan.doors.some((d) => d.parentIdentifier === null) ||
    rawScan.windows.some((w) => w.parentIdentifier === null) ||
    rawScan.openings.some((o) => o.parentIdentifier === null)
  );
}

/**
 * Checks if any entities have non-empty completedEdges arrays.
 */
export function hasNonEmptyCompletedEdges(rawScan: RawScan): boolean {
  return (
    rawScan.doors.some((d) => d.completedEdges.length > INITIAL_COUNT) ||
    rawScan.floors.some((f) => f.completedEdges !== undefined && f.completedEdges.length > INITIAL_COUNT) ||
    rawScan.openings.some((o) => o.completedEdges !== undefined && o.completedEdges.length > INITIAL_COUNT) ||
    rawScan.walls.some((w) => w.completedEdges !== undefined && w.completedEdges.length > INITIAL_COUNT) ||
    rawScan.windows.some((w) => w.completedEdges.length > INITIAL_COUNT)
  );
}
