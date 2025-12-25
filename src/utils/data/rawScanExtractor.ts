import * as fs from "fs";
import * as path from "path";
import convert from "convert-units";

import { Point } from "../../models/point";
import { RawScan } from "../../models/rawScan/rawScan";
import { extractRawScanMetadata } from "../room/metadata";
import { TRANSFORM_SIZE } from "../math/constants";
import { doPolygonsIntersect } from "../math/polygon";
import { transformPoint } from "../math/transform";

type ObjectConfidenceCounts = Record<string, [number, number, number]>; // [high, medium, low]

/**
 * Extracts object confidence counts from raw scan files.
 * Counts objects by type and confidence level (high, medium, low).
 */
export function getObjectConfidenceCounts(artifactDirs: string[]): ObjectConfidenceCounts {
  const counts: ObjectConfidenceCounts = {} as ObjectConfidenceCounts;
  const confidenceZeroValue = 0;

  const confidenceIndexHigh = 0;
  const confidenceIndexMedium = 1;
  const confidenceIndexLow = 2;

  const incrementConfidence = (
    objectType: string,
    confidence: { high?: unknown; medium?: unknown; low?: unknown }
  ): void => {
    const defaultCounts: [number, number, number] = [confidenceZeroValue, confidenceZeroValue, confidenceZeroValue];
    counts[objectType] ??= defaultCounts;
    const currentCounts = counts[objectType];

    // Count by confidence level: [high, medium, low]
    if (confidence.high !== undefined) {
      currentCounts[confidenceIndexHigh]++;
    } else if (confidence.medium !== undefined) {
      currentCounts[confidenceIndexMedium]++;
    } else if (confidence.low !== undefined) {
      currentCounts[confidenceIndexLow]++;
    }
  };

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      // Count objects from rawScan.objects
      for (const obj of rawScan.objects) {
        // Determine object type (only objects, not doors/windows/openings)
        let objectType: string | null = null;
        if (obj.category.toilet !== undefined) {
          objectType = "Toilet";
        } else if (obj.category.storage !== undefined) {
          objectType = "Storage";
        } else if (obj.category.sink !== undefined) {
          objectType = "Sink";
        } else if (obj.category.bathtub !== undefined) {
          objectType = "Bathtub";
        } else if (obj.category.washerDryer !== undefined) {
          objectType = "Washer/Dryer";
        } else if (obj.category.stove !== undefined) {
          objectType = "Stove";
        } else if (obj.category.table !== undefined) {
          objectType = "Table";
        } else if (obj.category.chair !== undefined) {
          objectType = "Chair";
        } else if (obj.category.bed !== undefined) {
          objectType = "Bed";
        } else if (obj.category.sofa !== undefined) {
          objectType = "Sofa";
        } else if (obj.category.dishwasher !== undefined) {
          objectType = "Dishwasher";
        } else if (obj.category.oven !== undefined) {
          objectType = "Oven";
        } else if (obj.category.refrigerator !== undefined) {
          objectType = "Refrigerator";
        } else if (obj.category.stairs !== undefined) {
          objectType = "Stairs";
        } else if (obj.category.fireplace !== undefined) {
          objectType = "Fireplace";
        } else if (obj.category.television !== undefined) {
          objectType = "Television";
        }

        if (objectType !== null) {
          incrementConfidence(objectType, obj.confidence);
        }
      }

      // Count doors, windows, and openings (they have confidence but are separate entities)
      for (const door of rawScan.doors) {
        incrementConfidence("Door", door.confidence);
      }

      for (const window of rawScan.windows) {
        incrementConfidence("Window", window.confidence);
      }

      for (const opening of rawScan.openings) {
        if (opening.confidence !== undefined) {
          incrementConfidence("Opening", opening.confidence);
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return counts;
}

/**
 * Finds artifact directories containing raw scans with unexpected versions.
 */
export function getUnexpectedVersionArtifactDirs(artifactDirs: string[]): Set<string> {
  const unexpectedDirs = new Set<string>();
  const expectedVersion = 2;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));
      if (rawScan.version !== expectedVersion) {
        unexpectedDirs.add(dir);
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return unexpectedDirs;
}

/**
 * Returns a set of artifact directories that have at least one wall with area less than 1.5 sq ft.
 * Areas are calculated in square meters and compared against the threshold (approximately 0.139 sq m).
 */
export function getArtifactsWithSmallWalls(artifactDirs: string[]): Set<string> {
  const artifactsWithSmallWalls = new Set<string>();
  const minWallAreaSqFt = 1.5;
  const minWallAreaSqM = convert(minWallAreaSqFt).from("ft2").to("m2");
  const dimensionIndexLength = 0;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minAreaValue = 0;
  const minPolygonCorners = 3;
  const pointIndexX = 0;
  const pointIndexZ = 1;
  const initialCount = 0;
  const nextOffset = 1;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const wall of rawScan.walls) {
        const hasPolygonCorners =
          wall.polygonCorners !== undefined &&
          Array.isArray(wall.polygonCorners) &&
          wall.polygonCorners.length >= minPolygonCorners;

        if (hasPolygonCorners && wall.polygonCorners !== undefined) {
          // Calculate wall area from polygon corners: perimeter * height
          const corners = wall.polygonCorners;
          let perimeter = initialCount;

          for (let i = initialCount; i < corners.length; i++) {
            const j = (i + nextOffset) % corners.length;
            const p1 = corners[i];
            const p2 = corners[j];

            if (
              p1 !== undefined &&
              p2 !== undefined &&
              p1.length >= minPolygonCorners &&
              p2.length >= minPolygonCorners
            ) {
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

          // Get height from dimensions
          const height =
            Array.isArray(wall.dimensions) && wall.dimensions.length > dimensionIndexHeight
              ? wall.dimensions[dimensionIndexHeight]
              : undefined;

          if (height !== undefined && height > minAreaValue && perimeter > minAreaValue) {
            const area = perimeter * height;
            if (area < minWallAreaSqM) {
              artifactsWithSmallWalls.add(dir);
              break; // Found one small wall, no need to check more walls in this artifact
            }
          }
        } else if (Array.isArray(wall.dimensions) && wall.dimensions.length >= minDimensionsLength) {
          // Calculate wall area from dimensions: length * height
          const length = wall.dimensions[dimensionIndexLength];
          const height = wall.dimensions[dimensionIndexHeight];

          if (length !== undefined && height !== undefined && length > minAreaValue && height > minAreaValue) {
            const area = length * height;
            if (area < minWallAreaSqM) {
              artifactsWithSmallWalls.add(dir);
              break; // Found one small wall, no need to check more walls in this artifact
            }
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return artifactsWithSmallWalls;
}

/**
 * Extracts window areas from raw scan files.
 * Returns areas in square meters.
 */
export function getWindowAreas(artifactDirs: string[]): number[] {
  const areas: number[] = [];
  const dimensionIndexWidth = 0;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minAreaValue = 0;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const window of rawScan.windows) {
        if (Array.isArray(window.dimensions) && window.dimensions.length >= minDimensionsLength) {
          const width = window.dimensions[dimensionIndexWidth];
          const height = window.dimensions[dimensionIndexHeight];
          if (width !== undefined && height !== undefined && width > minAreaValue && height > minAreaValue) {
            areas.push(width * height);
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return areas;
}

/**
 * Extracts door areas from raw scan files.
 * Returns areas in square meters.
 */
export function getDoorAreas(artifactDirs: string[]): number[] {
  const areas: number[] = [];
  const dimensionIndexWidth = 0;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minAreaValue = 0;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const door of rawScan.doors) {
        if (Array.isArray(door.dimensions) && door.dimensions.length >= minDimensionsLength) {
          const width = door.dimensions[dimensionIndexWidth];
          const height = door.dimensions[dimensionIndexHeight];
          if (width !== undefined && height !== undefined && width > minAreaValue && height > minAreaValue) {
            areas.push(width * height);
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return areas;
}

/**
 * Extracts opening areas from raw scan files.
 * Returns areas in square meters.
 */
export function getOpeningAreas(artifactDirs: string[]): number[] {
  const areas: number[] = [];
  const dimensionIndexWidth = 0;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minAreaValue = 0;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const opening of rawScan.openings) {
        if (Array.isArray(opening.dimensions) && opening.dimensions.length >= minDimensionsLength) {
          const width = opening.dimensions[dimensionIndexWidth];
          const height = opening.dimensions[dimensionIndexHeight];
          if (width !== undefined && height !== undefined && width > minAreaValue && height > minAreaValue) {
            areas.push(width * height);
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return areas;
}

/**
 * Extracts wall areas from raw scan files.
 * Returns areas in square meters.
 * Calculates area from polygon corners (perimeter * height) or dimensions (length * height).
 */
export function getWallAreas(artifactDirs: string[]): number[] {
  const areas: number[] = [];
  const dimensionIndexLength = 0;
  const dimensionIndexHeight = 1;
  const minDimensionsLength = 2;
  const minAreaValue = 0;
  const minPolygonCorners = 3;
  const pointIndexX = 0;
  const pointIndexZ = 1;
  const initialCount = 0;
  const nextOffset = 1;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const wall of rawScan.walls) {
        const hasPolygonCorners =
          wall.polygonCorners !== undefined &&
          Array.isArray(wall.polygonCorners) &&
          wall.polygonCorners.length >= minPolygonCorners;

        if (hasPolygonCorners && wall.polygonCorners !== undefined) {
          // Calculate wall area from polygon corners: perimeter * height
          const corners = wall.polygonCorners;
          let perimeter = initialCount;

          for (let i = initialCount; i < corners.length; i++) {
            const j = (i + nextOffset) % corners.length;
            const p1 = corners[i];
            const p2 = corners[j];

            if (
              p1 !== undefined &&
              p2 !== undefined &&
              p1.length >= minPolygonCorners &&
              p2.length >= minPolygonCorners
            ) {
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

          // Get height from dimensions
          const height =
            Array.isArray(wall.dimensions) && wall.dimensions.length > dimensionIndexHeight
              ? wall.dimensions[dimensionIndexHeight]
              : undefined;

          if (height !== undefined && height > minAreaValue && perimeter > minAreaValue) {
            areas.push(perimeter * height);
          }
        } else if (Array.isArray(wall.dimensions) && wall.dimensions.length >= minDimensionsLength) {
          // Calculate wall area from dimensions: length * height
          const length = wall.dimensions[dimensionIndexLength];
          const height = wall.dimensions[dimensionIndexHeight];

          if (length !== undefined && height !== undefined && length > minAreaValue && height > minAreaValue) {
            areas.push(length * height);
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return areas;
}

/**
 * Converts areas from square meters to square feet.
 */
export function convertAreasToSquareFeet(areasInSquareMeters: number[]): number[] {
  return areasInSquareMeters.map((area) => convert(area).from("m2").to("ft2"));
}

/**
 * Converts lengths from meters to feet.
 */
export function convertLengthsToFeet(lengthsInMeters: number[]): number[] {
  return lengthsInMeters.map((length) => convert(length).from("m").to("ft"));
}

/**
 * Converts lengths from meters to inches.
 */
export function convertLengthsToInches(lengthsInMeters: number[]): number[] {
  return lengthsInMeters.map((length) => convert(length).from("m").to("in"));
}

/**
 * Extracts tub lengths from raw scan files.
 * Returns lengths in meters.
 */
export function getTubLengths(artifactDirs: string[]): number[] {
  const lengths: number[] = [];
  const dimensionIndexLength = 0;
  const minDimensionsLength = 1;
  const minLengthValue = 0;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const obj of rawScan.objects) {
        if (obj.category.bathtub !== undefined) {
          if (Array.isArray(obj.dimensions) && obj.dimensions.length >= minDimensionsLength) {
            const length = obj.dimensions[dimensionIndexLength];
            if (length !== undefined && length > minLengthValue) {
              lengths.push(length);
            }
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return lengths;
}

/**
 * Extracts vanity lengths from raw scan files.
 * Returns lengths in meters.
 * Vanity detection logic:
 * 1. If there's a storage object intersecting with a sink, use that storage object.
 * 2. If there's not, then look for a sink and use that.
 * 3. If there's no sink in the room at all, then look for the largest storage object.
 * 4. If there are no sink and no storage objects, then the room has no vanity.
 */
export function getVanityLengths(artifactDirs: string[]): number[] {
  const lengths: number[] = [];
  const dimensionIndexLength = 0;
  const minDimensionsLength = 1;
  const minLengthValue = 0;
  const dimX = 0;
  const dimZ = 2;
  const half = 2;
  const defaultDim = 0;
  const zero = 0;
  const dimSize = 3;
  const tolerance = 0.0254; // 1 inch

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      // Build bounding boxes for all objects
      type ObjectItem = typeof rawScan.objects[number];
      interface ObjectBoundingBox {
        corners: Point[];
        innerCorners: Point[];
        isSink: boolean;
        isStorage: boolean;
        object: ObjectItem;
        story: number;
      }

      const objectBoxes: ObjectBoundingBox[] = [];
      const sinks: ObjectItem[] = [];
      const storages: ObjectItem[] = [];

      for (const obj of rawScan.objects) {
        const isSink = obj.category.sink !== undefined;
        const isStorage = obj.category.storage !== undefined;

        if (isSink) {
          sinks.push(obj);
        }
        if (isStorage) {
          storages.push(obj);
        }

        // Skip invalid objects
        if (
          obj.dimensions.every((d) => d === zero) ||
          obj.transform.length !== TRANSFORM_SIZE ||
          obj.dimensions.length !== dimSize
        ) {
          continue;
        }

        const halfW = (obj.dimensions[dimX] ?? defaultDim) / half;
        const halfD = (obj.dimensions[dimZ] ?? defaultDim) / half;

        // Local corners (y is ignored for floor plan)
        const corners = [
          new Point(-halfW, -halfD),
          new Point(halfW, -halfD),
          new Point(halfW, halfD),
          new Point(-halfW, halfD)
        ];

        // Inner corners (shrunk by tolerance)
        const innerHalfW = Math.max(zero, halfW - tolerance);
        const innerHalfD = Math.max(zero, halfD - tolerance);
        const innerCornersLocal = [
          new Point(-innerHalfW, -innerHalfD),
          new Point(innerHalfW, -innerHalfD),
          new Point(innerHalfW, innerHalfD),
          new Point(-innerHalfW, innerHalfD)
        ];

        const worldCorners = corners.map((c) => transformPoint(c, obj.transform));
        const worldInnerCorners = innerCornersLocal.map((c) => transformPoint(c, obj.transform));

        objectBoxes.push({
          corners: worldCorners,
          innerCorners: worldInnerCorners,
          isSink,
          isStorage,
          object: obj,
          story: obj.story
        });
      }

      // Step 1: Check for storage objects intersecting with sinks
      let vanityObject: ObjectItem | null = null;

      for (const storageBox of objectBoxes) {
        if (!storageBox.isStorage) {
          continue;
        }

        for (const sinkBox of objectBoxes) {
          if (!sinkBox.isSink) {
            continue;
          }

          // Check if on same story
          if (storageBox.story !== sinkBox.story) {
            continue;
          }

          // Check intersection using polygon intersection
          if (doPolygonsIntersect(storageBox.innerCorners, sinkBox.innerCorners)) {
            vanityObject = storageBox.object;
            break;
          }
        }

        if (vanityObject !== null) {
          break;
        }
      }

      // Step 2: If no storage+sink intersection, use sink
      const firstSinkIndex = 0;
      if (vanityObject === null && sinks.length > zero) {
        const firstSink = sinks[firstSinkIndex];
        if (firstSink !== undefined) {
          vanityObject = firstSink;
        }
      }

      // Step 3: If no sink, use largest storage object
      if (vanityObject === null && storages.length > zero) {
        let largestStorage: ObjectItem | null = null;
        let largestLength = minLengthValue;

        for (const storage of storages) {
          if (
            Array.isArray(storage.dimensions) &&
            storage.dimensions.length >= minDimensionsLength
          ) {
            const length = storage.dimensions[dimensionIndexLength];
            if (length !== undefined && length > largestLength) {
              largestLength = length;
              largestStorage = storage;
            }
          }
        }

        vanityObject = largestStorage;
      }

      // Step 4: Extract length if vanity found
      if (vanityObject !== null) {
        if (
          Array.isArray(vanityObject.dimensions) &&
          vanityObject.dimensions.length >= minDimensionsLength
        ) {
          const length = vanityObject.dimensions[dimensionIndexLength];
          if (length !== undefined && length > minLengthValue) {
            lengths.push(length);
          }
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return lengths;
}

/**
 * Extracts sink counts per artifact from metadata files.
 * Returns a record mapping sink count (as string) to number of artifacts with that count.
 * Uses extractRawScanMetadata to ensure consistency and generate metadata if missing.
 */
export function getSinkCounts(artifactDirs: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const initialCount = 0;
  const increment = 1;

  for (const dir of artifactDirs) {
    const metadata = extractRawScanMetadata(dir);
    if (metadata === null) {
      continue;
    }

    const sinkCountKey = metadata.sinkCount.toString();
    counts[sinkCountKey] = (counts[sinkCountKey] ?? initialCount) + increment;
  }

  return counts;
}

/**
 * Extracts vanity type classifications from raw scan files.
 * Returns a record mapping vanity type to number of scans.
 * Vanity types: "normal" (storage + sink intersecting), "sink only", "storage only", "no vanity"
 */
export function getVanityTypes(artifactDirs: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const initialCount = 0;
  const increment = 1;
  const dimX = 0;
  const dimZ = 2;
  const half = 2;
  const defaultDim = 0;
  const zero = 0;
  const dimSize = 3;
  const tolerance = 0.0254; // 1 inch

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      // Build bounding boxes for all objects
      type ObjectItem = typeof rawScan.objects[number];
      interface ObjectBoundingBox {
        corners: Point[];
        innerCorners: Point[];
        isSink: boolean;
        isStorage: boolean;
        object: ObjectItem;
        story: number;
      }

      const objectBoxes: ObjectBoundingBox[] = [];
      const sinks: ObjectItem[] = [];
      const storages: ObjectItem[] = [];

      for (const obj of rawScan.objects) {
        const isSink = obj.category.sink !== undefined;
        const isStorage = obj.category.storage !== undefined;

        if (isSink) {
          sinks.push(obj);
        }
        if (isStorage) {
          storages.push(obj);
        }

        // Skip invalid objects
        if (
          obj.dimensions.every((d) => d === zero) ||
          obj.transform.length !== TRANSFORM_SIZE ||
          obj.dimensions.length !== dimSize
        ) {
          continue;
        }

        const halfW = (obj.dimensions[dimX] ?? defaultDim) / half;
        const halfD = (obj.dimensions[dimZ] ?? defaultDim) / half;

        // Local corners (y is ignored for floor plan)
        const corners = [
          new Point(-halfW, -halfD),
          new Point(halfW, -halfD),
          new Point(halfW, halfD),
          new Point(-halfW, halfD)
        ];

        // Inner corners (shrunk by tolerance)
        const innerHalfW = Math.max(zero, halfW - tolerance);
        const innerHalfD = Math.max(zero, halfD - tolerance);
        const innerCornersLocal = [
          new Point(-innerHalfW, -innerHalfD),
          new Point(innerHalfW, -innerHalfD),
          new Point(innerHalfW, innerHalfD),
          new Point(-innerHalfW, innerHalfD)
        ];

        const worldCorners = corners.map((c) => transformPoint(c, obj.transform));
        const worldInnerCorners = innerCornersLocal.map((c) => transformPoint(c, obj.transform));

        objectBoxes.push({
          corners: worldCorners,
          innerCorners: worldInnerCorners,
          isSink,
          isStorage,
          object: obj,
          story: obj.story
        });
      }

      // Check for storage objects intersecting with sinks
      let hasStorageSinkIntersection = false;

      for (const storageBox of objectBoxes) {
        if (!storageBox.isStorage) {
          continue;
        }

        for (const sinkBox of objectBoxes) {
          if (!sinkBox.isSink) {
            continue;
          }

          // Check if on same story
          if (storageBox.story !== sinkBox.story) {
            continue;
          }

          // Check intersection using polygon intersection
          if (doPolygonsIntersect(storageBox.innerCorners, sinkBox.innerCorners)) {
            hasStorageSinkIntersection = true;
            break;
          }
        }

        if (hasStorageSinkIntersection) {
          break;
        }
      }

      // Classify vanity type
      let vanityType = "no vanity";
      if (hasStorageSinkIntersection) {
        vanityType = "normal";
      } else if (sinks.length > zero) {
        vanityType = "sink only";
      } else if (storages.length > zero) {
        vanityType = "storage only";
      }

      counts[vanityType] = (counts[vanityType] ?? initialCount) + increment;
    } catch {
      // Skip invalid rawScan files
    }
  }

  return counts;
}

/**
 * Extracts door isOpen values from raw scan files.
 * Returns a record mapping isOpen values (as strings) to their counts.
 */
export function getDoorIsOpenCounts(artifactDirs: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const initialCount = 0;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const door of rawScan.doors) {
        const isOpen = door.category.door?.isOpen;
        // Convert boolean to string, handle undefined as "Unknown"
        let key = "Unknown";
        if (isOpen === true) {
          key = "Open";
        } else if (isOpen === false) {
          key = "Closed";
        }
        const increment = 1;
        counts[key] = (counts[key] ?? initialCount) + increment;
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return counts;
}

/**
 * Extracts object attribute counts from raw scan files.
 * Returns a record mapping attribute type to a record of attribute values and their counts.
 */
export function getObjectAttributeCounts(
  artifactDirs: string[],
  attributeType: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  const initialCount = 0;
  const increment = 1;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      for (const obj of rawScan.objects) {
        const attributeValue = obj.attributes[attributeType];
        if (attributeValue !== undefined && typeof attributeValue === "string") {
          counts[attributeValue] = (counts[attributeValue] ?? initialCount) + increment;
        }
      }
    } catch {
      // Skip invalid rawScan files
    }
  }

  return counts;
}

/**
 * Counts walls with windows, doors, and openings across all raw scan files.
 * Returns counts for walls that have at least one window, door, or opening.
 */
export function getWallEmbeddedCounts(artifactDirs: string[]): {
  wallsWithWindows: number;
  wallsWithDoors: number;
  wallsWithOpenings: number;
  totalWalls: number;
} {
  const initialCount = 0;
  let wallsWithWindows = initialCount;
  let wallsWithDoors = initialCount;
  let wallsWithOpenings = initialCount;
  let totalWalls = initialCount;

  for (const dir of artifactDirs) {
    const rawScanPath = path.join(dir, "rawScan.json");
    if (!fs.existsSync(rawScanPath)) {
      continue;
    }

    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = new RawScan(JSON.parse(rawContent));

      // Create sets of wall identifiers that have windows, doors, or openings
      const wallsWithWindowsSet = new Set<string>();
      const wallsWithDoorsSet = new Set<string>();
      const wallsWithOpeningsSet = new Set<string>();

      // Count walls with windows
      for (const window of rawScan.windows) {
        if (window.parentIdentifier !== null) {
          wallsWithWindowsSet.add(window.parentIdentifier);
        }
      }

      // Count walls with doors
      for (const door of rawScan.doors) {
        if (door.parentIdentifier !== null) {
          wallsWithDoorsSet.add(door.parentIdentifier);
        }
      }

      // Count walls with openings
      for (const opening of rawScan.openings) {
        if (opening.parentIdentifier !== null && opening.parentIdentifier !== undefined) {
          wallsWithOpeningsSet.add(opening.parentIdentifier);
        }
      }

      wallsWithWindows += wallsWithWindowsSet.size;
      wallsWithDoors += wallsWithDoorsSet.size;
      wallsWithOpenings += wallsWithOpeningsSet.size;
      totalWalls += rawScan.walls.length;
    } catch {
      // Skip invalid rawScan files
    }
  }

  return {
    totalWalls,
    wallsWithDoors,
    wallsWithOpenings,
    wallsWithWindows
  };
}

