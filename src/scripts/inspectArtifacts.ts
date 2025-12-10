import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

import { ArData } from "../models/arData/arData";
import { ArtifactMetadata } from "../models/artifactMetadata";
import { Floor } from "../models/rawScan/floor";
import { RawScan, RawScanData } from "../models/rawScan/rawScan";
import { Wall } from "../models/rawScan/wall";
import * as ChartUtils from "../utils/chartUtils";
import { distToSegment, getPosition, transformPoint } from "../utils/mathUtils";
import { doPolygonsIntersect } from "../utils/sat";

// 1. Video Metadata Extraction
async function addVideoMetadata(dirPath: string, metadata: ArtifactMetadata): Promise<boolean> {
  const filePath = path.join(dirPath, "video.mp4");
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const PATH_OFFSET_ENVIRONMENT = 3;
  const DEFAULT_VALUE = 0;

  const result = await new Promise<boolean>((resolve) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err !== null && err !== undefined) {
        resolve(false);
        return;
      }

      const stream = meta.streams.find((s) => s.codec_type === "video");
      if (stream === undefined) {
        resolve(false);
        return;
      }

      let fps = DEFAULT_VALUE;
      // Handle fraction fps if present (e.g. "30/1")
      if (stream.r_frame_rate !== undefined) {
        if (stream.r_frame_rate.includes("/")) {
          const parts = stream.r_frame_rate.split("/");
          const num = parts[NUMERATOR_IDX];
          const den = parts[DENOMINATOR_IDX];
          if (num !== undefined && den !== undefined) {
            fps = parseFloat(num) / parseFloat(den);
          }
        } else {
          fps = parseFloat(stream.r_frame_rate);
        }
      }

      const parts = filePath.split(path.sep);
      const environment = parts[parts.length - PATH_OFFSET_ENVIRONMENT] ?? "unknown";

      // Populate valid metadata
      metadata.duration = meta.format.duration ?? DEFAULT_VALUE;
      metadata.environment = environment;
      metadata.filename = path.basename(path.dirname(filePath));
      metadata.fps = fps;
      metadata.height = stream.height ?? DEFAULT_VALUE;
      metadata.path = filePath;
      metadata.width = stream.width ?? DEFAULT_VALUE;

      resolve(true);
    });
  });
  return result;
}
// 2. RawScan Analysis
function addRawScanMetadata(dirPath: string, metadata: ArtifactMetadata): void {
  const rawScanPath = path.join(dirPath, "rawScan.json");
  if (fs.existsSync(rawScanPath)) {
    try {
      const rawContent = fs.readFileSync(rawScanPath, "utf-8");
      const rawScan = JSON.parse(rawContent) as Partial<RawScanData>;
      const SQ_M_TO_SQ_FT = 10.7639;
      const INITIAL_COUNT = 0;
      const DEFAULT_VALUE = 0;
      const MIN_NON_RECT_CORNERS = 4;
      const TRANSFORM_SIZE = 16;
      const GAP_THRESHOLD_METERS = 0.0254; // 1 inch
      const MAX_WALL_DIST_METERS = 2.0;
      const ZERO = 0;
      const ONE = 1;
      const TWO = 2;

      if (rawScan.floors !== undefined && Array.isArray(rawScan.floors)) {
        let totalAreaSqM = INITIAL_COUNT;

        for (const _floor of rawScan.floors) {
          const floor = new Floor(_floor);
          totalAreaSqM += floor.area;
        }
        if (totalAreaSqM > INITIAL_COUNT) {
          metadata.roomAreaSqFt = totalAreaSqM * SQ_M_TO_SQ_FT;
        }
      }

      // Features
      if (rawScan.walls !== undefined && Array.isArray(rawScan.walls)) {
        metadata.wallCount = rawScan.walls.length;
        metadata.hasNonRectWall = rawScan.walls.some((w) => {
          const wall = w as Partial<import("../models/rawScan/wall").Wall>;
          // Cast to unknown then shape with curve to safe check despite strict type definition
          const wallWithCurve = w as unknown as { curve?: unknown };
          return (
            (wallWithCurve.curve !== undefined && wallWithCurve.curve !== null) ||
            (wall.polygonCorners !== undefined && wall.polygonCorners.length > MIN_NON_RECT_CORNERS)
          );
        });
        metadata.hasCurvedWall = rawScan.walls.some((w) => {
          const wallWithCurve = w as unknown as { curve?: unknown };
          return wallWithCurve.curve !== undefined && wallWithCurve.curve !== null;
        });
      }
      if (rawScan.objects !== undefined && Array.isArray(rawScan.objects)) {
        metadata.toiletCount = rawScan.objects.filter((o) => o.category.toilet !== undefined).length;
        metadata.tubCount = rawScan.objects.filter((o) => o.category.bathtub !== undefined).length;
        metadata.sinkCount = rawScan.objects.filter((o) => o.category.sink !== undefined).length;
        metadata.storageCount = rawScan.objects.filter((o) => o.category.storage !== undefined).length;
        metadata.hasWasherDryer = rawScan.objects.some((o) => o.category.washerDryer !== undefined);
        metadata.hasStove = rawScan.objects.some((o) => o.category.stove !== undefined);
        metadata.hasTable = rawScan.objects.some((o) => o.category.table !== undefined);
        metadata.hasChair = rawScan.objects.some((o) => o.category.chair !== undefined);
        metadata.hasBed = rawScan.objects.some((o) => o.category.bed !== undefined);
        metadata.hasSofa = rawScan.objects.some((o) => o.category.sofa !== undefined);
        metadata.hasDishwasher = rawScan.objects.some((o) => o.category.dishwasher !== undefined);
        metadata.hasOven = rawScan.objects.some((o) => o.category.oven !== undefined);
        metadata.hasRefrigerator = rawScan.objects.some((o) => o.category.refrigerator !== undefined);
        metadata.hasStairs = rawScan.objects.some((o) => o.category.stairs !== undefined);
        metadata.hasFireplace = rawScan.objects.some((o) => o.category.fireplace !== undefined);
        metadata.hasTelevision = rawScan.objects.some((o) => o.category.television !== undefined);
      }

      if (
        rawScan.openings !== undefined &&
        Array.isArray(rawScan.openings) &&
        rawScan.walls !== undefined &&
        Array.isArray(rawScan.walls)
      ) {
        const wallIds = new Set<string>();
        rawScan.walls.forEach((w) => {
          if (w.identifier !== undefined) {
            wallIds.add(w.identifier);
          }
        });

        metadata.hasExternalOpening = rawScan.openings.some((o) => {
          return o.parentIdentifier !== null && o.parentIdentifier !== undefined && wallIds.has(o.parentIdentifier);
        });

        // Refined Logic (Step 2): Check if wall is on floor perimeter
        if (rawScan.floors !== undefined && rawScan.floors.length > INITIAL_COUNT && metadata.hasExternalOpening) {
          const floor = rawScan.floors[INITIAL_COUNT]; // Assume single floor layer for now
          if (floor) {
            const corners = floor.polygonCorners;

            // Local definition to avoid missing constant
            const MIN_POLY_CORNERS = 3;
            const DEFAULT_COORD = 0;
            const ZERO_LENGTH_SQ = 0;
            const SEGMENT_START = 0;
            const SEGMENT_END = 1;
            const PERIMETER_THRESHOLD = 0.5;
            const MAT_SIZE = 16;
            const TX_IDX = 12;
            const TY_IDX = 13;
            const X_IDX = 0;
            const Y_IDX = 1;
            const NEXT_IDX = 1;

            if (corners.length >= MIN_POLY_CORNERS) {
              // Filter "candidate" external openings by checking if their parent wall is on the perimeter
              const validExternalOpenings = rawScan.openings.filter((o) => {
                if (o.parentIdentifier === undefined || o.parentIdentifier === null) {
                  return false;
                }

                // Find the wall
                const wall = rawScan.walls?.find((w) => w.identifier === o.parentIdentifier);
                // Use optional chaining and strict check
                if (wall?.transform?.length !== MAT_SIZE) {
                  return false;
                }

                // Extract Wall Position (Translation from column-major transform matrix)
                // Indices 12, 13, 14 are X, Y, Z translation
                const wx = wall.transform[TX_IDX] ?? DEFAULT_COORD;
                const wy = wall.transform[TY_IDX] ?? DEFAULT_COORD;

                // Check distance to any floor edge
                let isOnPerimeter = false;

                for (let i = 0; i < corners.length; i++) {
                  const p1 = corners[i];
                  const p2 = corners[(i + NEXT_IDX) % corners.length];
                  if (!p1 || !p2) {
                    continue;
                  }

                  // Point-to-Segment Distance (2D X-Y projection)
                  const x1 = p1[X_IDX] ?? DEFAULT_COORD;
                  const y1 = p1[Y_IDX] ?? DEFAULT_COORD;
                  const x2 = p2[X_IDX] ?? DEFAULT_COORD;
                  const y2 = p2[Y_IDX] ?? DEFAULT_COORD;

                  const A = wx - x1;
                  const B = wy - y1;
                  const C = x2 - x1;
                  const D = y2 - y1;

                  const AC = A * C;
                  const BD = B * D;
                  const dot = AC + BD;

                  const CC = C * C;
                  const DD = D * D;
                  const lenSq = CC + DD;
                  let param = -1;
                  if (lenSq !== ZERO_LENGTH_SQ) {
                    param = dot / lenSq;
                  }

                  let xx = 0;
                  let yy = 0;

                  if (param < SEGMENT_START) {
                    xx = x1;
                    yy = y1;
                  } else if (param > SEGMENT_END) {
                    xx = x2;
                    yy = y2;
                  } else {
                    const paramC = param * C;
                    const paramD = param * D;
                    xx = x1 + paramC;
                    yy = y1 + paramD;
                  }

                  const dx = wx - xx;
                  const dy = wy - yy;
                  const dxSq = dx * dx;
                  const dySq = dy * dy;
                  const dist = Math.sqrt(dxSq + dySq);

                  if (dist < PERIMETER_THRESHOLD) {
                    isOnPerimeter = true;
                    break;
                  }
                }
                return isOnPerimeter;
              });

              metadata.hasExternalOpening = validExternalOpenings.length > INITIAL_COUNT;
            }
          }
        }
      }

      // Refined Logic (Step 3): Check for Soffits (270-degree notches in wall polygons)
      if (rawScan.walls !== undefined && Array.isArray(rawScan.walls)) {
        metadata.hasSoffit = rawScan.walls.some((wData) => new Wall(wData).hasSoffit);
      }

      // Refined Logic (Step 4): Check for Toilet Gaps
      // Rules:
      // - Find Toilet
      // - Find closest wall to toilet position
      // - If distance > 1 inch, flag it.
      // NOTE: RoomPlan object origin is center of bounding box. We need "back" of toilet.
      // But we don't have dimensions easily accessible in this raw scan partial type without casting.
      // Let's look at `rawScan.objects` again.
      if (rawScan.objects !== undefined && Array.isArray(rawScan.objects)) {
        const toilets = rawScan.objects.filter((o) => o.category.toilet !== undefined);
        const walls = rawScan.walls ?? [];

        let gapErrorFound = false;

        for (const toilet of toilets) {
          if (toilet.transform.length !== TRANSFORM_SIZE) {
            continue;
          }

          const MIN_DIMENSIONS = 3;
          if (toilet.dimensions.length < MIN_DIMENSIONS) {
            continue;
          }

          // Object Space: Origin is center.
          // Z-axis is depth. We assume toilet faces +Z or -Z?
          // Usually objects face -Z in RoomPlan (or +Z?).
          // Actually, "back" of the toilet is at `Center - (Depth/2) * ForwardVector`.
          // Or `Center + (Depth/2) * ForwardVector` depending on convention.
          // However, we can just check distance from Center to Wall.
          // If Distance > (Depth/2 + 1 inch), then there is a gap.
          // This is rotation invariant for the "closest point" logic if we assume
          // the wall is the one behind it.

          const Z_DIM_IDX = 2; // Fixed: Dimensions[2] is Depth
          const HALF_DIVISOR = 2;

          const tPos = getPosition(toilet.transform); // Now returns (x, z)
          const tDepth = toilet.dimensions[Z_DIM_IDX] ?? DEFAULT_VALUE;
          const halfDepth = tDepth / HALF_DIVISOR;
          const distThreshold = halfDepth + GAP_THRESHOLD_METERS;

          // Find distance to closest wall
          let minWallDist = Number.MAX_VALUE;

          for (const w of walls) {
            // Need corners (Global/Floor space? No, walls are defined in their own local space usually?)
            // WAIT. In `rawScan.json`, walls have `polygonCorners` which are usually local 2D points relative to the Wall's transform?
            // OR are they Global points?
            // The `Wall` class logic (lines 20-80) uses corners directly. And the "Perimeter" logic (lines 240+) uses `wall.transform` to translate simple corners?
            // Actually, looking at `inspectArtifacts.ts`:
            // The perimeter logic (line 209) uses `floor.polygonCorners`.
            // The wall logic uses `wall.transform` (tx, ty) AND `corners` which seem to be missing usage in the perimeter logic...
            // Wait, line 239 `wx/wy` is Wall translation.
            // The loop `corners` is `floor.polygonCorners`.
            // So `floor` corners are global?
            // Let's assume we use `floor.polygonCorners` as the walls...
            // But detailed walls are in `rawScan.walls`.
            // Each wall has a transform. If we assume walls are essentially valid segments near that transform...
            // A better approach for RoomPlan raw data:
            // Walls are entities with `transform` (center/position) and `dimensions` and `polygonCorners`.
            // `polygonCorners` are 2D points in the Wall's local X-Y plane.
            // So we need to transform them to World Space to compare with Toilet.

            if (w.transform?.length !== TRANSFORM_SIZE) {
              continue;
            }

            // Transform Wall Segments to World
            // Simple 2D transform (ignoring rotation for a moment if we assume axis align? No, can't assume that).
            // Full transform:
            // p_world = M_wall * p_local
            const m = w.transform;
            // 2D Rotation/Translation:
            // x' = m0*x + m4*y + m12
            // y' = m1*x + m5*y + m13
            // (Assuming standard 4x4 matrix layout)

            const NEXT_IDX = 1;
            for (let i = 0; i < w.polygonCorners.length; i++) {
              const p1Local = w.polygonCorners[i];
              const p2Local = w.polygonCorners[(i + NEXT_IDX) % w.polygonCorners.length];
              if (!p1Local || !p2Local) {
                continue;
              }

              const X_IDX_MAT = 0;
              const Y_IDX_MAT = 1;
              const TX_IDX_MAT = 12;
              const TY_IDX_MAT = 13;
              const M0 = 0;
              const M1 = 1;
              const M4 = 4;
              const M5 = 5;

              const p1x = p1Local[X_IDX_MAT] ?? DEFAULT_VALUE;
              const p1y = p1Local[Y_IDX_MAT] ?? DEFAULT_VALUE;
              const p2x = p2Local[X_IDX_MAT] ?? DEFAULT_VALUE;
              const p2y = p2Local[Y_IDX_MAT] ?? DEFAULT_VALUE;

              // Transform: x' = x*m0 + y*m4 + tx
              // Transform: y' = x*m1 + y*m5 + ty
              const m0 = m[M0] ?? DEFAULT_VALUE;
              const m4 = m[M4] ?? DEFAULT_VALUE;
              const mTx = m[TX_IDX_MAT] ?? DEFAULT_VALUE;
              const m1 = m[M1] ?? DEFAULT_VALUE;
              const m5 = m[M5] ?? DEFAULT_VALUE;
              const mTy = m[TY_IDX_MAT] ?? DEFAULT_VALUE;

              const x1Term1 = p1x * m0;
              const x1Term2 = p1y * m4;
              const x1 = x1Term1 + x1Term2 + mTx;

              const y1Term1 = p1x * m1;
              const y1Term2 = p1y * m5;
              const y1 = y1Term1 + y1Term2 + mTy;

              const x2Term1 = p2x * m0;
              const x2Term2 = p2y * m4;
              const x2 = x2Term1 + x2Term2 + mTx;

              const y2Term1 = p2x * m1;
              const y2Term2 = p2y * m5;
              const y2 = y2Term1 + y2Term2 + mTy;

              const dist = distToSegment(tPos, { x: x1, y: y1 }, { x: x2, y: y2 });
              if (dist < minWallDist) {
                minWallDist = dist;
              }
            }
          }

          if (minWallDist < MAX_WALL_DIST_METERS) {
            if (minWallDist > distThreshold) {
              // Found a gap!
              gapErrorFound = true;
            }
          }
        }

        if (gapErrorFound) {
          metadata.hasToiletGapErrors = true;
        }
      }

      // Refined Logic (Step 5): Check for Tub Gaps (1" < gap < 6")
      if (rawScan.objects !== undefined && Array.isArray(rawScan.objects)) {
        const tubs = rawScan.objects.filter((o) => o.category.bathtub !== undefined);
        const walls = rawScan.walls ?? [];
        let tubGapErrorFound = false;

        // 1. Collect Wall Segments (World Space)
        const roomWalls: { id: string; corners: { x: number; y: number }[] }[] = [];
        const HALF_DIVISOR = 2;

        for (const w of walls) {
          if (w.transform?.length !== TRANSFORM_SIZE) {
            continue;
          }

          // Transform Wall Segments to World
          const wallCornersWorld: { x: number; y: number }[] = [];
          // w.polygonCorners is mandatory in Wall type
          let pCorners = w.polygonCorners;

          // Fallback: If no polygon corners, use Dimensions (Length along X)
          // Wall Local Space: X=Length, Y=Height, Z=Thickness.
          // We define segment on X-axis (Z=0).
          const MIN_CORNERS = 0;
          // Lint fix: Property appears to be non-nullable in types
          const numCorners = pCorners.length;

          if (numCorners === MIN_CORNERS) {
            const DIM_LEN_IDX = 0;
            const halfLen = (w.dimensions[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF_DIVISOR;
            // Create 2D local points [x, z]. z is 0.
            const ZERO_Z = 0;
            pCorners = [
              [-halfLen, ZERO_Z],
              [halfLen, ZERO_Z]
            ];
          }

          // Safe loop
          const MIN_POINT_SIZE = 2;
          const PT_X_IDX = 0;
          const PT_Z_IDX = 1;
          for (const p of pCorners) {
            if (p.length >= MIN_POINT_SIZE) {
              // We assume p[1] is the 2nd dimension on the plane.
              // If fallback, p[1] is 0.
              wallCornersWorld.push(
                transformPoint({ x: p[PT_X_IDX] ?? DEFAULT_VALUE, y: p[PT_Z_IDX] ?? DEFAULT_VALUE }, w.transform)
              );
            }
          }

          const MIN_WALL_CORNERS = 2;
          if (wallCornersWorld.length < MIN_WALL_CORNERS) {
            continue;
          }

          // Store for Wall Gap Analysis
          roomWalls.push({
            corners: wallCornersWorld,
            id: w.identifier ?? `wall_${roomWalls.length.toString()}`
          });
        }

        // 2. Tub Gap Analysis (1" < gap < 6")
        const GAP_TUB_MIN = 0.0254; // 1 inch
        const GAP_TUB_MAX = 0.1524; // 6 inches

        for (const tub of tubs) {
          const DIM_X = 0;
          const DIM_Z = 2;
          // HALF_DIVISOR is defined above
          const halfW = (tub.dimensions[DIM_X] ?? DEFAULT_VALUE) / HALF_DIVISOR;
          const halfD = (tub.dimensions[DIM_Z] ?? DEFAULT_VALUE) / HALF_DIVISOR; // Half Depth
          const tubCornersLocal = [
            { x: -halfW, y: -halfD },
            { x: halfW, y: -halfD },
            { x: halfW, y: halfD },
            { x: -halfW, y: halfD }
          ];

          const tubCornersWorld = tubCornersLocal.map((p) => transformPoint(p, tub.transform));

          // Check each wall (using pre-calculated corners)
          for (const rw of roomWalls) {
            const wallCornersWorld = rw.corners;
            // Min Distance Tub <-> Wall
            let minDist = Number.MAX_VALUE;

            // 2a. Tub Corners -> Wall Segments
            const NEXT_IDX = 1;
            for (const tc of tubCornersWorld) {
              for (let i = 0; i < wallCornersWorld.length; i++) {
                const p1 = wallCornersWorld[i];
                const p2 = wallCornersWorld[(i + NEXT_IDX) % wallCornersWorld.length];
                if (!p1 || !p2) {
                  continue;
                }
                const d = distToSegment(tc, p1, p2);
                if (d < minDist) {
                  minDist = d;
                }
              }
            }

            // 2b. Wall Corners -> Tub Segments
            for (const wc of wallCornersWorld) {
              for (let i = 0; i < tubCornersWorld.length; i++) {
                const p1 = tubCornersWorld[i];
                const p2 = tubCornersWorld[(i + NEXT_IDX) % tubCornersWorld.length];
                if (!p1 || !p2) {
                  continue;
                }
                const d = distToSegment(wc, p1, p2);
                if (d < minDist) {
                  minDist = d;
                }
              }
            }

            if (minDist > GAP_TUB_MIN && minDist < GAP_TUB_MAX) {
              // Found a bad gap!
              tubGapErrorFound = true;
              break;
            }
          }
          if (tubGapErrorFound) {
            break;
          }
        }

        if (tubGapErrorFound) {
          metadata.hasTubGapErrors = true;
        }

        // 3. Wall Gap Analysis (Gap between wall endpoints)
        const GAP_WALL_MIN = 0.0254; // 1 inch
        const GAP_WALL_MAX = 0.3048; // 12 inches
        let wallGapErrorFound = false;

        // Compare every wall endpoint with every other wall endpoint
        for (let i = 0; i < roomWalls.length; i++) {
          const wA = roomWalls[i];
          if (!wA) {
            continue;
          }

          // A wall segment effectively has 2 endpoints if it's a line/rect.
          // We computed corners. If it's a 2-point segment (from fallback), it's endpoints.
          // If it's a 4-point rect (from polygon), all 4 are "endpoints".
          for (const pA of wA.corners) {
            let minEndpointDist = Number.MAX_VALUE;

            for (let j = 0; j < roomWalls.length; j++) {
              if (i === j) {
                continue;
              }
              const wB = roomWalls[j];
              if (!wB) {
                continue;
              }

              for (const pB of wB.corners) {
                const EXPONENT_SQUARED = 2;
                const d = Math.sqrt(Math.pow(pA.x - pB.x, EXPONENT_SQUARED) + Math.pow(pA.y - pB.y, EXPONENT_SQUARED));
                if (d < minEndpointDist) {
                  minEndpointDist = d;
                }
              }
            }

            if (minEndpointDist > GAP_WALL_MIN && minEndpointDist < GAP_WALL_MAX) {
              wallGapErrorFound = true;
              break;
            }
          }
          if (wallGapErrorFound) {
            break;
          }
        }

        if (wallGapErrorFound) {
          metadata.hasWallGapErrors = true;
        }

        // 4. Colinear Wall Detection (Touching and Parallel)
        // Touching: < 3 inches (0.0762m)
        // Parallel: Dot product > 0.996 (approx 5 degrees)
        const TOUCH_THRESHOLD = 0.0762;
        const PARALLEL_THRESHOLD = 0.996;
        const NEXT_IDX_ONE = 1;
        const EXPONENT_SQUARED = 2;
        let colinearErrorFound = false;

        for (let i = 0; i < roomWalls.length; i++) {
          const wA = roomWalls[i];
          if (!wA) {
            continue;
          }

          // Get Direction Vector for A (using first edge)
          // Assuming corners form a closed loop or line. Wall usually a rectangle.
          // Longest edge is the wall direction? Or just first segment?
          // Fallback created points [ -halfLen, 0 ] and [ halfLen, 0 ] (Local X-axis).
          // So p[1] - p[0] is the main axis.
          // If polygonCorners exist, we need to find the "length" edge.
          // Heuristic: Use first two points? Or longest edge?
          // Let's use longest edge for direction.
          let maxLenA = 0;
          let vAx = 0;
          let vAy = 0;
          const MIN_PTS = 2;
          if (wA.corners.length < MIN_PTS) {
            continue;
          }

          for (let k = 0; k < wA.corners.length; k++) {
            const p1 = wA.corners[k];
            const p2 = wA.corners[(k + NEXT_IDX_ONE) % wA.corners.length];
            if (!p1 || !p2) {
              continue;
            }

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const termX = dx * dx;
            const termY = dy * dy;
            const len = Math.sqrt(termX + termY);
            if (len > maxLenA) {
              maxLenA = len;
              vAx = dx / len;
              vAy = dy / len;
            }
          }

          for (let j = i + NEXT_IDX_ONE; j < roomWalls.length; j++) {
            const wB = roomWalls[j];
            if (!wB) {
              continue;
            }

            // Check Touching Distance
            let isTouching = false;
            for (const pA of wA.corners) {
              for (const pB of wB.corners) {
                const dist = Math.sqrt(
                  Math.pow(pA.x - pB.x, EXPONENT_SQUARED) + Math.pow(pA.y - pB.y, EXPONENT_SQUARED)
                );
                if (dist < TOUCH_THRESHOLD) {
                  isTouching = true;
                  break;
                }
              }
              if (isTouching) {
                break;
              }
            }

            if (!isTouching) {
              continue;
            }

            // Check Parallel
            let maxLenB = 0;
            let vBx = 0;
            let vBy = 0;
            if (wB.corners.length < MIN_PTS) {
              continue;
            }

            for (let k = 0; k < wB.corners.length; k++) {
              const p1 = wB.corners[k];
              const p2 = wB.corners[(k + NEXT_IDX_ONE) % wB.corners.length];
              if (!p1 || !p2) {
                continue;
              }

              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const termX = dx * dx;
              const termY = dy * dy;
              const len = Math.sqrt(termX + termY);
              if (len > maxLenB) {
                maxLenB = len;
                vBx = dx / len;
                vBy = dy / len;
              }
            }

            const dotTerm1 = vAx * vBx;
            const dotTerm2 = vAy * vBy;
            const dot = Math.abs(dotTerm1 + dotTerm2);
            if (dot > PARALLEL_THRESHOLD) {
              colinearErrorFound = true;
              break;
            }
          }
          if (colinearErrorFound) {
            break;
          }
        }

        if (colinearErrorFound) {
          metadata.hasColinearWallErrors = true;
        }

        // 5. Nib Wall Detection (Length < 1ft / 0.3048m)
        const NIB_WALL_THRESHOLD = 0.3048;
        let nibWallFound = false;

        for (const w of roomWalls) {
          // Calculate wall length.
          // We'll use the 'corners' we already computed.
          // Assuming wall corners form a loop, find max distance between any two corners?
          // Or sum of segments? Usually they are rects. The longest side is the length.
          let maxDist = 0;
          for (let i = 0; i < w.corners.length; i++) {
            const NEXT_IDX = 1;
            for (let j = i + NEXT_IDX; j < w.corners.length; j++) {
              const p1 = w.corners[i];
              const p2 = w.corners[j];
              if (!p1 || !p2) {
                continue;
              }
              const termX = (p2.x - p1.x) * (p2.x - p1.x);
              const termY = (p2.y - p1.y) * (p2.y - p1.y);
              const d = Math.sqrt(termX + termY);
              if (d > maxDist) {
                maxDist = d;
              }
            }
          }

          const MIN_LENGTH = 0;
          if (maxDist < NIB_WALL_THRESHOLD && maxDist > MIN_LENGTH) {
            nibWallFound = true;
            break;
          }
        }

        if (nibWallFound) {
          metadata.hasNibWalls = true;
        }

        // 6. Object Intersection Detection (AABB)
        // Exclusion: Sink <-> Storage
        // Types guarantee rawScan.objects is an array
        const objects = rawScan.objects;
        let objIntersectionFound = false;

        // Pre-calculate AABBs
        const objAABBs: {
          isSink: boolean;
          isStorage: boolean;
          maxX: number;
          maxZ: number;
          minX: number;
          minZ: number;
          corners: { x: number; y: number }[];
          innerCorners: { x: number; y: number }[];
        }[] = [];

        const TOLERANCE = 0.0254; // 1 inch
        const DIM_X = 0;
        const DIM_Z = 2;
        const HALF = 2;
        const DEFAULT_DIM = 0;
        const INIT_COORD = 0;
        const ZERO = 0;
        const DIM_SIZE = 3;

        for (const o of objects) {
          // Validating lengths. TS thinks they are mandatory, but safe check at runtime inside try/catch if strictly needed.
          // Linter: Unnecessary optional chain on non-nullish.
          // Removing optional chain as per linter, relying on try-catch for runtime safety if needed.
          if (o.transform.length !== TRANSFORM_SIZE || o.dimensions.length !== DIM_SIZE) {
            objAABBs.push({
              corners: [],
              innerCorners: [],
              isSink: false,
              isStorage: false,
              maxX: INIT_COORD,
              maxZ: INIT_COORD,
              minX: INIT_COORD,
              minZ: INIT_COORD
            }); // Empty/Invalid
            continue;
          }

          const halfW = (o.dimensions[DIM_X] ?? DEFAULT_DIM) / HALF;
          const halfD = (o.dimensions[DIM_Z] ?? DEFAULT_DIM) / HALF;

          // Local corners (y is ignored for floor plan)
          const corners = [
            { x: -halfW, y: -halfD },
            { x: halfW, y: -halfD },
            { x: halfW, y: halfD },
            { x: -halfW, y: halfD }
          ];

          // Inner corners (shrunk by tolerance)
          // If object is smaller than 2*tolerance, innerCorners collapses to center or very small box
          const innerHalfW = Math.max(ZERO, halfW - TOLERANCE);
          const innerHalfD = Math.max(ZERO, halfD - TOLERANCE);
          const innerCornersLocal = [
            { x: -innerHalfW, y: -innerHalfD },
            { x: innerHalfW, y: -innerHalfD },
            { x: innerHalfW, y: innerHalfD },
            { x: -innerHalfW, y: innerHalfD }
          ];

          let minX = Number.MAX_VALUE;
          let minZ = Number.MAX_VALUE;
          let maxX = -Number.MAX_VALUE;
          let maxZ = -Number.MAX_VALUE;

          for (const c of corners) {
            const worldP = transformPoint(c, o.transform);
            if (worldP.x < minX) {
              minX = worldP.x;
            }
            if (worldP.x > maxX) {
              maxX = worldP.x;
            }
            if (worldP.y < minZ) {
              minZ = worldP.y;
            }
            if (worldP.y > maxZ) {
              maxZ = worldP.y;
            }
          }

          objAABBs.push({
            corners: corners.map((c) => {
              const res = transformPoint(c, o.transform);
              return { x: res.x, y: res.y };
            }),
            innerCorners: innerCornersLocal.map((c) => {
              const res = transformPoint(c, o.transform);
              return { x: res.x, y: res.y };
            }),
            isSink: o.category.sink !== undefined,
            isStorage: o.category.storage !== undefined,
            maxX,
            maxZ,
            minX,
            minZ
          });
        }

        for (let i = 0; i < objects.length; i++) {
          const boxA = objAABBs[i];
          if (!boxA) {
            continue;
          }
          if (boxA.corners.length === ZERO) {
            continue;
          }

          const NEXT_IDX = 1;
          for (let j = i + NEXT_IDX; j < objects.length; j++) {
            const boxB = objAABBs[j];
            if (!boxB) {
              continue;
            }
            if (boxB.corners.length === ZERO) {
              continue;
            }

            // Exclude Sink <-> Storage
            if ((boxA.isSink && boxB.isStorage) || (boxA.isStorage && boxB.isSink)) {
              continue;
            }

            // AABB Check (using inner corners for tolerance logic?)
            // If we want "Touching" to be OK, we should use shrunk boxes.
            // Check if bounds of InnerBoxes intersect.
            if (boxA.maxX < boxB.minX || boxA.minX > boxB.maxX || boxA.maxZ < boxB.minZ || boxA.minZ > boxB.maxZ) {
              continue;
            }

            // Polygons Intersect Check (SAT) using Inner Corners
            const intersects = doPolygonsIntersect(boxA.innerCorners, boxB.innerCorners);
            if (intersects) {
              objIntersectionFound = true;
              break;
            }
          }
          if (objIntersectionFound) {
            break;
          }
        }

        if (objIntersectionFound) {
          metadata.hasObjectIntersectionErrors = true;
        }

        // 7. Wall-Object Intersection
        let wallObjIntersectionFound = false;
        // Using `roomWalls` segments and `objAABBs` (shrunk).
        // For each Object (Inner Poly), check intersection with any Wall Segment?
        // OR: Wall generally contains objects?
        // Actually, objects should NOT intersect walls significantly (embedded is OK, but crossing through is bad?).
        // If an object is "touching" a wall, that's fine.
        // If it's 50% through a wall, that's bad.
        // Simple logic: If object AABB center dist to wall is very small/zero?
        // Using "Polygons Intersect" with Wall Rect and Object Rect?
        // Wall Rect (PolygonCorners) vs Object InnerPoly.
        // If they intersect, it's an error.

        // Get Wall Polygons (World Space)
        for (const w of walls) {
          if (w.transform?.length !== TRANSFORM_SIZE) {
            continue;
          }

          // Construct Wall Footprint from Dimensions (Length x Thickness)
          // We avoid using polygonCorners here because they might describe the Vertical Face (Length x Height),
          // which would be interpreted as a massive thickness if treated as Z-depth.
          const DIM_LEN_IDX = 0;
          const DIM_THICK_IDX = 2;
          const THICKNESS_DEFAULT = 0.15; // 15cm approx if missing
          const halfLen = (w.dimensions[DIM_LEN_IDX] ?? DEFAULT_VALUE) / HALF;
          const halfThick = (w.dimensions[DIM_THICK_IDX] ?? THICKNESS_DEFAULT) / HALF;

          const wallFootprintLocal = [
            { x: -halfLen, y: -halfThick },
            { x: halfLen, y: -halfThick },
            { x: halfLen, y: halfThick },
            { x: -halfLen, y: halfThick }
          ];

          const wallPolyWorld: { x: number; y: number }[] = [];
          for (const p of wallFootprintLocal) {
            // p.y is Local Z (Thickness)
            wallPolyWorld.push(transformPoint({ x: p.x, y: p.y }, w.transform));
          }

          // Check Intersection with Objects
          for (const box of objAABBs) {
            if (box.innerCorners.length === ZERO) {
              continue;
            }
            // Objects can touch walls.
            // If we use Shrunk Object, it shouldn't intersect Wall.
            // (Unless it's embedded significantly).
            if (doPolygonsIntersect(wallPolyWorld, box.innerCorners)) {
              wallObjIntersectionFound = true;
              break;
            }
          }
          if (wallObjIntersectionFound) {
            break;
          }
        }

        if (wallObjIntersectionFound) {
          metadata.hasWallObjectIntersectionErrors = true;
        }
      }

      // 8. Wall-Wall Intersection (Non-End/Corner)
      // T-junctions or X-junctions are errors in some contexts?
      // Assuming valid RoomPlan should have clean corners.
      // If two walls intersect internally (not at endpoints), flag it.
      if (rawScan.walls !== undefined && Array.isArray(rawScan.walls)) {
        // We need 2D Segments of Walls' center-lines.
        const wallSegments = rawScan.walls
          .map((w) => {
            if (w.transform?.length === TRANSFORM_SIZE) {
              let p1Local: { x: number; y: number } | null = null;
              let p2Local: { x: number; y: number } | null = null;
              // 1. Try PolygonCorners (Preferred)
              const wPolySafe = w as unknown as { polygonCorners?: number[][] };
              if (wPolySafe.polygonCorners !== undefined && wPolySafe.polygonCorners.length >= TWO) {
                // Find min/max X in local space
                let minX = Number.MAX_VALUE;
                let maxX = -Number.MAX_VALUE;
                const PT_X_IDX = 0;
                for (const p of w.polygonCorners) {
                  const val = p[PT_X_IDX] ?? DEFAULT_VALUE;
                  if (val < minX) {
                    minX = val;
                  }
                  if (val > maxX) {
                    maxX = val;
                  }
                }
                // Avoid tiny walls? Original code didn't filter them.
                if (maxX > minX) {
                  p1Local = { x: minX, y: 0 };
                  p2Local = { x: maxX, y: 0 };
                }
              }

              // 2. Fallback to Dimensions
              if (p1Local === null) {
                const wSafe = w as unknown as { dimensions?: number[] };
                if (wSafe.dimensions !== undefined && wSafe.dimensions.length > ZERO) {
                  const DIM_LEN_IDX = 0;
                  const halfLen = (wSafe.dimensions[DIM_LEN_IDX] ?? DEFAULT_VALUE) / TWO;
                  p1Local = { x: -halfLen, y: 0 };
                  p2Local = { x: halfLen, y: 0 };
                }
              }

              if (p1Local !== null && p2Local !== null) {
                const p1 = transformPoint(p1Local, w.transform);
                const p2 = transformPoint(p2Local, w.transform);
                return { p1, p2 };
              }
            }
            return null;
          })
          .filter((s) => s !== null) as { p1: { x: number; y: number }; p2: { x: number; y: number } }[];

        let wallIntersectErr = false;
        // Check pair-wise
        for (let i = 0; i < wallSegments.length; i++) {
          for (let j = i + ONE; j < wallSegments.length; j++) {
            const s1 = wallSegments[i];
            const s2 = wallSegments[j];

            if (!s1 || !s2) {
              continue;
            }

            // proper intersection check (excluding endpoints)
            // https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
            const x1 = s1.p1.x;
            const y1 = s1.p1.y;
            const x2 = s1.p2.x;
            const y2 = s1.p2.y;
            const x3 = s2.p1.x;
            const y3 = s2.p1.y;
            const x4 = s2.p2.x;
            const y4 = s2.p2.y;

            const term1 = (x1 - x2) * (y3 - y4);
            const term2 = (y1 - y2) * (x3 - x4);
            const den = term1 - term2;
            const EPSILON = 1e-9;
            if (Math.abs(den) < EPSILON) {
              continue; // Parallel
            }

            const numTTerm1 = (x1 - x3) * (y3 - y4);
            const numTTerm2 = (y1 - y3) * (x3 - x4);
            const numT = numTTerm1 - numTTerm2;

            const numUTerm1 = (x1 - x2) * (y1 - y3);
            const numUTerm2 = (y1 - y2) * (x1 - x3);
            const numU = -(numUTerm1 - numUTerm2);
            const t = numT / den;
            const u = numU / den;

            // Relaxed slightly to exclude valid corners (endpoints) and floating point noise.
            const LOW = 0.00001; // 0.001% buffer
            const HIGH = ONE - LOW;

            const tInternal = t > LOW && t < HIGH;
            const uInternal = u > LOW && u < HIGH;

            // Error if BOTH are internal (X-crossing).
            if (tInternal && uInternal) {
              wallIntersectErr = true;
              break;
            }
          }
          if (wallIntersectErr) {
            break;
          }
        }

        if (wallIntersectErr) {
          metadata.hasWallWallIntersectionErrors = true;
        }
      }

      // 9. Crooked Wall Detection (Angle not 0/90/180/270 relative to main axis?)
      // Heuristic: Most walls should align to a Manhattan grid.
      // If a wall is "off-axis" significantly.
      // Find "dominant" axis of room?
      // Or just check if walls are parallel/perpendicular to *each other*.
      // Let's implement simple check: If relative angle to "first" wall is non-90-increments.
      if (rawScan.walls !== undefined && Array.isArray(rawScan.walls) && rawScan.walls.length > ZERO) {
        // Compute angles
        const angles: number[] = [];
        for (const w of rawScan.walls) {
          if (w.transform?.length === TRANSFORM_SIZE) {
            // Forward vector of wall from rotation matrix
            // Columns 0, 1, 2 are axes X, Y, Z.
            // Local X is "length".
            // World vector X' = (m0, m2)
            const m0 = w.transform[ZERO] ?? ZERO;
            const m2 = w.transform[TWO] ?? ZERO;
            const ang = Math.atan2(m2, m0); // Radians
            angles.push(ang);
          }
        }

        if (angles.length > ZERO) {
          // Compare all to angles[0]
          const base = angles[ZERO];
          // Check base is defined
          if (base !== undefined) {
            const PI_BY_2 = Math.PI / TWO;

            let crookedFound = false;
            for (let i = 1; i < angles.length; i++) {
              const ang = angles[i];
              if (ang === undefined) {
                continue;
              }
              const diff2 = Math.abs(ang - base);
              // distance to nearest 90 deg multiple
              // k = round(diff2 / (PI/2))
              const step = PI_BY_2;
              const nearestK = Math.round(diff2 / step);
              const idealDiff = nearestK * step;
              const deviation = Math.abs(diff2 - idealDiff);

              // "Crooked" means intended linear but slightly off.
              // If it's drastically off (e.g. 45 deg), it's likely intentional geometry (diagonal).
              // Thresholds:
              // > 3 degrees (0.05 rad) -> Not straight
              // < 30 degrees (0.52 rad) -> Not diagonal
              const THRESHOLD_MIN = 0.05;
              const THRESHOLD_MAX = 0.52;

              if (deviation > THRESHOLD_MIN && deviation < THRESHOLD_MAX) {
                crookedFound = true;
                break;
              }
            }
            if (crookedFound) {
              metadata.hasCrookedWallErrors = true;
            }
          }
        }
      }

      // 10. Door Blocking (Door sweep intersects Object)
      if (rawScan.doors && Array.isArray(rawScan.doors) && rawScan.objects && Array.isArray(rawScan.objects)) {
        const DOOR_CLEARANCE_METERS = 0.6;
        const WIDTH_SHRINK = 0.1; // Shrink width slightly to avoid grazing
        const DIVISOR = 2;
        const VAL_ZERO = 0;
        const DIM_X_IDX = 0;
        const DIM_Z_IDX = 2;

        const objPolys: { category: string; corners: { x: number; y: number }[] }[] = [];
        for (const o of rawScan.objects) {
          // Get footprint
          if (o.transform.length !== TRANSFORM_SIZE) {
            continue;
          }
          const dX = o.dimensions[DIM_X_IDX] ?? VAL_ZERO;
          const dZ = o.dimensions[DIM_Z_IDX] ?? VAL_ZERO;
          const hX = dX / DIVISOR;
          const hZ = dZ / DIVISOR;
          // Local corners (bottom footprint)
          const localCorners = [
            { x: -hX, y: -hZ },
            { x: hX, y: -hZ },
            { x: hX, y: hZ },
            { x: -hX, y: hZ }
          ];
          const worldCorners = localCorners.map((p) => transformPoint(p, o.transform));
          objPolys.push({ category: JSON.stringify(o.category), corners: worldCorners });
        }

        let doorBlocked = false;

        for (const door of rawScan.doors) {
          const dW = door.dimensions[DIM_X_IDX] ?? VAL_ZERO;
          const halfDW = Math.max(VAL_ZERO, dW - WIDTH_SHRINK) / DIVISOR;
          // Clearance box
          const clearanceBox = [
            { x: -halfDW, y: -DOOR_CLEARANCE_METERS },
            { x: halfDW, y: -DOOR_CLEARANCE_METERS },
            { x: halfDW, y: DOOR_CLEARANCE_METERS },
            { x: -halfDW, y: DOOR_CLEARANCE_METERS }
          ];
          const clearancePoly = clearanceBox.map((p) => transformPoint(p, door.transform));

          for (const objRes of objPolys) {
            const intersects = doPolygonsIntersect(clearancePoly, objRes.corners);
            if (intersects) {
              doorBlocked = true;
              break;
            }
          }
          if (doorBlocked) {
            break;
          }
        }

        if (doorBlocked) {
          metadata.hasDoorBlockingError = true;
        }
      }
    } catch {
      // Ignore
    }
  }
}

function findArtifactDirectories(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);

  // Check if this directory is an artifact directory (contains video.mp4, arData.json, and rawScan.json)
  if (list.includes("video.mp4") && list.includes("arData.json") && list.includes("rawScan.json")) {
    results.push(dir);
  }

  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findArtifactDirectories(fullPath));
    }
  }
  return results;
}

