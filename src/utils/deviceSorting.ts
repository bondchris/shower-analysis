import { DEVICE_RELEASE_ORDER } from "../../config/deviceReleaseOrder";

/**
 * Sorts device models into categories (iPhones, iPads, Others) and applies
 * appropriate sorting logic to each category.
 *
 * @param deviceMap - Map of device model names to their counts
 * @returns Object containing sorted device labels, counts, and optional separator label
 */
export function sortDeviceModels(deviceMap: Record<string, number>): {
  deviceLabels: string[];
  deviceCounts: number[];
  separatorLabel?: string;
} {
  const allKeys = Object.keys(deviceMap);
  const DEFAULT_DATE = 0;
  const INITIAL_COUNT = 0;
  const NO_RESULTS = 0;
  const SEPARATOR_KEY = "---";

  const getReleaseDate = (model: string) => DEVICE_RELEASE_ORDER[model] ?? DEFAULT_DATE;

  // Sort iPhones by release date desc, then by name desc
  const iPhones = allKeys
    .filter((k) => k.toLowerCase().includes("iphone"))
    .sort((a, b) => {
      const dateA = getReleaseDate(a);
      const dateB = getReleaseDate(b);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return b.localeCompare(a);
    });

  // Sort iPads by Hybrid Logic:
  // 1. M4 Generation (Newest Flagships)
  // 2. Legacy Large Pros (12.9) - Clean lineage
  // 3. Legacy Small Pros (11) - Clean lineage
  // 4. Airs > Base > Mini
  const RANK_M4 = 1;
  const RANK_LEGACY_LARGE = 2;
  const RANK_LEGACY_SMALL = 3;
  const RANK_PRO = 4;
  const RANK_AIR = 5;
  const RANK_BASE = 6;
  const RANK_MINI = 7;
  const RANK_DEFAULT = 99;

  const getiPadRank = (model: string): number => {
    const m = model.toLowerCase();

    // Rank 1: M4 Generation (Both 13" and 11")
    if (m.includes("(m4)")) {
      return RANK_M4;
    }

    // Rank 2: Legacy Large Pros
    if (m.includes("pro") && (m.includes("12.9") || m.includes("13-inch"))) {
      return RANK_LEGACY_LARGE;
    }

    // Rank 3: Legacy Small Pros
    if (m.includes("pro") && m.includes("11-inch")) {
      return RANK_LEGACY_SMALL;
    }

    // Rank 4: Other Pros
    if (m.includes("pro")) {
      return RANK_PRO;
    }

    // Rank 5: Airs
    if (m.includes("air")) {
      return RANK_AIR;
    }

    // Rank 6: Base
    if (m.includes("ipad") && !m.includes("mini")) {
      return RANK_BASE;
    }

    // Rank 7: Mini
    if (m.includes("mini")) {
      return RANK_MINI;
    }

    return RANK_DEFAULT;
  };

  const iPads = allKeys
    .filter((k) => k.toLowerCase().includes("ipad"))
    .sort((a, b) => {
      const rankA = getiPadRank(a);
      const rankB = getiPadRank(b);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const dateA = getReleaseDate(a);
      const dateB = getReleaseDate(b);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return b.localeCompare(a);
    });

  // Others sorted by count as before
  const others = allKeys
    .filter((k) => !k.toLowerCase().includes("iphone") && !k.toLowerCase().includes("ipad"))
    .sort((a, b) => (deviceMap[b] ?? INITIAL_COUNT) - (deviceMap[a] ?? INITIAL_COUNT));

  const deviceLabels = [...iPhones, ...iPads, ...others];
  let separatorLabel: string | undefined = undefined;

  // If we have both iPhones and (iPads or Others), insert a gap
  if (iPhones.length > NO_RESULTS && (iPads.length > NO_RESULTS || others.length > NO_RESULTS)) {
    const insertIdx = iPhones.length;
    deviceLabels.splice(insertIdx, NO_RESULTS, SEPARATOR_KEY);
    separatorLabel = SEPARATOR_KEY;
  }

  const deviceCounts = deviceLabels.map((l) => (l === SEPARATOR_KEY ? INITIAL_COUNT : (deviceMap[l] ?? INITIAL_COUNT)));

  const result: {
    deviceCounts: number[];
    deviceLabels: string[];
    separatorLabel?: string;
  } = {
    deviceCounts,
    deviceLabels
  };

  if (separatorLabel !== undefined) {
    result.separatorLabel = separatorLabel;
  }

  return result;
}
