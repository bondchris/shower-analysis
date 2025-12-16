import axios, { AxiosError, AxiosResponse } from "axios";
import fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import { Mock, Mocked } from "vitest";

import { downloadFile, downloadJsonFile } from "../../../../src/utils/sync/downloadHelpers";

vi.mock("axios");
vi.mock("fs");
vi.mock("stream/promises", () => ({
  pipeline: vi.fn().mockResolvedValue(undefined)
}));

const mockAxios = axios as Mocked<typeof axios>;
const mockFs = fs as Mocked<typeof fs>;
const mockPipeline = pipeline as Mock;

describe("downloadHelpers", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("downloadFile", () => {
    const url = "http://example.com/video.mp4";
    const outputPath = "/tmp/video.mp4";
    const tmpPath = "/tmp/video.mp4.tmp";

    it("skips if file exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const result = await downloadFile(url, outputPath);
      expect(result).toBeNull();
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it("downloads file successfully (atomic write)", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const mockStream = {};
      mockAxios.get.mockResolvedValue({ data: mockStream });
      const mockWriter = {};
      mockFs.createWriteStream.mockReturnValue(mockWriter as unknown as fs.WriteStream);

      const result = await downloadFile(url, outputPath);

      expect(result).toBeNull();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
      expect(mockFs.createWriteStream).toHaveBeenCalledWith(tmpPath);
      expect(mockPipeline).toHaveBeenCalledWith(mockStream, mockWriter);
      expect(mockFs.renameSync).toHaveBeenCalledWith(tmpPath, outputPath);
    });

    it("handles axios errors and cleans up temp file", async () => {
      mockFs.existsSync.mockReturnValue(false);
      // existsSync returns true for cleanup check
      mockFs.existsSync.mockImplementation((p) => p === tmpPath);

      const axiosError = new AxiosError("404 Not Found");
      axiosError.response = { status: 404 } as unknown as AxiosResponse;
      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxios.get.mockRejectedValue(axiosError);

      const result = await downloadFile(url, outputPath, "Video");

      expect(result).toBe("Video download failed (404)");
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(tmpPath);
      expect(mockFs.renameSync).not.toHaveBeenCalled();
    });

    it("uses default label 'file' if not provided", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockAxios.get.mockRejectedValue(new Error("Fail"));

      const result = await downloadFile(url, outputPath);
      expect(result).toContain("file download failed");
    });
  });

  describe("downloadJsonFile", () => {
    const url = "http://example.com/data.json";
    const outputPath = "/tmp/data.json";
    const tmpPath = "/tmp/data.json.tmp";
    const label = "TestJSON";

    it("skips if file exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const result = await downloadJsonFile(url, outputPath, label);
      expect(result).toBeNull();
    });

    it("downloads JSON successfully (atomic write)", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockAxios.get.mockResolvedValue({ data: { foo: "bar" } });

      const result = await downloadJsonFile(url, outputPath, label);

      expect(result).toBeNull();
      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(tmpPath, expect.stringContaining("foo"));
      expect(mockFs.renameSync).toHaveBeenCalledWith(tmpPath, outputPath);
    });

    it("handles download failure and cleans up", async () => {
      mockFs.existsSync.mockReturnValue(false);
      // existsSync returns true for cleanup check
      mockFs.existsSync.mockImplementation((p) => p === tmpPath);

      mockAxios.get.mockRejectedValue(new Error("Fail"));

      const result = await downloadJsonFile(url, outputPath, label);

      expect(result).toBe(`${label} download failed (Unknown: Error: Fail)`);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(tmpPath);
    });
  });
});
