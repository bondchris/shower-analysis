import { ArtifactAnalysis } from "../models/artifactAnalysis";
import * as ChartUtils from "../utils/chartUtils";
import { ChartConfiguration } from "../utils/chartUtils";
import {
  convertAreasToSquareFeet,
  getDoorAreas,
  getObjectConfidenceCounts,
  getOpeningAreas,
  getUnexpectedVersionArtifactDirs,
  getWallAreas,
  getWindowAreas
} from "../utils/data/rawScanExtractor";
import { sortDeviceModels } from "../utils/deviceSorting";
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
  windowArea: ChartConfiguration;
  doorArea: ChartConfiguration;
  openingArea: ChartConfiguration;
  wallArea: ChartConfiguration;
}

// Helper interface for local chart data preparation
interface ChartDef {
  check: (m: ArtifactAnalysis) => boolean;
  count: number;
  label: string;
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

  const { deviceCounts, deviceLabels, separatorLabel } = sortDeviceModels(deviceMap);

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

  // Get set of artifact directories with unexpected versions
  const unexpectedVersionDirs =
    artifactDirs !== undefined ? getUnexpectedVersionArtifactDirs(artifactDirs) : new Set<string>();

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

  // Add unexpected version error if artifact directories are provided
  if (artifactDirs !== undefined) {
    errorDefs.push({
      check: () => false, // Will be handled separately in counting loop
      count: INITIAL_COUNT,
      label: "Unexpected Version"
    });
  }

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
    { check: (m: ArtifactAnalysis) => m.hasLowCeiling, count: INITIAL_COUNT, label: "Low Ceiling (< 7.5ft)" },
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

  for (let i = 0; i < metadataList.length; i++) {
    const m = metadataList[i];
    if (m === undefined) {
      continue;
    }
    const currentDir = artifactDirs !== undefined && i < artifactDirs.length ? artifactDirs[i] : undefined;

    for (const d of errorDefs) {
      if (d.label === "Unexpected Version") {
        // Special handling for unexpected version: check if current directory is in the set
        if (currentDir !== undefined && unexpectedVersionDirs.has(currentDir)) {
          d.count++;
        }
      } else if (d.check(m)) {
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

  // Window, Door, Opening, and Wall Areas
  if (artifactDirs !== undefined) {
    const windowAreasSqM = getWindowAreas(artifactDirs);
    const doorAreasSqM = getDoorAreas(artifactDirs);
    const openingAreasSqM = getOpeningAreas(artifactDirs);
    const wallAreasSqM = getWallAreas(artifactDirs);

    const windowAreasSqFt = convertAreasToSquareFeet(windowAreasSqM);
    const doorAreasSqFt = convertAreasToSquareFeet(doorAreasSqM);
    const openingAreasSqFt = convertAreasToSquareFeet(openingAreasSqM);
    const wallAreasSqFt = convertAreasToSquareFeet(wallAreasSqM);

    // Window Areas: 0-50 sq ft (typical window sizes)
    const windowAreaKde = ChartUtils.calculateKde(windowAreasSqFt, { max: 50, min: 0, resolution: 200 });
    charts.windowArea = ChartUtils.getLineChartConfig(
      windowAreaKde.labels,
      [
        {
          borderColor: "#3b82f6",
          borderWidth: 2,
          data: windowAreaKde.values,
          fill: true,
          label: "Density"
        }
      ],
      {
        chartId: "windowArea",
        height: HALF_CHART_HEIGHT,
        smooth: true,
        title: "",
        width: HISTO_CHART_WIDTH,
        xLabel: "sq ft",
        yLabel: "Count"
      }
    );

    // Door Areas: 0-30 sq ft (typical door sizes)
    const doorAreaKde = ChartUtils.calculateKde(doorAreasSqFt, { max: 30, min: 0, resolution: 200 });
    charts.doorArea = ChartUtils.getLineChartConfig(
      doorAreaKde.labels,
      [
        {
          borderColor: "#8b5cf6",
          borderWidth: 2,
          data: doorAreaKde.values,
          fill: true,
          label: "Density"
        }
      ],
      {
        chartId: "doorArea",
        height: HALF_CHART_HEIGHT,
        smooth: true,
        title: "",
        width: HISTO_CHART_WIDTH,
        xLabel: "sq ft",
        yLabel: "Count"
      }
    );

    // Opening Areas: 0-50 sq ft (similar to windows)
    const openingAreaKde = ChartUtils.calculateKde(openingAreasSqFt, { max: 50, min: 0, resolution: 200 });
    charts.openingArea = ChartUtils.getLineChartConfig(
      openingAreaKde.labels,
      [
        {
          borderColor: "#f59e0b",
          borderWidth: 2,
          data: openingAreaKde.values,
          fill: true,
          label: "Density"
        }
      ],
      {
        chartId: "openingArea",
        height: HALF_CHART_HEIGHT,
        smooth: true,
        title: "",
        width: HISTO_CHART_WIDTH,
        xLabel: "sq ft",
        yLabel: "Count"
      }
    );

    // Wall Areas: 0-200 sq ft (typical wall sizes)
    const wallAreaKde = ChartUtils.calculateKde(wallAreasSqFt, { max: 200, min: 0, resolution: 200 });
    charts.wallArea = ChartUtils.getLineChartConfig(
      wallAreaKde.labels,
      [
        {
          borderColor: "#ef4444",
          borderWidth: 2,
          data: wallAreaKde.values,
          fill: true,
          label: "Density"
        }
      ],
      {
        chartId: "wallArea",
        height: HALF_CHART_HEIGHT,
        smooth: true,
        title: "",
        width: HISTO_CHART_WIDTH,
        xLabel: "sq ft",
        yLabel: "Count"
      }
    );
  }

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

  // Window Areas
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: populatedCharts.windowArea,
      title: "Window Areas",
      type: "chart"
    });
  }

  // Door Areas
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: populatedCharts.doorArea,
      title: "Door Areas",
      type: "chart"
    });
  }

  // Opening Areas
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: populatedCharts.openingArea,
      title: "Opening Areas",
      type: "chart"
    });
  }

  // Wall Areas
  if (artifactDirs !== undefined) {
    chartSections.push({
      data: populatedCharts.wallArea,
      title: "Wall Areas",
      type: "chart"
    });
  }

  const reportData: ReportData = {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
  return reportData;
}
