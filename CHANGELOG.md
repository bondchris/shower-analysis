# Changelog

All notable changes to this project will be documented in this file.

## 2026-01-19

### [v0.68.3] Report and Utility Modularization (Maintenance)

- Modularized all report templates into focused chart builders and section builders:
  - AR Data Analysis: Split into chart builders (device, framerate, lighting, movement, orientation, timing) and sections (phone orientation, spherical coverage, time series).
  - Video Analysis: Split into chart builders (color, duration, encoding, GOP, laplacian) and sections (encoding summary, laplacian examples).
  - Sync Report: Split into charts (artifact size, error history, video size) and sections (disk usage, failures, summary).
  - Discard Report: Split into charts, sections, and utils modules.
  - Scan Analysis: Split into charts and sections (ceiling, floor, object, summary, surface).
- Refactored AR data metadata extraction into smaller, focused modules (angular metrics, cache validation, EXIF extraction, framerate metrics, motion metrics, sensor metrics).
- Extracted raw scan data utilities into dedicated modules (aggregators, dimension filters, iterators, metadata collectors, object confidence, wall analysis).
- Extracted video analysis utilities into focused modules (entropy coding, ffprobe utils, GOP analysis, signal stats).
- Created dedicated model files for AR data types (arDataMetadata, cameraIntrinsics, coverageSphere) and chart types (arDataCharts, videoCharts, rawScanMetadata).
- Removed obsolete chart index barrel file and consolidated imports.
- Updated test coverage to match new module structure.

## 2026-01-18

### [v0.68.2] Discard Pipeline Modular Config (Maintenance)

- Split discard pipeline into dedicated phase modules (clean, filter, duplicates, mismatch) with a shared normalized config for consistent defaults, environment overrides, and persistence.
- Centralized config builder for DRY handling of dataDir, dryRun/save flags, concurrency, file paths, and injected services (fs/ffprobe/logger/Gemini).
- Kept public phase exports intact for reuse while reducing duplicate env checks and ensuring video hash persistence flows through the normalized config.

### [v0.68.1] Validation Report Modularization (Maintenance)

- Refactored validation report generation into reusable chart and section helpers, improving testability and reuse across reports.
- Hardened validation script by splitting pagination, page processing, and aggregation, plus added edge-case tests for artifact stats.
- Updated unit tests to cover new helpers and validation edge cases, keeping the pipeline ready for release.

## 2026-01-17

### [v0.68.0] Ceiling Analysis and Wall Shape Classification

- Added Ceiling Analysis section to the scan analysis report with "Maximum Difference in Ceiling Height" chart
  showing the distribution of ceiling height variations across artifacts (displayed in feet with a 2-inch
  minimum threshold).
- Separated non-rectangular wall shapes into two distinct categories:
  - **Slanted Wall Shapes**: Non-rectangular walls with angled profiles but no notches (re-entrant corners)
  - **Notched Wall Shapes**: Non-rectangular walls with vertical steps/notches (re-entrant corners with
    interior angles > 180°)
- Both wall shape charts are displayed side-by-side in the Ceiling Analysis section when both types are present.
- Improved test coverage for `scanAnalysisReport.ts` (from 7 to 19 tests) and `rawScanExtractor.ts` (from 73%
  to 99% line coverage).
- Added comprehensive tests for ceiling height difference calculations, wall shape classification, and edge
  cases.

### [v0.67.0] Vanity Placement Detection

- Added corner vanity detection to distinguish regular (flush against wall) vanities from corner vanities (positioned diagonally).
- Corner detection analyzes vanity bounding box edges against nearby wall orientations; if no edge is parallel to any wall within 15°, the vanity is classified as a corner placement.
- New "Vanity Placement" pie chart shows regular vs corner distribution alongside the existing Number of Sinks and Vanity Type charts.
- Extended metadata schema with `vanityPlacement` field and added `getVanityPlacement` extractor for aggregation.

## 2026-01-12

### [v0.66.1] Shape Overlay Polish and Scan Report Coverage

