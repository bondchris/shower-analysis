import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../../src/utils/logger";



export interface PersistenceTestConfig<T> {
    createDataWithUndefined?: () => unknown;
    // A generator for valid data (e.g. { "a": { ... } })
    createValidData: () => T;
    // A generator for data with undefined values (e.g. { "a": undefined }) if applicable
    // or keys that should be sorted
    createUnsortedData?: () => T;
    defaultFilename: string; // e.g. "config/badScans.json"
    getFn: (filePath?: string) => T;
    name: string;
    saveFn: (data: T, filePath?: string) => void;
    // Optional keys to check for sorting and undefined stripping.
    // Defaults to: sortedKeys: ["a", "b"], undefinedKeys: { kept: "a", stripped: "b" }
    testKeys?: {
        sortedKeys?: [string, string];
        undefinedKeys?: { kept: string; stripped: string };
    };
}

export function runPersistenceTestSuite<T>(config: PersistenceTestConfig<T>) {
    describe(`${config.name} Persistence`, () => {
        let tempDir: string;
        let cwdSpy: MockInstance;

        beforeEach(() => {
            // Create a real temp directory for isolation
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shower-analysis-test-"));
            cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);

            // Ensure the directory structure exists for defaultFilename (e.g. config/)
            // This mimics the real repo where 'config/' exists.
            const defaultDir = path.dirname(path.join(tempDir, config.defaultFilename));
            fs.mkdirSync(defaultDir, { recursive: true });
        });

        afterEach(() => {
            cwdSpy.mockRestore();
            // Cleanup
            try {
                fs.rmSync(tempDir, { force: true, recursive: true });
            } catch (e) {
                logger.warn(`Failed to cleanup temp dir: ${tempDir}`, e);
            }
        });

        describe("get", () => {
            it("returns empty object when file is missing (default path)", () => {
                // Ensure default path logic uses process.cwd()
                // No file exists yet
                const result = config.getFn();
                expect(result).toEqual({});
            });

            it("returns empty object when file is missing (custom path)", () => {
                const customPath = path.join(tempDir, "custom.json");
                const result = config.getFn(customPath);
                expect(result).toEqual({});
            });

            it("returns empty object when file contains invalid JSON", () => {
                const filePath = path.join(tempDir, config.defaultFilename);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, "{ this is not json }");

                const result = config.getFn();
                expect(result).toEqual({});
            });

            it("returns parsed object when file contains valid JSON", () => {
                const data = config.createValidData();
                const filePath = path.join(tempDir, config.defaultFilename);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, JSON.stringify(data));

                const result = config.getFn();
                expect(result).toEqual(data);
            });
        });

        describe("save", () => {
            it("writes valid JSON with indent=2", () => {
                const data = config.createValidData();
                config.saveFn(data);

                const filePath = path.join(tempDir, config.defaultFilename);
                expect(fs.existsSync(filePath)).toBe(true);

                const content = fs.readFileSync(filePath, "utf-8");
                // Check for 2-space indentation (newline + 2 spaces)
                expect(content).toContain('\n  "');

                // Logical equality
                const parsed = JSON.parse(content) as T;
                expect(parsed).toEqual(data);
            });

            it("sorts keys deterministically", () => {
                if (!config.createUnsortedData) {
                    return;
                }

                const data = config.createUnsortedData();
                config.saveFn(data);

                const filePath = path.join(tempDir, config.defaultFilename);
                const content = fs.readFileSync(filePath, "utf-8");

                // We expect first key to appear before second key
                const [key1, key2] = config.testKeys?.sortedKeys ?? ["a", "b"];
                const indexA = content.indexOf(`"${key1}":`);
                const indexB = content.indexOf(`"${key2}":`);

                expect(indexA).toBeGreaterThan(-1);
                expect(indexB).toBeGreaterThan(-1);
                expect(indexA).toBeLessThan(indexB);
            });

            it("strips undefined values", () => {
                if (!config.createDataWithUndefined) {
                    return;
                }

                const data = config.createDataWithUndefined() as T;
                config.saveFn(data);

                const filePath = path.join(tempDir, config.defaultFilename);
                const content = fs.readFileSync(filePath, "utf-8");
                const parsed = JSON.parse(content) as Record<string, unknown>;

                const { kept, stripped } = config.testKeys?.undefinedKeys ?? { kept: "a", stripped: "b" };
                expect(parsed).toHaveProperty(kept);
                expect(parsed).not.toHaveProperty(stripped);
            });

            it("uses custom file path if provided", () => {
                const data = config.createValidData();
                const customPath = path.join(tempDir, "custom-save.json");
                config.saveFn(data, customPath);

                expect(fs.existsSync(customPath)).toBe(true);
            });
        });

        describe("round-trip", () => {
            it("saves and retrieves the same data", () => {
                const data = config.createValidData();
                const customPath = path.join(tempDir, "roundtrip.json");

                config.saveFn(data, customPath);
                const result = config.getFn(customPath);

                expect(result).toEqual(data);
            });
        });
    });
}
