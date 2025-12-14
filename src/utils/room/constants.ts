import convert from "convert-units";
const ONE_UNIT = 1;
export const TOUCHING_THRESHOLD_METERS = convert(ONE_UNIT).from("in").to("m");
