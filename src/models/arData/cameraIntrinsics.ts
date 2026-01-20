/**
 * Camera intrinsics matrix stored as a 9-element tuple.
 * Represents the 3x3 intrinsic calibration matrix containing:
 * - Focal lengths (fx, fy)
 * - Principal point (cx, cy)
 * - Skew coefficient
 */
export type Intrinsics9 = [number, number, number, number, number, number, number, number, number];

export const INTRINSICS_SIZE = 9;
