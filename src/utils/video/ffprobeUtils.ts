import { execFile } from "child_process";

import ffmpeg from "fluent-ffmpeg";

export const BYTES_PER_KILOBYTE = 1024;
export const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;
const DEFAULT_FFPROBE_BUFFER_MB = 50;
export const DEFAULT_FFPROBE_MAX_BUFFER = DEFAULT_FFPROBE_BUFFER_MB * BYTES_PER_MEGABYTE;

/**
 * Internal helper to wrap fluent-ffmpeg's ffprobe in a promise.
 */
export async function getFfprobeData(filePath: string): Promise<ffmpeg.FfprobeData> {
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
 * Executes ffprobe with the given arguments and returns stdout as a string.
 * Node's execFile always returns Error objects and string/Buffer output.
 */
export async function runFfprobe(args: string[], maxBuffer: number = DEFAULT_FFPROBE_MAX_BUFFER): Promise<string> {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("ffprobe", args, { maxBuffer }, (err: Error | null, output: string) => {
      if (err !== null) {
        reject(err);
        return;
      }
      resolve(output);
    });
  });
  return stdout;
}
