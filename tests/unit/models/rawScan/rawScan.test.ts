import { describe, expect, it } from "vitest";

import { RawScan } from "../../../../src/models/rawScan/rawScan";

describe("RawScan Model", () => {
  const VALID_PAYLOAD = {
    coreModel: "test-model",
    doors: [],
    floors: [],
    objects: [],
    openings: [],
    sections: [],
    story: 1,
    version: 1,
    walls: [],
    windows: []
  };

  describe("Happy Path", () => {
    it("should instantiate successfully with valid data", () => {
      const scan = new RawScan(VALID_PAYLOAD);
      expect(scan.version).toBe(1);
      expect(scan.coreModel).toBe("test-model");
      expect(scan.floors).toEqual([]);
      expect(scan.walls).toEqual([]);
    });

    it("should instantiate sub-models (floors, walls) when provided", () => {
      const payload = {
        ...VALID_PAYLOAD,
        floors: [
          {
            category: { floor: {} },
            confidence: { high: {} },
            dimensions: [10, 0, 10],
            parentIdentifier: null,
            polygonCorners: [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10]
            ],
            story: 1
          }
        ],
        walls: [
          {
            category: { wall: {} },
            confidence: { high: {} },
            dimensions: [10, 2.7, 0.2],
            identifier: "w1",
            parentIdentifier: null,
            polygonCorners: [
              [0, 0],
              [10, 0]
            ],
            story: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
          }
        ]
      };
      const scan = new RawScan(payload);
      expect(scan.floors).toHaveLength(1);
      const floor = scan.floors[0];
      if (!floor) {
        throw new Error("Floor missing");
      }
      expect(floor.constructor.name).toBe("Floor");

      expect(scan.walls).toHaveLength(1);
      const wall = scan.walls[0];
      if (!wall) {
        throw new Error("Wall missing");
      }
      expect(wall.constructor.name).toBe("Wall");
    });

    it("should allow optional referenceOriginTransform", () => {
      const payload = {
        ...VALID_PAYLOAD,
        referenceOriginTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      };
      const scan = new RawScan(payload);
      expect(scan.referenceOriginTransform).toHaveLength(16);
    });

    it("should default referenceOriginTransform to empty array if missing", () => {
      const scan = new RawScan(VALID_PAYLOAD);
      expect(scan.referenceOriginTransform).toEqual([]);
    });

    it("should handle missing optional fields (windows, doors, openings)", () => {
      const minimalPayload: Record<string, unknown> = { ...VALID_PAYLOAD };
      delete minimalPayload["windows"];
      delete minimalPayload["doors"];
      delete minimalPayload["openings"];

      const scan = new RawScan(minimalPayload);
      expect(scan.windows).toEqual([]);
      expect(scan.doors).toEqual([]);
      expect(scan.openings).toEqual([]);
    });
  });

  describe("Top-level Validation", () => {
    it("should throw if input is not an object", () => {
      expect(() => new RawScan(null)).toThrow("Invalid raw scan: data must be an object");
      expect(() => new RawScan("string")).toThrow("Invalid raw scan: data must be an object");
    });
  });

  describe("Field Validation", () => {
    it("should throw on invalid version", () => {
      const payload = { ...VALID_PAYLOAD, version: "1" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "version"');
    });

    it("should throw on invalid sections", () => {
      const payload = { ...VALID_PAYLOAD, sections: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "sections" array');
    });

    it("should throw on invalid coreModel", () => {
      const payload = { ...VALID_PAYLOAD, coreModel: 123 };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "coreModel" string');
    });

    it("should throw on invalid floors", () => {
      const payload = { ...VALID_PAYLOAD, floors: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "floors" array');
    });

    it("should throw on invalid walls", () => {
      const payload = { ...VALID_PAYLOAD, walls: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "walls" array');
    });

    it("should throw on invalid objects", () => {
      const payload = { ...VALID_PAYLOAD, objects: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "objects" array');
    });

    it("should throw on invalid windows", () => {
      const payload = { ...VALID_PAYLOAD, windows: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "windows" array');
    });

    it("should throw on invalid doors", () => {
      const payload = { ...VALID_PAYLOAD, doors: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "doors" array');
    });

    it("should throw on invalid story", () => {
      const payload = { ...VALID_PAYLOAD, story: "1" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "story" number');
    });

    it("should throw on invalid openings", () => {
      const payload = { ...VALID_PAYLOAD, openings: "invalid" };
      expect(() => new RawScan(payload)).toThrow('Invalid raw scan: missing or invalid "openings" array');
    });

    it("should throw on invalid referenceOriginTransform", () => {
      const payload = { ...VALID_PAYLOAD, referenceOriginTransform: "invalid" };
      expect(() => new RawScan(payload)).toThrow(
        'Invalid raw scan: missing or invalid "referenceOriginTransform" array'
      );
    });
  });
});
