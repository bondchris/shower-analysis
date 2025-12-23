import { ArtifactAnalysis } from "../models/artifactAnalysis";
import { ChartConfiguration } from "../models/chart/chartConfiguration";
import { calculateKde } from "../utils/chart/kde";
import { getBarChartConfig, getLineChartConfig, getPieChartConfig } from "../utils/chart/configBuilders";
import { startCase } from "lodash";
import {
  convertAreasToSquareFeet,
  getDoorAreas,
  getDoorIsOpenCounts,
  getObjectAttributeCounts,
  getObjectConfidenceCounts,
  getOpeningAreas,
  getUnexpectedVersionArtifactDirs,
  getWallAreas,
  getWindowAreas
} from "../utils/data/rawScanExtractor";
import { sortDeviceModels } from "../utils/deviceSorting";
import { ReportData, ReportSection } from "../models/report";
import {
  CabinetIcon,
  ChairArmExistingIcon,
  ChairArmMissingIcon,
  ChairBackMissingIcon,
  CircularEllipticIcon,
  DiningIcon,
  DoorClosedIcon,
  DoorOpenIcon,
  ExistingIcon,
  FourIcon,
  RectangularIcon,
  ShelfIcon,
  SingleSeatIcon,
  StarIcon,
  StoolIcon,
  SwivelIcon,
  UnidentifiedIcon
} from "./components/charts/legend-icons/iconConfig";

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
  deviceModel: ChartConfiguration;
  resolution: ChartConfiguration;
  temperature: ChartConfiguration;
  focalLength: ChartConfiguration;
  aperture: ChartConfiguration;
  sections: ChartConfiguration;
  windowArea: ChartConfiguration;
  doorArea: ChartConfiguration;
  openingArea: ChartConfiguration;
  wallArea: ChartConfiguration;
  doorIsOpen: ChartConfiguration;
  chairArmType: ChartConfiguration;
  chairBackType: ChartConfiguration;
  chairLegType: ChartConfiguration;
  chairType: ChartConfiguration;
  sofaType: ChartConfiguration;
  storageType: ChartConfiguration;
  tableShapeType: ChartConfiguration;
  tableType: ChartConfiguration;
}

// Helper type for local chart data preparation
type ChartDef =
  | { check: (m: ArtifactAnalysis) => boolean; count: number; kind: "predicate"; label: string }
  | { count: number; kind: "unexpectedVersion"; label: string };

// Layout constants interface
interface LayoutConstants {
  PAGE_VIEWPORT_WIDTH: number;
  PAGE_VIEWPORT_HEIGHT: number;
  PAGE_MARGIN: number;
  PAGE_CONTENT_WIDTH: number;
  PAGE_CONTENT_HEIGHT: number;
  DURATION_CHART_WIDTH: number;
  HALF_CHART_WIDTH: number;
  THIRD_CHART_WIDTH: number;
  HISTO_CHART_WIDTH: number;
  ERRORS_CHART_WIDTH: number;
  DURATION_CHART_HEIGHT: number;
  HALF_CHART_HEIGHT: number;
  LENS_CHART_HEIGHT: number;
  MIN_DYNAMIC_HEIGHT: number;
  getDynamicHeight: (itemCount: number, minHeight?: number) => number;
}

function computeLayoutConstants(): LayoutConstants {
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
  const THIRD_WIDTH_RATIO = 0.23;
  const HISTO_WIDTH_RATIO = FULL_WIDTH_RATIO;
  const ERRORS_WIDTH_RATIO = 0.82;
  const DURATION_HEIGHT_RATIO = 0.32;
  const HALF_HEIGHT_RATIO = 0.26;
  const LENS_HEIGHT_RATIO = 0.35;

  const MIN_DURATION_HEIGHT = 260;
  const MIN_HALF_HEIGHT = 260;
  const MIN_LENS_HEIGHT = 340;

  const MIN_DYNAMIC_HEIGHT = 140;

  const DURATION_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * FULL_WIDTH_RATIO);
  const HALF_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HALF_WIDTH_RATIO);
  const THIRD_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * THIRD_WIDTH_RATIO);
  const HISTO_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HISTO_WIDTH_RATIO);
  const ERRORS_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * ERRORS_WIDTH_RATIO);
  const DURATION_CHART_HEIGHT = Math.max(MIN_DURATION_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * DURATION_HEIGHT_RATIO));
  const HALF_CHART_HEIGHT = Math.max(MIN_HALF_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * HALF_HEIGHT_RATIO));
  const LENS_CHART_HEIGHT = Math.max(MIN_LENS_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * LENS_HEIGHT_RATIO));

  // Helper for dynamic height
  const MIN_BAR_HEIGHT = 20;
  const HEADER_SPACE = 60;
  function getDynamicHeight(itemCount: number, minHeight = HALF_CHART_HEIGHT): number {
    const contentHeight = itemCount * MIN_BAR_HEIGHT;
    return Math.max(minHeight, contentHeight + HEADER_SPACE);
  }

  return {
    DURATION_CHART_HEIGHT,
    DURATION_CHART_WIDTH,
    ERRORS_CHART_WIDTH,
    HALF_CHART_HEIGHT,
    HALF_CHART_WIDTH,
    HISTO_CHART_WIDTH,
    LENS_CHART_HEIGHT,
    MIN_DYNAMIC_HEIGHT,
    PAGE_CONTENT_HEIGHT,
    PAGE_CONTENT_WIDTH,
    PAGE_MARGIN,
    PAGE_VIEWPORT_HEIGHT,
    PAGE_VIEWPORT_WIDTH,
    THIRD_CHART_WIDTH,
    getDynamicHeight
  };
}

