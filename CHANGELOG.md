# Changelog

All notable changes to this project will be documented in this file.

## 2025-12-27

### [v0.52.0] Sync Failure Hardening, Geometry Safety, and Dimension Extraction

- Sync failure persistence now normalizes and deduplicates reasons, strips malformed
  records, ensures the backing config path exists, and preserves scan dates so failures
  classify cleanly as new or known.
- Sync reports group repeated download failures by HTTP status and file type, separating
  new versus known inaccessible artifacts while avoiding double-counting initial layout
  issues.
- Dimension extraction now falls back to polygon perimeters for walls and floors, tolerates
  undefined or partial dimensions across doors, windows, openings, and tubs, and skips
  invalid measurements to keep charts stable.
- Polygon integrity checks clamp angle calculations and harden overlap/intersection
  detection against missing or mutated vertices, preventing runaway values while keeping
  validation strict.

## 2025-12-26

### [v0.51.0] Property Presence Trends, Resilient Sync Charts, and Cleaning Hardening

- **Property Presence Trends**: Track property availability by date during validation and add a
  cumulative "Property Presence Over Time" chart that visualizes coverage percentages while filtering
  out fields already at 100%.
- **Line Chart Layout & Legends**: Reworked line chart margins and legend layout to support wrapping,
  multi-row legends so axis labels and ticks remain readable when many datasets are shown.
- **Sync Report Robustness**: Duplicate video trend charts now include months with zero duplicates,
  duplicate groups deduplicate artifacts, and mismatch day deltas render cleanly without padding
  artifacts; file size and date formatting are more defensive.
- **Data Cleaning Hardening**: `cleanData` skips hidden files and dot directories, cleans up stale
  checked-scan entries when deleting artifacts, and records failed deletions instead of crashing.
- **Geometry & Chart Data Quality**: Floor aspect ratio points ignore undefined width/height pairs,
  and polygon/segment utilities guard against NaN/Infinity inputs to avoid false intersections in
  downstream checks.

### [v0.50.0] Video Hashing, Duplicate Reporting, and SSR-Safe Charts

- **Duplicate Video Detection**: Compute BLAKE3 hashes for downloaded videos, cache per-artifact
  `videoHash.json`, and maintain `config/videoHashes.json` so syncs flag duplicates (including newly
  seen copies) across environments.
- **Sync Report Enhancements**: Added duplicate video summary tables, trend visualizations, and
  detailed hash → artifact listings with environment context, plus consistent environment ordering in
  file size tables.
- **Report Rendering Reliability**: Added an SSR-safe DOM shim and replaced `@visx/text` with native
  SVG text to keep chart rendering stable when generating PDFs via Playwright; improved vertical
  reference line selection in line charts for accurate overlays.

## 2025-12-25

### [v0.49.0] Dimension & Aspect Ratio Visualizations, Vanity Detection, and Enhanced Capture Checks

- **Dimension Distributions**: Added KDE-based height/width distributions for walls, windows,
  doors, openings, and floors with dynamic bounds in the data analysis report.
- **Aspect Ratio Scatter Plots**: Introduced a reusable scatter chart component with opacity
  weighting for overlapping ratios, powering new aspect ratio visuals for walls, windows, doors,
  openings, and floors.
- **Vanity Insights**: Implemented vanity detection (normal, sink-only, storage-only) via
  sink/storage intersection analysis, plus vanity length distributions and sink count/vanity type
  charts.
- **Expanded Capture Validation**: Added door-to-floor contact checks, non-empty completed edges,
  floors with parent IDs, and narrow/short door and opening thresholds into capture error/feature
  prevalence charts.
- **Metadata Refactor & Coverage**: Centralized raw scan metadata extraction (dimensions,
  attributes, embedded counts, vanity data) into reusable modules and expanded tests for the new
  charts and validations.

## 2025-12-22

### [v0.48.1] Data Analysis Report Refactoring, Pie Chart Enhancements, and Validation Improvements

- **Data Analysis Report Modularization**: Refactored `dataAnalysisReport.ts` from a monolithic 2000+ line file into a modular structure:
  - Split chart building logic into focused helper modules in `src/templates/dataAnalysisReport/charts/`:
    - `kdeCharts.ts` - Continuous data distribution charts
    - `deviceAndCameraCharts.ts` - Device and camera metadata charts
    - `prevalenceCharts.ts` - Error, feature, and object charts
    - `areaCharts.ts` - Area distribution charts
    - `attributePieCharts.ts` - Object attribute pie charts
    - `wallEmbeddedPieCharts.ts` - Wall embedded feature pie charts
    - `vanityAttributesCharts.ts` - Vanity attribute charts
  - Added separate utility modules: `layout.ts` (layout constants), `kdeBounds.ts` (KDE bounds utilities), `reportSections.ts` (section building), `types.ts` (type definitions)
  - Improved maintainability and code organization with better separation of concerns
