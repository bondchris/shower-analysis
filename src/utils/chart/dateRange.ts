import { CHART_DATE_RANGE } from "../../../config/config";

const ZERO = 0;
const ONE = 1;

export function generateDateRange(startDate: string, endDate: string): string[] {
  const msPerDay = 86400000;
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const dayCount = Math.floor((endMs - startMs) / msPerDay) + ONE;

  return Array.from({ length: dayCount }, (_, i) => {
    const dayOffset = i * msPerDay;
    const dateMs = startMs + dayOffset;
    return new Date(dateMs).toISOString().split("T")[ZERO] ?? "";
  }).filter((d) => d !== "");
}

export function getGlobalDateRange(): string[] {
  const today = new Date().toISOString().split("T")[ZERO] ?? "";
  return generateDateRange(CHART_DATE_RANGE.startDate, today);
}
