import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

import { ArData } from "../models/arData/arData";
import { Floor } from "../models/rawScan/floor";
import { RawScan, RawScanData } from "../models/rawScan/rawScan";
import { Wall } from "../models/rawScan/wall";
import * as ChartUtils from "../utils/chartUtils";
import { doPolygonsIntersect } from "../utils/sat";

interface VideoMetadata {
  path: string;
  filename: string;
  environment: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  lensModel?: string;
  avgAmbientIntensity?: number;
  avgColorTemperature?: number;
  avgIso?: number;
  avgBrightness?: number;
  roomAreaSqFt?: number;
  hasNonRectWall?: boolean;
  toiletCount?: number;
  tubCount?: number;
  sinkCount?: number;
  storageCount?: number;
  wallCount?: number;
  hasCurvedWall?: boolean;
  hasExternalOpening?: boolean;
  hasSoffit?: boolean;
  hasToiletGapErrors?: boolean;
  hasTubGapErrors?: boolean;
  hasWallGapErrors?: boolean;
  hasColinearWallErrors?: boolean;
  hasNibWalls?: boolean;
  hasObjectIntersectionErrors?: boolean;
  hasWallObjectIntersectionErrors?: boolean;
  hasWallWallIntersectionErrors?: boolean;
  hasCrookedWallErrors?: boolean;
}

// 1. Video Metadata Extraction
async function getVideoMetadata(filePath: string): Promise<VideoMetadata | null> {
  const SPLIT_LENGTH = 2;
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const PATH_OFFSET_ENVIRONMENT = 3;
  const DEFAULT_VALUE = 0;

  const result = await new Promise<VideoMetadata | null>((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        resolve(null);
        return;
      }

      const stream = metadata.streams.find((s) => s.codec_type === "video");
      if (stream === undefined) {
        resolve(null);
        return;
      }

      // Extract FPS (e.g., "60/1" -> 60)
      let fps = DEFAULT_VALUE;
      if (stream.r_frame_rate !== undefined) {
        const parts = stream.r_frame_rate.split("/");
        if (parts.length === SPLIT_LENGTH) {
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

      resolve({
        duration: metadata.format.duration ?? DEFAULT_VALUE,
        environment,
        filename: path.basename(filePath),
        fps,
        height: stream.height ?? DEFAULT_VALUE,
        path: filePath,
        width: stream.width ?? DEFAULT_VALUE
      });
    });
  });
  return result;
}

function findVideoFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) {
    return [];
  }
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findVideoFiles(fullPath));
    } else if (file === "video.mp4") {
      results.push(fullPath);
    }
  }
  return results;
}

