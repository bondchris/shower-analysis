import {
  BadScanHistoryEntry,
  BlackFrameFinding,
  DateMismatch,
  DiscardReportInput,
  DiscardedArtifact,
  VideoHeaderAnomaly
} from "../../models/discardStats";
import { ReportSection } from "../../models/report";
import { escapeHtml, formatMismatchDate } from "./utils";

export function buildSummarySection(input: DiscardReportInput): ReportSection {
  const defaultCount = 0;
  const incrementCount = 1;
  const envSet = new Set([
    ...Object.keys(input.countsByEnv),
    ...input.dateMismatches.map((m) => m.environment),
    ...input.videoHeaderAnomalies.map((entry) => entry.environment),
    ...input.blackFrameFindings.map((entry) => entry.environment)
  ]);
  const envs = Array.from(envSet).sort();
  const headers = ["", ...envs, "Total"];
  const tableData: string[][] = [];

  // Helper to build a row
  const buildRow = (label: string, getValue: (env: string) => number): string[] => {
    const row = [label];
    let total = defaultCount;
    envs.forEach((env) => {
      const val = getValue(env);
      row.push(val.toString());
      total += val;
    });
    row.push(total.toString());
    return row;
  };

  // Artifacts Processed
  tableData.push(buildRow("Artifacts Processed", (env) => input.countsByEnv[env]?.processed ?? defaultCount));

  // Valid header
  tableData.push(
    buildRow(
      "Valid",
      (env) =>
        (input.countsByEnv[env]?.validCached ?? defaultCount) + (input.countsByEnv[env]?.validNew ?? defaultCount)
    )
  );
  // Valid - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.validNew ?? defaultCount));

  // Video < X s header
  const videoTooShortLabel = `Video < ${input.minDuration.toString()} s`;
  tableData.push(
    buildRow(
      videoTooShortLabel,
      (env) =>
        (input.countsByEnv[env]?.tooShortCached ?? defaultCount) + (input.countsByEnv[env]?.tooShortNew ?? defaultCount)
    )
  );
  // Video < X s - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.tooShortNew ?? defaultCount));

  // Not a Bathroom header
  tableData.push(
    buildRow(
      "Not a Bathroom",
      (env) =>
        (input.countsByEnv[env]?.notBathroomCached ?? defaultCount) +
        (input.countsByEnv[env]?.notBathroomNew ?? defaultCount)
    )
  );
  // Not a Bathroom - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.notBathroomNew ?? defaultCount));

  // Duplicate Video header
  tableData.push(
    buildRow(
      "Duplicate Video",
      (env) =>
        (input.countsByEnv[env]?.duplicateCached ?? defaultCount) +
        (input.countsByEnv[env]?.duplicateNew ?? defaultCount)
    )
  );
  // Duplicate Video - New
  tableData.push(buildRow("    New", (env) => input.countsByEnv[env]?.duplicateNew ?? defaultCount));

  // Video Header Anomaly rows (counts by environment)
  const headerAnomalyByEnv: Record<string, number> = {};
  const newHeaderAnomalyByEnv: Record<string, number> = {};
  input.videoHeaderAnomalies.forEach((entry) => {
    headerAnomalyByEnv[entry.environment] = (headerAnomalyByEnv[entry.environment] ?? defaultCount) + incrementCount;
    if (entry.isNew === true) {
      newHeaderAnomalyByEnv[entry.environment] =
        (newHeaderAnomalyByEnv[entry.environment] ?? defaultCount) + incrementCount;
    }
  });

  tableData.push(buildRow("Video Header Anomaly", (env) => headerAnomalyByEnv[env] ?? defaultCount));
  tableData.push(buildRow("    New", (env) => newHeaderAnomalyByEnv[env] ?? defaultCount));

  // Black Frame rows (counts by environment from blackFrameFindings array)
  const blackFrameByEnv: Record<string, number> = {};
  const newBlackFrameByEnv: Record<string, number> = {};
  input.blackFrameFindings.forEach((entry) => {
    blackFrameByEnv[entry.environment] = (blackFrameByEnv[entry.environment] ?? defaultCount) + incrementCount;
    if (entry.isNew === true) {
      newBlackFrameByEnv[entry.environment] = (newBlackFrameByEnv[entry.environment] ?? defaultCount) + incrementCount;
    }
  });

  tableData.push(buildRow("Black Frame Detected", (env) => blackFrameByEnv[env] ?? defaultCount));
  tableData.push(buildRow("    New", (env) => newBlackFrameByEnv[env] ?? defaultCount));

  // Date Mismatch rows (counts by environment from dateMismatches array)
  const totalMismatchByEnv: Record<string, number> = {};
  const newMismatchByEnv: Record<string, number> = {};
  input.dateMismatches.forEach((m) => {
    totalMismatchByEnv[m.environment] = (totalMismatchByEnv[m.environment] ?? defaultCount) + incrementCount;
    if (m.isNew === true) {
      newMismatchByEnv[m.environment] = (newMismatchByEnv[m.environment] ?? defaultCount) + incrementCount;
    }
  });

  tableData.push(buildRow("Date Mismatch", (env) => totalMismatchByEnv[env] ?? defaultCount));
  tableData.push(buildRow("    New", (env) => newMismatchByEnv[env] ?? defaultCount));

  const rowClassArray = [
    "bg-sky-100 font-semibold text-sky-800 print:print-color-adjust-exact", // 0: Artifacts Processed
    "bg-green-100 font-semibold text-green-800 print:print-color-adjust-exact", // 1: Valid
    "bg-green-50 text-green-800 print:print-color-adjust-exact", // 2: Valid - New
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // 3: Video < X s
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 4: Video < X s - New
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // 5: Not a Bathroom
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 6: Not a Bathroom - New
    "bg-red-100 font-semibold text-red-800 print:print-color-adjust-exact", // 7: Duplicate Video
    "bg-red-50 text-red-800 print:print-color-adjust-exact", // 8: Duplicate Video - New
    "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact", // 9: Video Header Anomaly
    "bg-yellow-50 text-yellow-800 print:print-color-adjust-exact", // 10: Video Header Anomaly - New
    "bg-amber-100 font-semibold text-amber-800 print:print-color-adjust-exact", // 11: Black Frame Detected
    "bg-amber-50 text-amber-800 print:print-color-adjust-exact", // 12: Black Frame Detected - New
    "bg-yellow-100 font-semibold text-yellow-800 print:print-color-adjust-exact", // 13: Date Mismatch
    "bg-yellow-50 text-yellow-800 print:print-color-adjust-exact" // 14: Date Mismatch - New
  ];
  const rowClasses: Record<number, string> = Object.fromEntries(
    rowClassArray.map((className, index) => [index, className])
  ) as Record<number, string>;

  return {
    data: tableData,
    options: { headers, rowClasses },
    title: "Processing Summary",
    type: "table"
  };
}