function buildKdeCharts(
  metadataList: ArtifactAnalysis[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "duration" | "ambient" | "temperature" | "iso" | "brightness" | "area">> {
  const charts: Partial<Pick<CaptureCharts, "duration" | "ambient" | "temperature" | "iso" | "brightness" | "area">> =
    {};
  const NO_RESULTS = 0;

  // Duration
  const durations = metadataList.map((m) => m.duration);
  const durKde = calculateKde(durations, { max: 120, min: 10, resolution: 200 });
  charts.duration = getLineChartConfig(
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
      height: layout.DURATION_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.DURATION_CHART_WIDTH,
      xLabel: "Seconds",
      yLabel: "Count"
    }
  );

  // Lighting & Exposure Data
  const intensityVals = metadataList.map((m) => m.avgAmbientIntensity).filter((v) => v > NO_RESULTS);
  const tempVals = metadataList.map((m) => m.avgColorTemperature).filter((v) => v > NO_RESULTS);
  const isoVals = metadataList.map((m) => m.avgIso).filter((v) => v > NO_RESULTS);
  const briVals = metadataList.map((m) => m.avgBrightness).filter((v) => v !== NO_RESULTS);
  const areaVals = metadataList.map((m) => m.roomAreaSqFt).filter((v) => v > NO_RESULTS);

  // Ambient: 980-1040
  const ambientKde = calculateKde(intensityVals, {
    max: 1040,
    min: 980,
    resolution: 200
  });
  charts.ambient = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "Lux",
      yLabel: "Count"
    }
  );

  // Temp: 3500-6700
  const tempKde = calculateKde(tempVals, { max: 6700, min: 3500, resolution: 200 });
  charts.temperature = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "Kelvin",
      yLabel: "Count"
    }
  );

  // ISO: 0-800
  const isoKde = calculateKde(isoVals, { max: 800, min: 0, resolution: 200 });
  charts.iso = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "ISO",
      yLabel: "Count"
    }
  );

  // Brightness: 0-6
  const briKde = calculateKde(briVals, { max: 6, min: 0, resolution: 200 });
  charts.brightness = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "EV",
      yLabel: "Count"
    }
  );

  // Room Area: 0-150
  const areaKde = calculateKde(areaVals, { max: 150, min: 0, resolution: 200 });
  charts.area = getLineChartConfig(
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
      height: layout.DURATION_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.DURATION_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  return charts;
}

