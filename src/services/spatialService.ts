import axios from "axios";
import * as fs from "fs";
import * as path from "path";

import { logger } from "../utils/logger";

export interface Artifact {
  id: string;
  projectId?: string | null;
  scanDate?: string;
  rawScan?: string;
  arData?: string;
  video?: string;
  pointCloud?: string | null;
  slowedArData?: string | null;
  slowedVideo?: string | null;
  scanNotes?: string | null;
  scanSuccess?: string;
  initialLayout?: string | null;
  initialVisualization?: string | null;
  showerDetections?: string | null;
}

export interface Pagination {
  currentPage: number;
  from: number;
  lastPage: number;
  perPage: number;
  to: number;
  total: number;
}

export interface ApiResponse {
  data: Artifact[];
  pagination: Pagination;
}

/**
 * Service to fetch Scan Artifacts from the Spatial API.
 * Includes a local filesystem cache to speed up repeated runs and development.
 * Cache invalidation is based on the total count of items on the server.
 */
export class SpatialService {
  protected readonly envName: string;
  private readonly domain: string;
  private cacheValid = false;
  private hasValidatedCache = false;

  constructor(domain: string, envName: string) {
    this.domain = domain;
    this.envName = envName;
  }

  /**
   * Fetches a specific page of scan artifacts.
   *
   * Flow:
   * 1. If cache not yet validated: Fetch fresh data to check "Total" count.
   * 2. If valid cache exists: Serve from local disk.
   * 3. Else: Network fetch and update cache.
   */
  public async fetchScanArtifacts(page: number): Promise<ApiResponse> {
    // If we haven't validated the cache yet, force a network fetch to check freshness
    if (!this.hasValidatedCache) {
      return this.fetchAndValidate(page);
    }

    // Use cache if confirmed valid
    if (this.cacheValid) {
      const cached = this.loadPageFromCache(page);
      if (cached !== null) {
        return cached;
      }
    }

    // Fallback to network fetch
    const res = await this.networkFetch(page);
    this.savePageToCache(page, res);
    return res;
  }

  protected getCacheDir(): string {
    const CACHE_DIR = path.join(process.cwd(), "data", "api_cache");
    return path.join(CACHE_DIR, this.envName.replace(/[^a-z0-9]/gi, "_").toLowerCase());
  }

  private async fetchAndValidate(page: number): Promise<ApiResponse> {
    const res = await this.networkFetch(page);
    const serverTotal = res.pagination.total;

    const meta = this.getCacheMeta();
    this.cacheValid = meta !== null && meta.total === serverTotal;
    this.hasValidatedCache = true;

    if (this.cacheValid) {
      logger.info("Cache is valid. Using cached pages.");
    } else {
      logger.info("Cache is invalid or missing. Fetching fresh data.");
      this.saveCacheMeta(serverTotal);
    }

    // Always update the current page in cache
    this.savePageToCache(page, res);
    return res;
  }

  private async networkFetch(page: number): Promise<ApiResponse> {
    const TIMEOUT_MS = 60000;
    const url = `https://api.${this.domain}/spatial/v1/scan-artifacts?page=${page.toString()}`;
    const res = await axios.get<ApiResponse>(url, { timeout: TIMEOUT_MS });
    return res.data;
  }

  private getCacheMeta(): { total: number } | null {
    try {
      const dir = this.getCacheDir();
      const metaPath = path.join(dir, "meta.json");
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { total: number };
      }
    } catch {
      // ignore
    }
    return null;
  }

  private saveCacheMeta(total: number): void {
    const dir = this.getCacheDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const INDENT = 2;
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({ date: new Date().toISOString(), total }, null, INDENT)
    );
  }

  private loadPageFromCache(page: number): ApiResponse | null {
    try {
      const dir = this.getCacheDir();
      const pagePath = path.join(dir, `page_${page.toString()}.json`);
      if (fs.existsSync(pagePath)) {
        return JSON.parse(fs.readFileSync(pagePath, "utf-8")) as ApiResponse;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private savePageToCache(page: number, data: ApiResponse): void {
    const dir = this.getCacheDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const INDENT = 2;
    fs.writeFileSync(path.join(dir, `page_${page.toString()}.json`), JSON.stringify(data, null, INDENT));
  }
}
