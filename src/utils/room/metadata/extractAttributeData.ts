import { RawScan } from "../../../models/rawScan/rawScan";

export interface AttributeData {
  doorIsOpenCounts: Record<string, number>;
  objectAttributeCounts: Record<string, Record<string, number>>;
}

/**
 * Extracts attribute data from a raw scan.
 * Counts door isOpen values and object attribute values.
 */
export function extractAttributeData(rawScan: RawScan): AttributeData {
  const initialCount = 0;
  const increment = 1;

  const doorIsOpenCounts: Record<string, number> = {};

  for (const door of rawScan.doors) {
    const isOpen = door.category.door?.isOpen;
    let key = "Unknown";
    if (isOpen === true) {
      key = "Open";
    } else if (isOpen === false) {
      key = "Closed";
    }
    doorIsOpenCounts[key] = (doorIsOpenCounts[key] ?? initialCount) + increment;
  }

  const objectAttributeCounts: Record<string, Record<string, number>> = {};
  const attributeTypes = [
    "ChairArmType",
    "ChairBackType",
    "ChairLegType",
    "ChairType",
    "SofaType",
    "StorageType",
    "TableShapeType",
    "TableType"
  ];

  for (const obj of rawScan.objects) {
    for (const attributeType of attributeTypes) {
      const attributeValue = obj.attributes[attributeType];
      if (attributeValue !== undefined && typeof attributeValue === "string") {
        objectAttributeCounts[attributeType] ??= {};
        objectAttributeCounts[attributeType][attributeValue] =
          (objectAttributeCounts[attributeType][attributeValue] ?? initialCount) + increment;
      }
    }
  }

  return { doorIsOpenCounts, objectAttributeCounts };
}
