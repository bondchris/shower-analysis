import * as fs from "fs";
import * as path from "path";

/**
 * Recursively finds all artifact directories within a given root directory.
 * An "artifact directory" is defined as any directory containing a `meta.json` file.
 *
 * @param dir - The root directory to search.
 * @returns A list of absolute paths to artifact directories.
 */
export function findArtifactDirectories(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) {
        return [];
    }

    try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of list) {
            if (ent.isDirectory()) {
                const fullPath = path.join(dir, ent.name);
                // Heuristic: If it has meta.json, it's an artifact.
                // We do strictly check for meta.json to identify the root of an artifact.
                if (fs.existsSync(path.join(fullPath, "meta.json"))) {
                    results.push(fullPath);
                } else {
                    // Recurse deeper
                    results.push(...findArtifactDirectories(fullPath));
                }
            }
        }
    } catch {
        // Ignore access errors
    }
    return results;
}
