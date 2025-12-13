import { Door } from "../../../src/models/rawScan/door";
import { FloorData } from "../../../src/models/rawScan/floor";
import { ObjectItem } from "../../../src/models/rawScan/objectItem";
import { Opening } from "../../../src/models/rawScan/opening";
import { RawScan, RawScanData } from "../../../src/models/rawScan/rawScan";
import { WallData } from "../../../src/models/rawScan/wall";
import { Window } from "../../../src/models/rawScan/window";

// --- HELPERS ---

// Mock helper to create a minimal valid RawScan
export const createMockScan = (overrides: Partial<RawScanData> = {}): RawScan => {
  const defaults: RawScanData = {
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
  return new RawScan({ ...defaults, ...overrides });
};

// Helper: Floor
export const createFloor = (story = 1): FloorData => ({
  category: { floor: {} },
  confidence: { high: {} },
  dimensions: [10, 0, 10], // X, Y, Z
  parentIdentifier: null,
  polygonCorners: [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, 10],
    [0, 0, 10]
  ],
  story
});

// Helper: External Wall
export const createExternalWall = (id: string, overrides: Partial<WallData> = {}): WallData => ({
  category: { wall: {} },
  confidence: { high: {} },
  dimensions: [10, 2.7, 0.2],
  identifier: id,
  parentIdentifier: null,
  polygonCorners: [
    [-5, 0],
    [5, 0]
  ],
  story: 1,
  transform: [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    5,
    0,
    0,
    1 // tx=5
  ],
  ...overrides
});

// Helper: Internal Wall
export const createInternalWall = (id: string): WallData => ({
  category: { wall: {} },
  confidence: { high: {} },
  dimensions: [2, 2.7, 0.2],
  identifier: id,
  parentIdentifier: null,
  polygonCorners: [
    [-1, 0],
    [1, 0]
  ],
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 5, 0, 1]
});

// Helper: Opening
export const createOpening = (id: string, parentId: string | null, overrides: Partial<Opening> = {}): Opening => ({
  category: { opening: {} },
  completedEdges: [],
  confidence: { high: {} },
  curve: null,
  dimensions: [],
  identifier: id,
  parentIdentifier: parentId,
  polygonCorners: [],
  story: 1,
  transform: [],
  ...overrides
});

// Helper: Door
export const createDoor = (id: string, parentId: string | null, overrides: Partial<Door> = {}): Door => ({
  category: { door: { isOpen: false } },
  completedEdges: [],
  confidence: { high: {} },
  curve: null,
  dimensions: [],
  identifier: id,
  parentIdentifier: parentId,
  polygonCorners: [],
  story: 1,
  transform: [],
  ...overrides
});

// Helper: Window
export const createWindow = (id: string, parentId: string | null, overrides: Partial<Window> = {}): Window => ({
  category: { window: {} },
  completedEdges: [],
  confidence: { high: {} },
  curve: null,
  dimensions: [],
  identifier: id,
  parentIdentifier: parentId,
  polygonCorners: [],
  story: 1,
  transform: [],
  ...overrides
});

// Helper: Toilet
export const createToilet = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { toilet: {} },
  confidence: { high: {} },
  dimensions: [0.5, 1, 0.5],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  ...overrides
});

// Helper: Tub
export const createTub = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { bathtub: {} },
  confidence: { high: {} },
  dimensions: [1.5, 0.5, 0.7],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1],
  ...overrides
});

// Helper: Sink
export const createSink = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { sink: {} },
  confidence: { high: {} },
  dimensions: [0.5, 0.5, 0.5],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  ...overrides
});

// Helper: Storage
export const createStorage = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { storage: {} },
  confidence: { high: {} },
  dimensions: [0.5, 1.0, 0.5],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  ...overrides
});

// Helper: Generic Object
export const createObject = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
  attributes: {},
  category: { toilet: {} },
  confidence: { high: {} },
  dimensions: [1, 1, 1],
  identifier: id,
  parentIdentifier: null,
  story: 1,
  transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Origin
  ...overrides
});
