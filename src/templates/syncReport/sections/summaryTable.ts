import { SyncStats } from "../../../models/syncStats";
import { ReportSection } from "../../../models/report";
import { wrapTotalCell } from "../utils";

export interface SyncTotals {
  totalFound: number;
  totalNew: number;
  totalFailed: number;
  totalSkipped: number;
  totalKnownFailures: number;
  totalNewFailures: number;
  totalSavedToDisk: number;
  totalAlreadyPresent: number;
}

/**
 * Calculate sync totals from all stats.
 */
export function calculateSyncTotals(allStats: SyncStats[]): SyncTotals {
  const initialSum = 0;
  const totalFound = allStats.reduce((sum, s) => sum + s.found, initialSum);
  const totalNew = allStats.reduce((sum, s) => sum + s.new, initialSum);
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, initialSum);
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, initialSum);
  const totalKnownFailures = allStats.reduce((sum, s) => sum + s.knownFailures, initialSum);
  const totalNewFailures = allStats.reduce((sum, s) => sum + s.newFailures, initialSum);
  const totalSavedToDisk = totalFound - totalFailed - totalSkipped;
  const totalAlreadyPresent = totalSavedToDisk - totalNew;

  return {
    totalAlreadyPresent,
    totalFailed,
    totalFound,
    totalKnownFailures,
    totalNew,
    totalNewFailures,
    totalSavedToDisk,
    totalSkipped
  };
}

/**
 * Build the sync summary table section.
 */
export function buildSummaryTableSection(sortedStats: SyncStats[], totals: SyncTotals): ReportSection {
  const headers = ["", ...sortedStats.map((s) => s.env), "Total"];

  const tableData: string[][] = [
    ["Found", ...sortedStats.map((s) => s.found.toString()), wrapTotalCell(totals.totalFound.toString())],
    [
      "Total Saved to Disk",
      ...sortedStats.map((s) => (s.found - s.failed - s.skipped).toString()),
      wrapTotalCell(totals.totalSavedToDisk.toString())
    ],
    [
      "Already Present",
      ...sortedStats.map((s) => (s.found - s.failed - s.skipped - s.new).toString()),
      wrapTotalCell(totals.totalAlreadyPresent.toString())
    ],
    ["New", ...sortedStats.map((s) => s.new.toString()), wrapTotalCell(totals.totalNew.toString())],
    ["Inaccessible", ...sortedStats.map((s) => s.failed.toString()), wrapTotalCell(totals.totalFailed.toString())],
    [
      "New Inaccessible",
      ...sortedStats.map((s) => s.newFailures.toString()),
      wrapTotalCell(totals.totalNewFailures.toString())
    ],
    [
      "Known Inaccessible",
      ...sortedStats.map((s) => s.knownFailures.toString()),
      wrapTotalCell(totals.totalKnownFailures.toString())
    ],
    ["Skipped", ...sortedStats.map((s) => s.skipped.toString()), wrapTotalCell(totals.totalSkipped.toString())]
  ];

  const rowClasses: Record<number, string> = {
    0: "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact", // Found
    1: "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // Total Saved to Disk
    2: "bg-green-50 text-green-800 print:print-color-adjust-exact", // Already Present
    3: "bg-green-50 text-green-800 print:print-color-adjust-exact", // New
    4: "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // Inaccessible
    5: "bg-red-50 text-red-800 print:print-color-adjust-exact", // New Inaccessible
    6: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Known Inaccessible
    7: "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact" // Skipped
  };

  return {
    data: tableData,
    options: { headers, rowClasses },
    title: "Sync Summary",
    type: "table"
  };
}
