import React from "react";
import { SVGIcon, SVGIconProps } from "./SVGIcon";

/**
 * Configuration for SVG-based legend icons.
 * Maps icon names to their SVG file paths and viewBox sizes.
 */
export const iconConfig: Record<string, { svgPath: string; viewBoxSize: number }> = {
  cabinet: {
    svgPath: "src/templates/assets/icons/cabinet.svg",
    viewBoxSize: 24
  },
  chairArmExisting: {
    svgPath: "src/templates/assets/icons/chair-arm-existing.svg",
    viewBoxSize: 512
  },
  chairArmMissing: {
    svgPath: "src/templates/assets/icons/chair-arm-missing.svg",
    viewBoxSize: 24
  },
  chairBackMissing: {
    svgPath: "src/templates/assets/icons/chair-back-missing.svg",
    viewBoxSize: 200
  },
  circularElliptic: {
    svgPath: "src/templates/assets/icons/circular-table.svg",
    viewBoxSize: 24
  },
  dining: {
    svgPath: "src/templates/assets/icons/dining-chair.svg",
    viewBoxSize: 50
  },
  doorClosed: {
    svgPath: "src/templates/assets/icons/door-closed.svg",
    viewBoxSize: 16
  },
  doorOpen: {
    svgPath: "src/templates/assets/icons/door-open.svg",
    viewBoxSize: 122.88
  },
  existing: {
    svgPath: "src/templates/assets/icons/chair-back-existing.svg",
    viewBoxSize: 511.997
  },
  four: {
    svgPath: "src/templates/assets/icons/chair-with-four-legs.svg",
    viewBoxSize: 512
  },
  rectangular: {
    svgPath: "src/templates/assets/icons/rectangular-table.svg",
    viewBoxSize: 50
  },
  shelf: {
    svgPath: "src/templates/assets/icons/shelf.svg",
    viewBoxSize: 50
  },
  singleSeat: {
    svgPath: "src/templates/assets/icons/single-seat-sofa.svg",
    viewBoxSize: 24
  },
  star: {
    svgPath: "src/templates/assets/icons/chair-with-star-base.svg",
    viewBoxSize: 24
  },
  stool: {
    svgPath: "src/templates/assets/icons/stool.svg",
    viewBoxSize: 512
  },
  swivel: {
    svgPath: "src/templates/assets/icons/swivel-chair.svg",
    viewBoxSize: 421.746
  },
  unidentified: {
    svgPath: "src/templates/assets/icons/unidentified.svg",
    viewBoxSize: 24
  }
};

/**
 * Creates an icon component factory function for a given icon name.
 * Returns a React component that matches the standard icon props interface.
 */
export function createIconComponent(
  iconName: string
): React.ComponentType<Omit<SVGIconProps, "svgPath" | "viewBoxSize">> {
  const config = iconConfig[iconName];
  if (config === undefined) {
    throw new Error(`Icon configuration not found for: ${iconName}`);
  }

  const IconComponent = (props: Omit<SVGIconProps, "svgPath" | "viewBoxSize">) => (
    <SVGIcon {...props} svgPath={config.svgPath} viewBoxSize={config.viewBoxSize} />
  );
  const firstCharIndex = 0;
  const sliceStartIndex = 1;
  const firstChar = iconName.charAt(firstCharIndex);
  const restOfName = iconName.slice(sliceStartIndex);
  const capitalizedName = firstChar.toUpperCase() + restOfName.replace(/([A-Z])/g, "$1");
  IconComponent.displayName = `${capitalizedName}Icon`;
  return IconComponent;
}

/**
 * Pre-created icon components for convenience.
 * These match the original component names for easy migration.
 */
export const CabinetIcon = createIconComponent("cabinet");
export const ChairArmExistingIcon = createIconComponent("chairArmExisting");
export const CircularEllipticIcon = createIconComponent("circularElliptic");
export const ChairArmMissingIcon = createIconComponent("chairArmMissing");
export const ChairBackMissingIcon = createIconComponent("chairBackMissing");
export const DiningIcon = createIconComponent("dining");
export const DoorClosedIcon = createIconComponent("doorClosed");
export const DoorOpenIcon = createIconComponent("doorOpen");
export const ExistingIcon = createIconComponent("existing");
export const FourIcon = createIconComponent("four");
export const RectangularIcon = createIconComponent("rectangular");
export const ShelfIcon = createIconComponent("shelf");
export const SingleSeatIcon = createIconComponent("singleSeat");
export const StarIcon = createIconComponent("star");
export const StoolIcon = createIconComponent("stool");
export const SwivelIcon = createIconComponent("swivel");
export const UnidentifiedIcon = createIconComponent("unidentified");
