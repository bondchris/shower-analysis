import { describe, expect, it } from "vitest";
import { ObjectItem } from "../../../../../src/models/rawScan/objectItem";
import { RawScan } from "../../../../../src/models/rawScan/rawScan";
import {
  buildObjectBoxes,
  findVanityCandidate,
  getVanityLengths,
  getVanityType
} from "../../../../../src/utils/room/vanity/vanityAnalysis";

describe("vanityAnalysis", () => {
  const identityTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const createBaseRawScan = (): RawScan =>
    ({
      coreModel: "test-model",
      doors: [],
      floors: [],
      objects: [],
      openings: [],
      referenceOriginTransform: [],
      sections: [],
      story: 1,
      version: 1,
      walls: [],
      windows: []
    }) as unknown as RawScan;

  describe("findVanityCandidate", () => {
    it("should detect normal vanity when storage and sink intersect on same story with additional sink on different story", () => {
      const rawScan = createBaseRawScan();

      const storage: ObjectItem = {
        category: { storage: {} },
        dimensions: [1.0, 0.5, 0.6],
        identifier: "storage1",
        story: 0,
        transform: identityTransform
      } as unknown as ObjectItem;

      const sinkOnSameStory: ObjectItem = {
        category: { sink: {} },
        dimensions: [0.5, 0.3, 0.2],
        identifier: "sink1",
        story: 0,
        transform: identityTransform
      } as unknown as ObjectItem;

      const sinkOnDifferentStory: ObjectItem = {
        category: { sink: {} },
        dimensions: [0.5, 0.3, 0.2],
        identifier: "sink2",
        story: 1,
        transform: identityTransform
      } as unknown as ObjectItem;

      rawScan.objects = [storage, sinkOnDifferentStory, sinkOnSameStory];

      const result = findVanityCandidate(rawScan);

      expect(result.vanityType).toBe("normal");
      expect(result.selectedObject).toBe(storage);
    });
  });

  describe("buildObjectBoxes", () => {
    it("should build bounding boxes for valid objects", () => {
      const rawScan = createBaseRawScan();
      rawScan.objects.push({
        category: { sink: {} },
        dimensions: [0.5, 0.3, 0.2],
        identifier: "sink1",
        story: 0,
        transform: identityTransform
      } as unknown as ObjectItem);

      const boxes = buildObjectBoxes(rawScan);

      expect(boxes.length).toBe(1);
      expect(boxes[0]?.isSink).toBe(true);
      expect(boxes[0]?.corners.length).toBe(4);
    });
  });

  describe("getVanityLengths", () => {
    it("should return vanity length when normal vanity exists", () => {
      const rawScan = createBaseRawScan();

      const storage: ObjectItem = {
        category: { storage: {} },
        dimensions: [1.2, 0.5, 0.6],
        identifier: "storage1",
        story: 0,
        transform: identityTransform
      } as unknown as ObjectItem;

      const sink: ObjectItem = {
        category: { sink: {} },
        dimensions: [0.5, 0.3, 0.2],
        identifier: "sink1",
        story: 0,
        transform: identityTransform
      } as unknown as ObjectItem;

      rawScan.objects = [storage, sink];

      const lengths = getVanityLengths(rawScan);

      expect(lengths).toEqual([1.2]);
    });
  });

  describe("getVanityType", () => {
    it("should return vanity type", () => {
      const rawScan = createBaseRawScan();

      const result = getVanityType(rawScan);

      expect(result).toBe("no vanity");
    });
  });
});