export function buildNewBadScansSection(newBadScans: DiscardedArtifact[]): ReportSection | null {
  const emptyCount = 0;
  if (newBadScans.length === emptyCount) {
    return null;
  }

  const sortedEntries = [...newBadScans].sort((a, b) => {
    if (a.stage !== b.stage) {
      return a.stage.localeCompare(b.stage);
    }
    if (a.environment !== b.environment) {
      return a.environment.localeCompare(b.environment);
    }
    return a.id.localeCompare(b.id);
  });

  const stageDisplayName = (stage: string): string => {
    if (stage === "clean") {
      return "Clean";
    }
    if (stage === "duplicates") {
      return "Duplicates";
    }
    return "Filter";
  };

  const rows = sortedEntries.map((entry) => [
    `<span class="font-mono">${escapeHtml(entry.id)}</span>`,
    escapeHtml(entry.environment),
    escapeHtml(entry.reason),
    stageDisplayName(entry.stage)
  ]);

  return {
    data: rows,
    options: { headers: ["Artifact ID", "Environment", "Reason", "Stage"] },
    title: "New Bad Scans",
    type: "table"
  };
}

export function buildFailedMovesSection(failedIds: string[]): ReportSection | null {
  const emptyCount = 0;
  if (failedIds.length === emptyCount) {
    return null;
  }

  const listItems = failedIds.map((id) => `<span class="font-mono">${escapeHtml(id)}</span>`);
  return {
    data: listItems,
    title: "Failed Moves (Clean Stage)",
    type: "list"
  };
}