async function main(): Promise<void> {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const REPORT_PATH = path.join(process.cwd(), "reports", "data-analysis.pdf");
  const INITIAL_COUNT = 0;
  const PROGRESS_UPDATE_INTERVAL = 10;
  const DECIMAL_PLACES = 2;
  const INCREMENT_STEP = 1;

  const MARGIN = 50;
  const PDF_TITLE_SIZE = 25;
  const PDF_BODY_SIZE = 12;
  const SPACING_SMALL = 0.5;
  const PDF_SUBTITLE_SIZE = 16;
  const CHART_SPACING = 10;

  // Histogram Constants
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  console.log("Finding artifacts...");
  const artifactDirs = findArtifactDirectories(DATA_DIR);
  console.log(`Found ${artifactDirs.length.toString()} artifact directories.`);

  console.log(" extracting metadata...");
  const metadataList: ArtifactMetadata[] = [];
  const NOT_SET = "";
  const NO_RESULTS = 0;
  let processed = INITIAL_COUNT;

  for (const dir of artifactDirs) {
    const metadata = new ArtifactMetadata();
    const success = await addVideoMetadata(dir, metadata);
    if (success) {
      addRawScanMetadata(dir, metadata);
      const arDataPath = path.join(dir, "arData.json");
      if (fs.existsSync(arDataPath)) {
        try {
          const content = fs.readFileSync(arDataPath, "utf-8");
          const json = JSON.parse(content) as unknown;
          const _arData = new ArData(json);
          const frames = Object.values(_arData.data);

          if (frames.length > INITIAL_COUNT) {
            // Lens Model
            const firstFrame = frames[INITIAL_COUNT];
            if (firstFrame) {
              const model = firstFrame.exifData.LensModel;
              if (model !== undefined && model !== NOT_SET) {
                metadata.lensModel = model;
              }
            }
          }

          // Calculate Averages
          let totalIntensity = 0;
          let totalTemperature = 0;
          let totalISO = 0;
          let totalBrightness = 0; // Exif BrightnessValue
          let count = 0;
          const MIN_VALID_FRAMES = 0;

          for (const frame of frames) {
            // Check for existence explicitly if needed, but safe navigation usage suggests they are optional
            // Using strict checks to satisfy linter
            // exifData is required per interface, so no check needed
            if (frame.lightEstimate) {
              // ambientIntensity and ambientColorTemperature are required in LightEstimate interface
              totalIntensity += frame.lightEstimate.ambientIntensity;
              totalTemperature += frame.lightEstimate.ambientColorTemperature;
              count++;
            }

            // ISOSpeedRatings check (exifData is required)
            const isoRatings = frame.exifData.ISOSpeedRatings;
            if (isoRatings !== undefined && isoRatings !== NOT_SET) {
              // Strip non-numeric chars (sometimes comes as "( 125 )" or similar)
              const isoStr = isoRatings.replace(/[^0-9.]/g, "");
              const isoVal = parseFloat(isoStr);
              if (!isNaN(isoVal)) {
                totalISO += isoVal;
              }
            }

            // BrightnessValue check
            const brightness = frame.exifData.BrightnessValue;
            if (brightness !== undefined && brightness !== NOT_SET) {
              // BrightnessValue is typically a number string, but sanity check
              const briVal = parseFloat(brightness);
              if (!isNaN(briVal)) {
                totalBrightness += briVal;
              }
            }
          }

          if (count > MIN_VALID_FRAMES) {
            metadata.avgAmbientIntensity = totalIntensity / count;
            metadata.avgColorTemperature = totalTemperature / count;
            metadata.avgIso = totalISO / count;
            metadata.avgBrightness = totalBrightness / count;
          }
        } catch {
          // Ignore
        }
      }

      metadataList.push(metadata);
      if (processed % PROGRESS_UPDATE_INTERVAL === INITIAL_COUNT) {
        process.stdout.write(".");
      }
      processed++;
    }
  }

  console.log("\nMetadata extraction complete.\n");

  if (metadataList.length === INITIAL_COUNT) {
    console.log("No metadata available to report.");
    return;
  }

  // Validate Raw Scans
  console.log("Validating Raw Scans...");
  const invalidScans: string[] = [];
  for (const m of metadataList) {
    const rawScanPath = path.join(path.dirname(m.path), "rawScan.json");
    if (fs.existsSync(rawScanPath)) {
      try {
        const content = fs.readFileSync(rawScanPath, "utf-8");
        const json = JSON.parse(content) as unknown;
        const _scan = new RawScan(json); // Validates on construction
        // Use variable to avoid unused error
        process.stdout.write(_scan.version ? "" : "");
      } catch (e) {
        invalidScans.push(`${m.filename} [${m.environment}]: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (invalidScans.length > INITIAL_COUNT) {
    console.log("\n--- Invalid Raw Scans ---");
    invalidScans.forEach((s) => {
      console.log(`- ${s}`);
    });
    console.log("-------------------------\n");
  } else {
    console.log("All raw scans are valid.\n");
  }
  // --- Analysis ---
  const DURATION_CHART_WIDTH = 1020;
  const DURATION_CHART_HEIGHT = 320;
  const durations = metadataList.map((m) => m.duration);
  const avgDuration =
    durations.length > INITIAL_COUNT
      ? durations.reduce((a, b) => a + b, INITIAL_COUNT) / durations.length
      : INITIAL_COUNT;

  // Lens Models
  const lensMap: Record<string, number> = {};
  for (const m of metadataList) {
    if (m.lensModel !== NOT_SET) {
      lensMap[m.lensModel] = (lensMap[m.lensModel] ?? INITIAL_COUNT) + INCREMENT_STEP;
    }
  }
  // Sort by count descending
  const lensLabels = Object.keys(lensMap).sort((a, b) => (lensMap[b] ?? INITIAL_COUNT) - (lensMap[a] ?? INITIAL_COUNT));
  const lensCounts = lensLabels.map((l) => lensMap[l] ?? INITIAL_COUNT);
  const lensChart = await ChartUtils.createBarChart(lensLabels, lensCounts, "Lens Model Distribution", {
    height: DURATION_CHART_HEIGHT,
    horizontal: true,
    width: DURATION_CHART_WIDTH
  });

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > NO_RESULTS);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > NO_RESULTS);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > NO_RESULTS);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== NO_RESULTS);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > NO_RESULTS);

  // Charts
  console.log("Generating charts...");

  // Duration: min 10, max 120, bin 10
  const durationChart = await ChartUtils.createHistogram(durations, "Seconds", "Duration", {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 120,
    min: 10,
    width: DURATION_CHART_WIDTH
  });

  // Ambient: 980-1040, bin 5
  const ambChart = await ChartUtils.createHistogram(intensityVals, "Lumens", "Ambient Intensity", {
    binSize: 5,
    max: 1040,
    min: 980
  });

  // Temp: 4000-6000, bin 250
  const tempChart = await ChartUtils.createHistogram(tempVals, "Kelvin", "Color Temperature", {
    binSize: 250,
    colorByValue: ChartUtils.kelvinToRgb,
    max: 6000,
    min: 4000
  });

  // ISO: 0-800, bin 50
  const isoChart = await ChartUtils.createHistogram(isoVals, "ISO", "ISO Speed", {
    binSize: 50,
    hideUnderflow: true,
    max: 800,
    min: 0
  });

  // Brightness: 0-6, bin 1
  const briChart = await ChartUtils.createHistogram(briVals, "Value (EV)", "Brightness Value", {
    binSize: 1,
    decimalPlaces: 1,
    max: 6,
    min: 0
  });

  // Room Area: 0-150, bin 10
  const areaChart = await ChartUtils.createHistogram(areaVals, "Sq Ft", "Room Area", {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 150,
    min: 0,
    width: DURATION_CHART_WIDTH
  });

  // Existing FPS/Res logic
  const framerates = metadataList.map((m) => Math.round(m.fps));
  const fpsDistribution: Record<string, number> = {};
  framerates.forEach((fps) => {
    fpsDistribution[String(fps)] = (fpsDistribution[String(fps)] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const fpsLabels = Object.keys(fpsDistribution).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsDistribution[l] ?? INITIAL_COUNT);
  const fpsChart = await ChartUtils.createBarChart(fpsLabels, fpsCounts, "Framerate");

  const resolutions = metadataList.map((m) => `${m.width.toString()}x${m.height.toString()}`);
  const resDistribution: Record<string, number> = {};
  resolutions.forEach((res) => {
    resDistribution[res] = (resDistribution[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  });
  const resLabels = Object.keys(resDistribution).sort();
  const resCounts = resLabels.map((l) => resDistribution[l] ?? INITIAL_COUNT);
  const resChart = await ChartUtils.createBarChart(resLabels, resCounts, "Resolution");

  // Layout Constants (Needed for PDF layout)
  const Y_START = 130;
  const H = 160;
  const W = 250;
  const GAP_Y = 200;
  const FULL_W = 510;
  const LEFT_X = 50;
  const TEXT_PADDING = 15;
  const RIGHT_X = LEFT_X + W + CHART_SPACING;

  // Feature Prevalence
  let countNonRect = INITIAL_COUNT;
  let countTwoToilets = INITIAL_COUNT;
  let countTwoTubs = INITIAL_COUNT;
  let countFewWalls = INITIAL_COUNT;
  let countCurvedWalls = INITIAL_COUNT;
  let countNoVanity = INITIAL_COUNT;
  let countExternalOpening = INITIAL_COUNT;
  let countSoffit = INITIAL_COUNT;
  let countToiletGapErrors = INITIAL_COUNT;
  let countTubGapErrors = INITIAL_COUNT;
  let countWallGapErrors = INITIAL_COUNT;
  let countColinearWallErrors = INITIAL_COUNT;
  let countNibWalls = INITIAL_COUNT;
  let countObjectIntersectionErrors = INITIAL_COUNT;
  let countWallObjectIntersectionErrors = INITIAL_COUNT;
  let countWallWallIntersectionErrors = INITIAL_COUNT;
  let countCrookedWallErrors = INITIAL_COUNT;
  let countDoorBlockingErrors = INITIAL_COUNT;
  let countWasherDryer = INITIAL_COUNT;
  let countStove = INITIAL_COUNT;
  let countTable = INITIAL_COUNT;
  let countChair = INITIAL_COUNT;
  let countBed = INITIAL_COUNT;
  let countSofa = INITIAL_COUNT;
  let countDishwasher = INITIAL_COUNT;
  let countOven = INITIAL_COUNT;
  let countRefrigerator = INITIAL_COUNT;
  let countStairs = INITIAL_COUNT;
  let countFireplace = INITIAL_COUNT;
  let countTelevision = INITIAL_COUNT;

  for (const m of metadataList) {
    if (m.hasNonRectWall) {
      countNonRect++;
    }
    if (m.hasCurvedWall) {
      countCurvedWalls++;
    }
    if (m.toiletCount >= MIN_TOILETS) {
      countTwoToilets++;
    }
    if (m.tubCount >= MIN_TUBS) {
      countTwoTubs++;
    }
    if (m.wallCount < MIN_WALLS) {
      countFewWalls++;
    }
    const sinks = m.sinkCount;
    const storage = m.storageCount;
    if (sinks === INITIAL_COUNT && storage === INITIAL_COUNT) {
      countNoVanity++;
    }
    if (m.hasExternalOpening) {
      countExternalOpening++;
    }
    if (m.hasSoffit) {
      countSoffit++;
    }
    if (m.hasToiletGapErrors) {
      countToiletGapErrors++;
    }
    if (m.hasTubGapErrors) {
      countTubGapErrors++;
    }
    if (m.hasWallGapErrors) {
      countWallGapErrors++;
    }
    if (m.hasColinearWallErrors) {
      countColinearWallErrors++;
    }
    if (m.hasNibWalls) {
      countNibWalls++;
    }
    if (m.hasObjectIntersectionErrors) {
      countObjectIntersectionErrors++;
    }
    if (m.hasWallObjectIntersectionErrors) {
      countWallObjectIntersectionErrors++;
    }
    if (m.hasWallWallIntersectionErrors) {
      countWallWallIntersectionErrors++;
    }
    if (m.hasCrookedWallErrors) {
      countCrookedWallErrors++;
    }
    if (m.hasDoorBlockingError) {
      countDoorBlockingErrors++;
    }
    // New Feature Counts
    if (m.hasWasherDryer) {
      countWasherDryer++;
    }
    if (m.hasStove) {
      countStove++;
    }
    if (m.hasTable) {
      countTable++;
    }
    if (m.hasChair) {
      countChair++;
    }
    if (m.hasBed) {
      countBed++;
    }
    if (m.hasSofa) {
      countSofa++;
    }
    if (m.hasDishwasher) {
      countDishwasher++;
    }
    if (m.hasOven) {
      countOven++;
    }
    if (m.hasRefrigerator) {
      countRefrigerator++;
    }
    if (m.hasStairs) {
      countStairs++;
    }
    if (m.hasFireplace) {
      countFireplace++;
    }
    if (m.hasTelevision) {
      countTelevision++;
    }
  }

  const featureLabels = [
    "Non-Rectangular Walls",
    "Curved Walls",
    "2+ Toilets",
    "2+ Tubs",
    "< 4 Walls",
    "No Vanity",
    "External Opening",
    "Soffit",
    "Nib Walls (< 1ft)",
    "Washer/Dryer",
    "Stove",
    "Table",
    "Chair",
    "Bed",
    "Sofa",
    "Dishwasher",
    "Oven",
    "Refrigerator",
    "Stairs",
    "Fireplace",
    "Television"
  ];
  const featureCounts = [
    countNonRect,
    countCurvedWalls,
    countTwoToilets,
    countTwoTubs,
    countFewWalls,
    countNoVanity,
    countExternalOpening,
    countSoffit,
    countNibWalls,
    countWasherDryer,
    countStove,
    countTable,
    countChair,
    countBed,
    countSofa,
    countDishwasher,
    countOven,
    countRefrigerator,
    countStairs,
    countFireplace,
    countTelevision
  ];
  const FEATURE_CHART_HEIGHT = 1500;
  const featureChart = await ChartUtils.createBarChart(featureLabels, featureCounts, "Feature Prevalence", {
    height: FEATURE_CHART_HEIGHT,
    horizontal: true,
    totalForPercentages: metadataList.length,
    width: DURATION_CHART_WIDTH
  });

  // Error Chart
  const errorLabels = [
    'Toilet Gap > 1"',
    'Tub Gap 1"-6"',
    'Wall Gaps 1"-12"',
    "Colinear Walls",
    "Object Intersections",
    "Wall <-> Object Intersections",
    "Wall <-> Wall Intersections",
    "Crooked Walls",
    "Door Blocked"
  ];
  const errorCounts = [
    countToiletGapErrors,
    countTubGapErrors,
    countWallGapErrors,
    countColinearWallErrors,
    countObjectIntersectionErrors,
    countWallObjectIntersectionErrors,
    countWallWallIntersectionErrors,
    countCrookedWallErrors,
    countDoorBlockingErrors
  ];
  const errorChart = await ChartUtils.createBarChart(errorLabels, errorCounts, "Capture Errors", {
    height: DURATION_CHART_HEIGHT,
    horizontal: true,
    totalForPercentages: metadataList.length,
    width: DURATION_CHART_WIDTH
  });

  // PDF Generation
  console.log("Generating PDF...");
  const doc = new PDFDocument({ margin: MARGIN });
  doc.pipe(fs.createWriteStream(REPORT_PATH));

  // --- Page 1: Summary ---
  const summaryText = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES)}s | Videos: ${metadataList.length.toString()}`;
  doc.fontSize(PDF_TITLE_SIZE).text("Artifact Data Analysis", { align: "center" });
  doc.fontSize(PDF_BODY_SIZE).text(summaryText, { align: "center" });
  doc.moveDown(SPACING_SMALL);

  // Row 1: Duration (Full Width)
  doc.image(durationChart, LEFT_X, Y_START, { height: H, width: FULL_W });
  doc.text("Duration", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: FULL_W });

  // Row 2: Lens Model (Full Width, Horizontal)
  const Y_ROW2 = Y_START + GAP_Y;
  doc.image(lensChart, LEFT_X, Y_ROW2, { height: H, width: FULL_W });
  doc.text("Lens Model", LEFT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: FULL_W });

  // Row 3: Framerate (Left) & Resolution (Right)
  const Y_ROW3 = Y_ROW2 + GAP_Y;
  doc.image(fpsChart, LEFT_X, Y_ROW3, { height: H, width: W });
  doc.text("Framerate", LEFT_X, Y_ROW3 + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(resChart, RIGHT_X, Y_ROW3, { height: H, width: W });
  doc.text("Resolution", RIGHT_X, Y_ROW3 + H + TEXT_PADDING, { align: "center", width: W });

  // --- Page 2: Lighting ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Lighting & Exposure", { align: "center" });

  // Row 1: Ambient (Left) & Temp (Right)
  doc.image(ambChart, LEFT_X, Y_START, { height: H, width: W });
  doc.text("Ambient Intensity", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(tempChart, RIGHT_X, Y_START, { height: H, width: W });
  doc.text("Color Temperature", RIGHT_X, Y_START + H + TEXT_PADDING, { align: "center", width: W });

  // Row 2: ISO (Left) & Brightness (Right)
  doc.image(isoChart, LEFT_X, Y_ROW2, { height: H, width: W });
  doc.text("ISO Speed", LEFT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: W });

  doc.image(briChart, RIGHT_X, Y_ROW2, { height: H, width: W });
  doc.text("Brightness Value", RIGHT_X, Y_ROW2 + H + TEXT_PADDING, { align: "center", width: W });

  // --- Page 3: Room Analysis ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Room Analysis", { align: "center" });

  doc.image(areaChart, LEFT_X, Y_START, { height: H, width: FULL_W });
  doc.text("Room Area (Sq Ft)", LEFT_X, Y_START + H + TEXT_PADDING, { align: "center", width: FULL_W });

  doc.image(errorChart, LEFT_X, Y_START + GAP_Y, { height: H, width: FULL_W });
  doc.text("Capture Errors", LEFT_X, Y_START + GAP_Y + H + TEXT_PADDING, {
    align: "center",
    width: FULL_W
  });

  // --- Page 4: Feature Prevalence ---
  doc.addPage();
  doc.fontSize(PDF_SUBTITLE_SIZE).text("Feature Prevalence", { align: "center" });

  const FEATURE_PDF_HEIGHT = 600;
  doc.image(featureChart, LEFT_X, Y_START, { height: FEATURE_PDF_HEIGHT, width: FULL_W });

  doc.end();
  console.log(`Report generated at: ${REPORT_PATH}`);
}

main().catch(console.error);
