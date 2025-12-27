import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";



import { logger } from "../../../../src/utils/logger";
import { SyncFailureDatabase, getSyncFailures, saveSyncFailures } from "../../../../src/utils/data/syncFailures";
import { runPersistenceTestSuite } from "./testHelpers";

runPersistenceTestSuite<SyncFailureDatabase>({
    createDataWithUndefined: () => ({
        "artifact_a": { date: "2024-01-01", environment: "env1", reasons: ["error a"] },
        "artifact_b": undefined as unknown as SyncFailureDatabase[string]
    }),
    createUnsortedData: () => {
        const fixturePath = path.join(__dirname, "fixtures/unsortedSyncFailures.json");
        const content = fs.readFileSync(fixturePath, "utf-8");
        return JSON.parse(content) as SyncFailureDatabase;
    },
    createValidData: () => ({
        "artifact_1": {
            date: "2024-01-01",
            environment: "production",
            reasons: ["download failed"]
        },
        "artifact_2": {
            date: "2024-01-02",
            environment: "staging",
            reasons: ["corrupt data"]
        }
    }),
    defaultFilename: "config/syncFailures.json",
    getFn: getSyncFailures,
    name: "SyncFailures",
    saveFn: saveSyncFailures,
    testKeys: {
        sortedKeys: ["a_artifact", "b_artifact"],
        undefinedKeys: { kept: "artifact_a", stripped: "artifact_b" }
    }
});

describe("SyncFailures Specific", () => {
    let tempDir: string;
    let cwdSpy: MockInstance;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shower-analysis-test-sync-"));
        cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    });

    afterEach(() => {
        cwdSpy.mockRestore();
        try {
            fs.rmSync(tempDir, { force: true, recursive: true });
        } catch (e) {
            logger.warn(`Failed to cleanup temp dir: ${tempDir}`, e);
        }
    });

    it("creates parent directory if missing", () => {
        const nestedPath = path.join(tempDir, "deeply/nested/config/syncFailures.json");
        const data: SyncFailureDatabase = { "art1": { date: "2024-01-01", environment: "env", reasons: ["err"] } };
        saveSyncFailures(data, nestedPath);

        expect(fs.existsSync(nestedPath)).toBe(true);
        expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });
});
