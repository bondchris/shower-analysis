import * as path from "path";

import { BadScanDatabase } from "../../models/badScanRecord";
import { DiscardStage, DiscardedArtifact } from "../../models/discardStats";

/* c8 ignore start */
export function getEnvironmentName(dataDir: string, artifactDir: string): string {
  const relativePath = path.relative(dataDir, artifactDir);
  const parts = relativePath.split(path.sep);
  const minimumPartsForEnvironment = 2;
  const environmentOffsetFromEnd = 2;
  const unknownEnvironment = "unknown";
  const hasEnvironment = parts.length >= minimumPartsForEnvironment;
  return hasEnvironment ? (parts[parts.length - environmentOffsetFromEnd] ?? unknownEnvironment) : unknownEnvironment;
}
/* c8 ignore stop */

export function shouldSkipEntry(name: string): boolean {
  return name === ".DS_Store" || name.startsWith(".");
}

export function toBadScanIdSet(database: BadScanDatabase): Set<string> {
  return new Set(Object.keys(database));
}

export function collectNewBadScans(
  badScanDatabase: BadScanDatabase,
  beforeIds: Set<string>,
  afterIds: Set<string>,
  stage: DiscardStage
): DiscardedArtifact[] {
  const additions: DiscardedArtifact[] = [];
  afterIds.forEach((id) => {
    if (beforeIds.has(id)) {
      return;
    }
    const entry = badScanDatabase[id];
    if (entry === undefined) {
      return;
    }
    additions.push({
      date: entry.date,
      environment: entry.environment,
      id,
      reason: entry.reason,
      stage
    });
  });
  return additions;
}
