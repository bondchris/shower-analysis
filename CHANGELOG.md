# Changelog

All notable changes to this project will be documented in this file.

## 2025-12-22

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