- Aligned surface shape overlays with their corresponding aspect ratio charts, removing frames and guide lines while keeping a clean white canvas for stacked silhouettes.
- Tweaked chart row offsets so shape overlays sit flush with scatter plot axes and titles, matching visual rhythm across paired charts.
- Expanded scan analysis report tests to cover aspect-ratio-only rows, shapes-only rows, and attribute chart chunking to maintain high coverage.

## 2026-01-11

### [v0.66.0] Surface Shape Overlay Charts

- Added normalized shape overlay charts for floors, walls, windows, doors, and openings to the scan analysis reports so surface silhouettes are stacked at a common scale.
- Cached surface outlines (from polygons or dimensions) inside `rawScanMetadata.json`, exposed outline getters, and wired them into the new chart builder.
- Introduced a dedicated Shape Overlay chart component and shared utilities plus documentation updates for the new visualization.

## 2026-01-06

### [v0.65.0] Spherical Coverage Visualizations and Color Signal Stats

- Compute per-scan spherical coverage from AR camera intrinsics/transforms, cache the grids, and aggregate them into a
  multi-view globe plus 6 ft radius heatmap with coverage stats in the AR Data Analysis report.
- Extract hue/saturation/brightness and RGB mean/variance (plus clipped pixel percentages) via ffprobe signalstats, cache
  the results, and feed the color distribution charts with data-driven gradients and stronger cache validation.
- Improve chart rendering by supporting multi-stop gradients, refining KDE bound detection for narrow peaks, and
  rebalancing chart row layout to avoid overflow with custom widths and side notes.
- Refresh artifact status configs (checked/bad/sync failures), regenerate report PDFs, and document the new coverage and
  color metrics ahead of release.

## 2026-01-05

### [v0.64.0] Color Stats Charts, Gradients, and Hue Sampling Threshold

- Added color distribution charts (mean/variance for hue, saturation, brightness; RGB channel mean/variance overlays; clipped pixel percentages) to the video analysis report.
- Line charts now support multi-stop gradients; mean hue uses the actual hue wheel, saturation/brightness are shaded by their values, and the RGB overlays keep their distinct fills.
- Hue sampling ignores low-saturation frames (S > 0.15) so hue statistics reflect chromatic pixels instead of noise; updated tests and sample metadata accordingly.
- RGB channel mean overlay is locked to a 0–255 x-axis with mean and variance on separate rows to preserve PDF layout.
- Documentation clarifies that saturation uses ffmpeg SATAVG (0–200 scale) and highlights the new color metrics ahead of release.

## 2026-01-04

### [v0.63.0] Laplacian Examples Layout Polish

- Added uniform-height Laplacian example thumbnails in the video analysis report, placed above the blurriness and shakiness charts with simplified styling (no borders or shadows) for a consistent row.
- Ensured functional pipeline tests copy the Laplacian assets into the temp workspace so report generation succeeds in isolation.
- Bumped package version to 0.63.0 for release.

## 2026-01-03

### [v0.62.0] Stage-Prefixed Reports, Video Encoding Insights, and Header Anomaly Detection

- **Stage-Numbered Outputs**: All generated PDFs now carry pipeline prefixes (`0 - Validation`, `1 - Sync`,
  `2 - Discard`, `3.x - Analysis`), with scripts, architecture docs, and README updated to match the reordered flow.
- **Validation Drilldowns**: The validation report lists artifacts with invalid scanDate values, missing projectId, or
  missing required assets (video/rawScan/arData) per environment alongside the existing summary tables.
- **Richer Video Metadata**: Video extraction now captures bitrate, codec/profile/level, B-frame/ref counts, GOP size
  plus min/avg/max/variance, color transfer/range/space, pixel format, bit depth, entropy coding mode, and
  creationTime, refreshing caches when any fields are missing.
- **Laplacian Sharpness Metrics**: Per-frame Laplacian values are computed and cached to chart median blurriness and
  shakiness (standard deviation of Laplacian) in the video analysis report. Added Laplacian example frames (0.4, 2, 3, 844) above the sharpness charts for quick visual reference.
