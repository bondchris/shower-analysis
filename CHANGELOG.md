# Changelog

All notable changes to this project will be documented in this file.

## 2025-12-22

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
