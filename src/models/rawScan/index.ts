import { Door } from "./door";
import { Floor } from "./floor";
import { ObjectItem } from "./objectItem";
import { Opening } from "./opening";
import { Section } from "./section";
import { Wall } from "./wall";
import { Window } from "./window";

export interface RawScanData {
  version: number;
  sections: Section[];
  coreModel: string;
  floors: Floor[];
  walls: Wall[];
  objects: ObjectItem[];
  windows: Window[];
  doors: Door[];
  referenceOriginTransform?: number[];
  story: number;
  openings: Opening[];
}

export class RawScan {
  public version: number;
  public sections: Section[];
  public coreModel: string;
  public floors: Floor[];
  public walls: Wall[];
  public objects: ObjectItem[];
  public windows: Window[];
  public doors: Door[];
  public referenceOriginTransform: number[];
  public story: number;
  public openings: Opening[];

  constructor(data: unknown) {
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid raw scan: data must be an object");
    }

    const typedData = data as RawScanData;
    const allowedKeys = new Set([
      "version",
      "sections",
      "coreModel",
      "floors",
      "walls",
      "objects",
      "windows",
      "doors",
      "referenceOriginTransform",
      "story",
      "openings"
    ]);

    // Strict Key Validation
    const keys = Object.keys(typedData);
    for (const key of keys) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Invalid raw scan: unknown key "${key}"`);
      }
    }

    // Validate Version
    if (typeof typedData.version !== "number") {
      throw new Error('Invalid raw scan: missing or invalid "version"');
    }
    this.version = typedData.version;

    // Validate Sections
    if (!Array.isArray(typedData.sections)) {
      throw new Error('Invalid raw scan: missing or invalid "sections" array');
    }
    this.sections = typedData.sections;

    // Validate CoreModel
    if (typeof typedData.coreModel !== "string") {
      throw new Error('Invalid raw scan: missing or invalid "coreModel" string');
    }
    this.coreModel = typedData.coreModel;

    // Validate Floors
    if (!Array.isArray(typedData.floors)) {
      throw new Error('Invalid raw scan: missing or invalid "floors" array');
    }
    this.floors = typedData.floors;

    // Validate Walls
    if (!Array.isArray(typedData.walls)) {
      throw new Error('Invalid raw scan: missing or invalid "walls" array');
    }
    this.walls = typedData.walls;

    // Validate Objects
    if (!Array.isArray(typedData.objects)) {
      throw new Error('Invalid raw scan: missing or invalid "objects" array');
    }
    this.objects = typedData.objects;

    // Validate Windows
    if (!Array.isArray(typedData.windows)) {
      throw new Error('Invalid raw scan: missing or invalid "windows" array');
    }
    this.windows = typedData.windows;

    // Validate Doors
    if (!Array.isArray(typedData.doors)) {
      throw new Error('Invalid raw scan: missing or invalid "doors" array');
    }
    this.doors = typedData.doors;

    // Validate ReferenceOriginTransform (Optional)
    if (typedData.referenceOriginTransform !== undefined) {
      if (!Array.isArray(typedData.referenceOriginTransform)) {
        throw new Error('Invalid raw scan: missing or invalid "referenceOriginTransform" array');
      }
      this.referenceOriginTransform = typedData.referenceOriginTransform;
    } else {
      this.referenceOriginTransform = [];
    }

    // Validate Story
    if (typeof typedData.story !== "number") {
      throw new Error('Invalid raw scan: missing or invalid "story" number');
    }
    this.story = typedData.story;

    // Validate Openings
    if (!Array.isArray(typedData.openings)) {
      throw new Error('Invalid raw scan: missing or invalid "openings" array');
    }
    this.openings = typedData.openings;
  }
}
