/**
 * Represents the spherical coverage analysis of an AR scan.
 * Tracks how much of the surrounding space was captured by the camera.
 */
export interface CoverageSphere {
  cols: number;
  frameCount: number;
  grid: number[][];
  rows: number;
  sampleCountPerFrame: number;
  sampledSeconds: number;
}
