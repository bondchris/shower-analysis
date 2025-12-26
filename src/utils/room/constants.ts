import convert from "convert-units";
const ONE_UNIT = 1;
export const TOUCHING_THRESHOLD_METERS = convert(ONE_UNIT).from("in").to("m");

/**
 * Threshold for narrow doors in feet. Doors with width less than this value are considered narrow.
 */
export const NARROW_DOOR_WIDTH_FT = 2.5;

/**
 * Threshold for narrow openings in feet. Openings with width less than this value are considered narrow.
 */
export const NARROW_OPENING_WIDTH_FT = 3;

/**
 * Threshold for short doors in feet. Doors with height less than this value are considered short.
 */
export const SHORT_DOOR_HEIGHT_FT = 6.5;

/**
 * Maximum gap between walls in inches. Gaps between 1 inch and this value are considered errors.
 */
export const WALL_GAP_MAX_INCHES = 12;

/**
 * Maximum gap around bathtubs in inches. Gaps between 1 inch and this value are considered errors.
 */
export const TUB_GAP_MAX_INCHES = 6;

/**
 * Door clearance distance in feet. Objects within this distance in front of a door are considered blocking.
 */
export const DOOR_CLEARANCE_FT = 2;

/**
 * Door clearance distance in meters. Objects within this distance in front of a door are considered blocking.
 */
export const DOOR_CLEARANCE_METERS = 0.6;

/**
 * Step-over height threshold in meters. Objects lower than this height relative to door bottom do not block.
 */
export const STEP_OVER_HEIGHT_METERS = 0.05;

/**
 * Minimum wall area in square feet. Walls with area less than this value are considered small.
 */
export const MIN_WALL_AREA_SQ_FT = 1.5;

/**
 * Minimum number of walls required for a valid room.
 */
export const MIN_WALLS = 4;

/**
 * Low ceiling threshold in feet. Ceilings lower than this value are considered low.
 */
export const LOW_CEILING_THRESHOLD_FT = 7.5;

/**
 * Nib wall threshold in feet. Walls shorter than this value are considered nib walls.
 */
export const NIB_WALL_THRESHOLD_FT = 1;

/**
 * Maximum gap for colinear walls in inches. Walls closer than this are considered touching/overlapping.
 */
export const COLINEAR_WALL_GAP_MAX_INCHES = 3;

/**
 * Parallel threshold for colinear walls. Dot product above this value indicates walls are parallel.
 */
export const COLINEAR_WALL_PARALLEL_THRESHOLD = 0.996;

/**
 * Minimum number of toilets to be considered a feature (e.g., "2+ Toilets").
 */
export const MIN_TOILETS = 2;

/**
 * Minimum number of tubs to be considered a feature (e.g., "2+ Tubs").
 */
export const MIN_TUBS = 2;
