import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

import { ArData } from "../models/arData/arData";
import { Floor } from "../models/rawScan/floor";
import { RawScan, RawScanData } from "../models/rawScan/rawScan";
import { Wall } from "../models/rawScan/wall";
import * as ChartUtils from "../utils/chartUtils";

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

  // PDF Constants
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
        } catch {
          // Ignore
        }
      }

      // 2. ArData Analysis (Lighting & Lens)
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

  // Layout Constants (Needed for feature chart)
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
  }

  const featureLabels = [
    "Non-Rectangular Walls",
    "Curved Walls",
    "2+ Toilets",
    "2+ Tubs",
    "< 4 Walls",
    "No Vanity",
    "External Opening",
    "Soffit"
  ];
  const featureCounts = [
    countNonRect,
    countCurvedWalls,
    countTwoToilets,
    countTwoTubs,
    countFewWalls,
    countNoVanity,
    countExternalOpening,
    countSoffit
  ];
  const featureChart = await ChartUtils.createBarChart(featureLabels, featureCounts, "Feature Prevalence", {
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

  doc.end();
  console.log(`Report generated at: ${REPORT_PATH}`);
}

main().catch(console.error);
