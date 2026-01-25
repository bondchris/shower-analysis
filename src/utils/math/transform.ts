import { Point } from "../../models/point";
import { TRANSFORM_SIZE } from "./constants";
import { dotProduct } from "./vector";

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * A 4x4 transformation matrix stored as a 16-element tuple in column-major order.
 * Used to represent camera pose (rotation and translation) in 3D space.
 */
export type Matrix16 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export const getPosition = (transform: number[]): Point => {
  const X_IDX = 12;
  const Z_IDX = 14;
  const DEFAULT_VALUE = 0;

  // Check if transform is valid (size 16)
  if (transform.length !== TRANSFORM_SIZE) {
    return new Point(DEFAULT_VALUE, DEFAULT_VALUE);
  }
  // Use X (idx 12) and Z (idx 14) for floor plane position
  return new Point(transform[X_IDX] ?? DEFAULT_VALUE, transform[Z_IDX] ?? DEFAULT_VALUE);
};

/**
 * Extracts the full 3D position from a 4x4 transformation matrix.
 * Index 12 = X, Index 13 = Y (vertical), Index 14 = Z
 */
export const getPosition3D = (transform: number[]): Position3D => {
  const X_IDX = 12;
  const Y_IDX = 13;
  const Z_IDX = 14;
  const DEFAULT_VALUE = 0;

  if (transform.length !== TRANSFORM_SIZE) {
    return { x: DEFAULT_VALUE, y: DEFAULT_VALUE, z: DEFAULT_VALUE };
  }
  return {
    x: transform[X_IDX] ?? DEFAULT_VALUE,
    y: transform[Y_IDX] ?? DEFAULT_VALUE,
    z: transform[Z_IDX] ?? DEFAULT_VALUE
  };
};

/**
 * Calculates the dot product of two 3D vectors.
 * Returns a scalar value representing the projection of one vector onto another.
 */
export const dotProduct3D = (a: Position3D, b: Position3D): number => {
  const productX = a.x * b.x;
  const productY = a.y * b.y;
  const productZ = a.z * b.z;
  return productX + productY + productZ;
};

/**
 * Returns a normalized (unit) 3D vector.
 * Returns zero vector if magnitude is below threshold.
 */
export const normalize3D = (vector: Position3D): Position3D => {
  const defaultComponent = 0;
  const minLength = 1e-6;
  const unitMagnitude = 1;
  const lengthSquared = dotProduct3D(vector, vector);
  const length = Math.sqrt(lengthSquared);
  if (length < minLength) {
    return { x: defaultComponent, y: defaultComponent, z: defaultComponent };
  }
  const invLength = unitMagnitude / length;
  return {
    x: vector.x * invLength,
    y: vector.y * invLength,
    z: vector.z * invLength
  };
};

/**
 * Calculates the Euclidean distance between two 3D positions.
 */
export const distance3D = (a: Position3D, b: Position3D): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const dxSquared = dx * dx;
  const dySquared = dy * dy;
  const dzSquared = dz * dz;
  return Math.sqrt(dxSquared + dySquared + dzSquared);
};

/**
 * Extracts the phone tilt angle from a camera transform matrix.
 * Returns the angle in degrees on a full 360° protractor scale:
 * - 0° = camera pointing straight down (phone tilted fully forward)
 * - 90° = camera pointing horizontally forward (phone perpendicular to floor)
 * - 180° = camera pointing straight up (phone tilted fully backward)
 * - 270° = camera pointing horizontally backward (phone past vertical, upside down)
 * - 360° = same as 0° (full rotation)
 *
 * We use:
 * - Forward vector (indices 8,9,10) to measure pitch magnitude (0-180)
 * - Up vector (indices 4,5,6), specifically its Y component, to detect
 *   whether the phone has gone past vertical (upside down).
 *
 * A threshold on upY avoids misclassifying landscape holds (upY ~ 0) as upside down.
 */