export function buildDuplicatesDetailSection(badScanHistory: BadScanHistoryEntry[]): ReportSection[] {
  const sections: ReportSection[] = [];
  const duplicatePrefix = "Duplicate video";

  const duplicateEntries = badScanHistory.filter((entry) => entry.reason.startsWith(duplicatePrefix));
  const noDuplicates = 0;

  if (duplicateEntries.length === noDuplicates) {
    return sections;
  }

  sections.push({ title: "Duplicate Videos", type: "header" });
  sections.push({
    data: "Videos with identical content (same hash) across the dataset.",
    type: "text"
  });

  // Extract hash from reason and group by hash
  const hashPattern = /\(hash ([a-f0-9]+)\)/;
  const hashCaptureGroup = 1;
  const duplicatesByHash = new Map<string, { artifactId: string; environment: string }[]>();

  duplicateEntries.forEach((entry) => {
    const hashMatch = hashPattern.exec(entry.reason);
    const hash = hashMatch !== null ? (hashMatch[hashCaptureGroup] ?? "unknown") : "unknown";

    const hashGroup = duplicatesByHash.get(hash) ?? [];
    if (!hashGroup.some((a) => a.artifactId === entry.id)) {
      hashGroup.push({ artifactId: entry.id, environment: entry.environment });
    }
    duplicatesByHash.set(hash, hashGroup);
  });

  // Sort hashes by number of artifacts (descending)
  const arrayValueIndex = 1;
  const sortedHashes = Array.from(duplicatesByHash.entries()).sort(
    (a, b) => b[arrayValueIndex].length - a[arrayValueIndex].length
  );

  const duplicateLines: string[] = [];

  sortedHashes.forEach(([hash, artifacts]) => {
    const monoHash = `<span class="font-mono">${escapeHtml(hash)}</span>`;

    // Sort artifacts by environment, then by ID for consistent ordering
    const sortedArtifacts = [...artifacts].sort((a, b) => {
      if (a.environment !== b.environment) {
        return a.environment.localeCompare(b.environment);
      }
      return a.artifactId.localeCompare(b.artifactId);
    });

    // Build nested HTML list structure
    const subItems = sortedArtifacts
      .map((artifact) => {
        const monoId = `<span class="font-mono">${escapeHtml(artifact.artifactId)}</span>`;
        return `<li>${monoId} (${escapeHtml(artifact.environment)})</li>`;
      })
      .join("");

    duplicateLines.push(
      `${monoHash}<ul style="list-style-type: disc; margin-top: 0.25rem; margin-bottom: 0.25rem; margin-left: 0.25rem; padding-left: 1rem;">${subItems}</ul>`
    );
  });

  sections.push({
    data: duplicateLines,
    level: 4,
    title: "Duplicates",
    type: "list"
  });

  return sections;
}

