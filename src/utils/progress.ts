import cliProgress from "cli-progress";

export const createProgressBar = (format?: string): cliProgress.SingleBar => {
  return new cliProgress.SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: format ?? " {bar} | {percentage}% | {value}/{total} | ETA: {eta}s",
      hideCursor: true
    },
    cliProgress.Presets.shades_classic
  );
};
