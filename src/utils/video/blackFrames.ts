import { spawn } from "child_process";

export interface BlackFrameSegment {
  start: number;
  end: number;
  duration: number;
}

export interface BlackFrameDetectionOptions {
  ffmpegPath?: string;
  minDurationSeconds?: number;
  pixelThreshold?: number;
  pictureThreshold?: number;
  timeoutMs?: number;
}

function parseBlackdetectOutput(output: string): BlackFrameSegment[] {
  const segments: BlackFrameSegment[] = [];
  const linePattern =
    /black_start:(?<start>[-\d.]+)\s+black_end:(?<end>[-\d.]+)\s+black_duration:(?<duration>[-\d.]+)/g;
  const decimalPlaces = 2;
  const minimumDuration = 0;

  let match = linePattern.exec(output);
  while (match !== null) {
    const groups = match.groups ?? {};
    const start = parseFloat(groups["start"] ?? "");
    const end = parseFloat(groups["end"] ?? "");
    const duration = parseFloat(groups["duration"] ?? "");
    const isValid =
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      Number.isFinite(duration) &&
      end >= start &&
      duration > minimumDuration;

    if (isValid) {
      const rounded = (value: number): number => Number(value.toFixed(decimalPlaces));
      segments.push({
        duration: rounded(duration),
        end: rounded(end),
        start: rounded(start)
      });
    }

    match = linePattern.exec(output);
  }

  return segments;
}

export async function detectBlackFrames(
  videoPath: string,
  options?: BlackFrameDetectionOptions
): Promise<BlackFrameSegment[]> {
  const defaultBinary = "ffmpeg";
  const binary = options?.ffmpegPath ?? defaultBinary;
  const defaultMinDurationSeconds = 0.25;
  const minDurationSeconds = options?.minDurationSeconds ?? defaultMinDurationSeconds;
  const defaultPixelThreshold = 0.1;
  const pixelThreshold = options?.pixelThreshold ?? defaultPixelThreshold;
  const defaultPictureThreshold = 0.98;
  const pictureThreshold = options?.pictureThreshold ?? defaultPictureThreshold;
  const defaultTimeoutMs = 90_000;
  const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;
  const minDurationStr = minDurationSeconds.toString();
  const pixelThresholdStr = pixelThreshold.toString();
  const pictureThresholdStr = pictureThreshold.toString();

  const args = [
    "-v",
    "warning",
    "-i",
    videoPath,
    "-vf",
    `blackdetect=d=${minDurationStr}:pix_th=${pixelThresholdStr}:pic_th=${pictureThresholdStr}`,
    "-f",
    "null",
    "-"
  ];

  const segments = await new Promise<BlackFrameSegment[]>((resolve, reject) => {
    const proc = spawn(binary, args);
    const stderrChunks: string[] = [];

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Black frame detection timed out"));
    }, timeoutMs);

    proc.stderr.on("data", (chunk: unknown) => {
      if (typeof chunk === "string") {
        stderrChunks.push(chunk);
        return;
      }
      if (chunk instanceof Buffer) {
        stderrChunks.push(chunk.toString());
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", () => {
      clearTimeout(timer);
      const output = stderrChunks.join("");
      resolve(parseBlackdetectOutput(output));
    });
  });

  return segments;
}

export function parseBlackFrames(output: string): BlackFrameSegment[] {
  return parseBlackdetectOutput(output);
}
