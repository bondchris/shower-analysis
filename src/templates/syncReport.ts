import { SyncStats } from "../models/syncStats";
import { SyncFailureDatabase } from "../utils/data/syncFailures";
import { ReportData, ReportSection } from "../models/report";

import { buildArtifactSizeChartSection, computeSharedArtifactDates } from "./syncReport/charts/artifactSizeChart";
import { buildErrorHistoryChartSection } from "./syncReport/charts/errorHistoryChart";
import { buildVideoSizeChartSection } from "./syncReport/charts/videoSizeChart";
import { buildDiskUsageTableSection, calculateDiskUsageTotals } from "./syncReport/sections/diskUsageTable";
import { buildFailuresSections } from "./syncReport/sections/failuresSection";
import { buildSummaryTableSection, calculateSyncTotals } from "./syncReport/sections/summaryTable";

export function buildSyncReport(allStats: SyncStats[], knownFailures: SyncFailureDatabase): ReportData {
  const sections: ReportSection[] = [];

  // Sort by volume found (Largest -> Smallest) to match charts
  const sortedStats = [...allStats].sort((a, b) => b.found - a.found);

  // Summary Table
  const syncTotals = calculateSyncTotals(allStats);
  sections.push(buildSummaryTableSection(sortedStats, syncTotals));

  // Inaccessible Artifacts Over Time Chart
  const errorHistorySection = buildErrorHistoryChartSection(sortedStats);
  if (errorHistorySection !== null) {
    sections.push(errorHistorySection);
  }

  // Disk Usage Summary Table
  const diskUsageTotals = calculateDiskUsageTotals(allStats);
  sections.push(buildDiskUsageTableSection(sortedStats, diskUsageTotals));

  // Video Size Chart
  const videoSizeSection = buildVideoSizeChartSection(allStats);
  if (videoSizeSection !== null) {
    sections.push(videoSizeSection);
  }

  // Artifact Size Charts (AR Data, RawScan, PointCloud, InitialLayout)
  const sharedArtifactDates = computeSharedArtifactDates(allStats);

  const arDataSection = buildArtifactSizeChartSection(
    allStats,
    sharedArtifactDates,
    "arDataHistory",
    "Average AR Data Size Over Time",
    "Size per AR Data (MB)"
  );
  if (arDataSection !== null) {
    sections.push(arDataSection);
  }

  const rawScanSection = buildArtifactSizeChartSection(
    allStats,
    sharedArtifactDates,
    "rawScanHistory",
    "Average RawScan Size Over Time",
    "Size per RawScan (KB)",
    { leftUnit: "KB", rightUnit: "MB" }
  );
  if (rawScanSection !== null) {
    sections.push(rawScanSection);
  }

  const pointCloudSection = buildArtifactSizeChartSection(
    allStats,
    sharedArtifactDates,
    "pointCloudHistory",
    "Average PointCloud Size Over Time",
    "Size per PointCloud (MB)"
  );
  if (pointCloudSection !== null) {
    sections.push(pointCloudSection);
  }

  const initialLayoutSection = buildArtifactSizeChartSection(
    allStats,
    sharedArtifactDates,
    "initialLayoutHistory",
    "Average InitialLayout Size Over Time",
    "Size per InitialLayout (KB)",
    { leftUnit: "KB", rightUnit: "MB" }
  );
  if (initialLayoutSection !== null) {
    sections.push(initialLayoutSection);
  }

  // Failures Section
  const failuresSections = buildFailuresSections(allStats, knownFailures);
  sections.push(...failuresSections);

  return {
    sections,
    title: "Data Sync Report"
  };
}
