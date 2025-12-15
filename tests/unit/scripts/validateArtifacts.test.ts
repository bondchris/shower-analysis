/* eslint-disable simple-import-sort/imports, sort-imports */
import * as fs from "fs";

import {
  EnvStats,
  applyArtifactToStats,
  generateReport,
  validateEnvironment
} from "../../../src/scripts/validateArtifacts";
import { Artifact } from "../../../src/services/spatialService";

// --- Mocks ---
const mockFetchScanArtifacts = jest.fn();
jest.mock("../../../src/services/spatialService", () => {
  return {
    SpatialService: jest.fn().mockImplementation(() => {
      return {
        fetchScanArtifacts: mockFetchScanArtifacts
      };
    })
  };
});

// PDFKit Mock
const mockPipe = jest.fn();
const mockText = jest.fn().mockReturnThis();
const mockFontSize = jest.fn().mockReturnThis();
const mockMoveDown = jest.fn().mockReturnThis();
const mockImage = jest.fn().mockReturnThis();
const mockAddPage = jest.fn().mockReturnThis();
const mockFont = jest.fn().mockReturnThis();
const mockEnd = jest.fn();

jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => ({
    addPage: mockAddPage,
    end: mockEnd,
    fill: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    font: mockFont,
    fontSize: mockFontSize,
    image: mockImage,
    lineTo: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    moveDown: mockMoveDown,
    moveTo: jest.fn().mockReturnThis(),
    page: { height: 800, width: 600 },
    pipe: mockPipe,
    rect: jest.fn().mockReturnThis(),
    restore: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    text: mockText,
    widthOfString: jest.fn().mockImplementation((str: string) => str.length * 5),
    y: 100
  }));
});

