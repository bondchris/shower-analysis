import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";

export async function downloadFile(url: string, outputPath: string, label = "file"): Promise<string | null> {
  const TIMEOUT_MS = 30000;

  if (fs.existsSync(outputPath)) {
    return null;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const tmpPath = `${outputPath}.tmp`;

  try {
    const res = await axios.get<NodeJS.ReadableStream>(url, { responseType: "stream", timeout: TIMEOUT_MS });
    const writer = fs.createWriteStream(tmpPath);

    await pipeline(res.data, writer);

    fs.renameSync(tmpPath, outputPath); // atomic replace on same filesystem
    return null;
  } catch (error: unknown) {
    // cleanup temp
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      /* ignore */
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status !== undefined ? ` (${String(error.response.status)})` : "";
      return `${label} download failed${status}`;
    }
    return `${label} download failed (Unknown: ${String(error)})`;
  }
}

export async function downloadJsonFile(url: string, outputPath: string, label: string): Promise<string | null> {
  const TIMEOUT_MS = 30000;
  const JSON_INDENT = 2;

  if (fs.existsSync(outputPath)) {
    return null;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const tmpPath = `${outputPath}.tmp`;

  try {
    const res = await axios.get<unknown>(url, { responseType: "json", timeout: TIMEOUT_MS });
    fs.writeFileSync(tmpPath, JSON.stringify(res.data, null, JSON_INDENT));
    fs.renameSync(tmpPath, outputPath);
    return null;
  } catch (error: unknown) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      /* ignore */
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status !== undefined ? ` (${String(error.response.status)})` : "";
      return `${label} download failed${status}`;
    }
    return `${label} download failed (Unknown: ${String(error)})`;
  }
}
