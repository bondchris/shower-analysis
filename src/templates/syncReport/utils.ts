/**
 * Format bytes to a human-readable string with appropriate unit.
 */
export function formatBytes(bytes: number): string {
  const zeroBytesValue = 0;
  if (bytes === zeroBytesValue) {
    return "0 B";
  }
  const bytesPerKilobyte = 1024;
  const sizes: [string, string, string, string, string] = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.floor(Math.log(bytes) / Math.log(bytesPerKilobyte));
  const indexOffset = 1;
  const lastSizeIndex = sizes.length - indexOffset;
  const index = Math.min(lastSizeIndex, exponent);
  const decimalPlaces = 2;
  const value = parseFloat((bytes / Math.pow(bytesPerKilobyte, index)).toFixed(decimalPlaces)).toString();
  const unit = sizes[index];
  return `${value} ${String(unit)}`;
}

/**
 * Calculate average safely, returning 0 if count is 0.
 */
export function safeAvg(total: number, count: number): number {
  const zeroCount = 0;
  if (count === zeroCount) {
    return zeroCount;
  }
  return total / count;
}

/**
 * Wrap a value in a span with gray styling for totals column.
 */
export function wrapTotalCell(value: string): string {
  return `<span style="font-weight:normal;color:#6b7280">${value}</span>`;
}

/**
 * Environment-specific colors for charts.
 */
export const ENV_COLORS: Record<string, string> = {
  "Bond Demo": "rgba(127, 24, 127, 1)",
  "Bond Production": "rgba(0, 100, 0, 1)",
  "Lowe's Production": "rgba(1, 33, 105, 1)",
  "Lowe's Staging": "rgba(0, 117, 206, 1)"
};

/**
 * Default fallback colors for charts when env color is not defined.
 */
export const DEFAULT_CHART_COLORS: [string, string, string, string] = ["#0ea5e9", "#22c55e", "#ef4444", "#eab308"];