function buildDeviceAndCameraCharts(
  metadataList: ArtifactAnalysis[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "deviceModel" | "focalLength" | "aperture" | "fps" | "resolution">> {
  const charts: Partial<Pick<CaptureCharts, "deviceModel" | "focalLength" | "aperture" | "fps" | "resolution">> = {};
  const NOT_SET = "";
  const INCREMENT_STEP = 1;
  const INITIAL_COUNT = 0;
  const DECIMAL_PLACES_LENS = 1;
  const LENS_WIDTH_RATIO = 0.9;

  // Device Model
  const deviceMap: Record<string, number> = {};
  for (const m of metadataList) {
    const model = m.deviceModel === NOT_SET ? "Unknown" : m.deviceModel;
    deviceMap[model] = (deviceMap[model] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }

  const { deviceCounts, deviceLabels, separatorLabel } = sortDeviceModels(deviceMap);

  charts.deviceModel = getBarChartConfig(deviceLabels, deviceCounts, {
    height: layout.getDynamicHeight(deviceLabels.length, layout.LENS_CHART_HEIGHT),
    horizontal: true,
    ...(separatorLabel !== undefined ? { separatorLabel } : {}),
    title: "",
    totalForPercentages: metadataList.length,
    width: Math.round(layout.PAGE_CONTENT_WIDTH * LENS_WIDTH_RATIO)
  });

  // Focal Length (aggregated & normalized)
  const focalMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensFocalLength !== NOT_SET) {
      const val = parseFloat(m.lensFocalLength);
      if (!isNaN(val)) {
        key = `${val.toFixed(DECIMAL_PLACES_LENS)} mm`;
      } else {
        key = m.lensFocalLength;
      }
    }
    focalMap[key] = (focalMap[key] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const focalLabels = Object.keys(focalMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const focalCounts = focalLabels.map((l) => focalMap[l] ?? INITIAL_COUNT);

  // Aperture
  const apertureMap: Record<string, number> = {};
  for (const m of metadataList) {
    let key = "Unknown";
    if (m.lensAperture !== NOT_SET) {
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

  charts.focalLength = getBarChartConfig(focalLabels, focalCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  charts.aperture = getBarChartConfig(apertureLabels, apertureCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Framerate
  const fpsMap: Record<string, number> = {};
  for (const m of metadataList) {
    const fps = Math.round(m.fps).toString();
    fpsMap[fps] = (fpsMap[fps] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const fpsLabels = Object.keys(fpsMap).sort((a, b) => parseFloat(a) - parseFloat(b));
  const fpsCounts = fpsLabels.map((l) => fpsMap[l] ?? INITIAL_COUNT);
  charts.fps = getBarChartConfig(fpsLabels, fpsCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  // Resolution
  const resMap: Record<string, number> = {};
  for (const m of metadataList) {
    const res = `${m.width.toString()}x${m.height.toString()}`;
    resMap[res] = (resMap[res] ?? INITIAL_COUNT) + INCREMENT_STEP;
  }
  const resLabels = Object.keys(resMap).sort();
  const resCounts = resLabels.map((l) => resMap[l] ?? INITIAL_COUNT);
  charts.resolution = getBarChartConfig(resLabels, resCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.HALF_CHART_WIDTH
  });

  return charts;
}

function buildErrorFeatureObjectCharts(
  metadataList: ArtifactAnalysis[],
  artifactDirs: string[] | undefined,
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "errors" | "features" | "objects" | "sections">> {
  const charts: Partial<Pick<CaptureCharts, "errors" | "features" | "objects" | "sections">> = {};
  const INITIAL_COUNT = 0;
  const INCREMENT_STEP = 1;
  const NO_RESULTS = 0;
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  // Get set of artifact directories with unexpected versions
  const unexpectedVersionDirs =
    artifactDirs !== undefined ? getUnexpectedVersionArtifactDirs(artifactDirs) : new Set<string>();

  // Capture Errors & Features
  const errorDefs: ChartDef[] = [
    {
      check: (m: ArtifactAnalysis) => m.hasToiletGapErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: 'Toilet Gap > 1"'
    },
    {
      check: (m: ArtifactAnalysis) => m.hasTubGapErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: 'Tub Gap 1"-6"'
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallGapErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: 'Wall Gaps 1"-12"'
    },
    {
      check: (m: ArtifactAnalysis) => m.hasColinearWallErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Colinear Walls"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasObjectIntersectionErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Object Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallObjectIntersectionErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Wall <-> Object Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWallWallIntersectionErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Wall <-> Wall Intersections"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasCrookedWallErrors,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Crooked Walls"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasDoorBlockingError,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Door Blocked"
    },
    {
      check: (m: ArtifactAnalysis) => m.wallCount < MIN_WALLS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "< 4 Walls"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasUnparentedEmbedded,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Unparented Embedded"
    }
  ];

  if (artifactDirs !== undefined) {
    errorDefs.push({
      count: INITIAL_COUNT,
      kind: "unexpectedVersion",
      label: "Unexpected Version"
    });
  }

  const featureDefs: ChartDef[] = [
    {
      check: (m: ArtifactAnalysis) => m.hasNonRectWall,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Non-Rectangular Walls"
    },
    { check: (m: ArtifactAnalysis) => m.hasCurvedWall, count: INITIAL_COUNT, kind: "predicate", label: "Curved Walls" },
    {
      check: (m: ArtifactAnalysis) => m.hasCurvedEmbedded,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Curved Embedded"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasNonRectangularEmbedded,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Non-Rectangular Embedded"
    },
    {
      check: (m: ArtifactAnalysis) => m.toiletCount >= MIN_TOILETS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "2+ Toilets"
    },
    {
      check: (m: ArtifactAnalysis) => m.tubCount >= MIN_TUBS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "2+ Tubs"
    },
    {
      check: (m: ArtifactAnalysis) => m.sinkCount === INITIAL_COUNT && m.storageCount === INITIAL_COUNT,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "No Vanity"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasExternalOpening,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "External Opening"
    },
    { check: (m: ArtifactAnalysis) => m.hasSoffit, count: INITIAL_COUNT, kind: "predicate", label: "Soffit" },
    {
      check: (m: ArtifactAnalysis) => m.hasLowCeiling,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Low Ceiling (< 7.5ft)"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasNibWalls,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Nib Walls (< 1ft)"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasMultipleStories,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Multiple Stories"
    }
  ];

  const objectDefs: ChartDef[] = [
    {
      check: (m: ArtifactAnalysis) => m.toiletCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Toilet"
    },
    {
      check: (m: ArtifactAnalysis) => m.doorCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Door"
    },
    {
      check: (m: ArtifactAnalysis) => m.windowCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Window"
    },
    {
      check: (m: ArtifactAnalysis) => m.storageCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Storage"
    },
    {
      check: (m: ArtifactAnalysis) => m.sinkCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Sink"
    },
    {
      check: (m: ArtifactAnalysis) => m.tubCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Bathtub"
    },
    {
      check: (m: ArtifactAnalysis) => m.openingCount > NO_RESULTS,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Opening"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasWasherDryer,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Washer/Dryer"
    },
    { check: (m: ArtifactAnalysis) => m.hasStove, count: INITIAL_COUNT, kind: "predicate", label: "Stove" },
    { check: (m: ArtifactAnalysis) => m.hasTable, count: INITIAL_COUNT, kind: "predicate", label: "Table" },
    { check: (m: ArtifactAnalysis) => m.hasChair, count: INITIAL_COUNT, kind: "predicate", label: "Chair" },
    { check: (m: ArtifactAnalysis) => m.hasBed, count: INITIAL_COUNT, kind: "predicate", label: "Bed" },
    { check: (m: ArtifactAnalysis) => m.hasSofa, count: INITIAL_COUNT, kind: "predicate", label: "Sofa" },
    { check: (m: ArtifactAnalysis) => m.hasDishwasher, count: INITIAL_COUNT, kind: "predicate", label: "Dishwasher" },
    { check: (m: ArtifactAnalysis) => m.hasOven, count: INITIAL_COUNT, kind: "predicate", label: "Oven" },
    {
      check: (m: ArtifactAnalysis) => m.hasRefrigerator,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Refrigerator"
    },
    { check: (m: ArtifactAnalysis) => m.hasStairs, count: INITIAL_COUNT, kind: "predicate", label: "Stairs" },
    { check: (m: ArtifactAnalysis) => m.hasFireplace, count: INITIAL_COUNT, kind: "predicate", label: "Fireplace" },
    { check: (m: ArtifactAnalysis) => m.hasTelevision, count: INITIAL_COUNT, kind: "predicate", label: "Television" }
  ];

  for (let i = 0; i < metadataList.length; i++) {
    const m = metadataList[i];
    if (m === undefined) {
      continue;
    }
    const currentDir = artifactDirs !== undefined && i < artifactDirs.length ? artifactDirs[i] : undefined;

    for (const d of errorDefs) {
      switch (d.kind) {
        case "unexpectedVersion":
          if (currentDir !== undefined && unexpectedVersionDirs.has(currentDir)) {
            d.count++;
          }
          break;
        case "predicate":
          if (d.check(m)) {
            d.count++;
          }
          break;
      }
    }
    for (const d of featureDefs) {
      if (d.kind === "predicate" && d.check(m)) {
        d.count++;
      }
    }
    for (const d of objectDefs) {
      if (d.kind === "predicate" && d.check(m)) {
        d.count++;
      }
    }
  }

  objectDefs.sort((a, b) => b.count - a.count);
  errorDefs.sort((a, b) => b.count - a.count);
  featureDefs.sort((a, b) => b.count - a.count);

  charts.features = getBarChartConfig(
    featureDefs.map((d) => d.label),
    featureDefs.map((d) => d.count),
    {
      height: layout.getDynamicHeight(featureDefs.length, layout.MIN_DYNAMIC_HEIGHT),
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: layout.DURATION_CHART_WIDTH
    }
  );

  const objectConfidenceCounts = artifactDirs !== undefined ? getObjectConfidenceCounts(artifactDirs) : null;

  if (objectConfidenceCounts !== null) {
    const objectLabels = objectDefs.map((d) => d.label);
    const confidenceZeroValue = 0;
    const defaultConfidenceCounts: [number, number, number] = [
      confidenceZeroValue,
      confidenceZeroValue,
      confidenceZeroValue
    ];
    const artifactCountsPerLabel: Record<string, number> = {};
    for (const def of objectDefs) {
      artifactCountsPerLabel[def.label] = def.count;
    }

    const objectData: [number, number, number][] = [];
    const initialSum = 0;
    for (const label of objectLabels) {
      const counts: [number, number, number] | undefined = objectConfidenceCounts[label];
      const artifactCount = artifactCountsPerLabel[label] ?? initialSum;

      if (counts !== undefined) {
        const totalObjectCount = counts.reduce((sum, val) => sum + val, initialSum);
        if (totalObjectCount > initialSum) {
          const scaleFactor = artifactCount / totalObjectCount;
          const confidenceIndexHigh = 0;
          const confidenceIndexMedium = 1;
          const confidenceIndexLow = 2;
          const scaledCounts: [number, number, number] = [
            Math.round(counts[confidenceIndexHigh] * scaleFactor),
            Math.round(counts[confidenceIndexMedium] * scaleFactor),
            Math.round(counts[confidenceIndexLow] * scaleFactor)
          ];
          const scaledSum = scaledCounts.reduce((sum, val) => sum + val, initialSum);
          const difference = artifactCount - scaledSum;
          if (difference !== initialSum) {
            const maxValue = Math.max(...scaledCounts);
            const maxIndex = scaledCounts.indexOf(maxValue);
            const minValidIndex = 0;
            if (maxIndex >= minValidIndex && maxIndex < scaledCounts.length) {
              scaledCounts[maxIndex] = (scaledCounts[maxIndex] ?? initialSum) + difference;
            }
          }
          objectData.push(scaledCounts);
        } else {
          objectData.push(defaultConfidenceCounts);
        }
      } else {
        objectData.push(defaultConfidenceCounts);
      }
    }

    charts.objects = getBarChartConfig(objectLabels, objectData, {
      artifactCountsPerLabel,
      height: layout.getDynamicHeight(objectDefs.length, layout.MIN_DYNAMIC_HEIGHT),
      horizontal: true,
      stackColors: ["#10b981", "#f59e0b", "#ef4444"],
      stackLabels: ["High", "Medium", "Low"],
      stacked: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: layout.DURATION_CHART_WIDTH
    });
  } else {
    charts.objects = getBarChartConfig(
      objectDefs.map((d) => d.label),
      objectDefs.map((d) => d.count),
      {
        height: layout.getDynamicHeight(objectDefs.length, layout.MIN_DYNAMIC_HEIGHT),
        horizontal: true,
        title: "",
        totalForPercentages: metadataList.length,
        width: layout.DURATION_CHART_WIDTH
      }
    );
  }

  charts.errors = getBarChartConfig(
    errorDefs.map((d) => d.label),
    errorDefs.map((d) => d.count),
    {
      height: layout.getDynamicHeight(errorDefs.length, layout.MIN_DYNAMIC_HEIGHT),
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: layout.ERRORS_CHART_WIDTH
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

  charts.sections = getBarChartConfig(sectionLabels, sectionCounts, {
    height: layout.getDynamicHeight(sectionLabels.length, layout.MIN_DYNAMIC_HEIGHT),
    horizontal: true,
    title: "",
    totalForPercentages: metadataList.length,
    width: layout.DURATION_CHART_WIDTH
  });

  return charts;
}

function buildAreaCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<Pick<CaptureCharts, "windowArea" | "doorArea" | "openingArea" | "wallArea">> {
  const charts: Partial<Pick<CaptureCharts, "windowArea" | "doorArea" | "openingArea" | "wallArea">> = {};

  const windowAreasSqM = getWindowAreas(artifactDirs);
  const doorAreasSqM = getDoorAreas(artifactDirs);
  const openingAreasSqM = getOpeningAreas(artifactDirs);
  const wallAreasSqM = getWallAreas(artifactDirs);

  const windowAreasSqFt = convertAreasToSquareFeet(windowAreasSqM);
  const doorAreasSqFt = convertAreasToSquareFeet(doorAreasSqM);
  const openingAreasSqFt = convertAreasToSquareFeet(openingAreasSqM);
  const wallAreasSqFt = convertAreasToSquareFeet(wallAreasSqM);

  const windowAreaKde = calculateKde(windowAreasSqFt, { max: 50, min: 0, resolution: 200 });
  charts.windowArea = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const doorAreaKde = calculateKde(doorAreasSqFt, { max: 30, min: 0, resolution: 200 });
  charts.doorArea = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const openingAreaKde = calculateKde(openingAreasSqFt, { max: 50, min: 0, resolution: 200 });
  charts.openingArea = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  const wallAreaKde = calculateKde(wallAreasSqFt, { max: 200, min: 0, resolution: 200 });
  charts.wallArea = getLineChartConfig(
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
      height: layout.HALF_CHART_HEIGHT,
      smooth: true,
      title: "",
      width: layout.HISTO_CHART_WIDTH,
      xLabel: "sq ft",
      yLabel: "Count"
    }
  );

  return charts;
}

function buildAttributePieCharts(
  artifactDirs: string[],
  layout: LayoutConstants
): Partial<
  Pick<
    CaptureCharts,
    | "doorIsOpen"
    | "chairArmType"
    | "chairBackType"
    | "chairLegType"
    | "chairType"
    | "sofaType"
    | "storageType"
    | "tableShapeType"
    | "tableType"
  >
> {
  const charts: Partial<
    Pick<
      CaptureCharts,
      | "doorIsOpen"
      | "chairArmType"
      | "chairBackType"
      | "chairLegType"
      | "chairType"
      | "sofaType"
      | "storageType"
      | "tableShapeType"
      | "tableType"
    >
  > = {};
  const INITIAL_COUNT = 0;
  const INCREMENT_STEP = 1;

  const distinctColors = [
    "#4E79A7", // Blue
    "#F28E2B", // Orange
    "#E15759", // Red
    "#76B7B2", // Cyan/Teal
    "#59A14F", // Green
    "#EDC948", // Yellow
    "#B07AA1", // Purple
    "#BAB0AC", // Gray
    "#FF9DA7", // Light Pink/Red
    "#9C755F" // Brown
  ];

  const labelChartCount = new Map<string, number>();

  const doorIsOpenCounts = getDoorIsOpenCounts(artifactDirs);
  Object.keys(doorIsOpenCounts).forEach((label) => {
    const currentCount = labelChartCount.get(label) ?? INITIAL_COUNT;
    labelChartCount.set(label, currentCount + INCREMENT_STEP);
  });

  const attributeTypeMap: Record<string, keyof CaptureCharts> = {
    ChairArmType: "chairArmType",
    ChairBackType: "chairBackType",
    ChairLegType: "chairLegType",
    ChairType: "chairType",
    SofaType: "sofaType",
    StorageType: "storageType",
    TableShapeType: "tableShapeType",
    TableType: "tableType"
  };

  for (const [attributeType] of Object.entries(attributeTypeMap)) {
    const attributeCounts = getObjectAttributeCounts(artifactDirs, attributeType);
    Object.keys(attributeCounts).forEach((label) => {
      const currentCount = labelChartCount.get(label) ?? INITIAL_COUNT;
      labelChartCount.set(label, currentCount + INCREMENT_STEP);
    });
  }

  const sharedLabels: string[] = [];
  const minChartsForShared = 2;
  for (const [label, count] of labelChartCount.entries()) {
    if (count >= minChartsForShared) {
      sharedLabels.push(label);
    }
  }

  sharedLabels.sort();

  const labelColorMap = new Map<string, string>();
  const firstColorIndex = 0;
  const defaultFallbackColor = distinctColors[firstColorIndex] ?? "#4E79A7";
  const decrement = 1;
  let sharedColorIndex = distinctColors.length - decrement;

  for (const label of sharedLabels) {
    if (sharedColorIndex >= firstColorIndex) {
      const color = distinctColors[sharedColorIndex];
      if (color !== undefined) {
        labelColorMap.set(label, color);
        sharedColorIndex -= decrement;
      }
    }
  }

  const getColorsForLabels = (labels: string[]): string[] => {
    let rotationIndex = firstColorIndex;
    const result: string[] = [];
    for (const label of labels) {
      const existingColor = labelColorMap.get(label);
      if (existingColor !== undefined) {
        result.push(existingColor);
        continue;
      }

      const colorIndex = rotationIndex % distinctColors.length;
      const color = distinctColors[colorIndex];
      rotationIndex++;
      if (color !== undefined) {
        result.push(color);
      } else {
        result.push(defaultFallbackColor);
      }
    }
    return result;
  };

  const doorIsOpenEntries = Object.entries(doorIsOpenCounts).sort(([, a], [, b]) => a - b);
  const doorIsOpenLabels = doorIsOpenEntries.map(([label]) => label);
  const doorIsOpenData = doorIsOpenEntries.map(([, value]) => value);

  if (doorIsOpenData.length > INITIAL_COUNT) {
    const doorColors = getColorsForLabels(doorIsOpenLabels);
    charts.doorIsOpen = getPieChartConfig(doorIsOpenLabels, doorIsOpenData, {
      colors: doorColors,
      height: layout.HALF_CHART_HEIGHT,
      legendIconComponents: {
        Closed: DoorClosedIcon,
        Open: DoorOpenIcon
      },
      title: "",
      width: layout.THIRD_CHART_WIDTH
    });
  }

  for (const [attributeType, chartKey] of Object.entries(attributeTypeMap)) {
    const attributeCounts = getObjectAttributeCounts(artifactDirs, attributeType);
    const attributeEntries = Object.entries(attributeCounts).sort(([, a], [, b]) => a - b);
    const originalLabels = attributeEntries.map(([label]) => label);
    const attributeData = attributeEntries.map(([, value]) => value);

    if (attributeData.length > INITIAL_COUNT) {
      const attributeLabels = originalLabels.map((label) => startCase(label));

      const circularEllipticLabel = "circularElliptic";
      const circularDisplayLabel = "Circular";
      const notFoundIndex = -1;
      const circularEllipticIndex = originalLabels.indexOf(circularEllipticLabel);
      if (circularEllipticIndex !== notFoundIndex) {
        attributeLabels[circularEllipticIndex] = circularDisplayLabel;
      }

      const labelMap = new Map<string, string>();
      originalLabels.forEach((original, index) => {
        labelMap.set(original, attributeLabels[index] ?? "");
      });

      const pieChartOptions: {
        colors: string[];
        height: number;
        legendIconComponents?: Record<
          string,
          React.ComponentType<{ color: string; x: number; y: number; legendBoxSize: number }>
        >;
        title: string;
        width: number;
      } = {
        colors: getColorsForLabels(originalLabels),
        height: layout.HALF_CHART_HEIGHT,
        title: "",
        width: layout.THIRD_CHART_WIDTH
      };

      const legendIconComponents: Record<
        string,
        React.ComponentType<{ color: string; x: number; y: number; legendBoxSize: number }>
      > = {};

      if (chartKey === "tableShapeType") {
        if (originalLabels.includes("circularElliptic")) {
          const displayLabel = labelMap.get("circularElliptic");
          if (displayLabel !== undefined) {
            legendIconComponents[displayLabel] = CircularEllipticIcon;
          }
        }
        if (originalLabels.includes("rectangular")) {
          const displayLabel = labelMap.get("rectangular");
          if (displayLabel !== undefined) {
            legendIconComponents[displayLabel] = RectangularIcon;
          }
        }
      }

      if (chartKey === "sofaType" && originalLabels.includes("singleSeat")) {
        const displayLabel = labelMap.get("singleSeat");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = SingleSeatIcon;
        }
      }

      if (chartKey === "chairType" && originalLabels.includes("stool")) {
        const displayLabel = labelMap.get("stool");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = StoolIcon;
        }
      }

      if (chartKey === "chairType" && originalLabels.includes("dining")) {
        const displayLabel = labelMap.get("dining");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = DiningIcon;
        }
      }

      if (chartKey === "chairType" && originalLabels.includes("swivel")) {
        const displayLabel = labelMap.get("swivel");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = SwivelIcon;
        }
      }

      if (chartKey === "chairLegType" && originalLabels.includes("four")) {
        const displayLabel = labelMap.get("four");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = FourIcon;
        }
      }

      if (chartKey === "chairLegType" && originalLabels.includes("star")) {
        const displayLabel = labelMap.get("star");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = StarIcon;
        }
      }

      if (chartKey === "chairArmType" && originalLabels.includes("missing")) {
        const displayLabel = labelMap.get("missing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ChairArmMissingIcon;
        }
      }

      if (chartKey === "chairArmType" && originalLabels.includes("existing")) {
        const displayLabel = labelMap.get("existing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ChairArmExistingIcon;
        }
      }

      if (chartKey === "chairBackType" && originalLabels.includes("missing")) {
        const displayLabel = labelMap.get("missing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ChairBackMissingIcon;
        }
      }

      if (chartKey === "chairBackType" && originalLabels.includes("existing")) {
        const displayLabel = labelMap.get("existing");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ExistingIcon;
        }
      }

      if (chartKey === "storageType" && originalLabels.includes("shelf")) {
        const displayLabel = labelMap.get("shelf");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = ShelfIcon;
        }
      }

      if (chartKey === "storageType" && originalLabels.includes("cabinet")) {
        const displayLabel = labelMap.get("cabinet");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = CabinetIcon;
        }
      }

      if (originalLabels.includes("unidentified")) {
        const displayLabel = labelMap.get("unidentified");
        if (displayLabel !== undefined) {
          legendIconComponents[displayLabel] = UnidentifiedIcon;
        }
      }

      if (Object.keys(legendIconComponents).length > INITIAL_COUNT) {
        pieChartOptions.legendIconComponents = legendIconComponents;
      }

      (charts as Record<string, ChartConfiguration>)[chartKey] = getPieChartConfig(
        attributeLabels,
        attributeData,
        pieChartOptions
      );
    }
  }

  return charts;
}

function buildReportSections(
  charts: CaptureCharts,
  artifactDirs: string[] | undefined,
  avgDuration: number,
  videoCount: number
): ReportData {
  const sections: ReportSection[] = [];
  const INITIAL_COUNT = 0;
  const DECIMAL_PLACES_AVG = 1;
  const subtitle = `Avg Duration: ${avgDuration.toFixed(DECIMAL_PLACES_AVG)}s | Artifacts: ${videoCount.toString()}`;

  const chartSections: ReportSection[] = [];

  chartSections.push({
    data: charts.duration,
    title: "Duration",
    type: "chart"
  });

  chartSections.push({
    data: [
      {
        data: charts.fps,
        title: "Framerate"
      },
      {
        data: charts.resolution,
        title: "Resolution"
      }
    ],
    type: "chart-row"
  });

  chartSections.push({
    data: "",
    title: "",
    type: "page-break"
  });

  chartSections.push({
    data: charts.deviceModel,
    title: "Device Model",
    type: "chart"
  });

  chartSections.push({
    data: [
      {
        data: charts.focalLength,
        title: "Focal Length"
      },
      {
        data: charts.aperture,
        title: "Max Aperture"
      }
    ],
    type: "chart-row"
  });

  chartSections.push({
    data: charts.ambient,
    title: "Ambient Intensity",
    type: "chart"
  });

  chartSections.push({
    data: charts.temperature,
    title: "Color Temperature",
    type: "chart"
  });

  chartSections.push({
    data: charts.iso,
    title: "ISO Speed",
    type: "chart"
  });

  chartSections.push({
    data: charts.brightness,
    title: "Brightness Value",
    type: "chart"
  });

  chartSections.push({
    data: charts.area,
    title: "Room Area",
    type: "chart"
  });

  chartSections.push({
    data: charts.errors,
    title: "Capture Errors",
    type: "chart"
  });

  chartSections.push({
    data: charts.features,
    title: "Feature Prevalence",
    type: "chart"
  });

  chartSections.push({
    data: charts.objects,
    title: "Object Distribution",
    type: "chart"
  });

  chartSections.push({
    data: charts.sections,
    title: "Section Types",
    type: "chart"
  });

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.windowArea,
      title: "Window Areas",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.doorArea,
      title: "Door Areas",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.openingArea,
      title: "Opening Areas",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined) {
    chartSections.push({
      data: charts.wallArea,
      title: "Wall Areas",
      type: "chart"
    });
  }

  if (artifactDirs !== undefined) {
    const attributeChartMap: { chartKey: keyof CaptureCharts; title: string }[] = [
      { chartKey: "doorIsOpen", title: "Door Open/Closed" },
      { chartKey: "chairArmType", title: "Chair Arm Type" },
      { chartKey: "chairBackType", title: "Chair Back Type" },
      { chartKey: "chairLegType", title: "Chair Base Type" },
      { chartKey: "chairType", title: "Chair Type" },
      { chartKey: "sofaType", title: "Sofa Type" },
      { chartKey: "storageType", title: "Storage Type" },
      { chartKey: "tableShapeType", title: "Table Shape Type" },
      { chartKey: "tableType", title: "Table Type" }
    ];

    const availableCharts: { data: ChartConfiguration; title: string }[] = [];
    for (const { chartKey, title } of attributeChartMap) {
      const chart = (charts as unknown as Record<string, ChartConfiguration | undefined>)[chartKey];
      if (chart !== undefined) {
        availableCharts.push({ data: chart, title });
      }
    }

    if (availableCharts.length > INITIAL_COUNT) {
      chartSections.push({
        data: "",
        title: "Object Attributes",
        type: "header"
      });

      const chartsPerRow = 3;
      for (let i = INITIAL_COUNT; i < availableCharts.length; i += chartsPerRow) {
        const rowCharts = availableCharts.slice(i, i + chartsPerRow);
        chartSections.push({
          data: rowCharts,
          type: "chart-row"
        });
      }
    }
  }

  const reportData: ReportData = {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
  return reportData;
}

export function buildDataAnalysisReport(
  metadataList: ArtifactAnalysis[],
  avgDuration: number,
  videoCount: number,
  artifactDirs?: string[]
): ReportData {
  const layout = computeLayoutConstants();
  const charts: Partial<CaptureCharts> = {};

  Object.assign(charts, buildKdeCharts(metadataList, layout));
  Object.assign(charts, buildDeviceAndCameraCharts(metadataList, layout));
  Object.assign(charts, buildErrorFeatureObjectCharts(metadataList, artifactDirs, layout));

  if (artifactDirs !== undefined) {
    Object.assign(charts, buildAreaCharts(artifactDirs, layout));
    Object.assign(charts, buildAttributePieCharts(artifactDirs, layout));
  }

  const populatedCharts = charts as CaptureCharts;
  return buildReportSections(populatedCharts, artifactDirs, avgDuration, videoCount);
}
