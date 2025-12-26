import * as fs from "fs";
import * as path from "path";

/**
 * Maps video hash (BLAKE3 hex string) to an array of artifact IDs that have that video.
 * This allows efficient duplicate detection by looking up which artifacts share the same video hash.
 */
export type VideoHashDatabase = Record<string, string[]>;

/**
 * Loads the database of video hashes.
 * Maps hash -> array of artifact IDs that have that video.
 * Backed by `config/videoHashes.json` by default.
 */
export function getVideoHashes(filePath?: string): VideoHashDatabase {
  const HASHES_FILE = filePath ?? path.join(process.cwd(), "config", "videoHashes.json");
  try {
    const content = fs.readFileSync(HASHES_FILE, "utf-8");
    const json: unknown = JSON.parse(content);
    return json as VideoHashDatabase;
  } catch {
    return {};
  }
}

/**
 * Saves the video hash database.
 * Sorts keys deterministically for consistent output.
 */
export function saveVideoHashes(database: VideoHashDatabase, filePath?: string) {
  const HASHES_FILE = filePath ?? path.join(process.cwd(), "config", "videoHashes.json");
  const JSON_INDENT = 2;

  // Deterministic sort by hash
  const sortedKeys = Object.keys(database).sort();
  const sortedDatabase: VideoHashDatabase = {};
  const MIN_ARRAY_LENGTH = 0;
  for (const key of sortedKeys) {
    const val = database[key];
    if (val !== undefined && Array.isArray(val) && val.length > MIN_ARRAY_LENGTH) {
      // Sort artifact IDs within each array for consistency
      sortedDatabase[key] = [...val].sort();
    }
  }

  // Ensure directory exists
  const dir = path.dirname(HASHES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(HASHES_FILE, JSON.stringify(sortedDatabase, null, JSON_INDENT));
}

/**
 * Adds a video hash -> artifact ID mapping to the database.
 * If the hash already exists, the artifact ID is added to the array (if not already present).
 */
export function addVideoHash(
  database: VideoHashDatabase,
  hash: string,
  artifactId: string
): void {
  database[hash] ??= [];
  if (!database[hash].includes(artifactId)) {
    database[hash].push(artifactId);
  }
}

/**
 * Finds all artifact IDs that share the same video hash (duplicates).
 * Returns an array of artifact IDs (excluding the current one if provided).
 */
export function findDuplicateArtifacts(
  database: VideoHashDatabase,
  hash: string,
  excludeId?: string
): string[] {
  const artifacts = database[hash] ?? [];
  if (excludeId !== undefined) {
    return artifacts.filter((id) => id !== excludeId);
  }
  return artifacts;
}

