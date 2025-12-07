import axios from "axios";

export interface Artifact {
  [key: string]: unknown;
  id: string;
  projectId?: string;
  scanDate?: string;
  rawScan?: string;
  arData?: string;
  video?: string;
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

export async function fetchScanArtifacts(domain: string, page: number): Promise<ApiResponse> {
  const url = `https://api.${domain}/spatial/v1/scan-artifacts?page=${page.toString()}`;
  const res = await axios.get<ApiResponse>(url, { timeout: 60000 });
  return res.data;
}

import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "api_cache");
const INDENT = 2;

function getCacheDir(envName: string): string {
  return path.join(CACHE_DIR, envName.replace(/[^a-z0-9]/gi, "_").toLowerCase());
}

export function getCacheMeta(envName: string): { total: number } | null {
  try {
    const dir = getCacheDir(envName);
    const metaPath = path.join(dir, "meta.json");
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { total: number };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveCacheMeta(envName: string, total: number): void {
  const dir = getCacheDir(envName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ date: new Date().toISOString(), total }, null, INDENT)
  );
}

export function loadPageFromCache(envName: string, page: number): ApiResponse | null {
  try {
    const dir = getCacheDir(envName);
    const pagePath = path.join(dir, `page_${page.toString()}.json`);
    if (fs.existsSync(pagePath)) {
      return JSON.parse(fs.readFileSync(pagePath, "utf-8")) as ApiResponse;
    }
  } catch {
    // ignore
  }
  return null;
}

export function savePageToCache(envName: string, page: number, data: ApiResponse): void {
  const dir = getCacheDir(envName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, `page_${page.toString()}.json`), JSON.stringify(data, null, INDENT));
}
