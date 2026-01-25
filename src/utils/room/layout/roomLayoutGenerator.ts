import * as fs from "fs";
import * as path from "path";
import { Browser, chromium } from "playwright";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { Point } from "../../../models/point";
import { ObjectCategory } from "../../../models/rawScan/objectItem";
import { RawScan } from "../../../models/rawScan/rawScan";
import { logger } from "../../logger";
import { transformPoint } from "../../math/transform";
import { angle, rotate, subtract } from "../../math/vector";
import { RoomLayoutSvg } from "./RoomLayoutSvg";

export interface RoomLayoutOptions {
  backgroundColor?: string;
  doorColor?: string;
  floorColor?: string;
  height?: number;
  objectColors?: Record<string, string>;
  padding?: number;
  showLabels?: boolean;
  wallColor?: string;
  width?: number;
  windowColor?: string;
}

export interface LayoutElement {
  label?: string;
  objectType?: string;
  points: Point[];
  type: "wall" | "floor" | "object" | "door" | "window";
}

interface BoundingBox {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

/**
 * Extracts wall endpoints from transform and dimensions.
 * Walls are centered at their transform position and extend along their local X axis.
 */
function getWallEndpoints(transform: number[], dimensions: number[]): [Point, Point] {
  const widthIndex = 0;
  const halfDivisor = 2;
  const defaultWidth = 0;
  const zeroCoord = 0;

  const width = dimensions[widthIndex] ?? defaultWidth;
  const halfWidth = width / halfDivisor;

  const localStart = new Point(-halfWidth, zeroCoord);
  const localEnd = new Point(halfWidth, zeroCoord);

  const worldStart = transformPoint(localStart, transform);
  const worldEnd = transformPoint(localEnd, transform);

  return [worldStart, worldEnd];
}

/**
 * Extracts object bounding box corners in world space.
 * Objects are oriented boxes centered at their transform position.
 */
function getObjectCorners(transform: number[], dimensions: number[]): Point[] {
  const widthIndex = 0;
  const depthIndex = 2;
  const halfDivisor = 2;
  const defaultDimension = 0;

  const width = dimensions[widthIndex] ?? defaultDimension;
  const depth = dimensions[depthIndex] ?? defaultDimension;
  const halfWidth = width / halfDivisor;
  const halfDepth = depth / halfDivisor;

  const localCorners = [
    new Point(-halfWidth, -halfDepth),
    new Point(halfWidth, -halfDepth),
    new Point(halfWidth, halfDepth),
    new Point(-halfWidth, halfDepth)
  ];

  return localCorners.map((corner) => transformPoint(corner, transform));
}

/**
 * Extracts floor polygon from polygonCorners and transform.
 */
function getFloorPolygon(polygonCorners: number[][], transform: number[]): Point[] {
  const xIndex = 0;
  const zIndex = 2;
  const defaultValue = 0;

  return polygonCorners.map((corner) => {
    const localX = corner[xIndex] ?? defaultValue;
    const localZ = corner[zIndex] ?? defaultValue;
    const localPoint = new Point(localX, localZ);
    return transformPoint(localPoint, transform);
  });
}

/**
 * Finds the longest wall in the RawScan and returns the rotation angle
 * needed to align it vertically.
 */
function findLongestWallRotation(rawScan: RawScan): number {
  const noRotation = 0;
  const halfCircle = 2;
  const verticalAngle = Math.PI / halfCircle;
  const widthIndex = 0;
  const defaultWidth = 0;
  const emptyLength = 0;
  const initialMaxLength = 0;

  if (rawScan.walls.length === emptyLength) {
    return noRotation;
  }

  let longestWall: (typeof rawScan.walls)[number] | undefined = undefined;
  let maxLength = initialMaxLength;

  for (const wall of rawScan.walls) {
    if (wall.dimensions === undefined) {
      continue;
    }
    const length = wall.dimensions[widthIndex] ?? defaultWidth;
    if (length > maxLength) {
      maxLength = length;
      longestWall = wall;
    }
  }

  if (longestWall?.transform === undefined || longestWall.dimensions === undefined) {
    return noRotation;
  }

  const [start, end] = getWallEndpoints(longestWall.transform, longestWall.dimensions);
  const wallDirection = subtract(end, start);
  const currentAngle = angle(wallDirection);
  const rotationToVertical = verticalAngle - currentAngle;

  return rotationToVertical;
}

/**
 * Applies rotation to all points in all layout elements.
 */
function rotateElements(elements: LayoutElement[], rotationAngle: number): LayoutElement[] {
  return elements.map((element) => ({
    ...element,
    points: element.points.map((point) => rotate(point, rotationAngle))
  }));
}

/**
 * Computes bounding box for all layout elements.
 */
function computeBoundingBox(elements: LayoutElement[]): BoundingBox {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const element of elements) {
    for (const point of element.points) {
      if (point.x < minX) {
        minX = point.x;
      }
      if (point.x > maxX) {
        maxX = point.x;
      }
      if (point.y < minY) {
        minY = point.y;
      }
      if (point.y > maxY) {
        maxY = point.y;
      }
    }
  }

