import cliProgress from "cli-progress";
import { describe, expect, it, vi } from "vitest";

import { createProgressBar } from "../../../src/utils/progress";

vi.mock("cli-progress", () => {
  return {
    default: {
      Presets: { shades_classic: "shades_classic" },
      SingleBar: vi.fn()
    }
  };
});

describe("createProgressBar", () => {
  it("creates a SingleBar with default options", () => {
    createProgressBar();
    expect(cliProgress.SingleBar).toHaveBeenCalledWith(
      expect.objectContaining({
        format: " {bar} | {percentage}% | {value}/{total} | ETA: {eta}s",
        hideCursor: true
      }),
      "shades_classic"
    );
  });

  it("creates a SingleBar with custom format", () => {
    const customFormat = "Loading... {bar}";
    createProgressBar(customFormat);
    expect(cliProgress.SingleBar).toHaveBeenCalledWith(
      expect.objectContaining({
        format: customFormat
      }),
      "shades_classic"
    );
  });
});