export function buildShortVideosDetailSection(
  badScanHistory: BadScanHistoryEntry[],
  minDuration: number
): ReportSection[] {
  const sections: ReportSection[] = [];
  const shortVideoPrefix = "Video too short";

  const shortVideos = badScanHistory.filter((entry) => entry.reason.startsWith(shortVideoPrefix));
  const noShortVideos = 0;

  if (shortVideos.length === noShortVideos) {
    return sections;
  }

  sections.push({ title: "Short Videos", type: "header" });
  sections.push({
    data: `Videos shorter than the minimum duration threshold (${minDuration.toString()}s).`,
    type: "text"
  });

  const envSet = new Set(badScanHistory.map((entry) => entry.environment));
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envShortVideos = shortVideos.filter((entry) => entry.environment === env);
    if (envShortVideos.length === noShortVideos) {
      return;
    }

    // Extract duration from reason and sort by duration
    const durationPattern = /\(([\d.]+)s\)/;
    const durationCaptureGroup = 1;
    const decimalPlaces = 2;
    const withDuration = envShortVideos.map((entry) => {
      const match = durationPattern.exec(entry.reason);
      const durationStr = match !== null ? (match[durationCaptureGroup] ?? "0") : "0";
      const duration = parseFloat(durationStr);
      return { ...entry, duration };
    });
    const sortedVideos = withDuration.sort((a, b) => a.duration - b.duration);

    const videoLines: string[] = [];
    sortedVideos.forEach((entry) => {
      const monoId = `<span class="font-mono">${escapeHtml(entry.id)}</span>`;
      const durationStr = `<span class="font-mono">${entry.duration.toFixed(decimalPlaces)}s</span>`;
      videoLines.push(`${monoId} - ${durationStr}`);
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: videoLines,
      level: 4,
      title: "Short Videos",
      type: "list"
    });
  });

  return sections;
}

export function buildNonBathroomDetailSection(badScanHistory: BadScanHistoryEntry[]): ReportSection[] {
  const sections: ReportSection[] = [];
  const nonBathroomPrefix = "Not a bathroom";

  const nonBathrooms = badScanHistory.filter((entry) => entry.reason.startsWith(nonBathroomPrefix));
  const noNonBathrooms = 0;

  if (nonBathrooms.length === noNonBathrooms) {
    return sections;
  }

  sections.push({ title: "Non-Bathroom Videos", type: "header" });
  sections.push({
    data: "Videos identified as not showing a bathroom.",
    type: "text"
  });

  const envSet = new Set(badScanHistory.map((entry) => entry.environment));
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envNonBathrooms = nonBathrooms.filter((entry) => entry.environment === env);
    if (envNonBathrooms.length === noNonBathrooms) {
      return;
    }

    // Sort by ID for consistent ordering
    const sortedVideos = [...envNonBathrooms].sort((a, b) => a.id.localeCompare(b.id));

    const videoLines: string[] = [];
    const modelPattern = /\(Gemini ([^)]+)\)/;
    const modelCaptureGroup = 1;
    sortedVideos.forEach((entry) => {
      const monoId = `<span class="font-mono">${escapeHtml(entry.id)}</span>`;
      // Extract model name if present
      const modelMatch = modelPattern.exec(entry.reason);
      const modelName = modelMatch !== null ? (modelMatch[modelCaptureGroup] ?? "") : "";
      const modelInfo = modelName !== "" ? ` (${modelName})` : "";
      videoLines.push(`${monoId}${modelInfo}`);
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: videoLines,
      level: 4,
      title: "Non-Bathrooms",
      type: "list"
    });
  });

  return sections;
}

export function buildHeaderAnomalySections(
  anomalies: VideoHeaderAnomaly[],
  environments: string[] = []
): ReportSection[] {
  const sections: ReportSection[] = [];
  const noAnomalies = 0;

  if (anomalies.length === noAnomalies) {
    return sections;
  }

  sections.push({ title: "Video Header Anomalies", type: "header" });
  sections.push({
    data: "Detected stray avcC bytes before the primary avcC atom in the bitstream.",
    type: "text"
  });

  const envSet = new Set([...anomalies.map((entry) => entry.environment), ...environments]);
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envAnomalies = anomalies.filter((entry) => entry.environment === env);
    if (envAnomalies.length === noAnomalies) {
      return;
    }

    const sortedAnomalies = [...envAnomalies].sort((a, b) => a.id.localeCompare(b.id));
    const items = sortedAnomalies.map((entry) => {
      const id = `<span class="font-mono">${escapeHtml(entry.id)}</span>`;
      return entry.isNew === true ? `${id} (new)` : id;
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: items,
      level: 4,
      title: "Artifacts",
      type: "list"
    });
  });

  return sections;
}

