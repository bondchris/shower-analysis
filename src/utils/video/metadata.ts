import * as fs from "fs";
import * as path from "path";

import ffmpeg from "fluent-ffmpeg";

export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

/**
 * Internal helper to wrap ffprobe in a promise.
 */
async function getFfprobeData(filePath: string): Promise<ffmpeg.FfprobeData> {
  const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err !== null && err !== undefined) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        resolve(metadata);
      }
    });
  });
  return data;
}

/**
 * Extracts metadata from a video file in the given directory.
 * Returns null if the video file does not exist or metadata cannot be parsed.
 * Caches results in videoMetadata.json to avoid redundant processing.
 */
export async function extractVideoMetadata(dirPath: string): Promise<VideoMetadata | null> {
  const metaCachePath = path.join(dirPath, "videoMetadata.json");
  const JSON_INDENT = 2;

  // 1. Check Cache
  if (fs.existsSync(metaCachePath)) {
    try {
      const cachedContent = fs.readFileSync(metaCachePath, "utf-8");
      return JSON.parse(cachedContent) as VideoMetadata;
    } catch {
      // If cache is corrupt, proceed to extraction
    }
  }

  const videoPath = path.join(dirPath, "video.mp4");
  const EXPECTED_PARTS = 2;
  const NUMERATOR_IDX = 0;
  const DENOMINATOR_IDX = 1;
  const RADIX = 10;
  const ZERO_DENOMINATOR = 0;
  const DEFAULT_DIMENSION = 0;
  const DEFAULT_FPS = 0;
  const DEFAULT_DURATION = 0;

  if (fs.existsSync(videoPath)) {
    try {
      const vidMeta = await getFfprobeData(videoPath);
      const stream = vidMeta.streams.find((s) => s.codec_type === "video");

      const result: VideoMetadata = {
        duration: DEFAULT_DURATION,
        fps: DEFAULT_FPS,
        height: DEFAULT_DIMENSION,
        width: DEFAULT_DIMENSION
      };

      if (stream) {
        if (stream.width !== undefined && stream.height !== undefined) {
          result.width = stream.width;
          result.height = stream.height;
        }
        if (stream.r_frame_rate !== undefined) {
          const parts = stream.r_frame_rate.split("/");
          if (
            parts.length === EXPECTED_PARTS &&
            parts[NUMERATOR_IDX] !== undefined &&
            parts[DENOMINATOR_IDX] !== undefined
          ) {
            const num = parseInt(parts[NUMERATOR_IDX], RADIX);
            const den = parseInt(parts[DENOMINATOR_IDX], RADIX);
            if (den !== ZERO_DENOMINATOR) {
              result.fps = Math.round(num / den);
            }
          }
        }
      }

      const format = vidMeta.format;
      if (format.duration !== undefined) {
        result.duration = format.duration;
      }

      // Persist to cache
      try {
        fs.writeFileSync(metaCachePath, JSON.stringify(result, null, JSON_INDENT));
      } catch {
        // If write fails, still return the result
      }

      return result;
    } catch {
      return null;
    }
  }
  return null;
}
