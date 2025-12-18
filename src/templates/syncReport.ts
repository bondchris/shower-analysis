import { SyncError, SyncStats } from "../models/syncStats";
import { SyncFailureDatabase } from "../utils/data/syncFailures";
import { ReportData, ReportSection } from "../utils/reportGenerator";

export function buildSyncReport(allStats: SyncStats[], knownFailures: SyncFailureDatabase): ReportData {
  const sections: ReportSection[] = [];
  const ZERO = 0;

  // Summary Table
  // Calculate Totals
  const totalFound = allStats.reduce((sum, s) => sum + s.found, ZERO);
  const totalNew = allStats.reduce((sum, s) => sum + s.new, ZERO);
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, ZERO);
  const totalSkipped = allStats.reduce((sum, s) => sum + s.skipped, ZERO);
  const totalKnownFailures = allStats.reduce((sum, s) => sum + s.knownFailures, ZERO);
  const totalNewFailures = allStats.reduce((sum, s) => sum + s.newFailures, ZERO);

  const headers = ["", ...allStats.map((s) => s.env), "Total"];
  const tableData: string[][] = [
    [
      "Found",
      ...allStats.map((s) => s.found.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFound.toString()}</span>`
    ],
    [
      "New",
      ...allStats.map((s) => s.new.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalNew.toString()}</span>`
    ],
    [
      "Inaccessible",
      ...allStats.map((s) => s.failed.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalFailed.toString()}</span>`
    ],
    [
      "New Inaccessible",
      ...allStats.map((s) => s.newFailures.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalNewFailures.toString()}</span>`
    ],
    [
      "Known Inaccessible",
      ...allStats.map((s) => s.knownFailures.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalKnownFailures.toString()}</span>`
    ],
    [
      "Skipped",
      ...allStats.map((s) => s.skipped.toString()),
      `<span style="font-weight:normal;color:#6b7280">${totalSkipped.toString()}</span>`
    ]
  ];

  const rowClasses: Record<number, string> = {
    0: "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact", // Found
    1: "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // New
    2: "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // Inaccessible
    3: "bg-red-50 text-red-800 print:print-color-adjust-exact", // New Inaccessible (lighter red)
    4: "bg-red-50 text-red-800 print:print-color-adjust-exact", // Known Inaccessible (lighter red)
    5: "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact" // Skipped
  };

  sections.push({
    data: tableData,
    options: { headers, rowClasses },
    title: "Sync Summary",
    type: "table"
  });

  // Failures Section
  const ZERO_FAILURES = 0;
  const failedStats = allStats.filter((s) => s.errors.length > ZERO_FAILURES);

  if (failedStats.length > ZERO_FAILURES) {
    sections.push({ title: "Inaccessible Artifacts", type: "header" });

    failedStats.forEach((stats) => {
      if (stats.errors.length > ZERO_FAILURES) {
        // Classify errors
        const newErrors: SyncError[] = [];
        const knownErrors: SyncError[] = [];

        stats.errors.forEach((err) => {
          if (Object.prototype.hasOwnProperty.call(knownFailures, err.id)) {
            knownErrors.push(err);
          } else {
            newErrors.push(err);
          }
        });

        // Helper to render error list
        const renderErrorList = (errors: SyncError[], title: string) => {
          if (errors.length === ZERO_FAILURES) {
            return;
          }

          // Group errors by ID and deduplicate reasons
          const errorsById = new Map<string, Set<string>>();
          errors.forEach((err) => {
            if (!errorsById.has(err.id)) {
              errorsById.set(err.id, new Set());
            }
            errorsById.get(err.id)?.add(err.reason);
          });

          // Print grouped errors
          const errorLines: string[] = [];
          errorsById.forEach((reasons, id) => {
            const currentArtifactErrors: string[] = [];

            // Group failures logic
            const groupedFailures = new Map<string, string[]>(); // status -> types[]
            const miscFailures: string[] = [];

            reasons.forEach((reason) => {
              const regex = /^(.+) download failed \((.+)\)$/;
              const match = regex.exec(reason);
              if (match !== null) {
                const MATCH_TYPE_INDEX = 1;
                const MATCH_STATUS_INDEX = 2;
                const type = match[MATCH_TYPE_INDEX];
                const status = match[MATCH_STATUS_INDEX];
                if (type !== undefined && status !== undefined) {
                  if (!groupedFailures.has(status)) {
                    groupedFailures.set(status, []);
                  }
                  groupedFailures.get(status)?.push(type);
                }
              } else {
                miscFailures.push(reason);
              }
            });

            // Collect grouped failures
            groupedFailures.forEach((types, status) => {
              const sortedTypes = types.sort();
              let typeStr = "";
              const ONE_ITEM = 1;
              const TWO_ITEMS = 2;
              const FIRST_ITEM = 0;
              const SECOND_ITEM = 1;

              if (sortedTypes.length === ONE_ITEM) {
                typeStr = sortedTypes[FIRST_ITEM] ?? "";
              } else if (sortedTypes.length === TWO_ITEMS) {
                typeStr = `${sortedTypes[FIRST_ITEM] ?? ""} and ${sortedTypes[SECOND_ITEM] ?? ""}`;
              } else {
                const last = sortedTypes.pop();
                typeStr = `${sortedTypes.join(", ")}, and ${String(last)}`;
              }
              currentArtifactErrors.push(`Download failed (${status}) for ${typeStr}`);
            });

            // Collect misc failures
            miscFailures.forEach((reason) => {
              currentArtifactErrors.push(reason);
            });

            // Print to errorLines based on count
            const SINGLE_FAILURE = 1;
            const FIRST_ERROR = 0;
            const monoId = `<span class="font-mono">${id}</span>`;
            if (currentArtifactErrors.length === SINGLE_FAILURE) {
              errorLines.push(`${monoId} - ${currentArtifactErrors[FIRST_ERROR] ?? ""}`);
            } else {
              errorLines.push(monoId);
              currentArtifactErrors.forEach((err) => {
                errorLines.push(`  - ${err}`);
              });
            }
          });

          sections.push({
            data: errorLines,
            level: 4,
            title: title,
            type: "list"
          });
        };

        if (newErrors.length > ZERO_FAILURES || knownErrors.length > ZERO_FAILURES) {
          sections.push({ level: 3, title: `Environment: ${stats.env}`, type: "header" });
          renderErrorList(newErrors, "New Inaccessible");
          renderErrorList(knownErrors, "Known Inaccessible");
        }
      }
    });
  } else {
    sections.push({
      data: "No failures occurred during sync.",
      type: "text"
    });
  }

  return {
    sections,
    title: "Inaccessible Artifacts Report"
  };
}