- **Encoding-Focused Video Report**: Video analysis adds bitrate histograms (Mbps), color space and encoding summary
  lines, profile/level and B-frame charts, and GOP charts (max/avg/min/variance) with side notes for long tails.
  Average GOP now renders on its own full-width line for readability.
  Bitrate shows units in the title instead of a legend, sits beside Level, and Min GOP now lives on its own full-width
  chart line rather than sharing with GOP Variance.
  Laplacian (blurriness/shakiness) charts now use the same teal palette as the other video charts for consistency.
  Shakiness chart title is shortened (x-axis already calls out the Laplacian std dev).
- **Header Anomaly Detection**: Discard mismatch stage scans active and discarded artifacts for stray avcC bytes ahead
  of the primary header, caches results, and surfaces counts and detail lists in the discard report with new summary
  rows.
- **Report Context Improvements**: Discard report clarifies the short-video threshold and includes header anomaly
  summaries; inspection logging reflects the new report names.

## 2026-01-01

### [v0.61.0] Phone Motion Analytics, Movement Speeds, and Zoomed Charts

- **Phone Orientation Analysis**: Extract tilt, roll, and pan angles from AR camera transforms; cache
  histograms with overflow percentages and render new protractor charts (with reference
  illustrations) for tilt, roll, and full 360° pan profiles.
- **Movement Distance & Speed Metrics**: Compute path length, displacement, scan duration, and
  sliding-window min/avg/max speeds; add scan efficiency scatter plot (with zoomed detail) plus a
  movement speed KDE overlay.
- **Rotation Coverage & Fast Motion Signals**: Detect scans that complete a full 360° rotation and
  chart partial rotation coverage; track fast tilt/roll/pan events (> 5 °/s) with pie charts,
  timing line charts, and maximum angular speed KDEs.
- **Chart & Layout Upgrades**: Scatter charts now support independent axes and zoom boxes; line
  charts format y-axis values with decimals/suffixes; pie/section layout improvements keep
  dual-chart rows centered with custom widths and prevent legend clipping.
- **Device Sorting & Test Coverage**: Centralize device model sorting by release order, expose
  script entrypoints for testing, and raise coverage thresholds to 99% while excluding
  interface-only models; new unit tests cover SpatialService caching, device sorting, motion math,
  and chart components.

## 2025-12-31

### [v0.60.0] Comprehensive AR Data Metrics, Capture Rate Analysis, and Color-Accurate Charts

- **Extended AR Data Metrics**: Track min/max/avg for ambient intensity, color temperature, ISO,
  and brightness values. Previously only averages were captured; now minimum and maximum values are
  extracted and visualized in dedicated KDE charts.
- **AR Data Capture Rate**: Calculate sampling framerate from AR data timestamps in FPS showing how
  frequently the device captured AR frames during scanning.
- **Dropped Frames Detection**: Detect dropped AR frames by identifying intervals that exceed 1.5×
  the median interval. Visualized with a pie chart showing percentage of scans with dropped frames,
  a trend chart showing dropped frame rates over time, and a new chart showing the average dropped
  frame percentage per scan over time. Both `droppedArFrameCount` and `droppedArFramePercentage`
  fields are now tracked for each artifact, with percentage providing normalized comparison across
  videos of different lengths.
- **Timezone Extraction**: Extract timezone (UTC offset) from EXIF `OffsetTime` field, displayed as
  a bar chart with abbreviated timezone names (e.g., "-07:00 MT", "+05:30 IST").
- **Time of Day Analysis**: Added a "Time of Day (Hour)" bar chart showing when scans were taken,
  extracted from EXIF `DateTimeOriginal` field with 24 hour buckets (00-23).
- **Color-Accurate Chart Gradients**: Added `kelvinToRgb.ts` and `brightnessToRgb.ts` utilities that
  convert color temperature (Kelvin) and brightness values (EV) to accurate hex colors. Charts now
  display scientifically accurate gradients: warm orange tones for low color temperatures, cool blue
  for high temperatures, and grayscale gradients for brightness values.
