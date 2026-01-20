import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ReportSection } from "../../../models/report";

export function buildEncodingSummarySections(metadataList: ArtifactAnalysis[]): ReportSection[] {
  const emptyMetadataCount = 0;
  const emptySetCount = 0;
  const emptyLength = 0;

  if (metadataList.length === emptyMetadataCount) {
    return [];
  }

  const defaultLabel = "Unknown";
  const listFormatter = (values: string[]): string => values.join(", ");

  const collectStringValues = (selector: (meta: ArtifactAnalysis) => string | undefined): string[] => {
    const values = new Set<string>();
    metadataList.forEach((meta) => {
      const rawValue = selector(meta);
      const value = (rawValue ?? "").trim();
      if (value.length > emptyLength) {
        values.add(value);
      }
    });
    if (values.size === emptySetCount) {
      values.add(defaultLabel);
    }
    return [...values];
  };

  const collectBitDepthValues = (): string[] => {
    const values = new Set<string>();
    const minValidBitDepth = 0;
    metadataList.forEach((meta) => {
      if (typeof meta.bitDepth === "number" && !Number.isNaN(meta.bitDepth) && meta.bitDepth > minValidBitDepth) {
        values.add(`${meta.bitDepth.toString()}-bit`);
      }
    });
    if (values.size === emptySetCount) {
      values.add(defaultLabel);
    }
    return [...values];
  };

  const topLineParts = [
    { label: "Codec", values: collectStringValues((meta) => meta.codecName) },
    { label: "Color transfer", values: collectStringValues((meta) => meta.colorTransfer) },
    { label: "Color range", values: collectStringValues((meta) => meta.colorRange) },
    { label: "Pixel format", values: collectStringValues((meta) => meta.pixelFormat) }
  ];

  const bottomLineParts = [
    { label: "Bit depth", values: collectBitDepthValues() },
    { label: "Entropy coding", values: collectStringValues((meta) => meta.entropyCoding) }
  ];

  const summaryLineTop = topLineParts.map((part) => `${part.label}: ${listFormatter(part.values)}`).join(" | ");
  const summaryLineBottom = bottomLineParts.map((part) => `${part.label}: ${listFormatter(part.values)}`).join(" | ");

  return [
    {
      data: summaryLineTop,
      options: { className: "text-[11px] text-gray-700 text-center" },
      type: "text"
    },
    {
      data: summaryLineBottom,
      options: { className: "text-[11px] text-gray-700 text-center mb-8" },
      type: "text"
    }
  ];
}
