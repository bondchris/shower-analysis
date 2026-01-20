import { ArtifactAnalysis } from "../../../models/artifactAnalysis";
import { ChartConfiguration } from "../../../models/chart/chartConfiguration";
import { getBarChartConfig } from "../../../utils/chart/configBuilders";
import { computeLayoutConstants } from "../../dataAnalysisReport/layout";

export interface TimingCharts {
  timeOfDay: ChartConfiguration;
  timezone: ChartConfiguration;
}

// Map UTC offsets to common timezone abbreviations (sorted alphabetically by key)
const timezoneAbbreviations: Record<string, string> = {
  "+00:00": "UTC",
  "+01:00": "CET",
  "+02:00": "EET",
  "+03:00": "MSK",
  "+04:00": "GST",
  "+04:30": "AFT",
  "+05:00": "PKT",
  "+05:30": "IST",
  "+05:45": "NPT",
  "+06:00": "BST",
  "+06:30": "MMT",
  "+07:00": "ICT",
  "+08:00": "SGT",
  "+09:00": "JST",
  "+09:30": "ACST",
  "+10:00": "AEST",
  "+10:30": "ACDT",
  "+11:00": "SBT",
  "+12:00": "NZST",
  "+13:00": "TOT",
  "+14:00": "LINT",
  "-01:00": "CVT",
  "-02:00": "GST",
  "-03:00": "ART",
  "-04:00": "AT",
  "-05:00": "ET",
  "-06:00": "CT",
  "-07:00": "MT",
  "-08:00": "PT",
  "-09:00": "AKT",
  "-10:00": "HT",
  "-11:00": "SST",
  "-12:00": "IDLW"
};

function getTimezoneLabel(offset: string): string {
  const notSet = "";
  if (offset === notSet) {
    return "Unknown";
  }
  const abbrev = timezoneAbbreviations[offset];
  if (abbrev !== undefined) {
    return `${offset}\n${abbrev}`;
  }
  return offset;
}

function parseTimezoneOffset(label: string): number {
  const sortEqual = 0;
  const sortBefore = -1;
  const sortAfter = 1;
  const minutesPerHour = 60;
  const radix = 10;
  const signGroupIndex = 1;
  const hoursGroupIndex = 2;
  const minutesGroupIndex = 3;

  // Extract the offset portion from labels like "-07:00 (MT)" or just "-07:00"
  const match = /^([+-])(\d{2}):(\d{2})/.exec(label);
  if (match === null) {
    return sortEqual;
  }
  const sign = match[signGroupIndex] === "-" ? sortBefore : sortAfter;
  const hoursStr = match[hoursGroupIndex];
  const minutesStr = match[minutesGroupIndex];
  if (hoursStr === undefined || minutesStr === undefined) {
    return sortEqual;
  }
  const hours = parseInt(hoursStr, radix);
  const minutes = parseInt(minutesStr, radix);
  const hoursInMinutes = hours * minutesPerHour;
  const totalMinutes = hoursInMinutes + minutes;
  return sign * totalMinutes;
}

// Parses DateTimeOriginal format "YYYY:MM:DD HH:MM:SS" and extracts the hour
function parseHourFromDateTime(dateTime: string): number | null {
  const hourGroupIndex = 1;
  const timeRegex = /\d{4}:\d{2}:\d{2}\s+(\d{2}):\d{2}:\d{2}/;
  const match = timeRegex.exec(dateTime);
  if (match?.[hourGroupIndex] !== undefined) {
    const radix = 10;
    const hour = parseInt(match[hourGroupIndex], radix);
    const maxHour = 23;
    const minHour = 0;
    if (hour >= minHour && hour <= maxHour) {
      return hour;
    }
  }
  return null;
}

export function buildTimingCharts(metadataList: ArtifactAnalysis[]): TimingCharts {
  const layout = computeLayoutConstants();
  const notSet = "";
  const initialCount = 0;
  const incrementStep = 1;
  const sortAfter = 1;
  const sortBefore = -1;

  // Timezone Bar Chart
  const timezoneMap: Record<string, number> = {};
  for (const m of metadataList) {
    const label = getTimezoneLabel(m.timezone);
    timezoneMap[label] = (timezoneMap[label] ?? initialCount) + incrementStep;
  }
  // Sort timezones by UTC offset (e.g., -12:00 to +14:00)
  const timezoneLabels = Object.keys(timezoneMap).sort((a, b) => {
    if (a === "Unknown") {
      return sortAfter;
    }
    if (b === "Unknown") {
      return sortBefore;
    }
    return parseTimezoneOffset(a) - parseTimezoneOffset(b);
  });
  const timezoneCounts = timezoneLabels.map((l) => timezoneMap[l] ?? initialCount);
  const timezone = getBarChartConfig(timezoneLabels, timezoneCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.FULL_CHART_WIDTH
  });

  // Time of Day Bar Chart
  const hourLabelDigits = 2;
  const hoursPerDay = 24;
  const timeOfDayMap: Record<string, number> = {};
  for (let h = 0; h < hoursPerDay; h++) {
    const hourLabel = h.toString().padStart(hourLabelDigits, "0");
    timeOfDayMap[hourLabel] = initialCount;
  }
  for (const m of metadataList) {
    if (m.scanDateTime !== notSet) {
      const hour = parseHourFromDateTime(m.scanDateTime);
      if (hour !== null) {
        const hourLabel = hour.toString().padStart(hourLabelDigits, "0");
        const currentHourCount = timeOfDayMap[hourLabel] ?? initialCount;
        timeOfDayMap[hourLabel] = currentHourCount + incrementStep;
      }
    }
  }
  const timeOfDayLabels = Object.keys(timeOfDayMap).sort();
  const timeOfDayCounts = timeOfDayLabels.map((l) => timeOfDayMap[l] ?? initialCount);
  const timeOfDay = getBarChartConfig(timeOfDayLabels, timeOfDayCounts, {
    height: layout.HALF_CHART_HEIGHT,
    showCount: true,
    title: "",
    width: layout.FULL_CHART_WIDTH
  });

  return {
    timeOfDay,
    timezone
  };
}
