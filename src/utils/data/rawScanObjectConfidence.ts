import { forEachRawScan } from "./rawScanIterators";

export type ObjectConfidenceCounts = Record<string, [number, number, number]>; // [high, medium, low]

type ConfidenceBucket = "high" | "medium" | "low";

const OBJECT_CATEGORY_LABELS: Record<string, string> = {
  bathtub: "Bathtub",
  bed: "Bed",
  chair: "Chair",
  dishwasher: "Dishwasher",
  fireplace: "Fireplace",
  oven: "Oven",
  refrigerator: "Refrigerator",
  sink: "Sink",
  sofa: "Sofa",
  stairs: "Stairs",
  storage: "Storage",
  stove: "Stove",
  table: "Table",
  television: "Television",
  toilet: "Toilet",
  washerDryer: "Washer/Dryer"
};

const CONFIDENCE_INDEX_HIGH = 0;
const CONFIDENCE_INDEX_MEDIUM = 1;
const CONFIDENCE_INDEX_LOW = 2;

const BUCKET_INDEX: Record<
  ConfidenceBucket,
  typeof CONFIDENCE_INDEX_HIGH | typeof CONFIDENCE_INDEX_MEDIUM | typeof CONFIDENCE_INDEX_LOW
> = {
  high: CONFIDENCE_INDEX_HIGH,
  low: CONFIDENCE_INDEX_LOW,
  medium: CONFIDENCE_INDEX_MEDIUM
};

function getObjectTypeFromCategory(category: Record<string, unknown>): string | null {
  for (const [key, label] of Object.entries(OBJECT_CATEGORY_LABELS)) {
    if (category[key] !== undefined) {
      return label;
    }
  }
  return null;
}

function getConfidenceBucket(conf?: { high?: unknown; medium?: unknown; low?: unknown }): ConfidenceBucket | null {
  if (!conf) {
    return null;
  }
  if (conf.high !== undefined) {
    return "high";
  }
  if (conf.medium !== undefined) {
    return "medium";
  }
  if (conf.low !== undefined) {
    return "low";
  }
  return null;
}

function bumpConfidence(counts: ObjectConfidenceCounts, type: string, bucket: ConfidenceBucket): void {
  const confidenceZeroValue = 0;
  const defaultCounts: [number, number, number] = [confidenceZeroValue, confidenceZeroValue, confidenceZeroValue];
  counts[type] ??= defaultCounts;
  counts[type][BUCKET_INDEX[bucket]]++;
}

/**
 * Extracts object confidence counts from raw scan files.
 * Counts objects by type and confidence level (high, medium, low).
 */
export function getObjectConfidenceCounts(artifactDirs: string[]): ObjectConfidenceCounts {
  const counts: ObjectConfidenceCounts = {};

  forEachRawScan(artifactDirs, (rawScan) => {
    for (const obj of rawScan.objects) {
      const type = getObjectTypeFromCategory(obj.category as Record<string, unknown>);
      const bucket = getConfidenceBucket(obj.confidence as { high?: unknown; medium?: unknown; low?: unknown });
      if (type !== null && bucket !== null) {
        bumpConfidence(counts, type, bucket);
      }
    }

    for (const door of rawScan.doors) {
      const bucket = getConfidenceBucket(door.confidence as { high?: unknown; medium?: unknown; low?: unknown });
      if (bucket !== null) {
        bumpConfidence(counts, "Door", bucket);
      }
    }

    for (const window of rawScan.windows) {
      const bucket = getConfidenceBucket(window.confidence as { high?: unknown; medium?: unknown; low?: unknown });
      if (bucket !== null) {
        bumpConfidence(counts, "Window", bucket);
      }
    }

    for (const opening of rawScan.openings) {
      const bucket = getConfidenceBucket(
        opening.confidence as { high?: unknown; medium?: unknown; low?: unknown } | undefined
      );
      if (bucket !== null) {
        bumpConfidence(counts, "Opening", bucket);
      }
    }
  });

  return counts;
}