  return { maxX, maxY, minX, minY };
}

/**
 * Extracts the category name from an object's category property.
 */
function getObjectCategory(category: ObjectCategory): string {
  const categoryKeys = Object.keys(category);
  const firstCategoryIndex = 0;
  return categoryKeys[firstCategoryIndex] ?? "unknown";
}

/**
 * Extracts all layout elements from a RawScan for visualization.
 */
export function extractLayoutElements(rawScan: RawScan): LayoutElement[] {
  const elements: LayoutElement[] = [];

  // Extract floor polygons
  for (const floor of rawScan.floors) {
    if (floor.polygonCorners !== undefined && floor.transform !== undefined) {
      const points = getFloorPolygon(floor.polygonCorners, floor.transform);
      elements.push({
        label: "Floor",
        points,
        type: "floor"
      });
    }
  }

  // Extract walls
  for (const wall of rawScan.walls) {
    if (wall.transform !== undefined && wall.dimensions !== undefined) {
      const [start, end] = getWallEndpoints(wall.transform, wall.dimensions);
      elements.push({
        label: "Wall",
        points: [start, end],
        type: "wall"
      });
    }
  }

  // Extract objects
  for (const obj of rawScan.objects) {
    const corners = getObjectCorners(obj.transform, obj.dimensions);
    const categoryName = getObjectCategory(obj.category);
    elements.push({
      label: categoryName,
      objectType: categoryName,
      points: corners,
      type: "object"
    });
  }

  // Extract doors
  for (const door of rawScan.doors) {
    const doorTransform = door.transform as number[] | undefined;
    const doorDimensions = door.dimensions as number[] | undefined;
    if (doorTransform !== undefined && doorDimensions !== undefined) {
      const [start, end] = getWallEndpoints(doorTransform, doorDimensions);
      elements.push({
        label: "Door",
        points: [start, end],
        type: "door"
      });
    }
  }

  // Extract windows
  for (const window of rawScan.windows) {
    const windowTransform = window.transform as number[] | undefined;
    const windowDimensions = window.dimensions as number[] | undefined;
    if (windowTransform !== undefined && windowDimensions !== undefined) {
      const [start, end] = getWallEndpoints(windowTransform, windowDimensions);
      elements.push({
        label: "Window",
        points: [start, end],
        type: "window"
      });
    }
  }

  return elements;
}

/**
 * Generates a room layout PNG image from a RawScan.
 * This is a pure function that takes scan data and options, and writes an image file.
 */
export async function generateRoomLayoutPng(
  rawScan: RawScan,
  outputPath: string,
  options: RoomLayoutOptions = {}
): Promise<void> {
  const defaultWidth = 800;
  const defaultHeight = 800;
  const defaultPadding = 40;
  const emptyElementCount = 0;

  const width = options.width ?? defaultWidth;
  const height = options.height ?? defaultHeight;
  const padding = options.padding ?? defaultPadding;

  const rawElements = extractLayoutElements(rawScan);

  if (rawElements.length === emptyElementCount) {
    logger.warn("No layout elements found in RawScan");
    return;
  }

  const rotationAngle = findLongestWallRotation(rawScan);
  const elements = rotateElements(rawElements, rotationAngle);
  const bounds = computeBoundingBox(elements);

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(RoomLayoutSvg, {
      bounds,
      elements,
      height,
      options,
      padding,
      width
    })
  );

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: white; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let browser: Browser | undefined = undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ height, width });
    await page.setContent(fullHtml);
    await page.screenshot({ path: outputPath, type: "png" });
    logger.info(`Room layout PNG generated at: ${outputPath}`);
  } catch (error) {
    logger.error(`Failed to generate room layout PNG: ${String(error)}`);
    throw error;
  } finally {
    await browser?.close();
  }
}
