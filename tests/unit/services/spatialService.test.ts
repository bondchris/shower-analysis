import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiResponse, SpatialService } from "../../../src/services/spatialService";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}));

type FsMock = ReturnType<typeof vi.fn>;

describe("SpatialService savePageToCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the cache directory when it is missing", () => {
    const existsSyncMock = fs.existsSync as unknown as FsMock;
    const mkdirSyncMock = fs.mkdirSync as unknown as FsMock;
    const writeFileSyncMock = fs.writeFileSync as unknown as FsMock;
    existsSyncMock.mockReturnValue(false);

    const cacheDir = "/tmp/spatial-cache";
    const spatialService = new SpatialService("bond.dev", "Test");
    vi.spyOn(spatialService as unknown as { getCacheDir(): string }, "getCacheDir").mockReturnValue(cacheDir);

    const apiResponse: ApiResponse = {
      data: [],
      pagination: {
        currentPage: 1,
        from: 0,
        lastPage: 1,
        perPage: 10,
        to: 0,
        total: 0
      }
    };

    (spatialService as unknown as { savePageToCache(page: number, data: ApiResponse): void }).savePageToCache(
      1,
      apiResponse
    );

    expect(existsSyncMock).toHaveBeenCalledWith(cacheDir);
    expect(mkdirSyncMock).toHaveBeenCalledWith(cacheDir, { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith(path.join(cacheDir, "page_1.json"), expect.any(String));
  });
});