- **Pie Chart Enhancements**:
  - **Small Slice Visibility**: Enhanced pie charts to ensure small slices (below 1.5% of total) are visible by applying minimum slice size while maintaining accurate percentage calculations
  - **Numeric Label Sorting**: Improved legend label sorting to handle numeric values correctly (0, 1, 2, 3) rather than alphabetically (0, 1, 10, 2, 3)
  - **Legend Spacing**: Increased legend row gap from 4px to 12px for better readability
  - **Shrink to Legend**: Added `shrinkToLegend` option to automatically adjust chart height based on legend size
  - **Accurate Percentages**: Fixed percentage calculations to use original data values even when visual slices are adjusted for visibility
- **KDE Bounds Calculation**: Enhanced dynamic KDE bounds calculation in `utils/chart/kde.ts`:
  - Added `calculateDynamicKdeBounds()` function for intelligent x-axis range calculation
  - Improved threshold detection using actual y-axis tick values from the chart scale library
  - Better handling of edge cases when data doesn't cross threshold values
- **Small Wall Detection**: Added `getArtifactsWithSmallWalls()` function to `rawScanExtractor.ts`:
  - Detects artifacts with walls having area less than 1.5 sq ft
  - Supports both rectangular walls (using dimensions) and non-rectangular walls (using polygon corner perimeter calculations)
  - Calculates wall area from polygon corners by computing perimeter and multiplying by height
- **Validation Enhancements**:
  - **Floor Parent ID Detection**: Added detection and reporting for floors with parent identifiers set (added to validation report error table)
  - **Completed Edges Tracking**: Added metadata tracking for `hasNonEmptyCompletedEdges` to detect doors, floors, openings, walls, and windows with non-empty `completedEdges` arrays
  - Updated `ArtifactAnalysis` model and `extractRawScanMetadata()` to track these new validation flags
  - Enhanced cache validation to include new metadata fields
- **Test Coverage**: Expanded test coverage for new pie chart features, validation enhancements, and metadata tracking improvements

### [v0.48.0] Dynamic X-Axis Bounds for KDE Charts, Embedded Prevalence Visualization, and Tub Length Distribution

- **Dynamic X-Axis Range Calculation**: Implemented intelligent x-axis bounds calculation for all KDE (Kernel Density
  Estimation) charts that automatically adjusts the displayed range to show only meaningful data:
  - Calculates the first y-axis tick using the same scale library as the chart component
  - Finds where the KDE density line crosses half of the first tick (threshold) going up and down
  - Returns bounds based on these crossings instead of the full data range, eliminating empty space at chart edges
- **Two-Pass Refinement**: Enhanced bounds calculation with a two-pass approach:
  - First pass calculates initial bounds from the full range KDE
  - Second pass refines bounds based on the recalculated KDE's y-axis for improved accuracy
- **Applied to All KDE Charts**: Dynamic bounds now applied to all continuous data distribution charts:
  - Duration (seconds)
  - Ambient intensity (lux)
  - Color temperature (kelvin)
  - ISO speed
  - Brightness value (EV)
  - Room area (sq ft)
  - Window area (sq ft)
  - Door area (sq ft)
  - Opening area (sq ft)
  - Wall area (sq ft)
  - Tub length (inches)
- **Embedded Prevalence Pie Charts**: Added three new pie charts to data analysis report showing the prevalence of embedded features in walls:
  - Walls with Windows (vs. without windows)
  - Walls with Doors (vs. without doors)
  - Walls with Openings (vs. without openings)
  - Charts appear in a single row under the "Embedded Prevalence" section heading
- **Tub Length Distribution Chart**: Added new KDE chart showing the distribution of bathtub lengths:
  - Displays tub lengths in inches
  - Uses dynamic x-axis bounds to focus on meaningful data range
  - Appears in the area distribution section when artifact directories are provided
- **New Data Extraction Functions**: Added utility functions to `rawScanExtractor.ts`:
  - `getWallEmbeddedCounts()` - counts walls with windows, doors, and openings
  - `getTubLengths()` - extracts bathtub length measurements
  - `convertLengthsToInches()` and `convertLengthsToFeet()` - unit conversion utilities
- **Improved Chart Readability**: Charts now focus on the meaningful data range, making it easier to see distribution patterns without empty space at the edges

### [v0.47.0] Object Attribute Visualization and Icon System Refactoring

- **Object Attribute Pie Charts**: Added 8 new pie charts to data analysis report showing distribution of object attributes:
  - Chair Arm Type (existing/missing)
  - Chair Back Type (existing/missing)
  - Chair Leg Type (four legs/star base)
  - Chair Type (stool/dining/swivel)
  - Sofa Type (single seat)
  - Storage Type (cabinet/shelf)
  - Table Shape Type (rectangular/circular)
  - Table Type
