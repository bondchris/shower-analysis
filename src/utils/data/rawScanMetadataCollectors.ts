import convert from "convert-units";

import { SurfaceOutline } from "../../models/shapeOutline";
import { collectFromMetadata } from "./rawScanIterators";

// Simple metadata collectors - areas
export const getWindowAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowAreas);
export const getDoorAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorAreas);
export const getOpeningAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingAreas);
export const getWallAreas = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallAreas);

// Simple metadata collectors - lengths
export const getTubLengths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.tubLengths);
export const getVanityLengths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.vanityLengths);

// Simple metadata collectors - wall dimensions
export const getWallHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallHeights);
export const getWallWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallWidths);

// Simple metadata collectors - dimension pairs
export const getWallWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.wallWidthHeightPairs);
export const getDoorWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorWidthHeightPairs);
export const getWindowWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowWidthHeightPairs);
export const getOpeningWidthHeightPairs = (dirs: string[]) =>
  collectFromMetadata(dirs, (m) => m.openingWidthHeightPairs);

// Simple metadata collectors - individual dimensions
export const getWindowHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowHeights);
export const getWindowWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.windowWidths);
export const getDoorHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorHeights);
export const getDoorWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.doorWidths);
export const getOpeningHeights = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingHeights);
export const getOpeningWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.openingWidths);

// Simple metadata collectors - floor dimensions
export const getFloorLengths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.floorLengths);
export const getFloorWidths = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.floorWidths);
export const getFloorWidthHeightPairs = (dirs: string[]) => collectFromMetadata(dirs, (m) => m.floorWidthHeightPairs);

// Simple metadata collectors - outlines
export const getFloorOutlines = (dirs: string[]): SurfaceOutline[] =>
  collectFromMetadata(dirs, (m) => m.floorOutlines);
export const getWallOutlines = (dirs: string[]): SurfaceOutline[] => collectFromMetadata(dirs, (m) => m.wallOutlines);
export const getWindowOutlines = (dirs: string[]): SurfaceOutline[] =>
  collectFromMetadata(dirs, (m) => m.windowOutlines);
export const getDoorOutlines = (dirs: string[]): SurfaceOutline[] => collectFromMetadata(dirs, (m) => m.doorOutlines);
export const getOpeningOutlines = (dirs: string[]): SurfaceOutline[] =>
  collectFromMetadata(dirs, (m) => m.openingOutlines);

// Unit conversion helpers

function convertAll(values: number[], from: convert.Unit, to: convert.Unit): number[] {
  return values.map((v) => convert(v).from(from).to(to));
}

export const convertAreasToSquareFeet = (a: number[]) => convertAll(a, "m2", "ft2");
export const convertLengthsToFeet = (l: number[]) => convertAll(l, "m", "ft");
export const convertLengthsToInches = (l: number[]) => convertAll(l, "m", "in");
