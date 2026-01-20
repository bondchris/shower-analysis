import { describe, expect, it } from "vitest";
import { MotionMetrics, computeMotionMetrics } from "../../../../../src/utils/arData/metadata/motionMetrics";
import { ValidFrame } from "../../../../../src/utils/arData/metadata/framerateMetrics";

describe("computeMotionMetrics", () => {
  const metersToFeet = 3.28084;

  /**
   * Creates a ValidFrame with a simple camera transform.
   * The transform places the camera at position (x, y, z).
   */
  function createFrame(timestamp: number, x: number, y: number, z: number): ValidFrame {
    // Camera transform is a 4x4 matrix in column-major order
    // Position is in the last column (indices 12, 13, 14)
    const transform = [
      1,
      0,
      0,
      0, // column 0
      0,
      1,
      0,
      0, // column 1
      0,
      0,
      1,
      0, // column 2
      x,
      y,
      z,
      1 // column 3 (position)
    ];
    return { cameraTransform: transform, timestamp };
  }

  it("returns zeros when fewer than 2 frames provided", () => {
    const result = computeMotionMetrics([], 10);

    expect(result).toEqual<MotionMetrics>({
      avgSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0,
      totalDisplacement: 0,
      totalDistanceTraveled: 0
    });
  });

  it("returns zeros when exactly 1 frame provided", () => {
    const frames = [createFrame(0, 0, 0, 0)];
    const result = computeMotionMetrics(frames, 10);

    expect(result).toEqual<MotionMetrics>({
      avgSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0,
      totalDisplacement: 0,
      totalDistanceTraveled: 0
    });
  });

  it("computes total distance traveled for multiple frames", () => {
    // Move 1 meter in x direction, then 1 meter in y direction
    const frames = [createFrame(0, 0, 0, 0), createFrame(1, 1, 0, 0), createFrame(2, 1, 1, 0)];

    const result = computeMotionMetrics(frames, 2);

    // Total distance: 1m + 1m = 2m = 6.56168 ft
    expect(result.totalDistanceTraveled).toBeCloseTo(2 * metersToFeet, 4);
  });

  it("computes displacement as straight-line distance from start to end", () => {
    // Move in a triangle: (0,0) -> (3,0) -> (3,4) -> back near start
    const frames = [
      createFrame(0, 0, 0, 0),
      createFrame(1, 3, 0, 0),
      createFrame(2, 3, 4, 0),
      createFrame(3, 0.5, 0.5, 0) // End near but not at start
    ];

    const result = computeMotionMetrics(frames, 3);

    // Displacement is distance from (0,0,0) to (0.5,0.5,0) = sqrt(0.5)
    const expectedDisplacement = Math.sqrt(0.5) * metersToFeet;
    expect(result.totalDisplacement).toBeCloseTo(expectedDisplacement, 4);
  });

  it("computes average speed as total distance divided by duration", () => {
    const frames = [
      createFrame(0, 0, 0, 0),
      createFrame(5, 10, 0, 0) // 10 meters in 5 seconds
    ];

    const result = computeMotionMetrics(frames, 5);

    // Avg speed: 10m * 3.28084 / 5s = 6.56168 ft/s
    expect(result.avgSpeed).toBeCloseTo((10 * metersToFeet) / 5, 4);
  });

  it("returns zero avgSpeed when totalDuration is zero", () => {
    const frames = [createFrame(0, 0, 0, 0), createFrame(0, 1, 0, 0)];

    const result = computeMotionMetrics(frames, 0);

    expect(result.avgSpeed).toBe(0);
    expect(result.totalDistanceTraveled).toBeCloseTo(metersToFeet, 4);
  });

  it("computes min/max speed with valid 5-second windows", () => {
    // Create frames spanning 10 seconds with varying speeds
    // First 5 seconds: slow movement (0.5m total)
    // Last 5 seconds: fast movement (2.5m total)
    const frames = [
      createFrame(0, 0, 0, 0),
      createFrame(2.5, 0.25, 0, 0),
      createFrame(5, 0.5, 0, 0), // End of slow phase: 0.5m in 5s = 0.1 m/s
      createFrame(7.5, 1.75, 0, 0),
      createFrame(10, 3, 0, 0) // End of fast phase: 2.5m in 5s = 0.5 m/s
    ];

    const result = computeMotionMetrics(frames, 10);

    // Min speed window should capture ~0.1 m/s
    expect(result.minSpeed).toBeCloseTo(0.1 * metersToFeet, 1);
    // Max speed window should capture ~0.5 m/s
    expect(result.maxSpeed).toBeCloseTo(0.5 * metersToFeet, 1);
  });

  it("returns zero min/max speed when no valid 5-second window exists", () => {
    // Frames span only 4 seconds (less than 90% of 5-second window)
    const frames = [createFrame(0, 0, 0, 0), createFrame(2, 1, 0, 0), createFrame(4, 2, 0, 0)];

    const result = computeMotionMetrics(frames, 4);

    expect(result.minSpeed).toBe(0);
    expect(result.maxSpeed).toBe(0);
    // But distance and avg speed should still be computed
    expect(result.totalDistanceTraveled).toBeCloseTo(2 * metersToFeet, 4);
  });

  it("handles frames with identical positions (stationary camera)", () => {
    const frames = [createFrame(0, 5, 5, 5), createFrame(3, 5, 5, 5), createFrame(6, 5, 5, 5)];

    const result = computeMotionMetrics(frames, 6);

    expect(result.totalDistanceTraveled).toBe(0);
    expect(result.totalDisplacement).toBe(0);
    expect(result.avgSpeed).toBe(0);
  });

  it("handles 3D movement correctly", () => {
    // Move diagonally in 3D space
    const frames = [
      createFrame(0, 0, 0, 0),
      createFrame(1, 1, 1, 1) // Distance = sqrt(3) ≈ 1.732m
    ];

    const result = computeMotionMetrics(frames, 1);

    const expectedDistance = Math.sqrt(3) * metersToFeet;
    expect(result.totalDistanceTraveled).toBeCloseTo(expectedDistance, 4);
    expect(result.totalDisplacement).toBeCloseTo(expectedDistance, 4);
  });

  it("handles window boundary conditions correctly", () => {
    // Create frames where window duration is exactly at the 90% threshold (4.5s)
    const frames = [
      createFrame(0, 0, 0, 0),
      createFrame(4.5, 4.5, 0, 0) // Exactly 4.5s = 90% of 5s window
    ];

    const result = computeMotionMetrics(frames, 4.5);

    // Should find a valid window since 4.5s >= 4.5s (90% of 5s)
    expect(result.minSpeed).toBeCloseTo(metersToFeet, 2);
    expect(result.maxSpeed).toBeCloseTo(metersToFeet, 2);
  });

  it("handles negative duration gracefully", () => {
    const frames = [createFrame(0, 0, 0, 0), createFrame(1, 1, 0, 0)];

    const result = computeMotionMetrics(frames, -5);

    // avgSpeed should be 0 since duration <= 0
    expect(result.avgSpeed).toBe(0);
    expect(result.totalDistanceTraveled).toBeCloseTo(metersToFeet, 4);
  });
});
