import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VideoHashDatabase,
  addVideoHash,
  findDuplicateArtifacts,
  getVideoHashes,
  saveVideoHashes
} from "../../../../src/utils/data/videoHashes";

vi.mock("fs");
vi.mock("path");

describe("videoHashes", () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.dirname.mockImplementation((filePath: string) => {
      const lastSlash = filePath.lastIndexOf("/");
      return lastSlash >= 0 ? filePath.substring(0, lastSlash) : ".";
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getVideoHashes", () => {
    it("should load video hashes from file", () => {
      const mockData: VideoHashDatabase = {
        hash1: ["artifact1", "artifact2"],
        hash2: ["artifact3"]
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const result = getVideoHashes();

      expect(result).toEqual(mockData);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining("config/videoHashes.json"),
        "utf-8"
      );
    });

    it("should return empty object if file does not exist", () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = getVideoHashes();

      expect(result).toEqual({});
    });

    it("should return empty object if file contains invalid JSON", () => {
      mockFs.readFileSync.mockReturnValue("invalid json");

      const result = getVideoHashes();

      expect(result).toEqual({});
    });

    it("should use custom file path when provided", () => {
      const customPath = "/custom/path/hashes.json";
      const mockData: VideoHashDatabase = { hash1: ["artifact1"] };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const result = getVideoHashes(customPath);

      expect(result).toEqual(mockData);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(customPath, "utf-8");
    });
  });

  describe("saveVideoHashes", () => {
    it("should save video hashes to file with sorted keys", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact3"],
        hash2: ["artifact2", "artifact1"]
      };

      mockFs.existsSync.mockReturnValue(true);

      saveVideoHashes(database);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string) as VideoHashDatabase;
        const keys = Object.keys(writtenData);
        expect(keys).toEqual(["hash1", "hash2"]);
        expect(writtenData["hash2"]).toEqual(["artifact1", "artifact2"]);
      }
    });

    it("should create directory if it does not exist", () => {
      const database: VideoHashDatabase = { hash1: ["artifact1"] };

      mockFs.existsSync.mockReturnValue(false);

      saveVideoHashes(database);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it("should filter out empty arrays", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact1"],
        hash2: []
      };

      mockFs.existsSync.mockReturnValue(true);

      saveVideoHashes(database);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string) as VideoHashDatabase;
        expect(writtenData["hash2"]).toBeUndefined();
        expect(writtenData["hash1"]).toEqual(["artifact1"]);
      }
    });

    it("should use custom file path when provided", () => {
      const customPath = "/custom/path/hashes.json";
      const database: VideoHashDatabase = { hash1: ["artifact1"] };

      mockFs.existsSync.mockReturnValue(true);

      saveVideoHashes(database, customPath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        customPath,
        expect.any(String)
      );
    });
  });

  describe("addVideoHash", () => {
    it("should add new hash and artifact ID", () => {
      const database: VideoHashDatabase = {};

      addVideoHash(database, "hash1", "artifact1");

      expect(database["hash1"]).toEqual(["artifact1"]);
    });

    it("should append artifact ID to existing hash", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact1"]
      };

      addVideoHash(database, "hash1", "artifact2");

      expect(database["hash1"]).toEqual(["artifact1", "artifact2"]);
    });

    it("should not add duplicate artifact IDs", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact1"]
      };

      addVideoHash(database, "hash1", "artifact1");

      expect(database["hash1"]).toEqual(["artifact1"]);
    });
  });

  describe("findDuplicateArtifacts", () => {
    it("should return all artifacts for a hash when excludeId is not provided", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact1", "artifact2", "artifact3"]
      };

      const result = findDuplicateArtifacts(database, "hash1");

      expect(result).toEqual(["artifact1", "artifact2", "artifact3"]);
    });

    it("should exclude specified artifact ID", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact1", "artifact2", "artifact3"]
      };

      const result = findDuplicateArtifacts(database, "hash1", "artifact2");

      expect(result).toEqual(["artifact1", "artifact3"]);
    });

    it("should return empty array for non-existent hash", () => {
      const database: VideoHashDatabase = {};

      const result = findDuplicateArtifacts(database, "nonexistent");

      expect(result).toEqual([]);
    });

    it("should return empty array when hash exists but has no artifacts after exclusion", () => {
      const database: VideoHashDatabase = {
        hash1: ["artifact1"]
      };

      const result = findDuplicateArtifacts(database, "hash1", "artifact1");

      expect(result).toEqual([]);
    });
  });
});