// Main Execution
async function main(): Promise<void> {
  const DATA_DIR = path.join(process.cwd(), "data", "artifacts");
  const REPORT_PATH = path.join(process.cwd(), "reports", "data-analysis.pdf");
  const INITIAL_COUNT = 0;
  const PROGRESS_UPDATE_INTERVAL = 10;
  const DECIMAL_PLACES = 2;
  const INCREMENT_STEP = 1;
  const TRANSFORM_SIZE = 16;
  const X_IDX = 12;
  const Z_IDX = 14;
  const DEFAULT_VALUE = 0;
  // Toilet Gap Constants
  const GAP_THRESHOLD_METERS = 0.0254; // 1 inch
  const MAX_WALL_DIST_METERS = 2.0; // Reasonable max dist to check for a backing wall

  // Math Helpers (Local)
  const getPosition = (transform: number[]): { x: number; y: number } => {
    // Check if transform is valid (size 16)
    if (transform.length !== TRANSFORM_SIZE) {
      return { x: 0, y: 0 };
    }
    // Use X (idx 12) and Z (idx 14) for floor plane position
    return { x: transform[X_IDX] ?? DEFAULT_VALUE, y: transform[Z_IDX] ?? DEFAULT_VALUE };
  };

  const transformPoint = (p: { x: number; y: number }, m: number[]): { x: number; y: number } => {
    // X-Z Plane Transform (Top Down)
    // x' = x*m0 + z*m8 + tx
    // z' = x*m2 + z*m10 + tz
    // Note: Input p.y corresponds to Local Z. Output p.y corresponds to World Z.
    const MAT_M0 = 0; // r0, c0 (Xx)
    const MAT_M2 = 2; // r2, c0 (Xz)
    const MAT_M8 = 8; // r0, c2 (Zx)
    const MAT_M10 = 10; // r2, c2 (Zz)
    const MAT_TX = 12; // r0, c3 (Tx)
    const MAT_TZ = 14; // r2, c3 (Tz)
    const DEFAULT_VALUE = 0;

    const m0 = m[MAT_M0] ?? DEFAULT_VALUE;
    const m8 = m[MAT_M8] ?? DEFAULT_VALUE;
    const mTx = m[MAT_TX] ?? DEFAULT_VALUE;

    const m2 = m[MAT_M2] ?? DEFAULT_VALUE;
    const m10 = m[MAT_M10] ?? DEFAULT_VALUE;
    const mTz = m[MAT_TZ] ?? DEFAULT_VALUE;

    const termX1 = p.x * m0;
    const termX2 = p.y * m8;
    const x = termX1 + termX2 + mTx;

    const termZ1 = p.x * m2;
    const termZ2 = p.y * m10;
    const y = termZ1 + termZ2 + mTz;

    return { x, y };
  };

  const distToSegment = (
    p: { x: number; y: number },
    v: { x: number; y: number },
    w: { x: number; y: number }
  ): number => {
    // l2 = length squared of segment vw
    const EXPONENT_SQUARED = 2;
    const l2 = Math.pow(v.x - w.x, EXPONENT_SQUARED) + Math.pow(v.y - w.y, EXPONENT_SQUARED);
    const ZERO_LENGTH = 0;
    if (l2 === ZERO_LENGTH) {
      return Math.sqrt(Math.pow(p.x - v.x, EXPONENT_SQUARED) + Math.pow(p.y - v.y, EXPONENT_SQUARED));
    }
    // t = projection of p onto line vw, clamped between 0 and 1
    // t = dot(p - v, w - v) / l2
    const pXDiff = p.x - v.x;
    const vXDiff = w.x - v.x;
    const pYDiff = p.y - v.y;
    const vYDiff = w.y - v.y;
    const term1 = pXDiff * vXDiff;
    const term2 = pYDiff * vYDiff;
    const dotP = term1 + term2;
    let t = dotP / l2;
    const MIN_CLAMP = 0;
    const MAX_CLAMP = 1;
    t = Math.max(MIN_CLAMP, Math.min(MAX_CLAMP, t));
    // Projection Point = v + t * (w - v)
    const tX = t * (w.x - v.x);
    const projX = v.x + tX;
    const tY = t * (w.y - v.y);
    const projY = v.y + tY;
    return Math.sqrt(Math.pow(p.x - projX, EXPONENT_SQUARED) + Math.pow(p.y - projY, EXPONENT_SQUARED));
  };

  const MARGIN = 50;
  const PDF_TITLE_SIZE = 25;
  const PDF_BODY_SIZE = 12;
  const SPACING_SMALL = 0.5;
  const PDF_SUBTITLE_SIZE = 16;
  const CHART_SPACING = 10;

  // Histogram Constants

  const SQ_M_TO_SQ_FT = 10.7639;
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;
  const DEFAULT_WALL_COUNT = 4;
  const MIN_NON_RECT_CORNERS = 4;

  console.log("Finding video files...");
  const videoFiles = findVideoFiles(DATA_DIR);
  console.log(`Found ${videoFiles.length.toString()} video files.`);

  console.log(" extracting metadata...");
  const metadataList: VideoMetadata[] = [];
  let processed = INITIAL_COUNT;

  for (const file of videoFiles) {
    const metadata = await getVideoMetadata(file);
    if (metadata !== null) {
      // 1. RawScan Analysis (Room Area & Features)
      const rawScanPath = path.join(path.dirname(file), "rawScan.json");
      if (fs.existsSync(rawScanPath)) {
        try {
          const rawContent = fs.readFileSync(rawScanPath, "utf-8");
          const rawScan = JSON.parse(rawContent) as Partial<RawScanData>;

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
                // Let's try to just use the Wall's position (center?) or assume walls define the boundary.
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
                  // console.log(`DEBUG: Toilet Gap: ${(minWallDist - tDepth / 2) * 39.37} inches`);
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
                    const d = Math.sqrt(
                      Math.pow(pA.x - pB.x, EXPONENT_SQUARED) + Math.pow(pA.y - pB.y, EXPONENT_SQUARED)
                    );
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
              // Skip invalid boxes if any
              if (boxA.minX >= boxA.maxX) {
                continue;
              }

              // Loop start index
              const NEXT_IDX = 1;
              for (let j = i + NEXT_IDX; j < objects.length; j++) {
                const boxB = objAABBs[j];
                if (!boxB) {
                  continue;
                }
                if (boxB.minX >= boxB.maxX) {
                  continue;
                }

                // Check Exclusion: Sink <-> Storage
                if ((boxA.isSink && boxB.isStorage) || (boxA.isStorage && boxB.isSink)) {
                  continue;
                }

                // Check Intersection using Separating Axis Theorem (SAT)
                // AABBs are too crude for rotated objects.
                const cornersA = boxA.corners; // We need to store corners in objAABBs
                const cornersB = boxB.corners;

                if (doPolygonsIntersect(cornersA, cornersB)) {
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

            // --- Wall Processing & Intersections ---
            // rawScan.walls might be undefined in some partial scans
            const wallsToCheck = rawScan.walls ?? [];

            const processedWalls: {
              fullCorners: { x: number; y: number }[];
              shrunkCorners: { x: number; y: number }[];
              endpoints: { x: number; y: number }[];
              dir: { x: number; y: number };
            }[] = [];
            const WALL_SHRINK_METERS = 0.1; // 10cm shrink
            const JOIN_DIST_METERS = 0.2; // 20cm tolerance for "joined"
            const CROOKED_THRESHOLD_DEG = 5;
            const CROOKED_MIN_DEG = 1.0;
            const RAD_TO_DEG = 57.2957795; // 180 / PI

            // 1. Pre-process Walls
            for (const w of wallsToCheck) {
              // Transform is optional
              const wTransform = w.transform;
              if (wTransform === undefined) {
                continue;
              }

              const wDims = w.dimensions;

              if (wTransform.length !== TRANSFORM_SIZE || wDims.length !== DIM_SIZE) {
                continue;
              }

              const halfW = (wDims[DIM_X] ?? DEFAULT_DIM) / HALF;
              const halfD = (wDims[DIM_Z] ?? DEFAULT_DIM) / HALF;
              const shrunkHalfW = Math.max(ZERO, halfW - WALL_SHRINK_METERS);

              // Standard Corners (Full Size)
              const corners = [
                { x: -halfW, y: -halfD },
                { x: halfW, y: -halfD },
                { x: halfW, y: halfD },
                { x: -halfW, y: halfD }
              ];

              // Shrunk Corners (For Wall-Wall checks)
              const sCorners = [
                { x: -shrunkHalfW, y: -halfD },
                { x: shrunkHalfW, y: -halfD },
                { x: shrunkHalfW, y: halfD },
                { x: -shrunkHalfW, y: halfD }
              ];

              const fullCorners = corners.map((c) => {
                const res = transformPoint(c, wTransform);
                return { x: res.x, y: res.y };
              });

              const shrunkCorners = sCorners.map((c) => {
                const res = transformPoint(c, wTransform);
                return { x: res.x, y: res.y };
              });

              // Endpoints (Center Left, Center Right along local X)
              const pLeft = transformPoint({ x: -halfW, y: 0 }, wTransform);
              const pRight = transformPoint({ x: halfW, y: 0 }, wTransform);
              const dx = pRight.x - pLeft.x;
              const dy = pRight.y - pLeft.y;
              const dxSq = dx * dx;
              const dySq = dy * dy;
              const len = Math.sqrt(dxSq + dySq);
              const dir = len > ZERO ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };

              processedWalls.push({
                dir,
                endpoints: [pLeft, pRight],
                fullCorners,
                shrunkCorners
              });
            }

            // 2. Wall <-> Object Intersection
            let wallObjectIntersectionFound = false;
            for (const pw of processedWalls) {
              for (const objAABB of objAABBs) {
                const EMPTY_LEN = 0;
                if (objAABB.corners.length === EMPTY_LEN) {
                  continue;
                }
                if (objAABB.innerCorners.length === EMPTY_LEN) {
                  continue;
                }
                if (doPolygonsIntersect(pw.fullCorners, objAABB.innerCorners)) {
                  wallObjectIntersectionFound = true;
                  break;
                }
              }
              if (wallObjectIntersectionFound) {
                break;
              }
            }

            // 3. Wall <-> Wall Intersection & Crooked Walls
            let wallWallIntersectionFound = false;
            let crookedWallFound = false;

            for (let i = 0; i < processedWalls.length; i++) {
              const pw1 = processedWalls[i];
              if (pw1 === undefined) {
                continue;
              }
              for (let j = i + INCREMENT_STEP; j < processedWalls.length; j++) {
                const pw2 = processedWalls[j];
                if (pw2 === undefined) {
                  continue;
                }
                // A. Intersection Check (Shrunk vs Shrunk)
                if (doPolygonsIntersect(pw1.shrunkCorners, pw2.shrunkCorners)) {
                  wallWallIntersectionFound = true;
                }

                // B. Crooked Wall Check (Joined at small angle)
                // Check if any endpoints are close
                let checkJoined = false;
                for (const ep1 of pw1.endpoints) {
                  for (const ep2 of pw2.endpoints) {
                    const diffX = ep1.x - ep2.x;
                    const diffY = ep1.y - ep2.y;
                    const EXPONENT_SQ = 2;
                    const distSq = Math.pow(diffX, EXPONENT_SQ) + Math.pow(diffY, EXPONENT_SQ);
                    const thresholdSq = Math.pow(JOIN_DIST_METERS, EXPONENT_SQ);

                    if (distSq < thresholdSq) {
                      checkJoined = true;
                      break;
                    }
                  }
                  if (checkJoined) {
                    break;
                  }
                }

                if (checkJoined) {
                  // Angle check
                  // Dot product
                  const dotX = pw1.dir.x * pw2.dir.x;
                  const dotY = pw1.dir.y * pw2.dir.y;
                  const dot = dotX + dotY;
                  // Clamp to -1..1
                  const CLAMP_DOT_MIN = -1;
                  const CLAMP_DOT_MAX = 1;
                  const clampedDot = Math.max(CLAMP_DOT_MIN, Math.min(CLAMP_DOT_MAX, dot));
                  // We care about the angle of the lines, so |dot| corresponds to 0..90 range deviation
                  // If lines are parallel, |dot| = 1. Angle = 0.
                  // If lines are perpendicular, |dot| = 0. Angle = 90.
                  const angleRad = Math.acos(Math.abs(clampedDot));
                  const angleDeg = angleRad * RAD_TO_DEG;

                  if (angleDeg > CROOKED_MIN_DEG && angleDeg <= CROOKED_THRESHOLD_DEG) {
                    crookedWallFound = true;
                  }
                }
              }
              if (wallWallIntersectionFound && crookedWallFound) {
                break;
              }
            }

            if (wallObjectIntersectionFound) {
              metadata.hasWallObjectIntersectionErrors = true;
            }
            if (wallWallIntersectionFound) {
              metadata.hasWallWallIntersectionErrors = true;
            }
            if (crookedWallFound) {
              metadata.hasCrookedWallErrors = true;
            }
          }
        } catch {
          // Ignore
        }
      }

      const arDataPath = path.join(path.dirname(file), "arData.json");
      if (fs.existsSync(arDataPath)) {
        try {
          const content = fs.readFileSync(arDataPath, "utf-8");
          const json = JSON.parse(content) as unknown;
          const _arData = new ArData(json);
          const frames = Object.values(_arData.data);

          if (frames.length > INITIAL_COUNT) {
            // Lens Model
            const firstFrame = frames[INITIAL_COUNT];
            // Use optional chaining for safe access to frames array item, but exifData is required
            if (firstFrame?.exifData.LensModel !== undefined) {
              metadata.lensModel = firstFrame.exifData.LensModel;
            }
          }

          // Calculate Averages
          let totalIntensity = 0;
          let totalTemperature = 0;
          let totalISO = 0;
          let totalBrightness = 0; // Exif BrightnessValue
          let count = 0;
          let isoCount = 0;
          let briCount = 0;
          const MIN_VALID_FRAMES = 0;

          for (const frame of frames) {
            // Check for existence explicitly if needed, but safe navigation usage suggests they are optional
            // Using strict checks to satisfy linter
            // exifData is required per interface, so no check needed
            if (frame.lightEstimate !== undefined) {
              // ambientIntensity and ambientColorTemperature are required in LightEstimate interface
              totalIntensity += frame.lightEstimate.ambientIntensity;
              totalTemperature += frame.lightEstimate.ambientColorTemperature;
            }

            // ISOSpeedRatings check (exifData is required)
            if (frame.exifData.ISOSpeedRatings !== undefined) {
              // Strip non-numeric chars (sometimes comes as "( 125 )" or similar)
              const isoStr = frame.exifData.ISOSpeedRatings.replace(/[^0-9.]/g, "");
              const isoVal = parseFloat(isoStr);
              if (!isNaN(isoVal)) {
                totalISO += isoVal;
                isoCount++;
              }
            }

            // BrightnessValue check
            if (frame.exifData.BrightnessValue !== undefined) {
              // BrightnessValue is typically a number string, but sanity check
              const briVal = parseFloat(frame.exifData.BrightnessValue);
              if (!isNaN(briVal)) {
                totalBrightness += briVal;
                briCount++;
              }
            }

            // Increment count if we have valid light estimate?
            // Original logic was "if (frame.lightEstimate && frame.exifData)".
            // Since exifData is always there, effective check was just lightEstimate.
            if (frame.lightEstimate !== undefined) {
              count++;
            }
          }

          if (count > MIN_VALID_FRAMES) {
            metadata.avgAmbientIntensity = totalIntensity / count;
            metadata.avgColorTemperature = totalTemperature / count;
          }
          if (isoCount > MIN_VALID_FRAMES) {
            metadata.avgIso = totalISO / isoCount;
          }
          if (briCount > MIN_VALID_FRAMES) {
            metadata.avgBrightness = totalBrightness / briCount;
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
    if (m.lensModel !== undefined && m.lensModel.length > INITIAL_COUNT) {
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
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v): v is number => v !== undefined);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v): v is number => v !== undefined);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v): v is number => v !== undefined);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v): v is number => v !== undefined);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v): v is number => v !== undefined);

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

  for (const m of metadataList) {
    if (m.hasNonRectWall === true) {
      countNonRect++;
    }
    if (m.hasCurvedWall === true) {
      countCurvedWalls++;
    }
    if ((m.toiletCount ?? INITIAL_COUNT) >= MIN_TOILETS) {
      countTwoToilets++;
    }
    if ((m.tubCount ?? INITIAL_COUNT) >= MIN_TUBS) {
      countTwoTubs++;
    }
    if ((m.wallCount ?? DEFAULT_WALL_COUNT) < MIN_WALLS) {
      countFewWalls++;
    }
    const sinks = m.sinkCount ?? INITIAL_COUNT;
    const storage = m.storageCount ?? INITIAL_COUNT;
    if (sinks === INITIAL_COUNT && storage === INITIAL_COUNT) {
      countNoVanity++;
    }
    if (m.hasExternalOpening === true) {
      countExternalOpening++;
    }
    if (m.hasSoffit === true) {
      countSoffit++;
    }
    if (m.hasToiletGapErrors === true) {
      countToiletGapErrors++;
    }
    if (m.hasTubGapErrors === true) {
      countTubGapErrors++;
    }
    if (m.hasWallGapErrors === true) {
      countWallGapErrors++;
    }
    if (m.hasColinearWallErrors === true) {
      countColinearWallErrors++;
    }
    if (m.hasNibWalls === true) {
      countNibWalls++;
    }
    if (m.hasObjectIntersectionErrors === true) {
      countObjectIntersectionErrors++;
    }
    if (m.hasWallObjectIntersectionErrors === true) {
      countWallObjectIntersectionErrors++;
    }
    if (m.hasWallWallIntersectionErrors === true) {
      countWallWallIntersectionErrors++;
    }
    if (m.hasCrookedWallErrors === true) {
      countCrookedWallErrors++;
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
    "Nib Walls (< 1ft)"
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
    countNibWalls
  ];
  const featureChart = await ChartUtils.createBarChart(featureLabels, featureCounts, "Feature Prevalence", {
    height: DURATION_CHART_HEIGHT,
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
    "Crooked Walls"
  ];
  const errorCounts = [
    countToiletGapErrors,
    countTubGapErrors,
    countWallGapErrors,
    countColinearWallErrors,
    countObjectIntersectionErrors,
    countWallObjectIntersectionErrors,
    countWallWallIntersectionErrors,
    countCrookedWallErrors
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

  doc.image(featureChart, LEFT_X, Y_START + GAP_Y, { height: H, width: FULL_W });
  doc.text("Feature Prevalence", LEFT_X, Y_START + GAP_Y + H + TEXT_PADDING, { align: "center", width: FULL_W });

  const HEIGHT_ADJUSTMENT_FACTOR = 2;
  const gapScaled = GAP_Y * HEIGHT_ADJUSTMENT_FACTOR;
  const errorChartY = Y_START + gapScaled;
  doc.image(errorChart, LEFT_X, errorChartY, { height: H, width: FULL_W });
  doc.text("Capture Errors", LEFT_X, errorChartY + H + TEXT_PADDING, {
    align: "center",
    width: FULL_W
  });

  doc.end();
  console.log(`Report generated at: ${REPORT_PATH}`);
}

main().catch(console.error);
