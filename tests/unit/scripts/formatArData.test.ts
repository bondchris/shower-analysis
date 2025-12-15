import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { ArData, findArDataFiles, run, sortArData } from "../../../src/scripts/formatArData";

describe("formatArData", () => {
  // --- Unit Tests: findArDataFiles ---
  describe("findArDataFiles", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "find-test-"));
    });

    afterEach(() => {
      try {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("returns empty array for missing directory", () => {
      const nonExistent = path.join(tmpDir, "missing");
      expect(findArDataFiles(nonExistent)).toEqual([]);
    });

    it("returns empty array for empty directory", () => {
      const emptyDir = path.join(tmpDir, "empty");
      fs.mkdirSync(emptyDir);
      expect(findArDataFiles(emptyDir)).toEqual([]);
    });

    it("finds arData.json in root", () => {
      fs.writeFileSync(path.join(tmpDir, "arData.json"), "{}");
      const files = findArDataFiles(tmpDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("arData.json");
    });

    it("finds nested arData.json files", () => {
      const nested = path.join(tmpDir, "a", "b");
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "arData.json"), "{}");
      fs.writeFileSync(path.join(nested, "arData.json"), "{}");

      const files = findArDataFiles(tmpDir);
      expect(files).toHaveLength(2);
    });

    it("ignores non-matching files", () => {
      fs.writeFileSync(path.join(tmpDir, "other.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "arData.json"), "{}");
      const files = findArDataFiles(tmpDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/arData\.json$/);
    });
  });

  // --- Unit Tests: sortArData ---
  describe("sortArData", () => {
    it("returns original if data is undefined", () => {
      const input: ArData = { other: 1 };
      expect(sortArData(input)).toEqual(input);
    });

    it("sorts numeric keys ascending", () => {
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

    it("preserves other properties", () => {
      const input: ArData = {
        data: { "1": "a" },
        meta: "info"
      };
      const sorted = sortArData(input);
      expect(sorted["meta"]).toBe("info");
      expect(sorted.data).toEqual({ "1": "a" });
    });

    it("does not mutate original object", () => {
      const input = { data: { "1": "a", "2": "b" } };
      const sorted = sortArData(input);
      expect(Object.keys(input.data)).toEqual(["1", "2"]); // Original order preserved (JS objects usually retain insertion order for string keys, or strict implementation dependent, but we expect new object reference)
      expect(sorted).not.toBe(input);
      expect(sorted.data).not.toBe(input.data);
    });
  });

  // --- Integration Tests: run ---
  describe("run", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-test-"));
      // Mock stdout to prevent clutter
      jest.spyOn(process.stdout, "write").mockImplementation(() => true);
      jest.spyOn(console, "log").mockImplementation(() => undefined);
      jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      try {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("creates arDataFormatted.json for valid files", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
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

    it("skips if arDataFormatted.json exists", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "arData.json"), "{}");
      fs.writeFileSync(path.join(fileDir, "arDataFormatted.json"), "{}");

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(stats.skipped).toBe(1);
    });

    it("skips file if data property is missing", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "arData.json"), JSON.stringify({ meta: "only" }));

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      // It is found, but processed count logic: if skipped inside loop due to missing data, processed does not increment.
      // stats.skipped = found - processed.
      // So it counts as "skipped".
      expect(stats.skipped).toBe(1);

      expect(fs.existsSync(path.join(fileDir, "arDataFormatted.json"))).toBe(false);
    });

    it("handles invalid JSON gracefully", async () => {
      const fileDir = path.join(tmpDir, "artifact1");
      fs.mkdirSync(fileDir);
      fs.writeFileSync(path.join(fileDir, "arData.json"), "{ invalid json");

      const stats = await run(tmpDir);

      expect(stats.processed).toBe(0);
      expect(stats.found).toBe(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to parse JSON"));
    });
  });
});
