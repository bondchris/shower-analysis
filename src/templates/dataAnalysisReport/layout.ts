// Layout constants interface
export interface LayoutConstants {
  PAGE_VIEWPORT_WIDTH: number;
  PAGE_VIEWPORT_HEIGHT: number;
  PAGE_MARGIN: number;
  PAGE_CONTENT_WIDTH: number;
  PAGE_CONTENT_HEIGHT: number;
  DURATION_CHART_WIDTH: number;
  HALF_CHART_WIDTH: number;
  THIRD_CHART_WIDTH: number;
  HISTO_CHART_WIDTH: number;
  ERRORS_CHART_WIDTH: number;
  DURATION_CHART_HEIGHT: number;
  HALF_CHART_HEIGHT: number;
  LENS_CHART_HEIGHT: number;
  MIN_DYNAMIC_HEIGHT: number;
  getDynamicHeight: (itemCount: number, minHeight?: number) => number;
}

export function computeLayoutConstants(): LayoutConstants {
  // A4 viewport at 96 DPI from reportGenerator; keep sizing as ratios
  const PAGE_VIEWPORT_WIDTH = 794;
  const PAGE_VIEWPORT_HEIGHT = 1123;
  const PAGE_MARGIN = 40;
  const DOUBLE = 2;
  const pageMarginDouble = PAGE_MARGIN * DOUBLE;
  const PAGE_CONTENT_WIDTH = PAGE_VIEWPORT_WIDTH - pageMarginDouble;
  const PAGE_CONTENT_HEIGHT = PAGE_VIEWPORT_HEIGHT - pageMarginDouble;

  const FULL_WIDTH_RATIO = 0.9;
  const HALF_WIDTH_RATIO = 0.47;
  const THIRD_WIDTH_RATIO = 0.23;
  const HISTO_WIDTH_RATIO = FULL_WIDTH_RATIO;
  const ERRORS_WIDTH_RATIO = 0.82;
  const DURATION_HEIGHT_RATIO = 0.32;
  const HALF_HEIGHT_RATIO = 0.26;
  const LENS_HEIGHT_RATIO = 0.35;

  const MIN_DURATION_HEIGHT = 260;
  const MIN_HALF_HEIGHT = 260;
  const MIN_LENS_HEIGHT = 340;

  const MIN_DYNAMIC_HEIGHT = 140;

  const DURATION_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * FULL_WIDTH_RATIO);
  const HALF_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HALF_WIDTH_RATIO);
  const THIRD_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * THIRD_WIDTH_RATIO);
  const HISTO_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * HISTO_WIDTH_RATIO);
  const ERRORS_CHART_WIDTH = Math.round(PAGE_CONTENT_WIDTH * ERRORS_WIDTH_RATIO);
  const DURATION_CHART_HEIGHT = Math.max(MIN_DURATION_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * DURATION_HEIGHT_RATIO));
  const HALF_CHART_HEIGHT = Math.max(MIN_HALF_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * HALF_HEIGHT_RATIO));
  const LENS_CHART_HEIGHT = Math.max(MIN_LENS_HEIGHT, Math.round(PAGE_CONTENT_HEIGHT * LENS_HEIGHT_RATIO));

  // Helper for dynamic height
  const MIN_BAR_HEIGHT = 20;
  const HEADER_SPACE = 60;
  function getDynamicHeight(itemCount: number, minHeight = HALF_CHART_HEIGHT): number {
    const contentHeight = itemCount * MIN_BAR_HEIGHT;
    return Math.max(minHeight, contentHeight + HEADER_SPACE);
  }

  return {
    DURATION_CHART_HEIGHT,
    DURATION_CHART_WIDTH,
    ERRORS_CHART_WIDTH,
    HALF_CHART_HEIGHT,
    HALF_CHART_WIDTH,
    HISTO_CHART_WIDTH,
    LENS_CHART_HEIGHT,
    MIN_DYNAMIC_HEIGHT,
    PAGE_CONTENT_HEIGHT,
    PAGE_CONTENT_WIDTH,
    PAGE_MARGIN,
    PAGE_VIEWPORT_HEIGHT,
    PAGE_VIEWPORT_WIDTH,
    THIRD_CHART_WIDTH,
    getDynamicHeight
  };
}
