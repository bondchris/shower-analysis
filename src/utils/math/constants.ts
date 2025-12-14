/**
 * Size of a 4x4 transformation matrix array (flattened).
 */
export const TRANSFORM_SIZE = 16;

/**
 * Small value for floating point comparisons to handle precision errors.
 * 1e-10 is chosen to be smaller than any reasonable architectural detail (sub-nanometer)
 * but larger than typical double-precision accumulation errors.
 */
export const EPSILON = 1e-10;
