import axios from "axios";
import fs from "fs";
import path from "path";
import { Mocked, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiResponse, Artifact, SpatialService } from "../../src/services/spatialService";

vi.mock("axios");
const mockedAxios = axios as Mocked<typeof axios>;

describe("SpatialService Integration", () => {
  const tempDir = path.join(__dirname, "temp-spatial-test");

  class TestSpatialService extends SpatialService {
    protected override getCacheDir(): string {
      const sanitized = this.envName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      return path.join(tempDir, "data", "api_cache", sanitized);
    }
  }

  let service: TestSpatialService;

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // No need to spy on process.cwd() anymore
  });

  beforeEach(() => {
    // 1. Setup Temp Dir (already done in beforeAll, but ensure it's clean for each test)
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // 2. Reset axios mocks
    mockedAxios.get.mockReset();

    // 3. Initialize Service
    service = new TestSpatialService("bondxlowes.com", "TestEnv");
  });

  afterEach(() => {
    // Cleanup
    vi.restoreAllMocks(); // Mock process.cwd() to verify relative path resolution
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { force: true, recursive: true });
      }
    } catch {
      // ignore cleanup errors
    }
  });

  // Helpers to access cache path
  const getCachePath = (envName = "TestEnv") => {
    // Sanitization logic from service: internal logic replces invalid chars
    const sanitized = envName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return path.join(tempDir, "data", "api_cache", sanitized);
  };

  const createMeta = (total: number, envName?: string) => {
    const dir = getCachePath(envName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ date: new Date().toISOString(), total }));
  };

  const createPage = (page: number, data: ApiResponse, envName?: string) => {
    const dir = getCachePath(envName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "page_" + page.toString() + ".json"), JSON.stringify(data));
  };

  const mockApiResponse = (total: number, items: Artifact[] = []): ApiResponse => ({
    data: items,
    pagination: {
      currentPage: 1,
      from: 1,
      lastPage: 1,
      perPage: 10,
      to: items.length,
      total
    }
  });

  describe("A. First Call Behavior (hasValidatedCache === false)", () => {
    it("should always hit network on first call (empty cache)", async () => {
      const responseData = mockApiResponse(100);
      mockedAxios.get.mockResolvedValue({ data: responseData });

      const res = await service.fetchScanArtifacts(1);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/spatial/v1/scan-artifacts?page=1"),
        expect.objectContaining({ timeout: 60000 })
      );
      expect(res).toEqual(responseData);

      // Expect page to be saved
      const pagePath = path.join(getCachePath(), "page_1.json");
      expect(fs.existsSync(pagePath)).toBe(true);
    });

    it("should hit network on first call even if meta exists and matches (validation)", async () => {
      // Arrange
      createMeta(100);
      const responseData = mockApiResponse(100);
      mockedAxios.get.mockResolvedValue({ data: responseData });

      // Act
      await service.fetchScanArtifacts(1);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      // Side effect: cacheValid should be set to true internally.
      // We verify this by making a SECOND call and ensuring it DOES NOT hit network.
      mockedAxios.get.mockClear();

      // Arrange cached page for second call so it can be returned
      createPage(2, mockApiResponse(100));

      await service.fetchScanArtifacts(2);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("should rewrite meta if totals mismatch on first call", async () => {
      createMeta(50); // Old total
      const responseData = mockApiResponse(60); // New total
      mockedAxios.get.mockResolvedValue({ data: responseData });

      await service.fetchScanArtifacts(1);

      const metaPath = path.join(getCachePath(), "meta.json");
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { total: number };
      expect(meta.total).toBe(60);
    });
  });

  describe("B. After Validation (hasValidatedCache === true)", () => {
    beforeEach(async () => {
      // Prime the service to be "valid"
      createMeta(100);
      mockedAxios.get.mockResolvedValue({ data: mockApiResponse(100) });
      // First call to validate cache
      await service.fetchScanArtifacts(1);
      mockedAxios.get.mockClear();
    });

    it("should use cached page if valid and exists", async () => {
      const cachedData = mockApiResponse(100, [{ id: "cached", projectId: "p1" }]);
      createPage(2, cachedData);

      const res = await service.fetchScanArtifacts(2);

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(res).toEqual(cachedData);
    });

    it("should fallback to network if valid but page file missing", async () => {
      // Page 3 missing
      const liveData = mockApiResponse(100, [{ id: "live", projectId: "p1" }]);
      mockedAxios.get.mockResolvedValue({ data: liveData });

      const res = await service.fetchScanArtifacts(3);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(res).toEqual(liveData);
      // Should write back to cache
      expect(fs.existsSync(path.join(getCachePath(), "page_3.json"))).toBe(true);
    });

    it("should fallback to network if cached page is corrupted", async () => {
      const dir = getCachePath();
      fs.writeFileSync(path.join(dir, "page_2.json"), "{ invalid json");

      const liveData = mockApiResponse(100, [{ id: "live_fix", projectId: "p1" }]);
      mockedAxios.get.mockResolvedValue({ data: liveData });

      const res = await service.fetchScanArtifacts(2);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(res).toEqual(liveData);
      // Should overwrite corrupt file
      const content = fs.readFileSync(path.join(dir, "page_2.json"), "utf8");
      const parsed = JSON.parse(content) as ApiResponse;
      expect(parsed).toEqual(liveData);
    });
  });

  describe("C. File / Path Sanitization", () => {
    it("should sanitize env name for folder", async () => {
      const dirtyEnv = "Prod/Lowes GAMMA!!";
      const sanitaryService = new TestSpatialService("domain.com", dirtyEnv);
      const responseData = mockApiResponse(10);
      mockedAxios.get.mockResolvedValue({ data: responseData });

      await sanitaryService.fetchScanArtifacts(1);

      // Expected: prod_lowes_gamma__
      // "Prod/Lowes GAMMA!!" -> replace non-alnum with _ -> Prod_Lowes_GAMMA__ -> lower -> prod_lowes_gamma__
      const expectedFolder = "prod_lowes_gamma__";
      const cacheDir = path.join(tempDir, "data", "api_cache", expectedFolder);
      expect(fs.existsSync(cacheDir)).toBe(true);
    });
  });

  describe("D. Request Configuration", () => {
    it("constructs correct URL and options", async () => {
      const responseData = mockApiResponse(5);
      mockedAxios.get.mockResolvedValue({ data: responseData });

      await service.fetchScanArtifacts(3);

      expect(mockedAxios.get).toHaveBeenCalledWith("https://api.bondxlowes.com/spatial/v1/scan-artifacts?page=3", {
        timeout: 60000
      });
    });
  });

  describe("E. Error Cases", () => {
    it("propagates network failures", async () => {
      mockedAxios.get.mockRejectedValue(new Error("Network Error"));

      await expect(service.fetchScanArtifacts(1)).rejects.toThrow("Network Error");
    });

    it("treats corrupted meta as missing/invalid (invalidates cache)", async () => {
      // Arrange: Corrupt meta
      const dir = getCachePath();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "meta.json"), "{ bad json");

      const responseData = mockApiResponse(100);
      mockedAxios.get.mockResolvedValue({ data: responseData });

      // Act: First call will try to read meta, fail parse (catch block returns null), so cacheValid -> false
      await service.fetchScanArtifacts(1);

      // Assert: Logic typically overwrites meta if invalid/missing
      const content = fs.readFileSync(path.join(dir, "meta.json"), "utf8");
      const savedMeta = JSON.parse(content) as { total: number };
      expect(savedMeta.total).toBe(100);
    });
  });
});
