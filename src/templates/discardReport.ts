import { DiscardReportInput } from "../models/discardStats";
import { ReportData, ReportSection } from "../models/report";
import {
  buildDistributionSection,
  buildDuplicatesOverTimeSection,
  buildMismatchOverTimeSection,
  buildNonBathroomOverTimeSection,
  buildShortVideosOverTimeSection
} from "./discardReport/charts";
import {
  buildBlackFrameSections,
  buildDuplicatesDetailSection,
  buildFailedMovesSection,
  buildHeaderAnomalySections,
  buildMismatchDetailSections,
  buildNewBadScansSection,
  buildNonBathroomDetailSection,
  buildShortVideosDetailSection,
  buildSummarySection
} from "./discardReport/sections";

export function buildDiscardReport(input: DiscardReportInput): ReportData {
  const newBadScanCount = input.newBadScans.length;
  const sections: ReportSection[] = [];

  sections.push(buildSummarySection(input));

  // Over Time charts
  const shortVideosOverTimeSection = buildShortVideosOverTimeSection(input.badScanHistory, input.minDuration);
  if (shortVideosOverTimeSection !== null) {
    sections.push(shortVideosOverTimeSection);
  }

  const nonBathroomOverTimeSection = buildNonBathroomOverTimeSection(input.badScanHistory);
  if (nonBathroomOverTimeSection !== null) {
    sections.push(nonBathroomOverTimeSection);
  }

  const duplicatesOverTimeSection = buildDuplicatesOverTimeSection(input.badScanHistory);
  if (duplicatesOverTimeSection !== null) {
    sections.push(duplicatesOverTimeSection);
  }

  const mismatchOverTimeSection = buildMismatchOverTimeSection(input.dateMismatches);
  if (mismatchOverTimeSection !== null) {
    sections.push(mismatchOverTimeSection);
  }

  const distributionSection = buildDistributionSection(input.newBadScans, newBadScanCount);
  if (distributionSection !== null) {
    sections.push(distributionSection);
  }

  const newBadScansSection = buildNewBadScansSection(input.newBadScans);
  if (newBadScansSection !== null) {
    sections.push(newBadScansSection);
  }

  const failedMovesSection = buildFailedMovesSection(input.cleanStats.failedDeletes);
  if (failedMovesSection !== null) {
    sections.push(failedMovesSection);
  }

  const shortVideosDetailSections = buildShortVideosDetailSection(input.badScanHistory, input.minDuration);
  sections.push(...shortVideosDetailSections);

  const nonBathroomDetailSections = buildNonBathroomDetailSection(input.badScanHistory);
  sections.push(...nonBathroomDetailSections);

  const duplicatesDetailSections = buildDuplicatesDetailSection(input.badScanHistory);
  sections.push(...duplicatesDetailSections);

  const headerAnomalySections = buildHeaderAnomalySections(input.videoHeaderAnomalies, Object.keys(input.countsByEnv));
  sections.push(...headerAnomalySections);

  const blackFrameSections = buildBlackFrameSections(input.blackFrameFindings, Object.keys(input.countsByEnv));
  sections.push(...blackFrameSections);

  const mismatchDetailSections = buildMismatchDetailSections(input.dateMismatches, Object.keys(input.countsByEnv));
  sections.push(...mismatchDetailSections);

  if (input.dryRun) {
    sections.push({
      data: "Dry run enabled: artifacts were not moved, but counts reflect what would have changed.",
      title: "Dry Run",
      type: "text"
    });
  }

  return {
    sections,
    title: "Discard Report"
  };
}
