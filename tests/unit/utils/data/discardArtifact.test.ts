import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discardArtifact } from "../../../../src/utils/data/discardArtifact";

describe("discardArtifact", () => {
  let tmpDir: string;
  let dataDir: string;
  let artifactsDir: string;
  let discardedDir: string;
  let artifactDir: string;
  let envDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "discard-artifact-test-"));
    dataDir = path.join(tmpDir, "data");
    artifactsDir = path.join(dataDir, "artifacts");
    discardedDir = path.join(dataDir, "discarded-artifacts");
    envDir = path.join(artifactsDir, "env");
    artifactDir = path.join(envDir, "artifact-id");

    // Create artifacts directory structure
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("moves artifact to discarded-artifacts preserving structure", () => {
    const result = discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result).toBe(path.join(discardedDir, "env", "artifact-id"));
      expect(fs.existsSync(result)).toBe(true);
    }
    expect(fs.existsSync(artifactDir)).toBe(false);
  });

  it("creates discarded-artifacts directory if it doesn't exist", () => {
    expect(fs.existsSync(discardedDir)).toBe(false);

    discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    expect(fs.existsSync(discardedDir)).toBe(true);
  });

  it("creates intermediate directories if needed", () => {
    const nestedEnvDir = path.join(artifactsDir, "env1", "subenv");
    const nestedArtifactDir = path.join(nestedEnvDir, "artifact-id");
    fs.mkdirSync(nestedArtifactDir, { recursive: true });
    fs.writeFileSync(path.join(nestedArtifactDir, "meta.json"), "{}");

    const result = discardArtifact(nestedArtifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    if (result !== null) {
      expect(result).toBe(path.join(discardedDir, "env1", "subenv", "artifact-id"));
      expect(fs.existsSync(result)).toBe(true);
    }
  });

  it("returns null when relative path starts with ..", () => {
    // Test the safety check for paths going outside artifacts tree
    const outsideArtifactDir = path.join(tmpDir, "outside", "artifact");
    fs.mkdirSync(outsideArtifactDir, { recursive: true });

    const result = discardArtifact(outsideArtifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    expect(result).toBeNull();
  });

  it("returns null for empty relative path", () => {
    // When artifactDir equals artifactsRoot, relative path is empty
    const result = discardArtifact(artifactsDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    expect(result).toBeNull();
  });

  it("removes source when destination already exists instead of creating duplicates", () => {
    // Create existing destination with some content
    const existingDest = path.join(discardedDir, "env", "artifact-id");
    fs.mkdirSync(existingDest, { recursive: true });
    fs.writeFileSync(path.join(existingDest, "meta.json"), '{"existing": true}');

    const result = discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    // Should return the existing destination path
    expect(result).toBe(existingDest);
    // Source should be removed
    expect(fs.existsSync(artifactDir)).toBe(false);
    // Existing destination should still be there
    expect(fs.existsSync(existingDest)).toBe(true);
    // No timestamped duplicates should exist
    const envContents = fs.readdirSync(path.join(discardedDir, "env"));
    expect(envContents).toEqual(["artifact-id"]);
  });

  it("writes discard-reason.txt when reason is provided", () => {
    const result = discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir,
      reason: "Video too short (5.00s)"
    });

    expect(result).not.toBeNull();
    if (result !== null) {
      const reasonPath = path.join(result, "discard-reason.txt");
      expect(fs.existsSync(reasonPath)).toBe(true);
      const content = fs.readFileSync(reasonPath, "utf-8");
      expect(content).toContain("Reason: Video too short (5.00s)");
      expect(content).toContain("Discarded:");
    }
  });

  it("does not write discard-reason.txt when reason is not provided", () => {
    const result = discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir
    });

    expect(result).not.toBeNull();
    if (result !== null) {
      const reasonPath = path.join(result, "discard-reason.txt");
      expect(fs.existsSync(reasonPath)).toBe(false);
    }
  });

  it("handles errors gracefully and returns null", () => {
    // Track which paths have been checked for existence
    const checkedPaths = new Set<string>();

    const mockFs = {
      existsSync: vi.fn((p: fs.PathLike) => {
        const pathStr = p.toString();
        checkedPaths.add(pathStr);
        // Return false for destination so renameSync is called
        if (pathStr.includes("discarded-artifacts") && pathStr.includes("artifact-id")) {
          return false;
        }
        return true;
      }),
      mkdirSync: vi.fn(),
      renameSync: vi.fn().mockImplementation(() => {
        throw new Error("Permission denied");
      }),
      rmSync: vi.fn(),
      writeFileSync: vi.fn()
    };

    const result = discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir,
      fsImpl: mockFs as Pick<typeof fs, "existsSync" | "mkdirSync" | "renameSync" | "rmSync" | "writeFileSync">
    });

    expect(result).toBeNull();
  });

  it("uses default paths when options not provided", () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(tmpDir);

      const defaultDataDir = path.join(process.cwd(), "data");
      const defaultArtifactsDir = path.join(defaultDataDir, "artifacts");
      const defaultDiscardedDir = path.join(defaultDataDir, "discarded-artifacts");
      const defaultEnvDir = path.join(defaultArtifactsDir, "env");
      const defaultArtifactDir = path.join(defaultEnvDir, "artifact-id");

      fs.mkdirSync(defaultArtifactDir, { recursive: true });
      fs.writeFileSync(path.join(defaultArtifactDir, "meta.json"), "{}");

      const result = discardArtifact(defaultArtifactDir);

      expect(result).not.toBeNull();
      if (result !== null) {
        expect(result).toBe(path.join(defaultDiscardedDir, "env", "artifact-id"));
        expect(fs.existsSync(result)).toBe(true);
      }
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("uses custom fsImpl when provided", () => {
    const mockFs = {
      existsSync: vi.fn((p: fs.PathLike) => {
        const pathStr = p.toString();
        if (pathStr === discardedDir) {
          return false;
        }
        if (pathStr === path.dirname(path.join(discardedDir, "env"))) {
          return false;
        }
        if (pathStr === path.join(discardedDir, "env", "artifact-id")) {
          return false;
        }
        return true;
      }),
      mkdirSync: vi.fn(),
      renameSync: vi.fn(),
      rmSync: vi.fn(),
      writeFileSync: vi.fn()
    };

    discardArtifact(artifactDir, {
      artifactsRoot: artifactsDir,
      dataRoot: dataDir,
      fsImpl: mockFs as Pick<typeof fs, "existsSync" | "mkdirSync" | "renameSync" | "rmSync" | "writeFileSync">
    });

    expect(mockFs.existsSync).toHaveBeenCalled();
    expect(mockFs.mkdirSync).toHaveBeenCalled();
    expect(mockFs.renameSync).toHaveBeenCalled();
  });
});
