import { CHART_DATE_RANGE } from "../../../config/config";

export function generateDateRange(startDate: string, endDate: string): string[] {
  const msPerDay = 86400000;
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const inclusiveOffset = 1;
  const dayCount = Math.floor((endMs - startMs) / msPerDay) + inclusiveOffset;

  const datePartIndex = 0;
  return Array.from({ length: dayCount }, (_, i) => {
    const dayOffset = i * msPerDay;
    const dateMs = startMs + dayOffset;
    return new Date(dateMs).toISOString().split("T")[datePartIndex] ?? "";
  }).filter((d) => d !== "");
}

export function getGlobalDateRange(): string[] {
  const datePartIndex = 0;
  const today = new Date().toISOString().split("T")[datePartIndex] ?? "";
  return generateDateRange(CHART_DATE_RANGE.startDate, today);
}
