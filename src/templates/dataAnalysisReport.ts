import { ArtifactAnalysis } from "../models/artifactAnalysis";
import * as ChartUtils from "../utils/chartUtils";
import { ChartConfiguration } from "../utils/chartUtils";
import { ReportData, ReportSection } from "../models/report";

export interface CaptureCharts {
  ambient: ChartConfiguration;
  area: ChartConfiguration;
  brightness: ChartConfiguration;
  duration: ChartConfiguration;
  errors: ChartConfiguration;
  features: ChartConfiguration;
  fps: ChartConfiguration;
  iso: ChartConfiguration;
  lens: ChartConfiguration;
  resolution: ChartConfiguration;
  temperature: ChartConfiguration;
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
  videoCount: number
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
  const FEATURE_HEIGHT_RATIO = 0.52;
  const MIN_DURATION_HEIGHT = 260;
  const MIN_HALF_HEIGHT = 260;
  const MIN_LENS_HEIGHT = 340;
  const MIN_FEATURE_HEIGHT = 400;

  const DURATION_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * FULL_WIDTH_RATIO);
  const HALF_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HALF_WIDTH_RATIO);
  const HISTO_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HISTO_WIDTH_RATIO);
  const ERRORS_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * ERRORS_WIDTH_RATIO);
  const DURATION_CHART_HEIGHT = Math.max(MIN_DURATION_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * DURATION_HEIGHT_RATIO));
  const HALF_CHART_HEIGHT = Math.max(MIN_HALF_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * HALF_HEIGHT_RATIO));
  const LENS_CHART_HEIGHT = Math.max(MIN_LENS_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * LENS_HEIGHT_RATIO));
  const FEATURE_CHART_HEIGHT = Math.max(MIN_FEATURE_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * FEATURE_HEIGHT_RATIO));
  const NOT_SET = "not_set";
  const INCREMENT_STEP = 1;
  const INITIAL_COUNT = 0;
  const NO_RESULTS = 0;

  // Histogram Constants
  const MIN_TOILETS = 2;
  const MIN_TUBS = 2;
  const MIN_WALLS = 4;

  // Duration
  const durations = metadataList.map((m) => m.duration);
  charts.duration = ChartUtils.getHistogramConfig(durations, {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 120,
    min: 10,
    // Label and title defaults handled in config builder or can be explicit
    title: "",
    width: DURATION_CHART_WIDTH,
    xLabel: "Seconds"
  });

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
  charts.lens = ChartUtils.getBarChartConfig(lensLabels, lensCounts, {
    height: LENS_CHART_HEIGHT,
    horizontal: true,
    title: "",
    totalForPercentages: metadataList.length,
    width: Math.round(PAGE_CONTENT_WIDTH * LENS_WIDTH_RATIO)
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

  // Ambient: 980-1040, bin 5
  charts.ambient = ChartUtils.getHistogramConfig(intensityVals, {
    binSize: 5,
    height: HALF_CHART_HEIGHT,
    max: 1040,
    min: 980,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "Lumens"
  });

  // Temp: 4000-6000, bin 250
  charts.temperature = ChartUtils.getHistogramConfig(tempVals, {
    binSize: 250,
    colorByValue: ChartUtils.kelvinToRgb,
    height: HALF_CHART_HEIGHT,
    max: 6000,
    min: 4000,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "Kelvin"
  });

  // ISO: 0-800, bin 50
  charts.iso = ChartUtils.getHistogramConfig(isoVals, {
    binSize: 50,
    height: HALF_CHART_HEIGHT,
    max: 800,
    min: 0,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "ISO"
  });

  // Brightness: 0-6, bin 1
  charts.brightness = ChartUtils.getHistogramConfig(briVals, {
    binSize: 1,
    decimalPlaces: 1,
    height: HALF_CHART_HEIGHT,
    max: 6,
    min: 0,
    title: "",
    width: HISTO_CHART_WIDTH,
    xLabel: "Value (EV)"
  });

  // Room Area: 0-150, bin 10
  charts.area = ChartUtils.getHistogramConfig(areaVals, {
    binSize: 10,
    height: DURATION_CHART_HEIGHT,
    hideUnderflow: true,
    max: 150,
    min: 0,
    title: "",
    width: DURATION_CHART_WIDTH,
    xLabel: "Sq Ft"
  });

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
    { check: (m: ArtifactAnalysis) => m.hasDoorBlockingError, count: INITIAL_COUNT, label: "Door Blocked" }
  ];

  const featureDefs: ChartDef[] = [
    { check: (m: ArtifactAnalysis) => m.hasNonRectWall, count: INITIAL_COUNT, label: "Non-Rectangular Walls" },
    { check: (m: ArtifactAnalysis) => m.hasCurvedWall, count: INITIAL_COUNT, label: "Curved Walls" },
    { check: (m: ArtifactAnalysis) => m.toiletCount >= MIN_TOILETS, count: INITIAL_COUNT, label: "2+ Toilets" },
    { check: (m: ArtifactAnalysis) => m.tubCount >= MIN_TUBS, count: INITIAL_COUNT, label: "2+ Tubs" },
    { check: (m: ArtifactAnalysis) => m.wallCount < MIN_WALLS, count: INITIAL_COUNT, label: "< 4 Walls" },
    {
      check: (m: ArtifactAnalysis) => m.sinkCount === INITIAL_COUNT && m.storageCount === INITIAL_COUNT,
      count: INITIAL_COUNT,
      label: "No Vanity"
    },
    { check: (m: ArtifactAnalysis) => m.hasExternalOpening, count: INITIAL_COUNT, label: "External Opening" },
    { check: (m: ArtifactAnalysis) => m.hasSoffit, count: INITIAL_COUNT, label: "Soffit" },
    { check: (m: ArtifactAnalysis) => m.hasNibWalls, count: INITIAL_COUNT, label: "Nib Walls (< 1ft)" },
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
  }

  charts.features = ChartUtils.getBarChartConfig(
    featureDefs.map((d) => d.label),
    featureDefs.map((d) => d.count),
    {
      height: FEATURE_CHART_HEIGHT,
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: DURATION_CHART_WIDTH
    }
  );

  charts.errors = ChartUtils.getBarChartConfig(
    errorDefs.map((d) => d.label),
    errorDefs.map((d) => d.count),
    {
      height: 320,
      horizontal: true,
      title: "",
      totalForPercentages: metadataList.length,
      width: ERRORS_CHART_WIDTH
    }
  );

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

  // Lens Model (dedicated page)
  chartSections.push({
    data: populatedCharts.lens,
    title: "Lens Model",
    type: "chart"
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
    title: "Room Area (Sq Ft)",
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

  return {
    sections: [...sections, ...chartSections],
    subtitle,
    title: "Artifact Data Analysis"
  };
}