- **Generalized Icon System**: Refactored icon components from specific implementations (`DoorClosedIcon`, `DoorOpenIcon`) to a generic, configurable system:
  - Created `SVGIcon` component that handles all icon rendering with automatic scaling
  - Added `iconConfig.tsx` with centralized icon configuration mapping icon names to SVG paths and viewBox sizes
  - Added 17 new SVG icon assets for various object types (chairs, tables, sofas, storage, etc.)
  - Icons automatically scale to match legend box size and use chart colors dynamically
- **Enhanced SVG Loader**: Improved `svgLoader.ts` to handle complex SVG files:
  - Added support for CSS classes in `<style>` tags by inlining fill/stroke attributes
  - Removes style tags (which don't work when injected via `dangerouslySetInnerHTML`)
  - Extracts class rules and applies colors directly to elements
- **Chart Utilities Refactoring**: Reorganized chart utilities for better maintainability:
  - Deleted monolithic `chartUtils.ts` (603 lines)
  - Split into modular structure in `utils/chart/` directory:
    - `configBuilders.ts` - Chart configuration builders
    - `kde.ts` - Kernel density estimation
    - `histogram.ts` - Histogram calculations
    - `colors.ts` - Color utilities
  - Moved chart type definitions to `models/chart/` directory
- **Data Analysis Report Refactoring**: Significant code organization improvements:
  - Split large report building function into focused helper functions:
    - `computeLayoutConstants()` - Layout calculations
    - `buildKdeCharts()` - Continuous data charts
    - `buildDeviceAndCameraCharts()` - Device/camera metadata charts
    - `buildErrorFeatureObjectCharts()` - Error, feature, and object charts
    - `buildAreaCharts()` - Area distribution charts
    - `buildAttributePieCharts()` - Object attribute pie charts
  - Improved type safety with explicit interfaces and better separation of concerns
- **New Utility Functions**: Added `getObjectAttributeCounts()` to `rawScanExtractor.ts` for extracting object attribute distributions from raw scan data
- **Test Coverage**: Updated and expanded tests for new icon system, SVG loader enhancements, and refactored chart utilities

### [v0.46.0] Door Status Pie Chart with Custom Legend Icons

- **Door Status Visualization**: Added pie chart to data analysis report showing the prevalence of different door `isOpen` values (Open, Closed, Unknown) across all doors in all `rawScan.json` files.
- **Custom Legend Icons**: Implemented custom SVG-based legend icons for door status:
  - `DoorClosedIcon` and `DoorOpenIcon` components that load SVG files dynamically
  - Icons automatically scale to match legend box size and use pie chart colors
  - Unknown status uses default colored box fallback
- **SVG Loading Utility**: Created `svgLoader.ts` utility to:
  - Load SVG files from the filesystem
  - Extract inner content (removes `<svg>` wrapper)
  - Replace `currentColor` with dynamic colors for proper theming
- **Component Organization**: Organized icon components into `legend-icons/` subfolder for better code organization.
- **Test Coverage**: Added comprehensive test coverage for:
  - `svgLoader.ts` - SVG loading and color replacement logic
  - `DoorClosedIcon.tsx` - Component rendering and scaling
  - `DoorOpenIcon.tsx` - Component rendering and scaling
- **Chart Enhancements**: Pie chart improvements:
  - Percentage labels displayed outside pie segments
  - Legend horizontally centered with proper vertical alignment
  - Dynamic padding when percentage labels appear near bottom
  - Sorted from smallest to largest slice
  - Darker color palette for better readability

### [v0.45.2] Code Refactoring: Extract Utilities from Data Analysis Report

- **Raw Scan Data Extraction Utilities**: Extracted all raw scan data extraction functions to `utils/data/rawScanExtractor.ts`:
  - `getObjectConfidenceCounts()` - extracts object confidence data from raw scans
  - `getUnexpectedVersionArtifactDirs()` - finds artifacts with unexpected versions
  - `getWindowAreas()`, `getDoorAreas()`, `getOpeningAreas()`, `getWallAreas()` - extract area data
  - `convertAreasToSquareFeet()` - unit conversion utility
- **Device Sorting Utilities**: Extracted device sorting/ranking logic to `utils/deviceSorting.ts`:
  - `sortDeviceModels()` - sorts devices into iPhones, iPads, and Others with custom ranking logic
  - Includes complex iPad ranking system (M4, Legacy Pros, Airs, Base, Mini)
- **Code Organization**: Reduced `dataAnalysisReport.ts` from 1382 lines to ~908 lines (34% reduction)
- **Maintainability**: Improved separation of concerns with reusable utilities following existing patterns in the `utils/` directory

### [v0.45.1] General Data Formatting Script with Recursive Key Sorting

- **Generalized Format Script**: Renamed `formatArData` to `formatData` to handle both `arData.json` and `rawScan.json` files.
- **Recursive Key Sorting**: Implemented recursive sorting of object keys at all levels, not just top-level keys, for consistent JSON formatting.
- **arData.json Formatting**: Maintains numeric sorting for timestamp keys in the `data` property while sorting all other keys alphabetically.
- **rawScan.json Formatting**: Sorts all keys alphabetically at all nesting levels for improved diff readability.
- **Output Files**: Generates `arDataFormatted.json` and `rawScanFormatted.json` files with consistently sorted keys.

### [v0.45.0] Low Ceiling Detection Fix and Non-Rectangular Embedded Detection Improvements

- **Low Ceiling Detection**: Added detection for room with low ceilings (< 7.5 feet>)
- **Non-Rectangular Embedded Detection Fix**: Fixed detection logic to only consider embedded objects (doors, windows, openings) with polygon corners defined (length > 0) as potentially non-rectangular.
- **Cache Management**: Added `npm run clear-cache` script to invalidate metadata cache files when detection logic changes. Cache validation now includes all required fields to ensure stale data is regenerated.
- **Wall Area Chart**: Added wall area distribution chart showing areas for both rectangular walls (using dimensions) and non-rectangular walls (using polygon corner perimeter calculations).

## 2025-12-21

### [v0.44.0] Area Distribution Charts and Version Error Detection

- **Window, Door, and Opening Area Charts**: Added three new charts showing the distribution of window, door, and opening areas.
  Areas are displayed in square feet with smooth density visualization. Charts only appear when artifact directories are provided.
- **Unexpected Version Error Detection**: Added "Unexpected Version" row to the Capture Errors table that counts scans with versions other than 2.

### [v0.43.0] Feature Extraction Chart Enhancements

- **Curved Embedded Detection**: Added detection and reporting for curved embedded features (windows, doors, and openings with curve values embedded in walls).
- **Non-Rectangular Embedded Detection**: Added detection and reporting for non-rectangular embedded features (windows, doors, and openings with polygon corners that are not 4 corners, embedded in walls).
- **Feature Extraction Chart Updates**: Added two new lines to the feature extraction chart: "Curved Embedded" and "Non-Rectangular Embedded" to track these special embedded feature types.
- **Test Coverage Improvements**: Added comprehensive test coverage for the new embedded feature detection functionality.

### [v0.42.3] Object Distribution Chart with Confidence Levels

- **Stacked Bar Charts for Object Distribution**: Object distribution chart now displays stacked bars showing confidence levels (High, Medium, Low) for detected objects from Roomplan data.
- **Confidence-Based Visualization**: Each object type shows breakdown by confidence level with color-coded segments (green for High, amber for Medium, red for Low).
- **Accurate Percentage Calculation**: Percentages now correctly represent "percentage of artifacts that have at least one instance of this object type" rather than total object counts.
- **Bar Height Alignment**: Bar heights now match percentages by scaling confidence counts proportionally to artifact counts.
- **Legend Support**: Added legend to stacked bar charts explaining the confidence level colors.
- **Border Color Fix**: Stacked bar segments now use their own color for borders instead of a uniform green border, improving visual clarity.

### [v0.42.2] Chart Improvements and Bug Fixes

- **Fixed Horizontal Bar Chart Sorting**: Corrected reversed sorting in horizontal bar charts - highest values now appear at the top as expected.
- **X-Axis Labels**: Added x-axis labels to all line charts (Duration: "Seconds", Ambient Intensity: "Lux", Color Temperature: "Kelvin", ISO Speed: "ISO", Brightness Value: "EV", Room Area: "sq ft").
- **Dynamic Label Positioning**: X-axis labels now dynamically position based on tick label length and rotation angle, eliminating manual offset configuration.
- **Reduced Chart Spacing**: Significantly reduced gaps between charts and section headers for more compact report layout.
- **Gradient Line Support**: Added gradient stroke support to line charts, enabling color temperature chart to display gradient from orange (3500K) to blue (6700K).
- **Category Reorganization**: Moved "Multiple Stories" from Capture Errors to Feature Prevalence, and "Unparented Embedded" from Feature Prevalence to Capture Errors.
- **Improved Chart Margins**: Reduced bottom margins on line charts to prevent excessive spacing between x-axis labels and next sections.

## 2025-12-20

### [v0.42.1] Maintenance: Type Safety Improvements

- **Visualization updates**: Visualize continuous data in charts instead of just counts.
- **Shading**: Shade relevant charts to visualizually indicate their data.

### [v0.42.0] Add Date Mismatch Analysis and Trends

- **Date Mismatch Reporting**: Added a "Date Mismatches" section in Sync Report with trend charts, summary tables, and cleaner list formatting.
- **Detailed List Improvements**: Formatted tables across reports to be consisent in the way they list environments.