// FS Mock
jest.mock("fs", () => ({
  createWriteStream: jest.fn().mockReturnValue({}),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// ChartUtils Mock
jest.mock("../../../src/utils/chartUtils", () => ({
  createBarChart: jest.fn().mockResolvedValue(Buffer.from("chart")),
  createLineChart: jest.fn().mockResolvedValue(Buffer.from("chart")),
  createMixedChart: jest.fn().mockResolvedValue(Buffer.from("chart"))
}));

// Stream Mock to handle 'finished'
jest.mock("stream", (): typeof import("stream") => {
  const actual = jest.requireActual<typeof import("stream")>("stream");
  return Object.assign({}, actual, {
    finished: ((_s: unknown, cb: () => void) => {
      // invokes callback immediately to simulate stream finish
      cb();
      return () => {
        // no-op cleanup
      };
    }) as unknown as typeof import("stream").finished
  }) as unknown as typeof import("stream");
});

describe("validateArtifacts script", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("applyArtifactToStats", () => {
    let stats: EnvStats;

    beforeEach(() => {
      stats = {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: "Test Env",
        pageErrors: {},
        processed: 0,
        propertyCounts: {},
        totalArtifacts: 0,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: {}
      };
    });

    const createArtifact = (overrides: Partial<Artifact> = {}): Artifact =>
      ({
        arData: "s3://ar",
        id: "test-id",
        projectId: "test-project",
        rawScan: "s3://raw",
        scanDate: "2025-12-14T10:00:00Z",
        video: "s3://video",
        ...overrides
      }) as unknown as Artifact;

    it("should count a valid artifact as processed and successful", () => {
      const artifact = createArtifact();
      applyArtifactToStats(stats, artifact);

      expect(stats.processed).toBe(1);
      expect(stats.artifactsWithIssues).toBe(0);
      expect(stats.totalScansByDate["2025-12-14"]).toBe(1);
      expect(stats.cleanScansByDate["2025-12-14"]).toBe(1);
    });

    it("should detect missing required fields", () => {
      const artifact = createArtifact({ id: undefined } as unknown as Partial<Artifact>);
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts["id"]).toBe(1);
      expect(stats.errorsByDate["2025-12-14"]).toBe(1);
      expect(stats.cleanScansByDate["2025-12-14"]).toBeUndefined();
    });

    it("should handle invalid dates (0001-01-01)", () => {
      const artifact = createArtifact({ scanDate: "0001-01-01T00:00:00Z" });
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithIssues).toBe(1);
      expect(stats.missingCounts["scanDate (invalid)"]).toBe(1);
      expect(stats.totalScansByDate["0001-01-01"]).toBeUndefined();
    });

    it("should detect missing warnings (projectId)", () => {
      const artifact = createArtifact({ projectId: undefined } as unknown as Partial<Artifact>);
      applyArtifactToStats(stats, artifact);

      expect(stats.artifactsWithWarnings).toBe(1);
      expect(stats.warningCounts["projectId"]).toBe(1);
    });

    it("should track dynamic properties", () => {
      const artifact = createArtifact({
        extraField: "some value",
        pointCloud: "s3://pc"
      } as unknown as Partial<Artifact>);
      applyArtifactToStats(stats, artifact);

      expect(stats.propertyCounts["id"]).toBe(1);
      expect(stats.propertyCounts["extraField"]).toBe(1);
      expect(stats.propertyCounts["pointCloud"]).toBe(1);
    });
  });

  describe("validateEnvironment", () => {
    it("should process all pages and summarize stats", async () => {
      mockFetchScanArtifacts
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        })
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "2", projectId: "p1", rawScan: "r", scanDate: "2025-01-02T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        });

      jest.spyOn(console, "log").mockImplementation(() => {
        // no-op
      });

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.name).toBe("Test Env");
      expect(stats.totalArtifacts).toBe(2);
      expect(stats.processed).toBe(2);
      expect(mockFetchScanArtifacts).toHaveBeenCalledTimes(2);
    });

    it("should handle fetch errors gracefully", async () => {
      mockFetchScanArtifacts
        .mockResolvedValueOnce({
          data: [{ arData: "a", id: "1", projectId: "p1", rawScan: "r", scanDate: "2025-01-01T10:00:00Z", video: "v" }],
          pagination: { lastPage: 2, total: 2 }
        })
        .mockRejectedValueOnce(new Error("Network Error"));

      jest.spyOn(console, "error").mockImplementation(() => {
        // no-op
      });
      jest.spyOn(console, "log").mockImplementation(() => {
        // no-op
      });

      const stats = await validateEnvironment({ domain: "test.com", name: "Test Env" });

      expect(stats.processed).toBe(1);
      expect(stats.totalArtifacts).toBe(2);
    });
  });

  describe("generateReport", () => {
    it("should create a PDF and add charts", async () => {
      const stats: EnvStats = {
        artifactsWithIssues: 1,
        artifactsWithWarnings: 1,
        cleanScansByDate: { "2025-01-01": 1 },
        errorsByDate: { "2025-01-01": 1 },
        missingCounts: { id: 1 },
        name: "Env 1",
        pageErrors: {},
        processed: 2,
        propertyCounts: { id: 2 },
        totalArtifacts: 2,
        totalScansByDate: { "2025-01-01": 2 },
        warningCounts: { projectId: 1 },
        warningsByDate: { "2025-01-01": 1 }
      };

      jest.spyOn(console, "log").mockImplementation(() => {
        // no-op
      });

      await generateReport([stats]);

      expect(fs.createWriteStream).toHaveBeenCalledWith(expect.stringContaining("validation-report.pdf"));
      expect(mockText).toHaveBeenCalledWith("Validation Report", expect.anything());

      // Check for chart pages
      expect(mockAddPage).toHaveBeenCalled();
      expect(mockImage).toHaveBeenCalled();
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should handle empty data gracefully", async () => {
      await generateReport([]);

      expect(mockText).toHaveBeenCalledWith("Validation Report", expect.anything());
      expect(mockText).toHaveBeenCalledWith("No environments / no data.", expect.anything());
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should truncate long headers to fit column width", async () => {
      const longName = "Very Long Environment Name That Will Definitely Truncate";
      const stats = {
        artifactsWithIssues: 0,
        artifactsWithWarnings: 0,
        cleanScansByDate: {},
        errorsByDate: {},
        missingCounts: {},
        name: longName,
        pageErrors: {},
        processed: 0,
        propertyCounts: {},
        totalArtifacts: 0,
        totalScansByDate: {},
        warningCounts: {},
        warningsByDate: {}
      };

      // Pass many environments to force narrow columns
      const manyStats = Array(10).fill(stats) as EnvStats[];
      await generateReport(manyStats);

      // Verify that the long name was not drawn fully
      expect(mockText).not.toHaveBeenCalledWith(longName, expect.anything());
      // Verify that a truncated version ending in "..." was drawn
      expect(mockText).toHaveBeenCalledWith(
        expect.stringMatching(/.*\.\.\.$/),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
