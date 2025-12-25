import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { getBarChartConfig } from "../../../utils/chart/configBuilders";
import {
  getArtifactsWithSmallWalls,
  getObjectConfidenceCounts,
  getUnexpectedVersionArtifactDirs
} from "../../../utils/data/rawScanExtractor";
import { LayoutConstants } from "../layout";
import { CaptureCharts } from "../types";

// Helper type for local chart data preparation
export type ChartDef =
  | { check: (m: ArtifactAnalysis) => boolean; count: number; kind: "predicate"; label: string }
  | { count: number; kind: "unexpectedVersion"; label: string }
  | { count: number; kind: "smallWalls"; label: string };

export function buildErrorFeatureObjectCharts(
  metadataList: (ArtifactAnalysis | undefined)[],
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

  // Get set of artifact directories with walls smaller than 1.5 sq ft
  const smallWallDirs = artifactDirs !== undefined ? getArtifactsWithSmallWalls(artifactDirs) : new Set<string>();

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
    },
    {
      check: (m: ArtifactAnalysis) => m.hasFloorsWithParentId,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Floors with Parent ID"
    },
    {
      check: (m: ArtifactAnalysis) => m.hasNonEmptyCompletedEdges,
      count: INITIAL_COUNT,
      kind: "predicate",
      label: "Non-Empty Completed Edges"
    }
  ];

  if (artifactDirs !== undefined) {
    errorDefs.push({
      count: INITIAL_COUNT,
      kind: "unexpectedVersion",
      label: "Unexpected Version"
    });
    errorDefs.push({
      count: INITIAL_COUNT,
      kind: "smallWalls",
      label: "Walls < 1.5 sq ft"
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
        case "smallWalls":
          if (currentDir !== undefined && smallWallDirs.has(currentDir)) {
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

          // Use largest remainder method for integer apportionment
          // This ensures the sum matches exactly and no negatives occur
          const scaledValues = [
            counts[confidenceIndexHigh] * scaleFactor,
            counts[confidenceIndexMedium] * scaleFactor,
            counts[confidenceIndexLow] * scaleFactor
          ];

          // Calculate integer parts and fractional remainders
          const integerParts = scaledValues.map((val) => Math.floor(val));
          const remainders = scaledValues.map((val, idx) => ({
            index: idx,
            remainder: val - Math.floor(val)
          }));

          // Calculate how many units we need to distribute
          const integerSum = integerParts.reduce((sum, val) => sum + val, initialSum);
          const remainderCount = artifactCount - integerSum;
          const incrementUnit = 1;

          // Start with integer parts
          const scaledCounts: [number, number, number] = [
            integerParts[confidenceIndexHigh] ?? initialSum,
            integerParts[confidenceIndexMedium] ?? initialSum,
            integerParts[confidenceIndexLow] ?? initialSum
          ];

          if (remainderCount > initialSum) {
            // Need to add units: use largest remainder method
            // Sort by remainder (largest first) to distribute fairly
            remainders.sort((a, b) => b.remainder - a.remainder);
            // Distribute remainder units to values with largest remainders
            for (let i = initialSum; i < remainderCount; i++) {
              const remainder = remainders[i];
              if (remainder !== undefined) {
                const targetIndex = remainder.index;
                if (targetIndex === confidenceIndexHigh) {
                  scaledCounts[confidenceIndexHigh] = scaledCounts[confidenceIndexHigh] + incrementUnit;
                } else if (targetIndex === confidenceIndexMedium) {
                  scaledCounts[confidenceIndexMedium] = scaledCounts[confidenceIndexMedium] + incrementUnit;
                } else if (targetIndex === confidenceIndexLow) {
                  scaledCounts[confidenceIndexLow] = scaledCounts[confidenceIndexLow] + incrementUnit;
                }
              }
            }
          }

          // Ensure no negative values (safety check)
          scaledCounts[confidenceIndexHigh] = Math.max(initialSum, scaledCounts[confidenceIndexHigh]);
          scaledCounts[confidenceIndexMedium] = Math.max(initialSum, scaledCounts[confidenceIndexMedium]);
          scaledCounts[confidenceIndexLow] = Math.max(initialSum, scaledCounts[confidenceIndexLow]);

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
    if (m === undefined) {
      continue;
    }
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
