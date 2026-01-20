import { SyncError, SyncStats } from "../../../models/syncStats";
import { SyncFailureDatabase } from "../../../utils/data/syncFailures";
import { ReportSection } from "../../../models/report";

/**
 * Format a list of types into a human-readable string.
 * e.g., ["video"] -> "video"
 * e.g., ["video", "arData"] -> "video and arData"
 * e.g., ["video", "arData", "rawScan"] -> "video, arData, and rawScan"
 */
function formatTypeList(types: string[]): string {
  const sortedTypes = [...types].sort();
  const singleItem = 1;
  const twoItems = 2;
  const firstIndex = 0;

  if (sortedTypes.length === singleItem) {
    return sortedTypes[firstIndex] ?? "";
  }

  if (sortedTypes.length === twoItems) {
    const [first = "", second = ""] = sortedTypes;
    return `${first} and ${second}`;
  }

  const last = sortedTypes.pop() ?? "";
  return `${sortedTypes.join(", ")}, and ${last}`;
}

/**
 * Group errors by ID and format them for display.
 */
function formatErrorsForDisplay(errors: SyncError[]): string[] {
  // Group errors by ID and deduplicate reasons
  const errorsById = new Map<string, Set<string>>();
  errors.forEach((err) => {
    if (!errorsById.has(err.id)) {
      errorsById.set(err.id, new Set());
    }
    errorsById.get(err.id)?.add(err.reason);
  });

  const errorLines: string[] = [];

  errorsById.forEach((reasons, id) => {
    const currentArtifactErrors: string[] = [];

    // Group failures by status
    const groupedFailures = new Map<string, string[]>(); // status -> types[]
    const miscFailures: string[] = [];

    reasons.forEach((reason) => {
      // Match "type download failed (status)" or "type download failed" without status
      const regexWithStatus = /^(.+) download failed \((.+)\)$/;
      const regexWithoutStatus = /^(.+) download failed$/;
      const matchWithStatus = regexWithStatus.exec(reason);
      const matchWithoutStatus = regexWithoutStatus.exec(reason);

      if (matchWithStatus !== null) {
        const [, type = "", status = ""] = matchWithStatus;
        if (!groupedFailures.has(status)) {
          groupedFailures.set(status, []);
        }
        groupedFailures.get(status)?.push(type);
      } else if (matchWithoutStatus !== null) {
        const [, type = ""] = matchWithoutStatus;
        const unknownStatus = "unknown";
        if (!groupedFailures.has(unknownStatus)) {
          groupedFailures.set(unknownStatus, []);
        }
        groupedFailures.get(unknownStatus)?.push(type);
      } else {
        miscFailures.push(reason);
      }
    });

    // Collect grouped failures
    groupedFailures.forEach((types, status) => {
      const typeStr = formatTypeList(types);
      currentArtifactErrors.push(`Download failed (${status}) for ${typeStr}`);
    });

    // Collect misc failures
    miscFailures.forEach((reason) => {
      currentArtifactErrors.push(reason);
    });

    // Format output based on error count
    const singleError = 1;
    const firstErrorIndex = 0;
    const monoId = `<span class="font-mono">${id}</span>`;
    if (currentArtifactErrors.length === singleError) {
      const firstError = String(currentArtifactErrors[firstErrorIndex]);
      errorLines.push(`${monoId} - ${firstError}`);
    } else {
      errorLines.push(monoId);
      currentArtifactErrors.forEach((err) => {
        errorLines.push(`  - ${err}`);
      });
    }
  });

  return errorLines;
}

/**
 * Build a list section for errors.
 */
function buildErrorListSection(errors: SyncError[], title: string): ReportSection | null {
  const noErrors = 0;
  if (errors.length === noErrors) {
    return null;
  }

  const errorLines = formatErrorsForDisplay(errors);

  return {
    data: errorLines,
    level: 4,
    title,
    type: "list"
  };
}

/**
 * Classify errors into new and known categories.
 */
function classifyErrors(
  stats: SyncStats,
  knownFailures: SyncFailureDatabase
): { newErrors: SyncError[]; knownErrors: SyncError[] } {
  const newErrors: SyncError[] = [];
  const knownErrors: SyncError[] = [];

  stats.errors.forEach((err) => {
    if (Object.prototype.hasOwnProperty.call(knownFailures, err.id)) {
      // Filter out initialLayout failures from known inaccessible section
      const isInitialLayoutFailure = /^initialLayout download failed/i.test(err.reason);
      if (!isInitialLayoutFailure) {
        knownErrors.push(err);
      }
    } else {
      newErrors.push(err);
    }
  });

  return { knownErrors, newErrors };
}

/**
 * Build the failures section containing all inaccessible artifacts.
 * Returns an array of sections to be added to the report.
 */
export function buildFailuresSections(allStats: SyncStats[], knownFailures: SyncFailureDatabase): ReportSection[] {
  const sections: ReportSection[] = [];
  const noErrors = 0;
  const failedStats = allStats.filter((s) => s.errors.length > noErrors);

  if (failedStats.length === noErrors) {
    sections.push({
      data: "No failures occurred during sync.",
      type: "text"
    });
    return sections;
  }

  sections.push({ title: "Inaccessible Artifacts", type: "header" });

  failedStats.forEach((stats) => {
    const { newErrors, knownErrors } = classifyErrors(stats, knownFailures);

    // Skip environments with no remaining errors
    const noRemainingErrors = 0;
    if (newErrors.length === noRemainingErrors && knownErrors.length === noRemainingErrors) {
      return;
    }

    sections.push({ level: 3, title: `Environment: ${stats.env}`, type: "header" });

    const newErrorSection = buildErrorListSection(newErrors, "New Inaccessible");
    if (newErrorSection !== null) {
      sections.push(newErrorSection);
    }

    const knownErrorSection = buildErrorListSection(knownErrors, "Known Inaccessible");
    if (knownErrorSection !== null) {
      sections.push(knownErrorSection);
    }
  });

  return sections;
}