- **AR Data Report Expansion**: The `ardata-analysis.pdf` report now includes 20 chart sections:
  - Device Model, Focal Length & Aperture
  - Timezone (UTC Offset), Time of Day (Hour)
  - AR Data Capture Rate, Artifacts with Dropped Frames pie chart, Artifacts with Dropped Frames Over Time trend, Average Dropped Frame Percentage Over Time
  - Ambient Intensity: Average, Minimum, Maximum KDE charts
  - Color Temperature: Average, Minimum, Maximum KDE charts with Kelvin-accurate colors
  - ISO Speed: Average, Minimum, Maximum KDE charts
  - Brightness Value: Average, Minimum, Maximum KDE charts with EV-accurate grayscale
- **Sync File Types Corrected**: Changed `pointCloud.json` to `pointCloud.ply` and
  `initialLayout.json` to `initialLayout.png` to match actual file formats.
- **Discard Reason Files Enhanced**: All discard operations (clean, filter, duplicates, sync
  failures) now write a `discard-reason.txt` file with timestamp and reason.
- **Duplicate Artifact Handling**: When discarding an artifact that already exists in
  `discarded-artifacts/`, the source is now removed instead of creating timestamped duplicate
  folders, reducing disk space waste.
- **Multi-line Bar Chart Labels**: BarChart component now supports multi-line tick labels using
  newline characters (e.g., for timezone offset with abbreviation).
- **Chart Tick Scaling**: Line chart x-axis ticks now scale based on chart width, preventing
  overcrowding on narrower charts.
- **Wall Height Calculation Fix**: Removed fallback height span calculation in Wall model that could
  produce incorrect values when all polygon points were at the same Y level.
- **Test Coverage**: Expanded test coverage for AR data metadata extraction, chart utilities,
  discard artifact handling, sync report generation, and validation scripts.

## 2025-12-30

### [v0.59.0] Split Data Analysis into Three Separate Reports

- **Report Separation**: Split the single `data-analysis.pdf` into three focused reports for better
  organization and easier navigation:
  - `video-analysis.pdf` - Video metadata: duration, framerate, resolution distributions
  - `ardata-analysis.pdf` - AR data and camera analysis: device models, focal length, aperture,
    ambient intensity, color temperature, ISO speed, brightness value
  - `scan-analysis.pdf` - Room scan data: section types, feature prevalence, capture errors,
    object distribution with confidence levels, dimension/area charts, attribute pie charts
- **New Report Templates**: Created `videoAnalysisReport.ts`, `arDataAnalysisReport.ts`, and
  `scanAnalysisReport.ts` as dedicated report builders for each domain.
- **Modular Architecture**: Retained shared chart utilities in `dataAnalysisReport/charts/` for
  reuse by the scan analysis report.
- **Documentation Updated**: README and ARCHITECTURE.md updated to reflect the new three-report
  output structure.

## 2025-12-29

### [v0.58.0] Consolidate Duplicate and Date Mismatch Detection into Discard Pipeline

- **Duplicate Detection Moved to Discard**: Relocated video duplicate detection from sync to the
  discard script as a dedicated `runDuplicatesPhase`. This separates data acquisition (sync) from
  data validation (discard), improving maintainability and allowing duplicate checks to run
  independently.
- **Date Mismatch Detection Moved to Discard**: Relocated scan-vs-video date mismatch detection
  from sync to discard with a new `runMismatchPhase`. Mismatches are now cached in
  `checkedScans.json` with fields `mismatchCheckedDate`, `mismatchDiffHours`, `mismatchScanDate`,
  and `mismatchVideoDate` to avoid reprocessing.
- **Discard Report Enhanced**: Added duplicate video and date mismatch sections to the discard
  report, including summary tables with cached/new breakdowns by environment and trend charts.
- **Sync Report Simplified**: Removed duplicate video and date mismatch sections from sync report
  since these are now handled by discard. Inaccessible artifacts chart now uses the global date
  range configuration for consistent timeline display.
