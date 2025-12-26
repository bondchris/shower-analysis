import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArData, run, sortArData, sortRawScan } from "../../../src/scripts/formatData";
import { logger } from "../../../src/utils/logger";

// Mock dependencies
vi.mock("../../../src/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock progress bar
vi.mock("../../../src/utils/progress", () => ({
  createProgressBar: vi.fn().mockReturnValue({
    increment: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn()
  })
}));

describe("formatData", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.exit to avoid exiting test runner
    vi.spyOn(process, "exit").mockImplementation(
      (() => undefined) as unknown as (code?: number | string | null) => never
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Unit Tests: sortArData ---
  describe("sortArData", () => {
    it("sorts top-level keys alphabetically when data is undefined", () => {
      const input: ArData = Object.fromEntries([
        ["z", 1],
        ["a", 2],
        ["m", 3]
      ]) as ArData;
      const sorted = sortArData(input);
      expect(Object.keys(sorted)).toEqual(["a", "m", "z"]);
    });

    it("sorts numeric keys ascending in data property", () => {
      const input: ArData = {
        data: {
          "1": "a",
          "10": "c",
          "2": "b"
        }
      };
      const sorted = sortArData(input);
      const keys = Object.keys(sorted.data ?? {});
      expect(keys).toEqual(["1", "2", "10"]);
    });

    it("sorts decimal keys correctly", () => {
      const input: ArData = {
        data: {
          "1.02": "a",
          "1.1": "b",
          "1.2": "c"
        }
      };
      const sorted = sortArData(input);
      const keys = Object.keys(sorted.data ?? {});
      expect(keys).toEqual(["1.02", "1.1", "1.2"]);
    });

    it("sorts other top-level properties alphabetically", () => {
      const input: ArData = Object.fromEntries([
        ["zeta", "z"],
        ["alpha", "a"],
        ["data", { "1": "a" }],
        ["meta", "info"]
      ]) as ArData;
      const sorted = sortArData(input);
      const topLevelKeys = Object.keys(sorted).filter((k) => k !== "data");
      expect(topLevelKeys).toEqual(["alpha", "meta", "zeta"]);
    });

    it("sorts nested object keys recursively", () => {
      const input: ArData = {
        data: {
          "1": Object.fromEntries([
            ["z", 1],
            ["a", 2],
            [
              "nested",
              Object.fromEntries([
                ["c", 3],
                ["b", 4]
              ]) as Record<string, unknown>
            ]
          ]) as Record<string, unknown>
        }
      };
      const sorted = sortArData(input);
      const nested = sorted.data?.["1"] as Record<string, unknown>;
      expect(Object.keys(nested)).toEqual(["a", "nested", "z"]);
      const deepNested = nested["nested"] as Record<string, unknown>;
      expect(Object.keys(deepNested)).toEqual(["b", "c"]);
    });

    it("does not mutate original object", () => {
      const input = { data: { "1": "a", "2": "b" } };
      const sorted = sortArData(input);
      expect(Object.keys(input.data)).toEqual(["1", "2"]);
      expect(sorted).not.toBe(input);
      expect(sorted.data).not.toBe(input.data);
    });
  });

  // --- Unit Tests: sortRawScan ---
  describe("sortRawScan", () => {
    it("sorts all keys alphabetically at top level", () => {
      const input = Object.fromEntries([
        ["z", 1],
        ["a", 2],
        ["m", 3]
      ]);
      const sorted = sortRawScan(input) as Record<string, unknown>;
      expect(Object.keys(sorted)).toEqual(["a", "m", "z"]);
    });

    it("sorts nested object keys recursively", () => {
      const input = Object.fromEntries([
        [
          "z",
          Object.fromEntries([
            ["c", 1],
            ["a", 2],
            [
              "nested",
              Object.fromEntries([
                ["f", 3],
                ["b", 4]
              ])
            ]
          ])
        ],
        ["a", 1]
      ]);
      const sorted = sortRawScan(input) as Record<string, unknown>;
      expect(Object.keys(sorted)).toEqual(["a", "z"]);
      const zObj = sorted["z"] as Record<string, unknown>;
      expect(Object.keys(zObj)).toEqual(["a", "c", "nested"]);
      const nested = zObj["nested"] as Record<string, unknown>;
      expect(Object.keys(nested)).toEqual(["b", "f"]);
    });

    it("preserves arrays but sorts object keys within arrays", () => {
      const input = {
        items: [
          Object.fromEntries([
            ["z", 1],
            ["a", 2]
          ]),
          Object.fromEntries([
            ["m", 3],
            ["b", 4]
          ])
        ]
      };
      const sorted = sortRawScan(input) as Record<string, unknown>;
      const items = sorted["items"] as Record<string, unknown>[];
      expect(items).toHaveLength(2);
      expect(Object.keys(items[0] ?? {})).toEqual(["a", "z"]);
      expect(Object.keys(items[1] ?? {})).toEqual(["b", "m"]);
    });

    it("handles null and primitive values", () => {
      const input = {
        boolValue: true,
        nullValue: null,
        numberValue: 42,
        stringValue: "test"
      };
      const sorted = sortRawScan(input) as Record<string, unknown>;
      expect(Object.keys(sorted)).toEqual(["boolValue", "nullValue", "numberValue", "stringValue"]);
      expect(sorted["nullValue"]).toBeNull();
      expect(sorted["stringValue"]).toBe("test");
      expect(sorted["numberValue"]).toBe(42);
      expect(sorted["boolValue"]).toBe(true);
    });
  });

  // --- Integration Tests: run ---
  describe("run", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "format-data-test-"));
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      try {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("creates arDataFormatted.json for valid arData.json files", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      // Valid artifact requires meta.json
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");

      const input = { data: { "1": "a", "2": "b" } };
      fs.writeFileSync(path.join(fileDir, "arData.json"), JSON.stringify(input));

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(1);
      expect(stats.found).toBe(1);

      const formattedPath = path.join(fileDir, "arDataFormatted.json");
      expect(fs.existsSync(formattedPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(formattedPath, "utf-8")) as ArData;
      expect(content.data).toBeDefined();
      expect(Object.keys(content.data ?? {})).toEqual(["1", "2"]);
    });

    it("creates rawScanFormatted.json for valid rawScan.json files", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");

      const input = Object.fromEntries([
        ["z", 1],
        ["a", 2],
        [
          "nested",
          Object.fromEntries([
            ["c", 3],
            ["b", 4]
          ]) as Record<string, unknown>
        ]
      ]) as Record<string, unknown>;
      fs.writeFileSync(path.join(fileDir, "rawScan.json"), JSON.stringify(input));

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(1);
      expect(stats.found).toBe(1);

      const formattedPath = path.join(fileDir, "rawScanFormatted.json");
      expect(fs.existsSync(formattedPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(formattedPath, "utf-8")) as Record<string, unknown>;
      expect(Object.keys(content)).toEqual(["a", "nested", "z"]);
      const nested = content["nested"] as Record<string, unknown>;
      expect(Object.keys(nested)).toEqual(["b", "c"]);
    });

    it("processes both arData.json and rawScan.json files", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");

      fs.writeFileSync(path.join(fileDir, "arData.json"), JSON.stringify({ data: { "1": "a" } }));
      fs.writeFileSync(
        path.join(fileDir, "rawScan.json"),
        JSON.stringify(
          Object.fromEntries([
            ["z", 1],
            ["a", 2]
          ])
        )
      );

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(2);
      expect(stats.found).toBe(2);

      expect(fs.existsSync(path.join(fileDir, "arDataFormatted.json"))).toBe(true);
      expect(fs.existsSync(path.join(fileDir, "rawScanFormatted.json"))).toBe(true);
    });

    it("skips if formatted file already exists", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");
      fs.writeFileSync(path.join(fileDir, "arData.json"), JSON.stringify({ data: { "1": "a" } }));
      fs.writeFileSync(path.join(fileDir, "arDataFormatted.json"), "{}");

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(stats.skipped).toBe(1);
    });

    it("skips arData.json file if data property is missing", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");
      fs.writeFileSync(path.join(fileDir, "arData.json"), JSON.stringify({ meta: "only" }));

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(stats.skipped).toBe(1);

      expect(fs.existsSync(path.join(fileDir, "arDataFormatted.json"))).toBe(false);
    });

    it("handles invalid JSON gracefully", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");
      fs.writeFileSync(path.join(fileDir, "arData.json"), "{ invalid json");

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(stats.found).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to parse JSON"));
    });

    it("handles errors during arData.json processing", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");
      const filePath = path.join(fileDir, "arData.json");
      fs.writeFileSync(filePath, JSON.stringify({ data: { "1": "a" } }));

      // Mock JSON.stringify to throw only when it's likely the one in the loop
      const stringifySpy = vi.spyOn(JSON, "stringify").mockImplementation(() => {
        throw new Error("Stringify failed");
      });

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to process"));
      stringifySpy.mockRestore();
    });

    it("handles errors during rawScan.json processing", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");
      const filePath = path.join(fileDir, "rawScan.json");
      fs.writeFileSync(filePath, JSON.stringify({ a: 1 }));

      const stringifySpy = vi.spyOn(JSON, "stringify").mockImplementation(() => {
        throw new Error("Stringify failed");
      });

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to process"));
      stringifySpy.mockRestore();
    });

    it("handles invalid JSON in rawScan.json gracefully", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "meta.json"), "{}");
      fs.writeFileSync(path.join(fileDir, "rawScan.json"), "{ invalid json");

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(stats.found).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to parse JSON"));
    });
  });
});
