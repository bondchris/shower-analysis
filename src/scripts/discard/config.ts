import * as fs from "fs";
import * as path from "path";
import ffmpeg from "fluent-ffmpeg";

import { DiscardConfig, DiscardOptions } from "./types";

export function buildDiscardConfig(options?: DiscardOptions): DiscardConfig {
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data", "artifacts");
  const envDryRun = process.env["DRY_RUN"] === "1" || process.env["DRY_RUN"] === "true";
  const dryRun = options?.dryRun ?? envDryRun;
  const saveResults = options?.saveResults ?? true;
  const defaultConcurrency = Number(process.env["BATHROOM_FILTER_CONCURRENCY"] ?? "5");
  const concurrency = options?.concurrency ?? defaultConcurrency;
  const defaultMinDuration = 12;

  const config: DiscardConfig = {
    concurrency,
    dataDir,
    dryRun,
    ffprobe: options?.ffprobe ?? ffmpeg.ffprobe,
    fs: options?.fs ?? fs,
    minDuration: options?.minDuration ?? defaultMinDuration,
    saveResults
  };

  if (options?.logger !== undefined) {
    config.logger = options.logger;
  }
  if (options?.now !== undefined) {
    config.now = options.now;
  }
  if (options?.service !== undefined) {
    config.service = options.service;
  }
  if (options?.badScansFile !== undefined) {
    config.badScansFile = options.badScansFile;
  }
  if (options?.checkedScansFile !== undefined) {
    config.checkedScansFile = options.checkedScansFile;
  }
  if (options?.videoHashesFile !== undefined) {
    config.videoHashesFile = options.videoHashesFile;
  }
  if (options?.quarantineDir !== undefined) {
    config.quarantineDir = options.quarantineDir;
  }

  return config;
}
