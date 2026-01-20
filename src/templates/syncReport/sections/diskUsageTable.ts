import { SyncStats } from "../../../models/syncStats";
import { ReportSection } from "../../../models/report";
import { formatBytes, safeAvg, wrapTotalCell } from "../utils";

export interface DiskUsageTotals {
  totalVideoSize: number;
  totalNewVideoSize: number;
  totalArDataSize: number;
  totalNewArDataSize: number;
  totalRawScanSize: number;
  totalNewRawScanSize: number;
  totalPointCloudSize: number;
  totalNewPointCloudSize: number;
  totalInitialLayoutSize: number;
  totalNewInitialLayoutSize: number;
  totalArtifactSize: number;
  totalFound: number;
}

/**
 * Calculate disk usage totals from all stats.
 */
export function calculateDiskUsageTotals(allStats: SyncStats[]): DiskUsageTotals {
  const initialSum = 0;
  const totalFound = allStats.reduce((sum, s) => sum + s.found, initialSum);
  const totalVideoSize = allStats.reduce((sum, s) => sum + s.videoSize, initialSum);
  const totalNewVideoSize = allStats.reduce((sum, s) => sum + s.newVideoSize, initialSum);
  const totalArDataSize = allStats.reduce((sum, s) => sum + s.arDataSize, initialSum);
  const totalNewArDataSize = allStats.reduce((sum, s) => sum + s.newArDataSize, initialSum);
  const totalRawScanSize = allStats.reduce((sum, s) => sum + s.rawScanSize, initialSum);
  const totalNewRawScanSize = allStats.reduce((sum, s) => sum + s.newRawScanSize, initialSum);
  const totalPointCloudSize = allStats.reduce((sum, s) => sum + s.pointCloudSize, initialSum);
  const totalNewPointCloudSize = allStats.reduce((sum, s) => sum + s.newPointCloudSize, initialSum);
  const totalInitialLayoutSize = allStats.reduce((sum, s) => sum + s.initialLayoutSize, initialSum);
  const totalNewInitialLayoutSize = allStats.reduce((sum, s) => sum + s.newInitialLayoutSize, initialSum);
  const totalArtifactSize =
    totalVideoSize + totalArDataSize + totalRawScanSize + totalPointCloudSize + totalInitialLayoutSize;

  return {
    totalArDataSize,
    totalArtifactSize,
    totalFound,
    totalInitialLayoutSize,
    totalNewArDataSize,
    totalNewInitialLayoutSize,
    totalNewPointCloudSize,
    totalNewRawScanSize,
    totalNewVideoSize,
    totalPointCloudSize,
    totalRawScanSize,
    totalVideoSize
  };
}

/**
 * Build the disk usage summary table section.
 */
export function buildDiskUsageTableSection(sortedStats: SyncStats[], totals: DiskUsageTotals): ReportSection {
  const headers = ["", ...sortedStats.map((s) => s.env), "Total"];

  const usageTableData: string[][] = [
    // All Artifacts
    [
      "All Artifacts (Total)",
      ...sortedStats.map((s) =>
        formatBytes(s.videoSize + s.arDataSize + s.rawScanSize + s.pointCloudSize + s.initialLayoutSize)
      ),
      wrapTotalCell(formatBytes(totals.totalArtifactSize))
    ],
    // Video
    [
      "Video (Total)",
      ...sortedStats.map((s) => formatBytes(s.videoSize)),
      wrapTotalCell(formatBytes(totals.totalVideoSize))
    ],
    [
      "Video (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.videoSize, s.found))),
      wrapTotalCell(formatBytes(safeAvg(totals.totalVideoSize, totals.totalFound)))
    ],
    [
      "Video (New)",
      ...sortedStats.map((s) => formatBytes(s.newVideoSize)),
      wrapTotalCell(formatBytes(totals.totalNewVideoSize))
    ],
    // ArData
    [
      "AR Data (Total)",
      ...sortedStats.map((s) => formatBytes(s.arDataSize)),
      wrapTotalCell(formatBytes(totals.totalArDataSize))
    ],
    [
      "AR Data (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.arDataSize, s.found))),
      wrapTotalCell(formatBytes(safeAvg(totals.totalArDataSize, totals.totalFound)))
    ],
    [
      "AR Data (New)",
      ...sortedStats.map((s) => formatBytes(s.newArDataSize)),
      wrapTotalCell(formatBytes(totals.totalNewArDataSize))
    ],
    // RawScan
    [
      "RawScan (Total)",
      ...sortedStats.map((s) => formatBytes(s.rawScanSize)),
      wrapTotalCell(formatBytes(totals.totalRawScanSize))
    ],
    [
      "RawScan (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.rawScanSize, s.found))),
      wrapTotalCell(formatBytes(safeAvg(totals.totalRawScanSize, totals.totalFound)))
    ],
    [
      "RawScan (New)",
      ...sortedStats.map((s) => formatBytes(s.newRawScanSize)),
      wrapTotalCell(formatBytes(totals.totalNewRawScanSize))
    ],
    // PointCloud
    [
      "PointCloud (Total)",
      ...sortedStats.map((s) => formatBytes(s.pointCloudSize)),
      wrapTotalCell(formatBytes(totals.totalPointCloudSize))
    ],
    [
      "PointCloud (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.pointCloudSize, s.found))),
      wrapTotalCell(formatBytes(safeAvg(totals.totalPointCloudSize, totals.totalFound)))
    ],
    [
      "PointCloud (New)",
      ...sortedStats.map((s) => formatBytes(s.newPointCloudSize)),
      wrapTotalCell(formatBytes(totals.totalNewPointCloudSize))
    ],
    // InitialLayout
    [
      "InitialLayout (Total)",
      ...sortedStats.map((s) => formatBytes(s.initialLayoutSize)),
      wrapTotalCell(formatBytes(totals.totalInitialLayoutSize))
    ],
    [
      "InitialLayout (Avg)",
      ...sortedStats.map((s) => formatBytes(safeAvg(s.initialLayoutSize, s.found))),
      wrapTotalCell(formatBytes(safeAvg(totals.totalInitialLayoutSize, totals.totalFound)))
    ],
    [
      "InitialLayout (New)",
      ...sortedStats.map((s) => formatBytes(s.newInitialLayoutSize)),
      wrapTotalCell(formatBytes(totals.totalNewInitialLayoutSize))
    ]
  ];

  const diskUsageRowClassArray = [
    "bg-indigo-100 font-semibold text-indigo-800 print:print-color-adjust-exact", // All artifacts total
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // Video Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // Video Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // Video New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // ArData Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // ArData Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // ArData New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // RawScan Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // RawScan Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // RawScan New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // PointCloud Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // PointCloud Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // PointCloud New
    "bg-blue-100 font-semibold text-blue-800 print:print-color-adjust-exact", // InitialLayout Total
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact", // InitialLayout Avg
    "bg-blue-50 text-blue-800 print:print-color-adjust-exact" // InitialLayout New
  ];

  const diskUsageRowClasses: Record<number, string> = Object.fromEntries(
    diskUsageRowClassArray.map((className, index) => [index, className])
  ) as Record<number, string>;

  return {
    data: usageTableData,
    options: { headers, rowClasses: diskUsageRowClasses },
    title: "Disk Usage Summary",
    type: "table"
  };
}