export const getPhoneTiltAngle = (transform: number[]): number => {
  const FORWARD_X_IDX = 8;
  const FORWARD_Y_IDX = 9;
  const FORWARD_Z_IDX = 10;
  const UP_Y_IDX = 5;
  const DEFAULT_VALUE = 0;
  const HORIZONTAL_ANGLE = 90;
  const UPSIDE_DOWN_HORIZONTAL_ANGLE = 270;
  const FULL_CIRCLE = 360;
  const DEGREES_IN_SEMICIRCLE = 180;
  const RADIANS_TO_DEGREES = DEGREES_IN_SEMICIRCLE / Math.PI;
  const UPSIDE_DOWN_THRESHOLD = -0.2; // must be clearly negative to treat as past vertical

  if (transform.length !== TRANSFORM_SIZE) {
    return HORIZONTAL_ANGLE;
  }

  const fx = transform[FORWARD_X_IDX] ?? DEFAULT_VALUE;
  const fy = transform[FORWARD_Y_IDX] ?? DEFAULT_VALUE;
  const fz = transform[FORWARD_Z_IDX] ?? DEFAULT_VALUE;
  const upY = transform[UP_Y_IDX] ?? DEFAULT_VALUE;

  // Calculate the magnitude of the horizontal component of the forward vector
  // This correctly accounts for yaw rotation (phone twisted left/right)
  const fxSquared = fx * fx;
  const fzSquared = fz * fz;
  const horizontalMagnitude = Math.sqrt(fxSquared + fzSquared);

  // Calculate pitch: angle between forward vector and horizontal plane
  // Range: [-90°, +90°] where positive = looking up, negative = looking down
  const pitchRadians = Math.atan2(fy, horizontalMagnitude);
  const pitchDegrees = pitchRadians * RADIANS_TO_DEGREES;

  // Determine past-vertical based on the UP vector's Y component.
  // - upY >= threshold: treat as right-side up → angles 0° to 180°
  // - upY < threshold:  treat as upside down → angles 180° to 360°
  // This avoids landscape (upY ~ 0) being misclassified as upside down.
  const isUpsideDown = upY < UPSIDE_DOWN_THRESHOLD;
  // Right-side up:  pitch -90° -> 0°, 0° -> 90°, +90° -> 180°
  // Upside down:    pitch +90° -> 180°, 0° -> 270°, -90° -> 360°
  let protractorAngle = isUpsideDown ? UPSIDE_DOWN_HORIZONTAL_ANGLE - pitchDegrees : HORIZONTAL_ANGLE + pitchDegrees;

  // Normalize to [0, 360)
  protractorAngle %= FULL_CIRCLE;
  if (protractorAngle < DEFAULT_VALUE) {
    protractorAngle += FULL_CIRCLE;
  }

  return protractorAngle;
};

/**
 * Extracts the phone roll angle from a camera transform matrix.
 * Roll is rotation around the camera's forward (Z) axis.
 * Returns the angle in degrees on a full 360° protractor scale:
 * - 0° = phone perfectly upright (right-side up, no roll)
 * - 90° = phone rolled 90° clockwise (when looking at the back of the phone)
 * - 180° = phone rolled upside down
 * - 270° = phone rolled 90° counter-clockwise
 *
 * We extract roll by examining both the camera's RIGHT vector (indices 0,1,2)
 * and the UP vector (indices 4,5,6). Using atan2(-RIGHT.y, UP.y) gives us
 * the full 360° range because:
 * - At 0° roll: RIGHT.y = 0, UP.y = 1 → atan2(0, 1) = 0°
 * - At 90° CW: RIGHT.y = -1, UP.y = 0 → atan2(1, 0) = 90°
 * - At 180°: RIGHT.y = 0, UP.y = -1 → atan2(0, -1) = 180°
 * - At 270° (90° CCW): RIGHT.y = 1, UP.y = 0 → atan2(-1, 0) = -90° → 270°
 *
 * This approach works regardless of the phone's yaw (horizontal rotation).
 */
