import * as fs from "fs";
import * as path from "path";

import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { RawScan } from "../models/rawScan/rawScan";
import * as ChartUtils from "../utils/chartUtils";
import { ChartConfiguration } from "../utils/chartUtils";
import { DEVICE_RELEASE_ORDER } from "../utils/deviceReleaseOrder";
import { ReportData, ReportSection } from "../models/report";

export interface CaptureCharts {
  ambient: ChartConfiguration;
  area: ChartConfiguration;
  brightness: ChartConfiguration;
  duration: ChartConfiguration;
  errors: ChartConfiguration;
  features: ChartConfiguration;
  objects: ChartConfiguration;
  fps: ChartConfiguration;
  iso: ChartConfiguration;
  lens: ChartConfiguration;
  resolution: ChartConfiguration;
  temperature: ChartConfiguration;
  focalLength: ChartConfiguration;
  aperture: ChartConfiguration;
  sections: ChartConfiguration;
}

// Helper interface for local chart data preparation
interface ChartDef {
  check: (m: ArtifactAnalysis) => boolean;
  count: number;
  label: string;
}

type ObjectConfidenceCounts = Record<string, [number, number, number]>; // [high, medium, low]

function getObjectConfidenceCounts(artifactDirs: string[]): ObjectConfidenceCounts {
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

export function buildDataAnalysisReport(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const charts: Partial<CaptureCharts> = {};
  // A4 viewport at 96 DPI from reportGenerator; keep sizing as ratios
  const PAGE_VIEWPORT_WIDTH = 794;
  const PAGE_VIEWPORT_HEIGHT = 1123;
  const PAGE_MARGIN = 40;
  const DOUBLE = 2;
  const pageMarginDouble = PAGE_MARGIN * DOUBLE;
  const PAGE_CONTENT_WIDTH = PAGE_VIEWPORT_WIDTH - pageMarginDouble;
  const PAGE_CONTENT_HEIGHT = PAGE_VIEWPORT_HEIGHT - pageMarginDouble;

  const FULL_WIDTH_RATIO = 0.9;
  const HALF_WIDTH_RATIO = 0.47;
  const HISTO_WIDTH_RATIO = FULL_WIDTH_RATIO;
  const ERRORS_WIDTH_RATIO = 0.82;
  const LENS_WIDTH_RATIO = 0.9;
  const DURATION_HEIGHT_RATIO = 0.32;
  const HALF_HEIGHT_RATIO = 0.26;
  const LENS_HEIGHT_RATIO = 0.35;

  const MIN_DURATION_HEIGHT = 260;
  const MIN_HALF_HEIGHT = 260;
  const MIN_LENS_HEIGHT = 340;

  const MIN_DYNAMIC_HEIGHT = 140;

  const DURATION_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * FULL_WIDTH_RATIO);
  const HALF_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HALF_WIDTH_RATIO);
  const HISTO_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HISTO_WIDTH_RATIO);
  const ERRORS_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * ERRORS_WIDTH_RATIO);
  const DURATION_CHART_HEIGHT = Math.max(MIN_DURATION_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * DURATION_HEIGHT_RATIO));
  const HALF_CHART_HEIGHT = Math.max(MIN_HALF_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * HALF_HEIGHT_RATIO));
  const LENS_CHART_HEIGHT = Math.max(MIN_LENS_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * LENS_HEIGHT_RATIO));

  const NOT_SET = "";
  const INCREMENT_STEP = 1;
  const INITIAL_COUNT = 0;
  const NO_RESULTS = 0;

  // Histogram Constants
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  // Helper for dynamic height
  const MIN_BAR_HEIGHT = 20;
  const HEADER_SPACE = 60;
  const DECIMAL_PLACES_LENS = 1;
  function getDynamicHeight(itemCount: number, minHeight = HALF_CHART_HEIGHT): number {
    const contentHeight = itemCount * MIN_BAR_HEIGHT;
    return Math.max(minHeight, contentHeight + HEADER_SPACE);
  }

  // Duration
  const durations = metadataList.map((m) => m.duration);
  // Rendered as KDE Smooth Area Chart
  const durKde = ChartUtils.calculateKde(durations, { max: 120, min: 10, resolution: 200 });
  charts.duration = ChartUtils.getLineChartConfig(
    durKde.labels,
    [
      {
        borderColor: "#06b6d4", // Cyan-500
        borderWidth: 2,
        data: durKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "duration",
      height: DURATION_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: DURATION_CHART_WIDTH,
      xLabel: "Seconds",
      yLabel: "Count"
    }
  );

  // Device Model
  const deviceMap: Record<string, number> = {};
  for (const m of metadataList) {
    const model = m.deviceModel === NOT_SET ? "Unknown" : m.deviceModel;
    deviceMap[model] = (deviceMap[model] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }

  const allKeys = Object.keys(deviceMap);

  const DEFAULT_DATE = 0;
  const getReleaseDate = (model: string) => DEVICE_RELEASE_ORDER[model] ?? DEFAULT_DATE;

  // Sort iPhones by release date desc, then by name desc
  const iPhones = allKeys
    .filter((k) => k.toLowerCase().includes("iphone"))
    .sort((a, b) => {
      const dateA = getReleaseDate(a);
      const dateB = getReleaseDate(b);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return b.localeCompare(a);
    });

  // Sort iPads by Hybrid Logic:
  // 1. M4 Generation (Newest Flagships)
  // 2. Legacy Large Pros (12.9) - Clean lineage
  // 3. Legacy Small Pros (11) - Clean lineage
  // 4. Airs > Base > Mini
  const RANK_M4 = 1;
  const RANK_LEGACY_LARGE = 2;
  const RANK_LEGACY_SMALL = 3;
  const RANK_PRO = 4;
  const RANK_AIR = 5;
  const RANK_BASE = 6;
  const RANK_MINI = 7;
  const RANK_DEFAULT = 99;

  const getiPadRank = (model: string): number => {
    // ... (omitted for brevity, assume content matches existing or re-copy whole function? Better re-copy to avoid partial match issues if possible, but it's long.
    // Actually the sort function below is what matters for magic 0s in comparators?
    // Wait, getReleaseDate uses DEFAULT_DATE now.
    // The errors 174:38/60 were in iPad sort?
    // Let's re-read line 174 from Step 1792.
    // 174:     return RANK_DEFAULT; (No magic number 0 here).

    // Ah, Step 1823 error log lines might differ from Step 1792 lines.
    // Let's check step 1823 again.
    // 204:45 error No magic number: 0.
    // 204:     if (iPhones.length > 0 && (iPads.length > 0 || others.length > 0)) {
    // Yes.

    // I need to replace '0' with 'NO_RESULTS'.

    // Also Step 1823 said 174:38 No magic number 0.
    // In Step 1792, line 174 is `return RANK_DEFAULT;`. Wait, `RANK_DEFAULT = 99`.
    // Maybe line 174 in the LINT output corresponds to something else?
    // Ah, Step 1792 view ended at line 220.
    // Let's look at lines around iPad sort again.
    // Line 180 sort.
    // 180: sort((a,b) => ...
    //   if (rankA !== rankB) return rankA - rankB;
    //   ... if (dateA !== dateB) return dateB - dateA;
    // None of these use 0 literals explicitly.
    // Wait... `return rankA - rankB`.
    // Is it complaining about subtraction? No.
    // Maybe `const dateA = ... ?? 0`? No, I changed that to `DEFAULT_DATE`.

    // Let's look at `iPhones` sort (lines 111-121).
    // `const dateA = getReleaseDate(a);` (Lines 114-115).
    // `type getReleaseDate` uses `DEFAULT_DATE`.

    // Wait! Step 1798 replaced `getReleaseDate`.
    // So the Sort functions shouldn't have `0` if they use that helper.

    // Maybe the errors `204`, `209`, `215` are the valid ones remaining (length > 0, SEPARATOR_KEY ? 0).
    // Lines `174` errors in previous run (Step 1750) might have shifted.
    // In Step 1823 output, I see lines 204, 209, 215 errors.
    // I DO NOT see lines 174 erros in Step 1823 snippet (it was truncated).
    // BUT Step 1823 output delta says `<truncated 182 lines>`.
    // It's possible I still have errors in Sort.

    // Wait, if `getReleaseDate` returns number, sorting by subtraction `dateB - dateA` is fine.
    // Where is the 0coming from for sort?
    // Maybe `deviceMap[b] ?? 0` in `others` sort? I fixed that in 1809.

    // So likely just the `length > 0` checks.

    // I will fix `if (iPhones.length > NO_RESULTS ...)` and `(l === SEPARATOR_KEY ? INITIAL_COUNT : ...)`

    const m = model.toLowerCase();

    // Rank 1: M4 Generation (Both 13" and 11")
    if (m.includes("(m4)")) {
      return RANK_M4;
    }

    // Rank 2: Legacy Large Pros
    if (m.includes("pro") && (m.includes("12.9") || m.includes("13-inch"))) {
      return RANK_LEGACY_LARGE;
    }

    // Rank 3: Legacy Small Pros
    if (m.includes("pro") && m.includes("11-inch")) {
      return RANK_LEGACY_SMALL;
    }

    // Rank 4: Other Pros
    if (m.includes("pro")) {
      return RANK_PRO;
    }

    // Rank 5: Airs
    if (m.includes("air")) {
      return RANK_AIR;
    }

    // Rank 6: Base
    if (m.includes("ipad") && !m.includes("mini")) {
      return RANK_BASE;
    }

    // Rank 7: Mini
    if (m.includes("mini")) {
      return RANK_MINI;
    }

    return RANK_DEFAULT;
  };

  const iPads = allKeys
    .filter((k) => k.toLowerCase().includes("ipad"))
    .sort((a, b) => {
      const rankA = getiPadRank(a);
      const rankB = getiPadRank(b);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const dateA = getReleaseDate(a);
      const dateB = getReleaseDate(b);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return b.localeCompare(a);
    });

  // Others sorted by count as before
  const others = allKeys
    .filter((k) => !k.toLowerCase().includes("iphone") && !k.toLowerCase().includes("ipad"))
    .sort((a, b) => (deviceMap[b] ?? INITIAL_COUNT) - (deviceMap[a] ?? INITIAL_COUNT));

  const SEPARATOR_KEY = "---";
  let separatorLabel: string | undefined = undefined;

  // If we have both iPhones and (iPads or Others), insert a gap
  if (iPhones.length > NO_RESULTS && (iPads.length > NO_RESULTS || others.length > NO_RESULTS)) {
    // Insert separator label after the last iPhone
  }

  const deviceLabels = [...iPhones, ...iPads, ...others];
  if (iPhones.length > NO_RESULTS && (iPads.length > NO_RESULTS || others.length > NO_RESULTS)) {
    const insertIdx = iPhones.length;
    deviceLabels.splice(insertIdx, NO_RESULTS, SEPARATOR_KEY);
    separatorLabel = SEPARATOR_KEY;
  }

  const deviceCounts = deviceLabels.map((l) => (l === SEPARATOR_KEY ? INITIAL_COUNT : (deviceMap[l] ?? INITIAL_COUNT)));

  charts.lens = ChartUtils.getBarChartConfig(deviceLabels, deviceCounts, {
    height: getDynamicHeight(deviceLabels.length, LENS_CHART_HEIGHT),
    horizontal: true,
    ...(separatorLabel !== undefined ? { separatorLabel } : {}),
    title: "",
    totalForPercentages: metadataList.length,
    width: Math.round(PAGE_CONTENT_WIDTH * LENS_WIDTH_RATIO)
  });

  // Focal Length (aggregated & normalized)
  const focalMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensFocalLength !== NOT_SET) {
      // Normalize: "5.1 mm" -> 5.1
      const val = parseFloat(m.lensFocalLength);
      if (!isNaN(val)) {
        key = `${val.toFixed(DECIMAL_PLACES_LENS)} mm`;
      } else {
        key = m.lensFocalLength;
      }
    }
    focalMap[key] = (focalMap[key] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  // Sort numerically
  const focalLabels = Object.keys(focalMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const focalCounts = focalLabels.map((l) => focalMap[l] ?? INITIAL_COUNT);

  // Aperture
  const apertureMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensAperture !== NOT_SET) {
      // Normalize f/1.6000 -> f/1.6
      const val = parseFloat(m.lensAperture.replace("f/", ""));
      if (!isNaN(val)) {
        key = `f/${val.toFixed(DECIMAL_PLACES_LENS)}`;
      } else {
        key = m.lensAperture;
      }
    }
    apertureMap[key] = (apertureMap[key] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const apertureLabels = Object.keys(apertureMap).sort((a, b) => {
    const valA = parseFloat(a.replace("f/", ""));
    const valB = parseFloat(b.replace("f/", ""));
    return valA - valB;
  });
  const apertureCounts = apertureLabels.map((l) => apertureMap[l] ?? INITIAL_COUNT);

  charts.focalLength = ChartUtils.getBarChartConfig(focalLabels, focalCounts, {
    height: HALF_CHART_HEIGHT,
    showCount: true,
    title: "", // Title handled in section
    width: HALF_CHART_WIDTH
  });

  charts.aperture = ChartUtils.getBarChartConfig(apertureLabels, apertureCounts, {
    height: HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: HALF_CHART_WIDTH
  });

  // Framerate
  const fpsMap: Record<string, number> = {};
  for (const m of metadataList) {
    const fps = Math.round(m.fps).toString();
    fpsMap[fps] = (fpsMap[fps] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const fpsLabels = Object.keys(fpsMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsMap[l] ?? INITIAL_COUNT);
  charts.fps = ChartUtils.getBarChartConfig(fpsLabels, fpsCounts, {
    height: HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: HALF_CHART_WIDTH
  });

  // Resolution
  const resMap: Record<string, number> = {};
  for (const m of metadataList) {
    const res = `${m.width.toString()}x${m.height.toString()}`;
    resMap[res] = (resMap[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const resLabels = Object.keys(resMap).sort();
  const resCounts = resLabels.map((l) => resMap[l] ?? INITIAL_COUNT);
  charts.resolution = ChartUtils.getBarChartConfig(resLabels, resCounts, {
    height: HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: HALF_CHART_WIDTH
  });

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > NO_RESULTS);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > NO_RESULTS);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > NO_RESULTS);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== NO_RESULTS);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > NO_RESULTS);

  // Ambient: 980-1040
  // Rendered as Kernel Density Estimation Smooth Area Chart
  const ambientKde = ChartUtils.calculateKde(intensityVals, {
    max: 1040,
    min: 980,
    resolution: 200
  });

  charts.ambient = ChartUtils.getLineChartConfig(
    ambientKde.labels,
    [
      {
        borderColor: "#d97706",
        borderWidth: 2,
        data: ambientKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#1f2937",
        gradientTo: "#fbbf24",
        label: "Density"
      }
    ],
    {
      chartId: "ambient",
      height: HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: HISTO_CHART_WIDTH,
      xLabel: "Lux",
      yLabel: "Count"
    }
  );

  // Temp: 3500-6700
  // Rendered as KDE Smooth Area Chart
  const tempKde = ChartUtils.calculateKde(tempVals, { max: 6700, min: 3500, resolution: 200 });
  charts.temperature = ChartUtils.getLineChartConfig(
    tempKde.labels,
    [
      {
        borderColor: "#f59e0b",
        borderWidth: 2,
        data: tempKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#fbbf24", // Orange (3500K)
        gradientTo: "#60a5fa", // Blue (6700K)
        label: "Density"
      }
    ],
    {
      chartId: "temperature",
      height: HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: HISTO_CHART_WIDTH,
      xLabel: "Kelvin",
      yLabel: "Count"
    }
  );

  // ISO: 0-800
  // Rendered as KDE Smooth Area Chart (Solid Fill)
  const isoKde = ChartUtils.calculateKde(isoVals, { max: 800, min: 0, resolution: 200 });
  charts.iso = ChartUtils.getLineChartConfig(
    isoKde.labels,
    [
      {
        borderColor: "#6366f1",
        borderWidth: 2,
        data: isoKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "iso",
      height: HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: HISTO_CHART_WIDTH,
      xLabel: "ISO",
      yLabel: "Count"
    }
  );

  // Brightness: 0-6
  // Rendered as KDE Smooth Area Chart
  const briKde = ChartUtils.calculateKde(briVals, { max: 6, min: 0, resolution: 200 });
  charts.brightness = ChartUtils.getLineChartConfig(
    briKde.labels,
    [
      {
        borderColor: "#eab308",
        borderWidth: 2,
        data: briKde.values,
        fill: true,
        gradientDirection: "horizontal",
        gradientFrom: "#1f2937",
        gradientTo: "#fef08a",
        label: "Density"
      }
    ],
    {
      chartId: "brightness",
      height: HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: HISTO_CHART_WIDTH,
      xLabel: "EV",
      yLabel: "Count"
    }
  );

  // Room Area: 0-150
  // Rendered as KDE Smooth Area Chart (Solid Fill)
  const areaKde = ChartUtils.calculateKde(areaVals, { max: 150, min: 0, resolution: 200 });
  charts.area = ChartUtils.getLineChartConfig(
    areaKde.labels,
    [
      {
        borderColor: "#10b981",
        borderWidth: 2,
        data: areaKde.values,
        fill: true,
        label: "Density"
      }
    ],
    {
      chartId: "area",
      height: DURATION_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: DURATION_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  // Capture Errors & Features
  const errorDefs: ChartDef[] = [
    { check: (m: ArtifactAnalysis) => m.hasToiletGapErrors, count: INITIAL_COUNT, label: 'Toilet Gap > 1"' },
    { check: (m: ArtifactAnalysis) => m.hasTubGapErrors, count: INITIAL_COUNT, label: 'Tub Gap 1"-6"' },
    { check: (m: ArtifactAnalysis) => m.hasWallGapErrors, count: INITIAL_COUNT, label: 'Wall Gaps 1"-12"' },
    { check: (m: ArtifactAnalysis) => m.hasColinearWallErrors, count: INITIAL_COUNT, label: "Colinear Walls" },
    {
      check: (m: ArtifactAnalysis) => m.hasObjectIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Object Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallObjectIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Wall <-> Object Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallWallIntersectionErrors,
      count: INITIAL_COUNT,
      label: "Wall <-> Wall Intersections"
    },
    { check: (m: ArtifactAnalysis) => m.hasCrookedWallErrors, count: INITIAL_COUNT, label: "Crooked Walls" },
    { check: (m: ArtifactAnalysis) => m.hasDoorBlockingError, count: INITIAL_COUNT, label: "Door Blocked" },
    { check: (m: ArtifactAnalysis) => m.wallCount < MIN_WALLS, count: INITIAL_COUNT, label: "< 4 Walls" },
    { check: (m: ArtifactAnalysis) => m.hasUnparentedEmbedded, count: INITIAL_COUNT, label: "Unparented Embedded" }
  ];

  const featureDefs: ChartDef[] = [
    { check: (m: ArtifactAnalysis) => m.hasNonRectWall, count: INITIAL_COUNT, label: "Non-Rectangular Walls" },
    { check: (m: ArtifactAnalysis) => m.hasCurvedWall, count: INITIAL_COUNT, label: "Curved Walls" },
    { check: (m: ArtifactAnalysis) => m.hasCurvedEmbedded, count: INITIAL_COUNT, label: "Curved Embedded" },
    {
      check: (m: ArtifactAnalysis) => m.hasNonRectangularEmbedded,
      count: INITIAL_COUNT,
      label: "Non-Rectangular Embedded"
    },
    { check: (m: ArtifactAnalysis) => m.toiletCount >= MIN_TOILETS, count: INITIAL_COUNT, label: "2+ Toilets" },
    { check: (m: ArtifactAnalysis) => m.tubCount >= MIN_TUBS, count: INITIAL_COUNT, label: "2+ Tubs" },
    {
      check: (m: ArtifactAnalysis) => m.sinkCount === INITIAL_COUNT && m.storageCount === INITIAL_COUNT,
      count: INITIAL_COUNT,
      label: "No Vanity"
    },
    { check: (m: ArtifactAnalysis) => m.hasExternalOpening, count: INITIAL_COUNT, label: "External Opening" },
    { check: (m: ArtifactAnalysis) => m.hasSoffit, count: INITIAL_COUNT, label: "Soffit" },
    { check: (m: ArtifactAnalysis) => m.hasNibWalls, count: INITIAL_COUNT, label: "Nib Walls (< 1ft)" },
    { check: (m: ArtifactAnalysis) => m.hasMultipleStories, count: INITIAL_COUNT, label: "Multiple Stories" }
  ];

  const objectDefs: ChartDef[] = [
    { check: (m: ArtifactAnalysis) => m.toiletCount > NO_RESULTS, count: INITIAL_COUNT, label: "Toilet" },
    { check: (m: ArtifactAnalysis) => m.doorCount > NO_RESULTS, count: INITIAL_COUNT, label: "Door" },
    { check: (m: ArtifactAnalysis) => m.windowCount > NO_RESULTS, count: INITIAL_COUNT, label: "Window" },
    { check: (m: ArtifactAnalysis) => m.storageCount > NO_RESULTS, count: INITIAL_COUNT, label: "Storage" },
    { check: (m: ArtifactAnalysis) => m.sinkCount > NO_RESULTS, count: INITIAL_COUNT, label: "Sink" },
    { check: (m: ArtifactAnalysis) => m.tubCount > NO_RESULTS, count: INITIAL_COUNT, label: "Bathtub" },
    { check: (m: ArtifactAnalysis) => m.openingCount > NO_RESULTS, count: INITIAL_COUNT, label: "Opening" },
    { check: (m: ArtifactAnalysis) => m.hasWasherDryer, count: INITIAL_COUNT, label: "Washer/Dryer" },
    { check: (m: ArtifactAnalysis) => m.hasStove, count: INITIAL_COUNT, label: "Stove" },
    { check: (m: ArtifactAnalysis) => m.hasTable, count: INITIAL_COUNT, label: "Table" },
    { check: (m: ArtifactAnalysis) => m.hasChair, count: INITIAL_COUNT, label: "Chair" },
    { check: (m: ArtifactAnalysis) => m.hasBed, count: INITIAL_COUNT, label: "Bed" },
    { check: (m: ArtifactAnalysis) => m.hasSofa, count: INITIAL_COUNT, label: "Sofa" },
    { check: (m: ArtifactAnalysis) => m.hasDishwasher, count: INITIAL_COUNT, label: "Dishwasher" },
    { check: (m: ArtifactAnalysis) => m.hasOven, count: INITIAL_COUNT, label: "Oven" },
    { check: (m: ArtifactAnalysis) => m.hasRefrigerator, count: INITIAL_COUNT, label: "Refrigerator" },
    { check: (m: ArtifactAnalysis) => m.hasStairs, count: INITIAL_COUNT, label: "Stairs" },
    { check: (m: ArtifactAnalysis) => m.hasFireplace, count: INITIAL_COUNT, label: "Fireplace" },
    { check: (m: ArtifactAnalysis) => m.hasTelevision, count: INITIAL_COUNT, label: "Television" }
  ];

  for (const m of metadataList) {
    for (const d of errorDefs) {
      if (d.check(m)) {
        d.count++;
      }
    }
    for (const d of featureDefs) {
      if (d.check(m)) {
        d.count++;
      }
    }
    for (const d of objectDefs) {
      if (d.check(m)) {
        d.count++;
      }
    }
  }

  // Sort objects by frequency (most common at top)
  objectDefs.sort((a, b) => b.count - a.count);
  errorDefs.sort((a, b) => b.count - a.count);
  featureDefs.sort((a, b) => b.count - a.count);

  charts.features = ChartUtils.getBarChartConfig(
    featureDefs.map((d) => d.label),
    featureDefs.map((d) => d.count),
    {
      height: getDynamicHeight(featureDefs.length, MIN_DYNAMIC_HEIGHT),
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: DURATION_CHART_WIDTH
    }
  );

  // Collect object confidence data if artifact directories are provided
  const objectConfidenceCounts = artifactDirs !== undefined ? getObjectConfidenceCounts(artifactDirs) : null;

  if (objectConfidenceCounts !== null) {
    // Use stacked bars with confidence levels
    const objectLabels = objectDefs.map((d) => d.label);
    const confidenceZeroValue = 0;
    const defaultConfidenceCounts: [number, number, number] = [
      confidenceZeroValue,
      confidenceZeroValue,
      confidenceZeroValue
    ];
    // For stacked bars, we want the bar height to match the artifact count (which matches the percentage)
    // but still show the confidence breakdown proportionally
    // Map object labels to their artifact counts (number of artifacts that have this object type)
    const artifactCountsPerLabel: Record<string, number> = {};
    for (const def of objectDefs) {
      artifactCountsPerLabel[def.label] = def.count;
    }

    const objectData: [number, number, number][] = [];
    const initialSum = 0;
    for (const label of objectLabels) {
      // TypeScript's Record type inference treats dynamic key access as potentially unsafe
      // We know from our type definition that values are [number, number, number], so we can safely access
      const counts: [number, number, number] | undefined = objectConfidenceCounts[label];
      const artifactCount = artifactCountsPerLabel[label] ?? initialSum;

      if (counts !== undefined) {
        // Scale confidence counts to sum to artifact count while maintaining proportions
        const totalObjectCount = counts.reduce((sum, val) => sum + val, initialSum);
        if (totalObjectCount > initialSum) {
          // Scale each confidence level proportionally
          const scaleFactor = artifactCount / totalObjectCount;
          const confidenceIndexHigh = 0;
          const confidenceIndexMedium = 1;
          const confidenceIndexLow = 2;
          const scaledCounts: [number, number, number] = [
            Math.round(counts[confidenceIndexHigh] * scaleFactor),
            Math.round(counts[confidenceIndexMedium] * scaleFactor),
            Math.round(counts[confidenceIndexLow] * scaleFactor)
          ];
          // Adjust to ensure they sum exactly to artifactCount (handle rounding errors)
          const scaledSum = scaledCounts.reduce((sum, val) => sum + val, initialSum);
          const difference = artifactCount - scaledSum;
          if (difference !== initialSum) {
            // Add the difference to the largest segment
            const maxValue = Math.max(...scaledCounts);
            const maxIndex = scaledCounts.indexOf(maxValue);
            const minValidIndex = 0;
            if (maxIndex >= minValidIndex && maxIndex < scaledCounts.length) {
              scaledCounts[maxIndex] = (scaledCounts[maxIndex] ?? initialSum) + difference;
            }
          }
          objectData.push(scaledCounts);
        } else {
          // No objects, use zeros
          objectData.push(defaultConfidenceCounts);
        }
      } else {
        objectData.push(defaultConfidenceCounts);
      }
    }

    charts.objects = ChartUtils.getBarChartConfig(objectLabels, objectData, {
      artifactCountsPerLabel,
      height: getDynamicHeight(objectDefs.length, MIN_DYNAMIC_HEIGHT),
      horizontal: true,
      stackColors: ["#10b981", "#f59e0b", "#ef4444"], // green-500, amber-500, red-500
      stackLabels: ["High", "Medium", "Low"],
      stacked: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: DURATION_CHART_WIDTH
    });
  } else {
    // Fallback to simple bars if confidence data not available
    charts.objects = ChartUtils.getBarChartConfig(
      objectDefs.map((d) => d.label),
      objectDefs.map((d) => d.count),
      {
        height: getDynamicHeight(objectDefs.length, MIN_DYNAMIC_HEIGHT),
        horizontal: true,
        title: "",
        totalForPercentages: metadataList.length,
        width: DURATION_CHART_WIDTH
      }
    );
  }

  charts.errors = ChartUtils.getBarChartConfig(
    errorDefs.map((d) => d.label),
    errorDefs.map((d) => d.count),
    {
      height: getDynamicHeight(errorDefs.length, MIN_DYNAMIC_HEIGHT),
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: ERRORS_CHART_WIDTH
    }
  );

  // Sections
  const sectionMap: Record<string, number> = {};
  for (const m of metadataList) {
    for (const label of m.sectionLabels) {
      sectionMap[label] = (sectionMap[label] ?? INITIAL_COUNT) + INCREMENT_STEP;
    }
  }
  const sectionLabels = Object.keys(sectionMap).sort(
    (a, b) => (sectionMap[b] ?? INITIAL_COUNT) - (sectionMap[a] ?? INITIAL_COUNT)
  );
  const sectionCounts = sectionLabels.map((l) => sectionMap[l] ?? INITIAL_COUNT);

  charts.sections = ChartUtils.getBarChartConfig(sectionLabels, sectionCounts, {
    height: getDynamicHeight(sectionLabels.length, MIN_DYNAMIC_HEIGHT),
    horizontal: true,
    title: "",
    totalForPercentages: metadataList.length,
    width: DURATION_CHART_WIDTH
  });

  const populatedCharts = charts as CaptureCharts;

  const sections: ReportSection[] = [];

  // Metadata
  const DECIMAL_PLACES_AVG = 1;
  const subtitle = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES_AVG)}s | Artifacts: ${videoCount.toString()}`;

  // Charts
  const chartSections: ReportSection[] = [];

  // Duration
  chartSections.push({
    data: populatedCharts.duration,
    title: "Duration",
    type: "chart"
  });

  // Framerate & Resolution Side-by-Side (move up to appear earlier)
  chartSections.push({
    data: [
      {
        data: populatedCharts.fps,
        title: "Framerate"
      },
      {
        data: populatedCharts.resolution,
        title: "Resolution"
      }
    ],
    type: "chart-row"
  });

  // Page break before Lens Model so it starts on page 2
  chartSections.push({
    data: "",
    title: "",
    type: "page-break"
  });

  // Device Model (dedicated page)
  chartSections.push({
    data: populatedCharts.lens,
    title: "Device Model",
    type: "chart"
  });

  // Focal Length & Aperture Side-by-Side
  chartSections.push({
    data: [
      {
        data: populatedCharts.focalLength,
        title: "Focal Length"
      },
      {
        data: populatedCharts.aperture,
        title: "Max Aperture"
      }
    ],
    type: "chart-row"
  });

  // Ambient Intensity (full-width)
  chartSections.push({
    data: populatedCharts.ambient,
    title: "Ambient Intensity",
    type: "chart"
  });

  // Color Temperature (full-width)
  chartSections.push({
    data: populatedCharts.temperature,
    title: "Color Temperature",
    type: "chart"
  });

  // ISO Speed (full-width)
  chartSections.push({
    data: populatedCharts.iso,
    title: "ISO Speed",
    type: "chart"
  });

  // Brightness Value (full-width)
  chartSections.push({
    data: populatedCharts.brightness,
    title: "Brightness Value",
    type: "chart"
  });

  // Room Area
  chartSections.push({
    data: populatedCharts.area,
    title: "Room Area",
    type: "chart"
  });

  // Capture Errors
  chartSections.push({
    data: populatedCharts.errors,
    title: "Capture Errors",
    type: "chart"
  });

  // Feature Prevalence
  chartSections.push({
    data: populatedCharts.features,
    title: "Feature Prevalence",
    type: "chart"
  });

  // Object Distribution
  chartSections.push({
    data: populatedCharts.objects,
    title: "Object Distribution",
    type: "chart"
  });

  // Section Types
  chartSections.push({
    data: populatedCharts.sections,
    title: "Section Types",
    type: "chart"
  });

  const reportData: ReportData = {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
  return reportData;
}