export function buildBlackFrameSections(findings: BlackFrameFinding[], environments: string[] = []): ReportSection[] {
  const sections: ReportSection[] = [];
  const noFindings = 0;

  if (findings.length === noFindings) {
    return sections;
  }

  sections.push({ title: "Black Frame Segments", type: "header" });
  sections.push({
    data: "Detected stretches of mostly-black frames using ffmpeg blackdetect.",
    type: "text"
  });

  const envSet = new Set([...findings.map((entry) => entry.environment), ...environments]);
  const sortedEnvs = Array.from(envSet).sort();
  const decimalPlaces = 2;

  sortedEnvs.forEach((env) => {
    const envFindings = findings.filter((entry) => entry.environment === env);
    if (envFindings.length === noFindings) {
      return;
    }

    const items = envFindings
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((entry) => {
        const id = `<span class="font-mono">${escapeHtml(entry.id)}</span>`;
        const segments = entry.segments;
        const segmentText =
          segments
            .slice()
            .sort((a, b) => a.start - b.start)
            .map(
              (segment) =>
                `${segment.start.toFixed(decimalPlaces)}-${segment.end.toFixed(decimalPlaces)}s (${segment.duration.toFixed(decimalPlaces)}s)`
            )
            .join(", ") || "No segments recorded";
        const label = entry.isNew === true ? `${id} (new)` : id;
        return `${label}: ${segmentText}`;
      });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: items,
      level: 4,
      title: "Artifacts",
      type: "list"
    });
  });

  return sections;
}

export function buildMismatchDetailSections(mismatches: DateMismatch[], environments: string[] = []): ReportSection[] {
  const sections: ReportSection[] = [];
  const noMismatches = 0;

  if (mismatches.length === noMismatches) {
    return sections;
  }

  sections.push({ title: "Date Mismatches (> 1 Day)", type: "header" });
  sections.push({
    data: "Format: ID - [Days] (Video Date vs API Date in ET)",
    type: "text"
  });

  const envSet = new Set([...mismatches.map((m) => m.environment), ...environments]);
  const sortedEnvs = Array.from(envSet).sort();

  sortedEnvs.forEach((env) => {
    const envMismatches = mismatches.filter((m) => m.environment === env);
    if (envMismatches.length === noMismatches) {
      return;
    }

    const sortedMismatches = [...envMismatches].sort((a, b) => b.diffHours - a.diffHours);
    const mismatchLines: string[] = [];
    const hoursPerDay = 24;
    const digitThreshold = 10;
    const decimalPlaces = 1;

    sortedMismatches.forEach((m) => {
      const monoId = `<span class="font-mono">${escapeHtml(m.id)}</span>`;
      const diffDays = m.diffHours / hoursPerDay;
      const diffVal = diffDays.toFixed(decimalPlaces);
      const paddedDiffVal = diffDays < digitThreshold ? `&nbsp;${diffVal}` : diffVal;
      const diff = `<span class="font-mono">${paddedDiffVal} days</span>`;
      const dates = `(${formatMismatchDate(m.videoDate)} vs ${formatMismatchDate(m.scanDate)})`;
      mismatchLines.push(`${monoId} - ${diff} ${dates}`);
    });

    sections.push({ level: 3, title: `Environment: ${env}`, type: "header" });
    sections.push({
      data: mismatchLines,
      level: 4,
      title: "Mismatches",
      type: "list"
    });
  });

  return sections;
}
