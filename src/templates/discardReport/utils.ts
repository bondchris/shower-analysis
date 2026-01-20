import { BadScanHistoryEntry } from "../../models/discardStats";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isTooShortEntry(entry: BadScanHistoryEntry): boolean {
  return entry.reason.includes("Video too short") || entry.reason.includes("duration");
}

export function isNotBathroomEntry(entry: BadScanHistoryEntry): boolean {
  return entry.reason.includes("Not a bathroom");
}

export function isDuplicateEntry(entry: BadScanHistoryEntry): boolean {
  return entry.reason.startsWith("Duplicate video");
}

export function formatMismatchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      timeZone: "America/New_York",
      year: "2-digit"
    };
    interface DateParts {
      day: string;
      hour: string;
      minute: string;
      month: string;
      year: string;
    }
    const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(d);
    const partLookup: DateParts = { day: "00", hour: "00", minute: "00", month: "00", year: "00" };
    const datePartKeys: (keyof DateParts)[] = ["day", "hour", "minute", "month", "year"];
    parts.forEach((part) => {
      if (datePartKeys.includes(part.type as keyof DateParts)) {
        const key = part.type as keyof DateParts;
        partLookup[key] = part.value;
      }
    });
    return `${partLookup.year}-${partLookup.month}-${partLookup.day} ${partLookup.hour}:${partLookup.minute}`;
  } catch {
    return dateStr;
  }
}
