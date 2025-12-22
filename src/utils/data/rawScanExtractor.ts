import * as fs from "fs";
import * as path from "path";
import convert from "convert-units";

import { RawScan } from "../../models/rawScan/rawScan";

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

