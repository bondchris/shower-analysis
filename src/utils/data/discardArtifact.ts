import * as fs from "fs";
import * as path from "path";

interface DiscardOptions {
  dataRoot?: string;
  artifactsRoot?: string;
  reason?: string;
  fsImpl?: Pick<typeof fs, "existsSync" | "mkdirSync" | "renameSync" | "rmSync" | "writeFileSync">;
}

/**
 * Moves an artifact directory to the discarded-artifacts folder, preserving the
 * relative path under `data/artifacts` (e.g., env/uuid -> env/uuid).
 * Creates intermediate directories as needed. Optionally writes a discard-reason.txt
 * file explaining why the artifact was discarded.
 *
 * @param artifactDir - Full path to the artifact directory to discard
 * @param options - Optional overrides for roots, filesystem impl, and discard reason
 * @returns Destination path or null on failure/safety violation
 */
export function discardArtifact(artifactDir: string, options?: DiscardOptions): string | null {
  const fsModule = options?.fsImpl ?? fs;
  const rootDir = options?.dataRoot ?? path.join(process.cwd(), "data");
  const artifactsRoot = options?.artifactsRoot ?? path.join(rootDir, "artifacts");
  const discardedRoot = path.join(rootDir, "discarded-artifacts");

  try {
    // Ensure the discarded-artifacts root exists
    if (!fsModule.existsSync(discardedRoot)) {
      fsModule.mkdirSync(discardedRoot, { recursive: true });
    }

    // Compute relative path to mirror artifacts structure (e.g., env/uuid)
    const relative = path.relative(artifactsRoot, artifactDir);

    if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
      // Safety: do not move paths outside artifacts tree or empty names
      return null;
    }

    const destPath = path.join(discardedRoot, relative);
    const destDir = path.dirname(destPath);

    if (!fsModule.existsSync(destDir)) {
      fsModule.mkdirSync(destDir, { recursive: true });
    }

    // If destination already exists, remove the source since we already have a discarded copy.
    // Creating timestamped duplicates wastes disk space with identical data.
    if (fsModule.existsSync(destPath)) {
      fsModule.rmSync(artifactDir, { force: true, recursive: true });
    } else {
      fsModule.renameSync(artifactDir, destPath);
    }

    // Write the discard reason file if a reason was provided
    if (options?.reason !== undefined && options.reason !== "") {
      const reasonPath = path.join(destPath, "discard-reason.txt");
      const timestamp = new Date().toISOString();
      const content = `Discarded: ${timestamp}\nReason: ${options.reason}\n`;
      fsModule.writeFileSync(reasonPath, content);
    }

    return destPath;
  } catch {
    return null;
  }
}

