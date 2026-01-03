import { afterEach, describe, expect, it, vi } from "vitest";

import { sortDeviceModels } from "../../../src/utils/deviceSorting";

describe("sortDeviceModels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the default iPad rank for uncommon models", () => {
    const originalIncludes = String.prototype.includes;
    const callCounts: Record<string, number> = {};

    const includesOverride = function (this: string, searchString: string, position?: number): boolean {
      if (this === "ipad unknown" && searchString === "ipad") {
        const key = `${this}-${searchString}`;
        callCounts[key] = (callCounts[key] ?? 0) + 1;

        // Allow detection as an iPad during filtering, but force the default rank during classification.
        if (callCounts[key] === 3) {
          return false;
        }
        return true;
      }

      return originalIncludes.call(this, searchString, position);
    };

    const includesSpy = vi.spyOn(String.prototype, "includes").mockImplementation(includesOverride);

    const result = sortDeviceModels({ "iPad Unknown": 1 });

    expect(result.deviceLabels).toEqual(["iPad Unknown"]);
    expect(result.deviceCounts).toEqual([1]);
    expect(result.separatorLabel).toBeUndefined();

    includesSpy.mockRestore();
  });
});