export const getPhoneRollAngle = (transform: number[]): number => {
  const RIGHT_Y_IDX = 1;
  const UP_Y_IDX = 5;
  const DEFAULT_VALUE = 0;
  const NO_ROLL_ANGLE = 0;
  const FULL_CIRCLE = 360;
  const DEGREES_IN_SEMICIRCLE = 180;
  const RADIANS_TO_DEGREES = DEGREES_IN_SEMICIRCLE / Math.PI;

  if (transform.length !== TRANSFORM_SIZE) {
    return NO_ROLL_ANGLE;
  }

  const rightY = transform[RIGHT_Y_IDX] ?? DEFAULT_VALUE;
  const upY = transform[UP_Y_IDX] ?? DEFAULT_VALUE;

  // Roll angle using atan2(-RIGHT.y, UP.y)
  // The negation of RIGHT.y converts from the standard rotation direction
  // to our convention where positive angles = clockwise roll
  const rollRadians = Math.atan2(-rightY, upY);
  let rollDegrees = rollRadians * RADIANS_TO_DEGREES;

  // Normalize to [0, 360)
  rollDegrees %= FULL_CIRCLE;
  if (rollDegrees < DEFAULT_VALUE) {
    rollDegrees += FULL_CIRCLE;
  }

  return rollDegrees;
};

/**
 * Extracts the phone pan angle from a camera transform matrix, relative to an initial forward direction.
 * Pan is rotation around the vertical (Y) axis - horizontal turning left/right.
 * Returns the angle in degrees on a full 360° compass scale:
 * - 0° = camera pointing same direction as initial (forward at scan start)
 * - 90° = camera turned 90° clockwise (to the right)
 * - 180° = camera turned 180° (facing opposite direction)
 * - 270° = camera turned 90° counter-clockwise (to the left)
 *
 * We project both forward vectors onto the horizontal (XZ) plane and compute the
 * signed angle between them using atan2.
 *
 * @param transform - The current camera transformation matrix (16 elements)
 * @param initialForwardX - X component of initial horizontal forward direction
 * @param initialForwardZ - Z component of initial horizontal forward direction
 */
export const getPhonePanAngle = (transform: number[], initialForwardX: number, initialForwardZ: number): number => {
  const FORWARD_X_IDX = 8;
  const FORWARD_Z_IDX = 10;
  const DEFAULT_VALUE = 0;
  const FULL_CIRCLE = 360;
  const DEGREES_IN_SEMICIRCLE = 180;
  const RADIANS_TO_DEGREES = DEGREES_IN_SEMICIRCLE / Math.PI;
  const NO_PAN_ANGLE = 0;

  if (transform.length !== TRANSFORM_SIZE) {
    return NO_PAN_ANGLE;
  }

  const currentFx = transform[FORWARD_X_IDX] ?? DEFAULT_VALUE;
  const currentFz = transform[FORWARD_Z_IDX] ?? DEFAULT_VALUE;

  // Project current forward onto XZ plane (horizontal component)
  const currentFxSquared = currentFx * currentFx;
  const currentFzSquared = currentFz * currentFz;
  const currentMagnitude = Math.sqrt(currentFxSquared + currentFzSquared);
  const initFxSquared = initialForwardX * initialForwardX;
  const initFzSquared = initialForwardZ * initialForwardZ;
  const initialMagnitude = Math.sqrt(initFxSquared + initFzSquared);

  // Handle degenerate cases (no horizontal component)
  const minMagnitude = 0.001;
  if (currentMagnitude < minMagnitude || initialMagnitude < minMagnitude) {
    return NO_PAN_ANGLE;
  }

  // Normalize the vectors
  const currNormX = currentFx / currentMagnitude;
  const currNormZ = currentFz / currentMagnitude;
  const initNormX = initialForwardX / initialMagnitude;
  const initNormZ = initialForwardZ / initialMagnitude;

  // Calculate signed angle using cross product (for sign) and dot product (for magnitude)
  // Cross product in 2D gives us the sine of the angle (Z component of 3D cross)
  // sin(angle) = currX * initZ - currZ * initX
  // cos(angle) = currX * initX + currZ * initZ
  const crossTerm1 = currNormX * initNormZ;
  const crossTerm2 = currNormZ * initNormX;
  const crossProduct = crossTerm1 - crossTerm2;
  const dotTerm1 = currNormX * initNormX;
  const dotTerm2 = currNormZ * initNormZ;
  const dotProduct = dotTerm1 + dotTerm2;

  // atan2(sin, cos) gives us the signed angle from initial to current
  // Positive = clockwise rotation (to the right)
  const angleRadians = Math.atan2(crossProduct, dotProduct);
  let angleDegrees = angleRadians * RADIANS_TO_DEGREES;

  // Normalize to [0, 360)
  angleDegrees %= FULL_CIRCLE;
  if (angleDegrees < DEFAULT_VALUE) {
    angleDegrees += FULL_CIRCLE;
  }

  return angleDegrees;
};

