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

    describe("normalizeRecord edge cases", () => {
        it("skips records with non-string date", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "invalid_date": { date: 12345, environment: "prod", reasons: ["err"] },
                "valid": { date: "2024-01-01", environment: "prod", reasons: ["err"] }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("valid");
            expect(result).not.toHaveProperty("invalid_date");
        });

        it("skips records with non-string environment", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "invalid_env": { date: "2024-01-01", environment: null, reasons: ["err"] },
                "valid": { date: "2024-01-01", environment: "prod", reasons: ["err"] }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("valid");
            expect(result).not.toHaveProperty("invalid_env");
        });

        it("handles legacy reason field (singular) with valid string", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "legacy": { date: "2024-01-01", environment: "prod", reason: "legacy error" }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("legacy");
            expect(result["legacy"]?.reasons).toEqual(["legacy error"]);
        });

        it("handles legacy reason field that is empty after trim", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "empty_reason": { date: "2024-01-01", environment: "prod", reason: "   " }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("empty_reason");
            expect(result["empty_reason"]?.reasons).toEqual([]);
        });

        it("handles legacy reason field that is not a string", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "non_string_reason": { date: "2024-01-01", environment: "prod", reason: 12345 }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("non_string_reason");
            expect(result["non_string_reason"]?.reasons).toEqual([]);
        });

        it("filters out non-string items from reasons array", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "mixed_reasons": {
                    date: "2024-01-01",
                    environment: "prod",
                    reasons: ["valid error", 12345, null, "another error"]
                }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("mixed_reasons");
            expect(result["mixed_reasons"]?.reasons).toEqual(["valid error", "another error"]);
        });

        it("filters out empty strings from reasons array after trim", () => {
            const filePath = path.join(tempDir, "test-sync.json");
            fs.writeFileSync(filePath, JSON.stringify({
                "whitespace_reasons": {
                    date: "2024-01-01",
                    environment: "prod",
                    reasons: ["valid error", "   ", "", "another error"]
                }
            }));

            const result = getSyncFailures(filePath);
            expect(result).toHaveProperty("whitespace_reasons");
            expect(result["whitespace_reasons"]?.reasons).toEqual(["valid error", "another error"]);
        });
    });
});
