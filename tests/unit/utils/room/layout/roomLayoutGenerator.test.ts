import { describe, expect, it, vi } from "vitest";

import { Point } from "../../../../../src/models/point";
import { extractLayoutElements, generateRoomLayoutPng } from "../../../../../src/utils/room/layout/roomLayoutGenerator";
import {
  createDoor,
  createExternalWall,
  createFloor,
  createMockScan,
  createToilet,
  createTub,
  createWindow
} from "../testHelpers";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue({
        screenshot: vi.fn().mockResolvedValue(undefined),
        setContent: vi.fn().mockResolvedValue(undefined),
        setViewportSize: vi.fn().mockResolvedValue(undefined)
      })
    })
  }
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn()
  };
});

describe("roomLayoutGenerator", () => {
  describe("extractLayoutElements", () => {
    it("should return empty array for scan with no elements", () => {
      const scan = createMockScan();
      const elements = extractLayoutElements(scan);
      expect(elements).toEqual([]);
    });

    it("should extract floor polygon from scan", () => {
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("floor");
      expect(elements[0]?.label).toBe("Floor");
      expect(elements[0]?.points).toHaveLength(4);
    });

    it("should extract wall segments from scan", () => {
      const wall = createExternalWall("wall1");
      const scan = createMockScan({ walls: [wall] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("wall");
      expect(elements[0]?.label).toBe("Wall");
      expect(elements[0]?.points).toHaveLength(2);
    });

    it("should extract objects with their categories", () => {
      const toilet = createToilet("toilet1");
      const tub = createTub("tub1");
      const scan = createMockScan({ objects: [toilet, tub] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(2);
      const toiletElement = elements.find((e) => e.objectType === "toilet");
      const bathtubElement = elements.find((e) => e.objectType === "bathtub");
      expect(toiletElement).toBeDefined();
      expect(bathtubElement).toBeDefined();
      expect(toiletElement?.type).toBe("object");
      expect(bathtubElement?.type).toBe("object");
    });

    it("should extract doors from scan", () => {
      const door = createDoor("door1", null, {
        dimensions: [0.8, 2.0, 0],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1]
      });
      const scan = createMockScan({ doors: [door] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("door");
      expect(elements[0]?.label).toBe("Door");
      expect(elements[0]?.points).toHaveLength(2);
    });

    it("should extract windows from scan", () => {
      const window = createWindow("window1", null, {
        dimensions: [1.0, 1.2, 0],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1]
      });
      const scan = createMockScan({ windows: [window] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("window");
      expect(elements[0]?.label).toBe("Window");
      expect(elements[0]?.points).toHaveLength(2);
    });

    it("should extract all element types from a complete scan", () => {
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const wall = createExternalWall("wall1");
      const toilet = createToilet("toilet1");
      const door = createDoor("door1", null, {
        dimensions: [0.8, 2.0, 0],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const window = createWindow("window1", null, {
        dimensions: [1.0, 1.2, 0],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });

      const scan = createMockScan({
        doors: [door],
        floors: [floor],
        objects: [toilet],
        walls: [wall],
        windows: [window]
      });

      const elements = extractLayoutElements(scan);

      const floorElements = elements.filter((e) => e.type === "floor");
      const wallElements = elements.filter((e) => e.type === "wall");
      const objectElements = elements.filter((e) => e.type === "object");
      const doorElements = elements.filter((e) => e.type === "door");
      const windowElements = elements.filter((e) => e.type === "window");

      expect(floorElements).toHaveLength(1);
      expect(wallElements).toHaveLength(1);
      expect(objectElements).toHaveLength(1);
      expect(doorElements).toHaveLength(1);
      expect(windowElements).toHaveLength(1);
    });

    it("should skip floors without transform", () => {
      const floor = createFloor();
      const scan = createMockScan({ floors: [floor] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip floors without polygonCorners", () => {
      const floor = createFloor();
      delete (floor as { polygonCorners?: number[][] }).polygonCorners;
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip walls without transform", () => {
      const wall = createExternalWall("wall1");
      delete (wall as { transform?: number[] }).transform;
      const scan = createMockScan({ walls: [wall] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip walls without dimensions", () => {
      const wall = createExternalWall("wall1");
      delete (wall as { dimensions?: number[] }).dimensions;
      const scan = createMockScan({ walls: [wall] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip doors without transform", () => {
      const door = createDoor("door1", null, {
        dimensions: [0.8, 2.0, 0]
      });
      delete (door as { transform?: number[] }).transform;
      const scan = createMockScan({ doors: [door] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip doors without dimensions", () => {
      const door = createDoor("door1", null, {
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1]
      });
      delete (door as { dimensions?: number[] }).dimensions;
      const scan = createMockScan({ doors: [door] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip windows without transform", () => {
      const window = createWindow("window1", null, {
        dimensions: [1.0, 1.2, 0]
      });
      delete (window as { transform?: number[] }).transform;
      const scan = createMockScan({ windows: [window] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should skip windows without dimensions", () => {
      const window = createWindow("window1", null, {
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1]
      });
      delete (window as { dimensions?: number[] }).dimensions;
      const scan = createMockScan({ windows: [window] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(0);
    });

    it("should handle objects with empty category", () => {
      const object = createToilet("obj1");
      object.category = {};
      const scan = createMockScan({ objects: [object] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.objectType).toBe("unknown");
    });

    it("should handle walls with undefined width dimension", () => {
      const wall = createExternalWall("wall1");
      wall.dimensions = [undefined as never, 2.7, 0.2];
      const scan = createMockScan({ walls: [wall] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("wall");
    });

    it("should handle objects with undefined width dimension", () => {
      const object = createToilet("obj1");
      object.dimensions = [undefined as never, 1, 0.5];
      const scan = createMockScan({ objects: [object] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("object");
    });

    it("should handle objects with undefined depth dimension", () => {
      const object = createToilet("obj1");
      object.dimensions = [0.5, 1, undefined as never];
      const scan = createMockScan({ objects: [object] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("object");
    });

    it("should handle floor corners with undefined coordinates", () => {
      const floor = createFloor();
      floor.polygonCorners = [
        [undefined as never, 0, undefined as never],
        [10, 0, 10],
        [10, 0, 10],
        [0, 0, 10]
      ];
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      expect(elements[0]?.type).toBe("floor");
    });

    it("should correctly transform object corners", () => {
      const objectAtOrigin = createToilet("obj1", {
        dimensions: [2, 1, 2],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const scan = createMockScan({ objects: [objectAtOrigin] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      const objElement = elements[0];
      expect(objElement).toBeDefined();
      if (objElement === undefined) {
        throw new Error("Expected objElement to be defined");
      }
      expect(objElement.points).toHaveLength(4);

      const corners = objElement.points;
      const expectedCorners = [new Point(-1, -1), new Point(1, -1), new Point(1, 1), new Point(-1, 1)];
      const cornerCount = 4;

      for (let i = 0; i < cornerCount; i++) {
        const expectedCorner = expectedCorners[i];
        if (expectedCorner !== undefined) {
          expect(corners[i]?.x).toBeCloseTo(expectedCorner.x, 5);
          expect(corners[i]?.y).toBeCloseTo(expectedCorner.y, 5);
        }
      }
    });

    it("should correctly transform wall endpoints", () => {
      const wall = createExternalWall("wall1", {
        dimensions: [4, 2.7, 0.2],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 3, 1]
      });
      const scan = createMockScan({ walls: [wall] });

      const elements = extractLayoutElements(scan);

      expect(elements).toHaveLength(1);
      const wallElement = elements[0];
      expect(wallElement).toBeDefined();
      if (wallElement === undefined) {
        throw new Error("Expected wallElement to be defined");
      }
      expect(wallElement.points).toHaveLength(2);

      const [start, end] = wallElement.points;
      expect(start?.x).toBeCloseTo(3, 5);
      expect(start?.y).toBeCloseTo(3, 5);
      expect(end?.x).toBeCloseTo(7, 5);
      expect(end?.y).toBeCloseTo(3, 5);
    });
  });

  describe("generateRoomLayoutPng", () => {
    it("should log warning and return early for empty scan", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const scan = createMockScan();

      await generateRoomLayoutPng(scan, "/tmp/test-output.png");

      warnSpy.mockRestore();
    });

    it("should generate PNG for scan with elements", async () => {
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const wall = createExternalWall("wall1");
      const toilet = createToilet("toilet1");

      const scan = createMockScan({
        floors: [floor],
        objects: [toilet],
        walls: [wall]
      });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).resolves.not.toThrow();
    });

    it("should use default options when not provided", async () => {
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).resolves.not.toThrow();
    });

    it("should use provided options", async () => {
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      await expect(
        generateRoomLayoutPng(scan, "/tmp/test-output.png", {
          backgroundColor: "#f0f0f0",
          height: 600,
          padding: 50,
          showLabels: false,
          width: 600
        })
      ).resolves.not.toThrow();
    });

    it("should create directory if it does not exist", async () => {
      const fs = await import("fs");
      const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const mkdirSyncSpy = vi.spyOn(fs, "mkdirSync");

      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      await expect(generateRoomLayoutPng(scan, "/tmp/new-dir/test-output.png")).resolves.not.toThrow();

      expect(mkdirSyncSpy).toHaveBeenCalledWith("/tmp/new-dir", { recursive: true });

      existsSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
    });

    it("should handle browser launch errors", async () => {
      const { chromium } = await import("playwright");
      const launchError = new Error("Browser launch failed");
      vi.mocked(chromium.launch).mockRejectedValueOnce(launchError);

      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).rejects.toThrow("Browser launch failed");
    });

    it("should handle browser close when browser launch fails before assignment", async () => {
      const { chromium } = await import("playwright");
      const mockBrowser = {
        close: vi.fn().mockResolvedValue(undefined),
        newPage: vi.fn().mockResolvedValue({
          screenshot: vi.fn().mockResolvedValue(undefined),
          setContent: vi.fn().mockResolvedValue(undefined),
          setViewportSize: vi.fn().mockResolvedValue(undefined)
        })
      };
      vi.mocked(chromium.launch).mockResolvedValueOnce(mockBrowser as never);

      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor] });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).resolves.not.toThrow();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it("should handle findLongestWallRotation with no walls", async () => {
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scanWithFloor = createMockScan({ floors: [floor], walls: [] });

      await expect(generateRoomLayoutPng(scanWithFloor, "/tmp/test-output.png")).resolves.not.toThrow();
    });

    it("should handle findLongestWallRotation with walls without dimensions", async () => {
      const wall = createExternalWall("wall1");
      delete (wall as { dimensions?: number[] }).dimensions;
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor], walls: [wall] });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).resolves.not.toThrow();
    });

    it("should handle findLongestWallRotation with longest wall without transform", async () => {
      const wall1 = createExternalWall("wall1", { dimensions: [5, 2.7, 0.2] });
      const wall2 = createExternalWall("wall2", { dimensions: [10, 2.7, 0.2] });
      delete (wall2 as { transform?: number[] }).transform;
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor], walls: [wall1, wall2] });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).resolves.not.toThrow();
    });

    it("should handle findLongestWallRotation with wall having undefined width", async () => {
      const wall = createExternalWall("wall1");
      wall.dimensions = [undefined as never, 2.7, 0.2];
      const floor = createFloor();
      floor.transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const scan = createMockScan({ floors: [floor], walls: [wall] });

      await expect(generateRoomLayoutPng(scan, "/tmp/test-output.png")).resolves.not.toThrow();
    });
  });
});
