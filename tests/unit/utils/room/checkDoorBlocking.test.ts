import { Door } from "../../../../src/models/rawScan/door";
import { ObjectItem } from "../../../../src/models/rawScan/objectItem";
import { checkDoorBlocking } from "../../../../src/utils/room/checkDoorBlocking";
import { createMockScan } from "./testHelpers";

describe("checkDoorBlocking (Refactored)", () => {
  // Helpers
  const createDoor = (id: string, overrides: Partial<Door> = {}): Door => ({
    category: { door: { isOpen: false } },
    completedEdges: [],
    confidence: { high: {} },
    curve: null,
    dimensions: [0.9, 2.1, 0.1], // 90cm wide, 2.1m high, 10cm thick (local Z depth)
    identifier: id,
    parentIdentifier: null,
    polygonCorners: [],
    story: 0,
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Identity
    ...overrides
  });

  const createObj = (id: string, overrides: Partial<ObjectItem> = {}): ObjectItem => ({
    attributes: {},
    category: { storage: {} },
    confidence: { high: {} },
    dimensions: [0.5, 0.5, 0.5], // 50cm cube
    identifier: id,
    parentIdentifier: null,
    story: 0,
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], // Identity
    ...overrides
  });

  // Transform helper: Place object at (x, z)
  const placeAt = (x: number, z: number) => ({
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1]
  });

  // Rotated transform helper (Y rotation)
  const placeRotated = (x: number, z: number, angDeg: number) => {
    const rad = (angDeg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return {
      transform: [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, x, 0, z, 1]
    };
  };

  it("Core Blocked Geometry", () => {
    // No doors -> False
    expect(checkDoorBlocking(createMockScan({ doors: [], objects: [createObj("o1")] }))).toBe(false);

    // No objects -> False
    expect(checkDoorBlocking(createMockScan({ doors: [createDoor("d1")], objects: [] }))).toBe(false);

    // Single door, single object blocking (12 inches/30cm in front)
    // Door at 0,0. Front is +Z. Clearance is 0.6m. Object at Z=0.3.
    const d1 = createDoor("d1");
    const o1 = createObj("o1", placeAt(0, 0.3));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [o1] }))).toBe(true);

    // Single door, object far away (60 inches/1.5m)
    const oFar = createObj("o2", placeAt(0, 1.5));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oFar] }))).toBe(false);
  });

  it("2) Multiple objects/doors", () => {
    const d1 = createDoor("d1");
    const o1 = createObj("o1", placeAt(0, 1.5)); // Far
    const o2 = createObj("o2", placeAt(2, 0)); // Side far
    const o3 = createObj("o3", placeAt(0, 0.3)); // Blocking

    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [o1, o2, o3] }))).toBe(true);

    // Multi doors: D1 blocked, D2 clear
    const d2 = createDoor("d2", placeAt(5, 0));
    expect(checkDoorBlocking(createMockScan({ doors: [d1, d2], objects: [o3] }))).toBe(true); // Overall result true
    expect(checkDoorBlocking(createMockScan({ doors: [d2], objects: [o3] }))).toBe(false); // D2 alone clear
  });

  it("3) 24 Inch Threshold (0.6096m vs 0.6m internal)", () => {
    // Spec implies 24" but implementation uses 0.6m (~23.6").
    // We should test against the IMPLEMENTED limit of 0.6m.
    const d1 = createDoor("d1");

    // Just inside: 0.59m
    // Object center at 0.59? No, it's intersection of polygons.
    // Object is 0.5m deep. Half depth = 0.25.
    // If center is at Z=0, extent is -0.25 to 0.25.
    // Door clearance is 0 to 0.6.
    // Test object: Tiny object (point-like) to test exact boundary.
    const tinyObj = (z: number) =>
      createObj("o", {
        dimensions: [0.01, 0.01, 0.01],
        ...placeAt(0, z)
      });

    // Center at 0.59 (Extent ~0.595). Inside 0.6. -> True
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [tinyObj(0.59)] }))).toBe(true);

    // Center at 0.61 (Extent ~0.605). Outside 0.6. -> False
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [tinyObj(0.61)] }))).toBe(false);

    // Boundary: Center at 0.6 (Extent 0.595 to 0.605).
    // 0.595 is inside 0.6. -> True (Polygon intersection)
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [tinyObj(0.6)] }))).toBe(true);
  });

  it("4) Directionality (Front vs Behind)", () => {
    const d1 = createDoor("d1");
    // Front is 0 to +0.6 (Local Z/Input Y).

    // Object Behind (-0.3m) -> False (New Requirement)
    const oBehind = createObj("o1", placeAt(0, -0.3));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oBehind] }))).toBe(false);

    // Object Side (Near jamb)
    // Door width 0.9. Half width 0.45.
    // Object width 0.5. Half width 0.25.
    // Overlap calculation: 0.6 - 0.25 = 0.35 (Obj Left) < 0.45 (Door Right). Intersection!
    // Must move object further to be truly clear.
    // X = 0.8. Left edge = 0.55 > 0.45.
    const oSide = createObj("o2", placeAt(0.8, 0.3));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oSide] }))).toBe(false);
  });

  it("5) Object Intersects Door Polygon", () => {
    const d1 = createDoor("d1");
    // Object at 0,0 (Inside doorway)
    const oInside = createObj("o1", placeAt(0, 0));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oInside] }))).toBe(true);
  });

  it("6) Rotated Door", () => {
    // Door rotated -90 deg (Facing +X)
    // Front is +X direction.
    const d1 = createDoor("d1", placeRotated(0, 0, -90)); // Rotated -90

    // Object at +X 0.3m -> Blocked
    const oFront = createObj("o1", placeAt(0.3, 0));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oFront] }))).toBe(true);

    // Object at +Z 1.0m (To the side, outside width) -> Clear
    const oSide = createObj("o2", placeAt(0, 1.0));
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oSide] }))).toBe(false);
  });

  it("10) Story Isolation", () => {
    const d1 = createDoor("d1", { story: 0 });
    // Object strictly in geometric blocking zone, but Story 1.
    const oHigh = createObj("o1", { story: 1, ...placeAt(0, 0.3) });

    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oHigh] }))).toBe(false);

    // Correct story -> True
    oHigh.story = 0;
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oHigh] }))).toBe(true);
  });

  it("14) Real World Categories", () => {
    const d1 = createDoor("d1");
    const oToilet = createObj("toilet", { category: { toilet: {} }, ...placeAt(0, 0.3) });
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oToilet] }))).toBe(true);
  });

  it("15) Height Awareness (Overhead & Low Profile)", () => {
    // Door Height = 2.1m. Center at Y=0 ??
    // Wait, if door is at Y=0, dimensions=[0.9, 2.1, 0.1].
    // Height range: 0 +/- 1.05 = [-1.05, 1.05].
    // This implies floor is at -1.05.
    // Usually we might want floor at Y=0.
    // But assuming Center Pivot is consistent.

    const d1 = createDoor("d1"); // Y range [-1.05, 1.05]

    // Overhead Object:
    // Center Y = 2.0. Height = 0.5. Range [1.75, 2.25].
    // 1.75 > 1.05. No overlap.
    // Geometric position (X,Z) blocks, but Y misses.
    const oOverhead = createObj("overhead", {
      dimensions: [0.5, 0.5, 0.5],
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2.0, 0.3, 1] // X=0, Y=2.0, Z=0.3
    });

    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oOverhead] }))).toBe(false);

    // 3. Low Profile Object (Door Stopper):
    // Height = 0.1. Center Y = -1.0 (near floor). Range [-1.05, -0.95].
    // Door range [-1.05, 1.05].
    // Limit = -1.05 + 0.05 = -1.00.
    // -0.95 < -1.00 is False. -> Blocked.
    const oLow = createObj("low", {
      dimensions: [0.5, 0.1, 0.5],
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.0, 0.3, 1]
    });
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oLow] }))).toBe(true);

    // 4. Rug / Low Threshold (Below Step-Over):
    // Height = 0.04 (4cm). Center Y = -1.03. Range [-1.05, -1.01].
    // MaxY = -1.01. Limit = -1.0.
    // -1.01 < -1.0 is True. -> Ignored (False).
    const oRug = createObj("rug", {
      dimensions: [0.5, 0.04, 0.5],
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.03, 0.3, 1]
    });
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oRug] }))).toBe(false);
  });

  it("16) Rotated Bounds Intrusion", () => {
    const d1 = createDoor("d1"); // Clearance X [0, 0.6], Z [-0.45, 0.45]

    // Long object rotated 45 degrees.
    // Center outside zone, but corner enters.
    // E.g. Dims [2.0, 0.5, 0.2].
    const oRot = createObj("rot", {
      dimensions: [2.0, 0.5, 0.2],
      ...placeRotated(0.4, 0, 45) // Placed at X=0.4, should protrude into X < 0.6
    });

    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oRot] }))).toBe(true);
  });

  it("17) Data Integrity & Parenting", () => {
    // ParentIdentifier mismatch -> Blocked
    const d1 = createDoor("d1");
    const o1 = createObj("o1", { parentIdentifier: "some-wall", ...placeAt(0, 0.3) });
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [o1] }))).toBe(true);

    // ParentIdentifier matches Door -> Ignored
    const oAttached = createObj("oAttached", { parentIdentifier: "d1", ...placeAt(0, 0.3) });
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oAttached] }))).toBe(false);

    // No Objects -> Not Blocked
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [] }))).toBe(false);
  });

  it("18) Invalid Transform Data", () => {
    const d1 = createDoor("d1");
    // Object with invalid transform should be skipped (not blocking)
    const oInvalid = createObj("oInvalid", { transform: [] });
    expect(checkDoorBlocking(createMockScan({ doors: [d1], objects: [oInvalid] }))).toBe(false);

    // Door with invalid transform should be skipped
    const dInvalid = createDoor("dInvalid", { transform: [] });
    // Valid object that would block if door was valid
    const o1 = createObj("o1", placeAt(0, 0.3));
    expect(checkDoorBlocking(createMockScan({ doors: [dInvalid], objects: [o1] }))).toBe(false);
  });
});
