import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { detectBlackFrames, parseBlackFrames } from "../../../../src/utils/video/blackFrames";

type SpawnMock = (
  ...args: Parameters<typeof import("child_process").spawn>
) => ReturnType<typeof import("child_process").spawn>;
const mockSpawn = vi.fn<SpawnMock>();

vi.mock("child_process", () => ({
  spawn: (...args: Parameters<typeof import("child_process").spawn>) => mockSpawn(...args)
}));

describe("black frame utils", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses ffmpeg blackdetect output into rounded segments", () => {
    const output = `
frame:123 black_start:0 black_end:1.23456 black_duration:1.23456
frame:456 black_start:5.01 black_end:6.999 black_duration:1.989`;
    const result = parseBlackFrames(output);

    expect(result).toEqual([
      { duration: 1.23, end: 1.23, start: 0 },
      { duration: 1.99, end: 7, start: 5.01 }
    ]);
  });

  it("detects black frames from spawned ffmpeg output", async () => {
    const dataHandlers: ((chunk: Buffer) => void)[] = [];
    let closeHandler: (() => void) | undefined;
    const kill = vi.fn();

    mockSpawn.mockReturnValue({
      kill,
      on: (event: string, handler: () => void) => {
        if (event === "close") {
          closeHandler = handler;
        }
      },
      stderr: {
        on: (_event: string, handler: (chunk: Buffer) => void) => {
          dataHandlers.push(handler);
        }
      }
    } as unknown as ReturnType<typeof import("child_process").spawn>);

    const detectionPromise = detectBlackFrames("/mock/video.mp4", { timeoutMs: 500 });
    dataHandlers.forEach((handler) => {
      handler(Buffer.from("black_start:0.5 black_end:1.5 black_duration:1.0"));
    });
    if (closeHandler !== undefined) {
      closeHandler();
    }

    const result = await detectionPromise;
    expect(result).toEqual([{ duration: 1, end: 1.5, start: 0.5 }]);
    expect(kill).not.toHaveBeenCalled();
  });

  it("rejects on timeout and kills the ffmpeg process", async () => {
    vi.useFakeTimers();

    const kill = vi.fn();
    mockSpawn.mockReturnValue({
      kill,
      on: () => undefined,
      stderr: { on: () => undefined }
    } as unknown as ReturnType<typeof import("child_process").spawn>);

    const detectionPromise = detectBlackFrames("/mock/video.mp4", { timeoutMs: 10 });
    const rejectionAssertion = expect(detectionPromise).rejects.toThrow(/timed out/i);
    await vi.runOnlyPendingTimersAsync();
    await rejectionAssertion;
    expect(kill).toHaveBeenCalled();
  });

  it("parses string stderr chunks during detection", async () => {
    const dataHandlers: ((chunk: unknown) => void)[] = [];
    let closeHandler: (() => void) | undefined;
    const kill = vi.fn();

    mockSpawn.mockReturnValue({
      kill,
      on: (event: string, handler: () => void) => {
        if (event === "close") {
          closeHandler = handler;
        }
      },
      stderr: {
        on: (_event: string, handler: (chunk: unknown) => void) => {
          dataHandlers.push(handler);
        }
      }
    } as unknown as ReturnType<typeof import("child_process").spawn>);

    const detectionPromise = detectBlackFrames("/mock/video.mp4", { timeoutMs: 500 });
    dataHandlers.forEach((handler) => {
      handler("black_start:2 black_end:3 black_duration:1");
    });
    if (closeHandler !== undefined) {
      closeHandler();
    }

    const result = await detectionPromise;
    expect(result).toEqual([{ duration: 1, end: 3, start: 2 }]);
    expect(kill).not.toHaveBeenCalled();
  });

  it("uses default detector thresholds when options are omitted", async () => {
    const kill = vi.fn();
    let capturedArgs: string[] = [];
    let closeHandler: (() => void) | undefined;

    mockSpawn.mockReturnValue({
      kill,
      on: (event: string, handler: () => void) => {
        if (event === "close") {
          closeHandler = handler;
        }
      },
      stderr: {
        on: () => undefined
      }
    } as unknown as ReturnType<typeof import("child_process").spawn>);

    // Capture args from the mock implementation
    mockSpawn.mockImplementationOnce((_command: string, args: readonly string[]) => {
      capturedArgs = [...args];
      return {
        kill,
        on: (event: string, handler: () => void) => {
          if (event === "close") {
            closeHandler = handler;
          }
        },
        stderr: {
          on: () => undefined
        }
      } as unknown as ReturnType<typeof import("child_process").spawn>;
    });

    const detectionPromise = detectBlackFrames("/mock/video.mp4");
    closeHandler?.();
    await detectionPromise;

    expect(capturedArgs.slice(0, 3)).toEqual(["-v", "warning", "-i"]);
    expect(capturedArgs.join(" ")).toContain("blackdetect=d=0.25:pix_th=0.1:pic_th=0.98");
    expect(kill).not.toHaveBeenCalled();
  });

  it("ignores non-string, non-buffer stderr chunks", async () => {
    const dataHandlers: ((chunk: unknown) => void)[] = [];
    let closeHandler: (() => void) | undefined;
    const kill = vi.fn();

    mockSpawn.mockReturnValue({
      kill,
      on: (event: string, handler: () => void) => {
        if (event === "close") {
          closeHandler = handler;
        }
      },
      stderr: {
        on: (_event: string, handler: (chunk: unknown) => void) => {
          dataHandlers.push(handler);
        }
      }
    } as unknown as ReturnType<typeof import("child_process").spawn>);

    const detectionPromise = detectBlackFrames("/mock/video.mp4", { timeoutMs: 500 });
    dataHandlers.forEach((handler) => {
      handler({ unexpected: true });
    });
    closeHandler?.();

    const result = await detectionPromise;
    expect(result).toEqual([]);
    expect(kill).not.toHaveBeenCalled();
  });

  it("skips invalid segments with non-positive duration", () => {
    const output = "black_start:0 black_end:0 black_duration:0\nblack_start:2 black_end:1 black_duration:-1";
    const result = parseBlackFrames(output);
    expect(result).toEqual([]);
  });

  it("ignores matches that do not expose capture groups", () => {
    const fakeMatch = [""] as RegExpExecArray;
    Reflect.set(fakeMatch, "groups", undefined);

    const execSpy = vi.spyOn(RegExp.prototype, "exec");
    execSpy.mockReturnValueOnce(fakeMatch).mockReturnValueOnce(null);

    try {
      const result = parseBlackFrames("black_start:0 black_end:1 black_duration:1");
      expect(result).toEqual([]);
    } finally {
      execSpy.mockRestore();
    }
  });

  it("rejects when ffmpeg emits an error and collects string stderr", async () => {
    const dataHandlers: ((chunk: unknown) => void)[] = [];
    let errorHandler: ((err: Error) => void) | undefined;

    mockSpawn.mockReturnValue({
      kill: vi.fn(),
      on: (event: string, handler: (value: unknown) => void) => {
        if (event === "error") {
          errorHandler = handler as (err: Error) => void;
        }
      },
      stderr: {
        on: (_event: string, handler: (chunk: unknown) => void) => {
          dataHandlers.push(handler);
        }
      }
    } as unknown as ReturnType<typeof import("child_process").spawn>);

    const detectionPromise = detectBlackFrames("/mock/video.mp4", { timeoutMs: 1000 });
    dataHandlers.forEach((handler) => {
      handler("black_start:0 black_end:1 black_duration:1");
    });
    errorHandler?.(new Error("spawn failed"));

    await expect(detectionPromise).rejects.toThrow(/spawn failed/);
  });
});