- **Stats Models Reorganized**: Moved `DuplicateVideo`, `DateMismatch`, and `DuplicateStats` types
  from `syncStats.ts` to `discardStats.ts`. Added `duplicates` stage to `DiscardStage` type.
- **Chart Date Range**: Updated `CHART_DATE_RANGE.startDate` from "2024-07-23" to "2024-07-22".
- **Test Coverage**: Added `dateRange.test.ts` for chart date utilities. Expanded test coverage
  for discard phases, sync artifact processing, and report generation.

## 2025-12-28

### [v0.57.0] File Size Reporting for All Sync Data Types

- Sync report now tracks and displays file sizes for arData, rawScan, pointCloud, and initialLayout
  files in addition to videos, with daily average and cumulative trends.
- Line charts support additional dataset styling options for mixed file type visualizations.
- Expanded test coverage for sync artifact handling, prevalence charts, validation report,
  discard artifact utilities, vanity analysis, and video metadata extraction.
- Discard now produces `reports/discard-report.pdf` with clean/filter summaries and new bad scans
  grouped by reason and environment.
- Discard flow tracks bad scan deltas to populate the report, including failed moves and dry-run
  context.
- Added a dedicated discard report template and unit coverage; running `npm run discard` now
  emits the PDF alongside stats.

### [v0.56.0] Aggregated Chart Visualizations and Vertical Line Rendering

- Sync report video size chart now aggregates all environments into a single mixed chart showing
  daily average, all-time cumulative average, and cumulative total size with area fill for visual
  depth.
- Added artifact history tracking for arData, rawScan, pointCloud, and initialLayout files by date,
  enabling future per-file-type trend visualizations.
- Line charts now support vertical line rendering mode via the `verticalLines` option, displaying
  discrete data points as bar-like vertical strokes from baseline to value.
- Validation report scan success percentage chart now aggregates across all environments with both
  daily (vertical lines) and cumulative (smooth line) views for clearer trend analysis.
- Inaccessible artifacts trend chart in sync report now uses vertical lines for daily error counts.
- Error and warning charts in validation report use vertical lines to better represent discrete
  daily counts.
- Refactored prevalence chart definitions from switch statements to streamlined if/else chains for
  improved readability.
- Expanded test coverage for sync artifacts, prevalence charts, validation report, sync failures,
  download helpers, and video metadata utilities.

## 2025-12-27

### [v0.55.0] Sync Failure Accuracy, Lens Metadata Normalization, and Embedded Overlap Handling

- Sync failure counts now ignore optional file misses and deduplicate by artifact ID so known
  and new failure totals reflect only required file issues across environments.
- Sync report adds "Total Saved to Disk" and "Already Present" rows to clarify what was newly
  downloaded versus already on disk while keeping failure/skip totals intact.
- AR metadata extraction prioritizes EXIF focal length/aperture, normalizes prefixed F-numbers,
  and gracefully handles missing lens models or invalid ISO/brightness data to avoid noisy
  averages.
- Embedded object intersection checks now treat story-less objects as floor-level, detect
  overlaps only when stories match, and skip malformed transforms or dimensions to reduce false
  positives.

### [v0.54.0] Unified Artifact Discarding and Report Cleanup

- Created `discardArtifact` utility that centralizes moving invalid artifacts to
  `data/discarded-artifacts` with collision-safe naming and safety checks.
- Refactored `cleanData` to move artifacts instead of deleting them, preserving the
  environment directory structure under `discarded-artifacts`.
- Refactored `filterNonBathrooms` to use the shared `discardArtifact` utility instead of
  direct deletion for consistency and safety.
- Sync report now hides environments with no sync errors (neither new nor known) for
  cleaner output.

### [v0.53.0] Duplicate Video Offloading and Bad Scan Guardrails

- Sync now relocates duplicate videos to `data/discarded-artifacts` and records them in
  `config/badScans.json` so the same artifact IDs are skipped on subsequent runs while their
  hashes remain tracked for reporting.
- Duplicate detection now keeps a canonical artifact per hash and marks the additional copies
  as bad scans immediately, preventing repeated downloads of known duplicates.

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
