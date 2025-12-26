import * as fs from "fs";
import * as path from "path";

import { blake3 } from "@noble/hashes/blake3.js";

/**
 * Computes the BLAKE3 hash of a video file.
 * Returns the hash as a hexadecimal string.
 *
 * @param videoPath - Path to the video file
 * @returns The BLAKE3 hash as a hex string, or null if the file cannot be read
 */
export async function hashVideoFile(videoPath: string): Promise<string | null> {
  const BYTES_PER_KB = 1024;
  const KB_PER_MB = 1024;
  const CHUNK_SIZE = BYTES_PER_KB * KB_PER_MB; // 1MB chunks for efficient streaming

  try {
    if (!fs.existsSync(videoPath)) {
      return await Promise.resolve(null);
    }

    // @noble/hashes blake3.create() returns a hasher instance
    const hasher = blake3.create();
    const stream = fs.createReadStream(videoPath, { highWaterMark: CHUNK_SIZE });

    return await new Promise<string | null>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        hasher.update(chunk);
      });

      stream.on("end", () => {
        const hash = hasher.digest();
        // Convert Uint8Array to hex string
        const HEX_BASE = 16;
        const HEX_PADDING = 2;
        const hexHash = Array.from(hash)
          .map((b) => b.toString(HEX_BASE).padStart(HEX_PADDING, "0"))
          .join("");
        resolve(hexHash);
      });

      stream.on("error", (err: Error) => {
        reject(err);
      });
    });
  } catch {
    return null;
  }
}

/**
 * Computes the BLAKE3 hash of a video file in the given artifact directory.
 * Caches the result in videoHash.json to avoid redundant computation.
 *
 * @param dirPath - Path to the artifact directory containing video.mp4
 * @returns The BLAKE3 hash as a hex string, or null if the video cannot be hashed
 */
export async function hashVideoInDirectory(dirPath: string): Promise<string | null> {
  const hashCachePath = path.join(dirPath, "videoHash.json");
  const JSON_INDENT = 2;

  // Check cache
  if (fs.existsSync(hashCachePath)) {
    try {
      const cachedContent = fs.readFileSync(hashCachePath, "utf-8");
      const cached = JSON.parse(cachedContent) as { hash: string };
      const MIN_HASH_LENGTH = 0;
      if (typeof cached.hash === "string" && cached.hash.length > MIN_HASH_LENGTH) {
        return cached.hash;
      }
    } catch {
      // If cache is corrupt, proceed to computation
    }
  }

  const videoPath = path.join(dirPath, "video.mp4");
  const hash = await hashVideoFile(videoPath);

  if (hash !== null) {
    // Persist to cache
    try {
      const cacheData = { hash };
      fs.writeFileSync(hashCachePath, JSON.stringify(cacheData, null, JSON_INDENT));
    } catch {
      // If write fails, still return the hash
    }
  }

  return hash;
}
