import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findArtifactDirectories } from "../../../../src/utils/data/artifactIterator";

describe("artifactIterator", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-iterator-test-"));
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { force: true, recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it("returns empty if dir missing", () => {
        expect(findArtifactDirectories(path.join(tmpDir, "missing"))).toEqual([]);
    });

    it("finds artifact directory with meta.json", () => {
        const artifactDir = path.join(tmpDir, "artifact1");
        fs.mkdirSync(artifactDir);
        fs.writeFileSync(path.join(artifactDir, "meta.json"), "{}");

        const results = findArtifactDirectories(tmpDir);
        expect(results).toHaveLength(1);
        expect(results[0]).toBe(artifactDir);
    });

    it("recurses to find nested artifacts", () => {
        const nested = path.join(tmpDir, "env", "artifact2");
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, "meta.json"), "{}");

        const results = findArtifactDirectories(tmpDir);
        expect(results).toHaveLength(1);
        expect(results[0]).toBe(nested);
    });

    it("ignores directories without meta.json", () => {
        const ignored = path.join(tmpDir, "ignored");
        fs.mkdirSync(ignored);
        // No meta.json

        const results = findArtifactDirectories(tmpDir);
        expect(results).toHaveLength(0);
    });
});
