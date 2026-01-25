import { Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactAnalysis } from "../../../src/models/artifactAnalysis";
import { ChartConfiguration } from "../../../src/models/chart/chartConfiguration";
import { buildScanAnalysisReport } from "../../../src/templates/scanAnalysisReport";
import {
  OBJECT_CATEGORY_KEYS,
  type ObjectCategoryKey,
  collectAllObjectViewTimes
} from "../../../src/utils/scan/objectViewTime";

vi.mock("../../../src/utils/scan/objectViewTime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/utils/scan/objectViewTime")>();
  return {
    ...actual,
    collectAllObjectViewTimes: vi.fn()
  };
});

function createEmptyViewTimes(): Record<ObjectCategoryKey, number[]> {
  const result: Record<string, number[]> = {};
  for (const key of OBJECT_CATEGORY_KEYS) {
    result[key] = [];
  }
  return result as Record<ObjectCategoryKey, number[]>;
}

describe("scanAnalysisReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate a report with title Scan Analysis and artifact subtitle", () => {
    const metadataList: ArtifactAnalysis[] = [new ArtifactAnalysis(), new ArtifactAnalysis()];
    const report = buildScanAnalysisReport(metadataList, 2);

    expect(report.title).toBe("Scan Analysis");
    expect(report.subtitle).toBe("Artifacts: 2");
  });

  it("should have no chart sections when artifactDirs is not provided", () => {
    const metadataList: ArtifactAnalysis[] = [new ArtifactAnalysis()];
    const report = buildScanAnalysisReport(metadataList, 1);

    expect(report.sections.length).toBe(0);
    expect(collectAllObjectViewTimes).not.toHaveBeenCalled();
  });

  it("should have no chart sections when artifactDirs is empty", () => {
    const metadataList: ArtifactAnalysis[] = [new ArtifactAnalysis()];
    const report = buildScanAnalysisReport(metadataList, 1, []);

    expect(report.sections.length).toBe(0);
    expect(collectAllObjectViewTimes).not.toHaveBeenCalled();
  });

  it("should have no chart when no category yields view time data", () => {
    (collectAllObjectViewTimes as Mock).mockReturnValue(createEmptyViewTimes());
    const metadataList: ArtifactAnalysis[] = [new ArtifactAnalysis()];
    const artifactDirs = ["/artifacts/a", "/artifacts/b"];
    const report = buildScanAnalysisReport(metadataList, 2, artifactDirs);

    expect(report.sections.length).toBe(0);
    expect(collectAllObjectViewTimes).toHaveBeenCalledWith(artifactDirs);
  });

  it("should include Time with Toilet in View chart when toilet yields view times", () => {
    const viewTimes = createEmptyViewTimes();
    viewTimes.toilet = [5, 10, 15];
    (collectAllObjectViewTimes as Mock).mockReturnValue(viewTimes);

    const metadataList: ArtifactAnalysis[] = [new ArtifactAnalysis()];
    const artifactDirs = ["/artifacts/a", "/artifacts/b", "/artifacts/c"];
    const report = buildScanAnalysisReport(metadataList, 3, artifactDirs);

    expect(report.sections.length).toBe(1);
    const chartSection = report.sections[0];
    expect(chartSection?.type).toBe("chart");
    expect(chartSection?.title).toBe("Time with Toilet in View");
    expect((chartSection?.data as ChartConfiguration).type).toBe("line");
    expect(collectAllObjectViewTimes).toHaveBeenCalledWith(artifactDirs);
  });

  it("should include a chart per category that yields view time data", () => {
    const viewTimes = createEmptyViewTimes();
    viewTimes.toilet = [2, 4, 6];
    viewTimes.sink = [2, 4, 6];
    (collectAllObjectViewTimes as Mock).mockReturnValue(viewTimes);

    const metadataList: ArtifactAnalysis[] = [new ArtifactAnalysis()];
    const artifactDirs = ["/artifacts/a", "/artifacts/b"];
    const report = buildScanAnalysisReport(metadataList, 2, artifactDirs);

    expect(report.sections.length).toBe(2);
    const titles = report.sections.map((s) => s.title);
    expect(titles).toContain("Time with Toilet in View");
    expect(titles).toContain("Time with Sink in View");
  });
});
