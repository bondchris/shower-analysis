import { Door } from "../../../../src/models/rawScan/door";
import { FloorData } from "../../../../src/models/rawScan/floor";
import { checkDoorFloorContact } from "../../../../src/utils/room/analysis/checkDoorFloorContact";
import { TOUCHING_THRESHOLD_METERS } from "../../../../src/utils/room/constants";
import { createDoor, createFloor, createMockScan } from "./testHelpers";

describe("checkDoorFloorContact", () => {
  const MAT_TY_IDX = 13;

  // Helper to create a door with specific Y position and height
  const createDoorAtY = (id: string, centerY: number, height: number, overrides: Partial<Door> = {}): Door => {
    const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, centerY, 0, 1];
    transform[MAT_TY_IDX] = centerY;
    return createDoor(id, null, {
      dimensions: [0.9, height, 0.1],
      transform,
      ...overrides
    });
  };

  // Helper to create a floor with specific Y transform
  const createFloorAtY = (y: number, overrides: Partial<FloorData> = {}): FloorData => {
    const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, y, 0, 1];
    transform[MAT_TY_IDX] = y;
    return {
      ...createFloor(1),
      transform,
      ...overrides
    };
  };

  describe("Basic functionality", () => {
    it("should return false when no doors exist", () => {
      const scan = createMockScan({ doors: [], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should return false when door touches floor (door bottom at floor level)", () => {
      const doorHeight = 2.1; // 2.1m door
      const doorCenterY = doorHeight / 2; // Center at 1.05m, so bottom is at 0
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should return true when door does not touch floor (door floating above)", () => {
      const doorHeight = 2.1;
      const doorCenterY = 1.0; // Center at 1.0m, bottom at -0.05m (floating)
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(true);
    });

    it("should return true when door bottom is more than threshold away from floor", () => {
      const doorHeight = 2.1;
      const gap = TOUCHING_THRESHOLD_METERS + 0.01; // Just over threshold
      const halfDoorHeight = doorHeight / 2;
      const doorCenterY = halfDoorHeight + gap; // Bottom will be at gap distance
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(true);
    });

    it("should return false when door bottom is just under threshold distance", () => {
      const doorHeight = 2.1;
      const gap = TOUCHING_THRESHOLD_METERS - 0.001; // Just under threshold
      const halfDoorHeight = doorHeight / 2;
      const doorCenterY = halfDoorHeight + gap;
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });
  });

  describe("Floor level determination", () => {
    it("should use default Y=0 when no floors exist", () => {
      const doorHeight = 2.1;
      const doorCenterY = doorHeight / 2; // Bottom at 0
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const scan = createMockScan({ doors: [door], floors: [] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should use floor transform Y when floor has transform", () => {
      const floorY = 0.1; // Floor at 0.1m
      const doorHeight = 2.1;
      const halfDoorHeight = doorHeight / 2;
      const doorCenterY = floorY + halfDoorHeight; // Door bottom at floor level
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const floor = createFloorAtY(floorY);
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should use polygonCorners Y when floor has no transform but has polygonCorners", () => {
      const cornerY = 0.15; // Floor corner Y coordinate
      const doorHeight = 2.1;
      const halfDoorHeight = doorHeight / 2;
      const doorCenterY = cornerY + halfDoorHeight; // Door bottom at floor level
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const floor: FloorData = {
        ...createFloor(1),
        polygonCorners: [
          [0, cornerY, 0],
          [10, cornerY, 0],
          [10, cornerY, 10],
          [0, cornerY, 10]
        ]
      };
      delete floor.transform;
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should handle floor with polygonCorners but first corner missing Y coordinate", () => {
      const doorHeight = 2.1;
      const doorCenterY = doorHeight / 2; // Bottom at 0 (default)
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const floor: FloorData = {
        ...createFloor(1),
        polygonCorners: [[0], [10, 0, 0]] // First corner missing Y
      };
      delete floor.transform;
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should handle floor with empty polygonCorners", () => {
      const doorHeight = 2.1;
      const doorCenterY = doorHeight / 2;
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const floor: FloorData = {
        ...createFloor(1),
        polygonCorners: []
      };
      delete floor.transform;
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should handle floor with transform but wrong length", () => {
      const doorHeight = 2.1;
      const doorCenterY = doorHeight / 2;
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const floor: FloorData = {
        ...createFloor(1),
        polygonCorners: [
          [0, 0, 0],
          [10, 0, 0]
        ],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0] as unknown as number[] // Wrong length
      };
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });
  });

  describe("Door validation", () => {
    it("should skip doors with invalid transform length", () => {
      const validDoor = createDoorAtY("d1", 1.05, 2.1);
      const invalidDoor = createDoor("d2", null, {
        dimensions: [0.9, 2.1, 0.1],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0] // Wrong length
      });
      const scan = createMockScan({ doors: [validDoor, invalidDoor], floors: [createFloor()] });
      // Should only check validDoor, which touches floor
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should return true if any door has invalid transform but another door floats", () => {
      const invalidDoor = createDoor("d1", null, {
        dimensions: [0.9, 2.1, 0.1],
        transform: [] // Invalid
      });
      const floatingDoor = createDoorAtY("d2", 1.5, 2.1); // Floating above floor
      const scan = createMockScan({ doors: [invalidDoor, floatingDoor], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(true);
    });
  });

  describe("Multiple doors", () => {
    it("should return true if any door does not touch floor", () => {
      const touchingDoor = createDoorAtY("d1", 1.05, 2.1); // Touches floor
      const floatingDoor = createDoorAtY("d2", 1.5, 2.1); // Floats above
      const scan = createMockScan({ doors: [touchingDoor, floatingDoor], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(true);
    });

    it("should return false if all doors touch floor", () => {
      const door1 = createDoorAtY("d1", 1.05, 2.1);
      const door2 = createDoorAtY("d2", 1.05, 2.1);
      const scan = createMockScan({ doors: [door1, door2], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle door below floor level", () => {
      const doorHeight = 2.1;
      const doorCenterY = -0.5; // Center at -0.5m, bottom at -1.55m (below floor)
      const door = createDoorAtY("d1", doorCenterY, doorHeight);
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(true);
    });

    it("should handle door with zero height", () => {
      const door = createDoorAtY("d1", 0, 0);
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should handle door with missing dimensions", () => {
      const door = createDoor("d1", null, {
        dimensions: [],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      });
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      // Should use default value 0 for height, so doorMinY = 0 - 0 = 0
      expect(checkDoorFloorContact(scan)).toBe(false);
    });

    it("should handle door with missing transform Y coordinate", () => {
      const transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      transform[MAT_TY_IDX] = undefined as unknown as number;
      const door = createDoor("d1", null, {
        dimensions: [0.9, 2.1, 0.1],
        transform
      });
      const scan = createMockScan({ doors: [door], floors: [createFloor()] });
      // Should use default value 0, so doorMinY = 0 - 1.05 = -1.05
      expect(checkDoorFloorContact(scan)).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    it("should detect floating door in typical bathroom", () => {
      const doorHeight = 2.1; // Standard door height
      const doorCenterY = 1.2; // Door floating 0.15m above floor
      const door = createDoorAtY("bathroom-door", doorCenterY, doorHeight);
      const floor = createFloor();
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(true);
    });

    it("should pass for properly installed door", () => {
      const doorHeight = 2.1;
      const doorCenterY = doorHeight / 2; // Properly installed
      const door = createDoorAtY("proper-door", doorCenterY, doorHeight);
      const floor = createFloor();
      const scan = createMockScan({ doors: [door], floors: [floor] });
      expect(checkDoorFloorContact(scan)).toBe(false);
    });
  });
});