/**
 * Extracts the 3D forward direction from a camera transform matrix.
 * Returns the normalized vector (indices 8, 9, 10) representing the camera's view direction.
 */
export const getForward3D = (transform: number[]): Position3D => {
  const FORWARD_X_IDX = 8;
  const FORWARD_Y_IDX = 9;
  const FORWARD_Z_IDX = 10;
  const DEFAULT_VALUE = 0;

  if (transform.length !== TRANSFORM_SIZE) {
    return { x: DEFAULT_VALUE, y: DEFAULT_VALUE, z: DEFAULT_VALUE };
  }
  const forward: Position3D = {
    x: transform[FORWARD_X_IDX] ?? DEFAULT_VALUE,
    y: transform[FORWARD_Y_IDX] ?? DEFAULT_VALUE,
    z: transform[FORWARD_Z_IDX] ?? DEFAULT_VALUE
  };
  return normalize3D(forward);
};

/**
 * Extracts the horizontal forward direction from a camera transform.
 * Returns the X and Z components of the forward vector projected onto the XZ plane.
 * Used to establish the initial "forward" direction for pan angle calculations.
 */
export const getHorizontalForward = (transform: number[]): { forwardX: number; forwardZ: number } => {
  const FORWARD_X_IDX = 8;
  const FORWARD_Z_IDX = 10;
  const DEFAULT_VALUE = 0;

  if (transform.length !== TRANSFORM_SIZE) {
    return { forwardX: DEFAULT_VALUE, forwardZ: -1 };
  }

  const fx = transform[FORWARD_X_IDX] ?? DEFAULT_VALUE;
  const fz = transform[FORWARD_Z_IDX] ?? DEFAULT_VALUE;

  return { forwardX: fx, forwardZ: fz };
};

/**
 * Transforms a 2D point using a 4x4 matrix, assuming a top-down projection.
 *
 * Coordinate Space Mapping:
 * - Input Point.y is treated as Local Z (RoomPlan depth).
 * - Output Point.y corresponds to World Z (Floor plan Y).
 *
 * This effectively projects the 3D X-Z plane onto a 2D surface.
 */
export const transformPoint = (p: Point, m: number[]): Point => {
  // X-Z Plane Transform (Top Down)
  // Note: Input p.y corresponds to Local Z. Output p.y corresponds to World Z.
  const MAT_M0 = 0; // r0, c0 (Xx)
  const MAT_M2 = 2; // r2, c0 (Xz)
  const MAT_M8 = 8; // r0, c2 (Zx)
  const MAT_M10 = 10; // r2, c2 (Zz)
  const MAT_TX = 12; // r0, c3 (Tx)
  const MAT_TZ = 14; // r2, c3 (Tz)
  const DEFAULT_VALUE = 0;

  const m0 = m[MAT_M0] ?? DEFAULT_VALUE;
  const m8 = m[MAT_M8] ?? DEFAULT_VALUE;
  const mTx = m[MAT_TX] ?? DEFAULT_VALUE;

  const m2 = m[MAT_M2] ?? DEFAULT_VALUE;
  const m10 = m[MAT_M10] ?? DEFAULT_VALUE;
  const mTz = m[MAT_TZ] ?? DEFAULT_VALUE;

  const x = dotProduct(p, new Point(m0, m8)) + mTx;
  const y = dotProduct(p, new Point(m2, m10)) + mTz;

  return new Point(x, y);
};
