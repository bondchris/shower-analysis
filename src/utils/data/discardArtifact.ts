import * as fs from "fs";
import * as path from "path";

interface DiscardOptions {
  dataRoot?: string;
  artifactsRoot?: string;
  fsImpl?: Pick<typeof fs, "existsSync" | "mkdirSync" | "renameSync">;
}

/**
 * Moves an artifact directory to the discarded-artifacts folder, preserving the
 * relative path under `data/artifacts` (e.g., env/uuid -> env/uuid).
 * Creates intermediate directories as needed.
 *
 * @param artifactDir - Full path to the artifact directory to discard
 * @param options - Optional overrides for roots and filesystem impl
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

    // If destination already exists, append a timestamp to avoid collision
    let finalDest = destPath;
    if (fsModule.existsSync(destPath)) {
      const timestamp = Date.now();
      const baseName = path.basename(destPath);
      finalDest = path.join(destDir, `${baseName}-${timestamp.toString()}`);
    }

    fsModule.renameSync(artifactDir, finalDest);

    return finalDest;
  } catch {
    return null;
  }
}

