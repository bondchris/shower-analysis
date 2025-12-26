import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashVideoFile, hashVideoInDirectory } from "../../../../src/utils/video/hash";

vi.mock("fs");
vi.mock("path");
vi.mock("@noble/hashes/blake3.js", () => ({
  blake3: {
    create: vi.fn(() => ({
      digest: vi.fn(() => new Uint8Array([0x12, 0x34, 0x56, 0x78])),
      update: vi.fn()
    }))
  }
}));

describe("hash", () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.dirname.mockImplementation(path.dirname);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hashVideoFile", () => {
    it("should return null if file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await hashVideoFile("/nonexistent/video.mp4");

      expect(result).toBeNull();
    });

    it("should hash video file successfully", async () => {
      mockFs.existsSync.mockReturnValue(true);

      let dataHandler: ((chunk: Buffer) => void) | undefined;
      let endHandler: (() => void) | undefined;

      const mockStream = {
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === "data") {
            dataHandler = handler as (chunk: Buffer) => void;
          } else if (event === "end") {
            endHandler = handler as () => void;
          }
          return mockStream;
        })
      };

      mockFs.createReadStream.mockReturnValue(mockStream as unknown as fs.ReadStream);

      const resultPromise = hashVideoFile("/path/to/video.mp4");

      // Trigger data event
      if (dataHandler) {
        dataHandler(Buffer.from("test data"));
      }

      // Trigger end event
      if (endHandler) {
        endHandler();
      }

      const result = await resultPromise;

      expect(result).toBe("12345678");
      expect(mockFs.createReadStream).toHaveBeenCalledWith("/path/to/video.mp4", {
        highWaterMark: 1048576
      });
    });

    it("should handle stream errors by returning null", async () => {
      mockFs.existsSync.mockReturnValue(true);

      const mockError = new Error("Stream error");
      let errorHandler: ((err: Error) => void) | undefined;

      const mockStream = {
        on: vi.fn((event: string, handler: (err?: Error) => void) => {
          if (event === "error") {
            errorHandler = handler as (err: Error) => void;
          }
          return mockStream;
        })
      };

      mockFs.createReadStream.mockReturnValue(mockStream as unknown as fs.ReadStream);

      const resultPromise = hashVideoFile("/path/to/video.mp4");

      // Trigger error event
      if (errorHandler) {
        errorHandler(mockError);
      }

      // The outer try-catch will catch the rejection and return null
      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it("should return null on general catch errors", async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await hashVideoFile("/path/to/video.mp4");

      expect(result).toBeNull();
    });
  });

  describe("hashVideoInDirectory", () => {
    it("should return cached hash if valid cache exists", async () => {
      const dirPath = "/artifact/dir";
      const cachePath = "/artifact/dir/videoHash.json";
      const cachedHash = "cached_hash_value";

      mockPath.join.mockReturnValueOnce(cachePath).mockReturnValueOnce("/artifact/dir/video.mp4");

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ hash: cachedHash }));

      const result = await hashVideoInDirectory(dirPath);

      expect(result).toBe(cachedHash);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(cachePath, "utf-8");
    });

    it("should proceed to hash if cache is missing", async () => {
      const dirPath = "/artifact/dir";
      const cachePath = "/artifact/dir/videoHash.json";
      const videoPath = "/artifact/dir/video.mp4";

      // path.join is called: cache path, then video path, then cache path again for write
      mockPath.join.mockImplementation((...args) => {
        const joined = args.join("/");
        if (joined.includes("videoHash.json")) {
          return cachePath;
        }
        if (joined.includes("video.mp4")) {
          return videoPath;
        }
        return joined;
      });

      mockFs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);

      let dataHandler: ((chunk: Buffer) => void) | undefined;
      let endHandler: (() => void) | undefined;

      const mockStream = {
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === "data") {
            dataHandler = handler as (chunk: Buffer) => void;
          } else if (event === "end") {
            endHandler = handler as () => void;
          }
          return mockStream;
        })
      };

      mockFs.createReadStream.mockReturnValue(mockStream as unknown as fs.ReadStream);
      mockFs.writeFileSync.mockImplementation(() => {
        // Mock write success
      });

      const resultPromise = hashVideoInDirectory(dirPath);

      // Trigger data event
      if (dataHandler) {
        dataHandler(Buffer.from("test data"));
      }

      // Trigger end event
      if (endHandler) {
        endHandler();
      }

      const result = await resultPromise;

      expect(result).toBe("12345678");
      // Verify writeFileSync was called to cache the hash
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      // The implementation writes the hash to cache, verify it was called
      // We don't need to check the exact path since path.join is mocked
      const writeCalls = mockFs.writeFileSync.mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
    });

    it("should proceed to hash if cache is corrupt", async () => {
      const dirPath = "/artifact/dir";
      const cachePath = "/artifact/dir/videoHash.json";
      const videoPath = "/artifact/dir/video.mp4";

      mockPath.join.mockReturnValueOnce(cachePath).mockReturnValueOnce(videoPath);

      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      let dataHandler: ((chunk: Buffer) => void) | undefined;
      let endHandler: (() => void) | undefined;

      const mockStream = {
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === "data") {
            dataHandler = handler as (chunk: Buffer) => void;
          } else if (event === "end") {
            endHandler = handler as () => void;
          }
          return mockStream;
        })
      };

      mockFs.createReadStream.mockReturnValue(mockStream as unknown as fs.ReadStream);

      const resultPromise = hashVideoInDirectory(dirPath);

      // Trigger data event
      if (dataHandler) {
        dataHandler(Buffer.from("test data"));
      }

      // Trigger end event
      if (endHandler) {
        endHandler();
      }

      const result = await resultPromise;

      expect(result).toBe("12345678");
    });

    it("should proceed to hash if cache has empty hash", async () => {
      const dirPath = "/artifact/dir";
      const cachePath = "/artifact/dir/videoHash.json";
      const videoPath = "/artifact/dir/video.mp4";

      mockPath.join.mockReturnValueOnce(cachePath).mockReturnValueOnce(videoPath);

      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ hash: "" }));

      let dataHandler: ((chunk: Buffer) => void) | undefined;
      let endHandler: (() => void) | undefined;

      const mockStream = {
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === "data") {
            dataHandler = handler as (chunk: Buffer) => void;
          } else if (event === "end") {
            endHandler = handler as () => void;
          }
          return mockStream;
        })
      };

      mockFs.createReadStream.mockReturnValue(mockStream as unknown as fs.ReadStream);

      const resultPromise = hashVideoInDirectory(dirPath);

      // Trigger data event
      if (dataHandler) {
        dataHandler(Buffer.from("test data"));
      }

      // Trigger end event
      if (endHandler) {
        endHandler();
      }

      const result = await resultPromise;

      expect(result).toBe("12345678");
    });

    it("should return null if video file cannot be hashed", async () => {
      const dirPath = "/artifact/dir";
      const cachePath = "/artifact/dir/videoHash.json";
      const videoPath = "/artifact/dir/video.mp4";

      mockPath.join.mockReturnValueOnce(cachePath).mockReturnValueOnce(videoPath);

      mockFs.existsSync.mockReturnValue(false);

      const result = await hashVideoInDirectory(dirPath);

      expect(result).toBeNull();
    });

    it("should still return hash if cache write fails", async () => {
      const dirPath = "/artifact/dir";
      const cachePath = "/artifact/dir/videoHash.json";
      const videoPath = "/artifact/dir/video.mp4";

      mockPath.join.mockReturnValueOnce(cachePath).mockReturnValueOnce(videoPath);

      mockFs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);

      let dataHandler: ((chunk: Buffer) => void) | undefined;
      let endHandler: (() => void) | undefined;

      const mockStream = {
        on: vi.fn((event: string, handler: (data?: Buffer) => void) => {
          if (event === "data") {
            dataHandler = handler as (chunk: Buffer) => void;
          } else if (event === "end") {
            endHandler = handler as () => void;
          }
          return mockStream;
        })
      };

      mockFs.createReadStream.mockReturnValue(mockStream as unknown as fs.ReadStream);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error("Write failed");
      });

      const resultPromise = hashVideoInDirectory(dirPath);

      // Trigger data event
      if (dataHandler) {
        dataHandler(Buffer.from("test data"));
      }

      // Trigger end event
      if (endHandler) {
        endHandler();
      }

      const result = await resultPromise;

      expect(result).toBe("12345678");
    });
  });
});
