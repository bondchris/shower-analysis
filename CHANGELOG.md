# Changelog

All notable changes to this project will be documented in this file.

## 2025-12-21

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

### [v0.41.0] Improve device sorting and test coverage

- **Lens Analysis**: Split Lens Model analysis into dedicated charts for Device, Focal Length, and Aperture with improved formatting.

### [v0.40.0] Add Video Size Chart and Disk Usage Summary

- **Average Video Size Chart**: Added a line chart to the sync report visualizing average video size trends over time per environment.
- **Disk Usage Summary**: Added a disk usage table with comprehensive Total, Average, and New size metrics.
- **Test Coverage**: Added robust test cases for `LineChart` edge cases and `syncReport` zero-data scenarios.

### [v0.39.1] Add chart data labels and improve coverage

- **Chart Data Labels**: specific charts (Framerate, Resolution) now display numerical counts above bars, and horizontal charts (Lens Models) display percentages.
- **Fix Chart Clipping**: Resolved layout issues in the "Feature Prevalence" chart within the Data Analysis report.
- **Test Coverage**: Significantly improved test coverage.
- **Linting**: Added functional test that simulates a full pipeline run.

## 2025-12-19

### [v0.39.0] Persist all metadata for inspect

- **Persist Video Metadata**: Implemented caching for video metadata extraction (`videoMetadata.json`), significantly improving subsequent run times.
- **Persist RawScan/ArData**: Extended caching to `RawScan` and `ArData` metadata (`rawScanMetadata.json`, `arDataMetadata.json`).
- **Refactor Utilities**: Moved metadata logic to domain-specific folders (`src/utils/room`, `src/utils/arData`, `src/utils/video`) for better separation of concerns.

### [v0.38.0] Centralize Artifact Iteration & Model Cleanup

- **Centralized Artifact Iteration**: Introduced `src/utils/data/artifactIterator.ts` to unifiy artifact discovery via `meta.json`. Refactored scripts to use this shared utility.
- **Model Cleanup**: Removed unused `filename`, `path`, and `environment` properties from the `ArtifactAnalysis` domain model.
- **Decoupled Metadata Extraction**: Updated `inspectArtifacts.ts` to capture `RawScan` and `ArData` metadata even if video metadata extraction fails.

## 2025-12-18

### [v0.37.0] Refactor Validation Report Architecture

- Moved chart generation logic from `validateArtifacts.ts` script to `validationReport.ts` template
- Decoupled report models by removing re-exports from `reportGenerator.ts` and importing directly from `models/report.ts`
- Added comprehensive documentation to concurrency helpers (`pLimit`) in `syncArtifacts.ts`
- Refactored global constants in `syncArtifacts.ts` to local scopes for better encapsulation
- Improved separation of concerns between data processing and report presentation

### [v0.36.0] Add test coverage reporting

- Added test coverage reporting using @vitest/coverage-v8
- Configured Vitest with coverage thresholds (75% lines/functions/statements, 70% branches)
- Added `test:coverage` npm script to generate coverage reports
- Coverage reports generated in multiple formats: text, JSON, HTML, and LCOV
- Updated ESLint, Prettier, and Markdownlint ignores to exclude coverage, data, and node_modules directories
- Added coverage documentation to README
- Coverage HTML reports available at `coverage/index.html` for detailed line-by-line analysis

## 2025-12-17

### [v0.35.0] Migrate to visx for product rendering

- Migrated chart rendering system from previous implementation to use the visx library
- Introduced four new React chart components: BarChart, Histogram, LineChart, and MixedChart
- Refactored chart utilities module from monolithic chart generation to component-based system
- Each chart type is now a self-contained React component
- Chart configuration interfaces updated to work with the new component-based approach
- Report generation templates adjusted to integrate the new chart components
- PDF reports show reduced file sizes indicating more efficient rendering

## 2025-12-16

### [v0.34.0] Build the charts in react components instead of generating images

- Refactored chart generation to build charts as React components instead of static images
- Removed `chartjs-node-canvas` dependency
- Moved from Chart.js canvas rendering to component-based React system
- Updated report generator to use ReactDOMServer.renderToStaticMarkup
- Report generator loads Chart.js and chartjs-plugin-datalabels libraries into HTML
- Set viewport size to A4 dimensions (794x1123px)
- Added wait for charts to render before generating PDF
- Chart utilities module refactored to remove ChartJSNodeCanvas usage
- Configuration objects now passed to React components instead of generating image files
- PDF reports show substantial size reductions
- Report templates and generation logic updated for component-based chart system

### [v0.33.2] Upgrade to the latest version of all of our packages

- Upgraded all project dependencies to latest versions
- Migrated from `.eslintrc.cjs` to flat config format (`eslint.config.mjs`)
- Updated package-lock.json with extensive dependency changes
- Removed `tailwind.config.js` in favor of newer configuration approach
- Updated TypeScript configuration for newer compiler options
- Regenerated compiled CSS file with updated Tailwind classes and utilities
- Ensures latest features, security patches, and performance improvements

### [v0.33.1] Add react linting

- Added React-specific linting rules to ESLint configuration
- Introduced `eslint-plugin-react` package
- Configured to enforce React best practices and catch common React issues
- Updated ESLint configuration with React-specific rules
- Essential for maintaining code quality with React components for templates and charts
- Added React linting dependencies to package-lock.json

### [v0.33.0] Switch to vitest

- Migrated test framework from Jest to Vitest
- Removed Jest configuration files
- Replaced with Vitest configuration
- Updated all test files to use Vitest's API
- Updated test imports and assertions to use Vitest's modules
- Adjusted test runner configuration for Vitest execution model
- Introduced custom ESLint rules: `no-commented-out-code` and `no-duplicate-comments`
- Updated package.json to use Vitest for test command
- Removed Jest dependencies, added Vitest and related packages
- Provides faster test execution and better integration with Vite

### [v0.32.0] Switch to tailwinds

- Migrated styling system to Tailwind CSS utility-first framework
- Replaced custom CSS with Tailwind utility classes
- Updated component templates to use Tailwind utility classes
- Configured Tailwind to work with project's build system
- Regenerated print stylesheet with Tailwind utility classes
- Updated input CSS file to import Tailwind's base, components, and utilities
- Provides maintainable and scalable styling approach

### [v0.31.0] Switch to react based templates

- Refactored PDF template system to use React-based templates
- Added React and ReactDOM dependencies to package.json
- Converted template files to React components
- Templates now use React's component model, JSX syntax, and component composition
- Reorganized component structure for React's component hierarchy
- Converted template files to React components with TypeScript typing
- Enables better code organization and reusability

## 2025-12-15

### [v0.30.0] Move PDFs to template based generation

- Refactored PDF generation to use template-based approach
- Created new model files: envStats.ts and syncStats.ts
- Moved report templates to dedicated `src/templates` directory
- Separated report structure/content definition from generation logic
- Generation logic focuses on data processing and template rendering
- Makes it easier to modify report layouts without touching core logic

### [v0.29.0] Migrate PDF creation to playwright

- Migrated PDF generation from pdfkit to Playwright
- Replaced pdfkit dependency with playwright in package.json
- Created new reportGenerator utility module using Playwright's chromium browser
- Updated PDF generation code to use Playwright's API
- ReportGenerator uses ReactDOMServer.renderToStaticMarkup to render React components
- Generates PDFs with A4 format and 40px margins
- Provides better cross-browser support and more reliable rendering

### [v0.28.0] Centralize PDF creation logic

- Centralized PDF creation logic into single reusable module
- Created new `src/utils/pdfUtils.ts` file
- Consolidated all PDF creation functionality
- Updated inspectArtifacts, syncArtifacts, and validateArtifacts scripts to use centralized utility
- Eliminates code duplication
- Makes it easier to maintain and ensure consistency across report types

### [v0.27.0] Implement a logger

- Implemented centralized logging system using winston library
- Created new `src/utils/logger.ts` file
- Logger uses winston's console transport with colorized output
- Timestamp formatting: YYYY-MM-DD HH:mm:ss
- Log levels configured via LOG_LEVEL environment variable (defaults to "info")
- Updated all scripts to use logger instead of console.log statements
- Updated spatialService to use logger
- Ensures consistent log formatting and easier debugging

### [v0.26.5] Add tests for the filter bathrooms script

- Added comprehensive unit tests for filter bathrooms script
- Validates functionality that identifies and filters out non-bathroom scans
- Tests cover various edge cases and input scenarios
- Verifies filtering produces expected results
- Improves code reliability and makes refactoring safer

## 2025-12-14

### [v0.26.4] Add tests to the clean data script

- Added comprehensive unit tests for clean data script
- Validates data cleaning functionality
- Tests cover various data quality scenarios and edge cases
- Verifies cleaning process produces expected output
- Improves code reliability and provides confidence for changes

### [v0.26.3] Add tests for the format AR data script

- Added comprehensive unit tests for format AR data script
- Validates functionality that formats augmented reality data
- Tests cover various data transformation scenarios
- Verifies formatting produces expected output structure
- Ensures AR data formatting remains consistent and correct

### [v0.26.2] Add tests for the sync script

- Added comprehensive unit tests for sync artifacts script
- Validates functionality that synchronizes artifact data from remote sources
- Tests cover various synchronization scenarios and network error handling
- Verifies sync process works correctly under different conditions
- Makes it safer to modify synchronization logic

### [v0.26.1] Add tests to the validation script

- Added comprehensive unit tests for validation script
- Validates artifact validation functionality
- Tests cover various validation scenarios and edge cases
- Verifies validation process produces accurate and complete reports
- Ensures validation logic remains correct as codebase evolves

### [v0.26.0] Improve analysis from validation

- Improved analysis capabilities of validation process
- Added dynamic property tracking that counts presence of all properties in artifacts
- Tracks warnings separately from errors (projectId as warning field, not required)
- Tracks clean scans by date
- Generates property presence counts for all artifact properties
- Checks for invalid dates (those starting with "0001")
- Processes artifacts with concurrency limits
- Generates comprehensive reports showing error trends, warning trends, and property presence over time
- Renamed artifactMetadata model to artifactAnalysis

### [v0.25.6] Update commenting throughout the repo

- Updated comments throughout repository to improve code documentation
- Reviewed and updated code comments to accurately describe functionality
- Comments now explain complex logic and provide context for future developers
- Improves code maintainability and reduces misunderstandings

### [v0.25.5] Improve efficiency of main scripts using caches

- Improved efficiency of main scripts by implementing caching mechanisms
- Added filesystem caching to SpatialService class
- Caches API responses in local `data/api_cache` directory organized by environment name
- Cache validation based on comparing total count of items on server with cached metadata
- Updated cleanData script to use cached data when available
- Avoids redundant API calls and significantly reduces execution time
- Improves user experience and reduces load on external systems

## 2025-12-13

### [v0.25.4] Add spatial service tests

- Added comprehensive integration tests for spatial service
- Validates SpatialService class functionality
- Tests verify service fetches scan artifacts from Spatial API with filesystem caching
- Tests ensure correct processing of spatial data
- Tests handle cache validation based on total count
- Tests manage filesystem cache directories
- Tests handle edge cases and produce accurate results
- Integration tests verify service works correctly with external systems

### [v0.25.3] Nest unit tests into a folder called unit

- Reorganized test directory structure by nesting unit tests into "unit" folder
- Moved unit tests from `tests/utils` to `tests/unit/utils`
- Created clear separation between unit tests and integration tests
- Integration tests remain in `tests/integration`
- Improves test directory structure and makes test organization clearer
- Follows testing best practices

### [v0.25.2] Extract the touching distance to a shared constant

- Extracted touching distance constant to shared location
- Moved magic number from embedded code to named constant in shared constants file
- Makes value easy to find and modify
- Provides single source of truth for configuration
- Makes code more readable with meaningful name
- Part of effort to eliminate magic numbers

### [v0.25.1] Refactor and add tests for chartUtils

- Refactored chart utilities module and added comprehensive tests
- Significantly refactored `src/utils/chartUtils.ts` (513 lines changed: 472 additions, 201 deletions)
- Improved code organization and removed duplication
- Made utilities more maintainable
- Created new test file `tests/utils/chartUtils.test.ts` with 160 lines of tests
- Tests validate chart utility functions
- Ensures chart utilities continue to work correctly as codebase evolves

### [v0.25.0] Introduce library for unit conversion

- Introduced convert-units library for unit conversion functionality
- Added convert-units package and TypeScript types to package.json
- Used throughout room checking utilities: checkColinearWalls, checkCrookedWalls, checkIntersections, checkNibWalls, checkToiletGaps, checkTubGaps, checkWallGaps
- Used in math utilities: constants, polygon, segment, vector
- Provides centralized and reliable way to perform unit conversions
- Ensures consistency and accuracy for spatial data and dimensions

### [v0.24.0] Introduce a Point class

- Introduced Point class to represent two-dimensional points
- Created new `src/models/point.ts` file with Point class (x and y number properties)
- Replaced ad-hoc point representations throughout codebase
- Used in chartUtils, polygon, segment, transform, vector utilities
- Used in all room checking functions: checkColinearWalls, checkCrookedWalls, checkDoorBlocking, checkExternalOpening, checkIntersections, checkNibWalls, checkToiletGaps, checkTubGaps, checkWallGaps
- Encapsulates point data and makes point-related code more readable

### [v0.23.0] Centralize vector operations

- Centralized vector operations into dedicated utility module
- Created `src/utils/math/vector.ts` to consolidate vector mathematics functions
- Includes vector addition, subtraction, dot product, cross product, normalization, etc.
- Previously scattered across different files or implemented inline
- Improves code reusability and makes vector operations easier to maintain and test
- Ensures consistency in how vectors are manipulated

### [v0.22.27] Move data utils into their own folder

- Reorganized codebase by moving data utility functions into dedicated folder
- Groups related data manipulation utilities together
- Makes it easier to find and maintain data-related functionality
- Separates data utilities from other utility functions
- Follows single responsibility principle

### [v0.22.26] Separate math utils into their own folder

- Reorganized codebase by separating math utilities into dedicated folder
- Groups all mathematical utility functions together
- Improves code organization and makes mathematical operations easier to find
- Separates math utilities from other utility functions
- Makes codebase structure more intuitive

### [v0.22.25] Split up roomutils

- Split up roomutils module into smaller, focused modules
- Created separate files in `src/utils/room/` directory
- Each file has specific responsibility:
  - checkColinearWalls.ts
  - checkCrookedWalls.ts
  - checkDoorBlocking.ts
  - checkExternalOpening.ts
  - checkIntersections.ts
  - checkNibWalls.ts
  - checkToiletGaps.ts
  - checkTubGaps.ts
  - checkWallGaps.ts
- Improves code organization and makes room-related functionality easier to understand
- Follows single responsibility principle

### [v0.22.24] Set up tests for the door blocked check

- Set up test infrastructure for door blocked check functionality
- Establishes test structure and initial test cases
- Validates logic that detects when doors are blocked by other objects
- Ensures functionality can be properly validated
- Makes it easier to catch regressions

## 2025-12-12

### [v0.22.23] Add tests for the check crooked walls

- Added comprehensive unit tests for crooked walls detection
- Validates logic that identifies walls that are not straight or have irregular angles
- Tests cover different wall configurations and edge cases
- Verifies detection produces accurate results
- Ensures crooked wall detection remains accurate

### [v0.22.22] Add tests for the intersection checks

- Added comprehensive unit tests for intersection checks functionality
- Validates logic that detects intersections between room elements (walls, objects, etc.)
- Tests cover various intersection scenarios and edge cases
- Verifies detection produces accurate results
- Ensures intersection detection remains correct

### [v0.22.21] Add tests for nib wall detection

- Added comprehensive unit tests for nib wall detection
- Validates logic that identifies nib walls (short wall segments)
- Tests cover various wall configurations
- Verifies detection produces accurate results
- Ensures nib wall detection remains accurate

### [v0.22.20] Run the suite

- Executed full test suite to verify all tests pass after recent changes
- Routine maintenance action to ensure code quality
- Catches any regressions that may have been introduced

### [v0.22.19] Add tests for colinear walls

- Added comprehensive unit tests for colinear walls detection
- Validates logic that identifies walls that are colinear (lying on the same line)
- May indicate data quality issues or construction anomalies
- Tests ensure detection algorithm correctly identifies colinear wall configurations
- Verifies detection produces accurate results
- Ensures colinear wall detection remains accurate

### [v0.22.18] Run script suite

- Executed script test suite to verify all scripts work correctly
- Routine verification step to ensure data processing scripts function properly
- Verifies scripts produce expected results

### [v0.22.17] Add tests for wall gaps

- Added comprehensive unit tests for wall gaps detection
- Validates logic that identifies gaps between walls
- May indicate measurement errors, data quality issues, or construction problems
- Tests ensure detection algorithm correctly identifies various gap scenarios
- Verifies detection produces accurate results
- Ensures wall gap detection remains accurate

## 2025-12-11

### [v0.22.16] Add tests for tub gap detection

- Added comprehensive unit tests for tub gaps detection
- Validates logic that identifies gaps around bathtubs
- May indicate installation issues or measurement errors
- Tests ensure detection algorithm correctly identifies various gap scenarios around tubs
- Verifies detection produces accurate results
- Ensures tub gap detection remains accurate

### [v0.22.15] Add tests to toilet gap detection

- Added comprehensive unit tests for toilet gap detection
- Validates logic that identifies gaps around toilets
- May indicate installation issues, code compliance problems, or measurement errors
- Tests ensure detection algorithm correctly identifies various gap scenarios around toilets
- Verifies detection produces accurate results
- Ensures toilet gap detection remains accurate

### [v0.22.14] Add tests for checking for external openings

- Added comprehensive unit tests for external opening detection
- Validates logic that identifies external openings (windows or doors to outside) in room scans
- Tests ensure detection algorithm correctly identifies external openings
- Tests distinguish external openings from internal openings
- Ensures external opening detection remains accurate

### [v0.22.13] Don't run jest on dist

- Updated test configuration to exclude dist directory from Jest test execution
- Prevents test runner from attempting to run tests on compiled JavaScript files
- Ensures tests only run on source files
- Improves test execution reliability and performance

### [v0.22.12] Add tests for polygon intersection

- Added comprehensive unit tests for polygon intersection functionality
- Validates geometric algorithms that detect when polygons intersect
- Crucial for spatial analysis and room validation
- Tests ensure intersection detection algorithm handles various polygon configurations
- Tests cover edge cases and verify accurate results
- Ensures geometric calculations remain correct

### [v0.22.11] Move the polygon intersection function to the mathUtils library

- Moved polygon intersection function to mathUtils library
- Consolidates geometric calculation functions into centralized math utilities module
- Improves code organization
- Makes mathematical functions easier to find and maintain
- Groups related functionality together

### [v0.22.10] Add tests for get position function

- Added comprehensive unit tests for get position function
- Validates functionality that calculates or retrieves position information
- Handles objects and points in spatial coordinate system
- Tests ensure function correctly handles various input scenarios
- Verifies function produces accurate position data
- Ensures position calculations remain correct

### [v0.22.9] Add tests for transform points

- Added comprehensive unit tests for transform points functionality
- Validates coordinate transformation functions
- Tests convert points between different coordinate systems
- Tests apply transformations: rotation, translation, scaling
- Tests ensure transformation functions handle various scenarios correctly
- Verifies transformations produce accurate results
- Ensures coordinate transformations remain mathematically correct

### [v0.22.8] Add dist to segment tests

- Extended segment tests to include distance calculation tests
- Validates functionality that calculates distances between points or along segments
- Tests cover various distance calculation scenarios and edge cases
- Ensures distance calculations are mathematically correct
- Ensures distance calculations remain accurate

### [v0.22.7] Add tests for polygon validation

- Added comprehensive unit tests for polygon validation functionality
- Validates logic that checks whether polygon data is valid
- Checks for closed polygons, proper vertex ordering, no self-intersections
- Tests ensure validation correctly identifies valid and invalid polygons
- Tests handle edge cases
- Ensures polygon validation remains accurate

### [v0.22.6] Move tests to a top level folder

- Reorganized test directory structure by moving tests to top-level folder
- Gives tests dedicated, prominent location at root of project
- Makes it easier to find and navigate tests
- Follows common project organization patterns
- Tests clearly separated from source code

### [v0.22.5] Add test for soffit detection

- Added unit tests for soffit detection functionality
- Validates logic that identifies soffits (underside of architectural features)
- Soffits often found above cabinets or in ceiling areas
- Tests ensure detection algorithm correctly identifies soffit features
- Verifies detection produces accurate results
- Ensures soffit detection remains accurate

## 2025-12-10

### [v0.22.4] Refactor the inspect script

- Refactored inspect script to improve structure and organization
- Reorganized script's logic into smaller functions
- Improved code readability
- Applied refactoring techniques to make script more maintainable
- Improves code quality and makes inspection functionality easier to understand and extend

### [v0.22.3] Extract the functions to do the analysis of a room

- Extracted room analysis functions into separate module
- Moved room analysis logic from inspect script into dedicated functions
- Improves code organization and reusability
- Extracted functions can be used by other parts of codebase
- Functions easier to test and maintain independently
- Follows single responsibility principle

### [v0.22.2] Pull raw scan analysis out into its own step

- Separated raw scan analysis into its own processing step
- Created distinct step for analyzing raw scan data
- Makes pipeline more modular and easier to understand
- Allows raw scan analysis to be performed independently or in different contexts
- Improves code organization and makes data processing flow clearer

### [v0.22.1] Save the path to artifact directories not the videos

- Modified artifact metadata to store paths to artifact directories instead of video file paths
- Stores directory references rather than specific file paths
- Provides more flexibility for working with all files in artifact directory
- Simplifies file access patterns
- Makes metadata more useful for operations on entire artifact directories

### [v0.22.0] Create an artifact metadata file

- Created new artifact metadata file structure
- Introduces standardized way to store and access metadata about artifacts
- Provides centralized location for artifact information
- Metadata file contains artifact IDs, paths, timestamps, and other relevant metadata
- Improves data organization and makes artifact information more accessible

### [v0.21.0] Create mathUtils

- Created new mathUtils module to centralize mathematical utility functions
- Groups mathematical helper functions together in dedicated module
- Makes mathematical operations easier to find, use, and maintain
- Module contains functions for calculations, transformations, and validations
- Improves code organization and follows good software engineering practices

## 2025-12-09

### [v0.20.0] Add blocked doors to scan errors

- Added functionality to detect and report blocked doors in scan data
- Identifies doors that are obstructed by other objects
- May indicate data quality issues, measurement errors, or construction problems
- Integrated into scan error reporting system
- Blocked doors properly flagged and reported in validation outputs
- Improves comprehensiveness of scan validation

### [v0.19.2] Add additional objects to the room features chart

- Expanded room features chart to include additional object types
- Adds more object categories to room analysis
- Provides more comprehensive view of objects detected in room scans
- Additional objects represent different types of fixtures, furniture, and architectural elements
- Makes room features analysis more complete and useful

### [v0.19.1] Refine crooked wall detection to eliminate colinear walls

- Refined crooked wall detection algorithm to exclude colinear walls from being flagged as crooked
- Recognizes that colinear walls (lying on the same line) are not necessarily crooked
- Prevents false positives
- Makes crooked wall detection more precise and useful

### [v0.19.0] Add crooked wall detection

- Added functionality to detect crooked walls in scan data
- Identifies walls that are not straight or have irregular angles
- May indicate measurement errors, data quality issues, or construction problems
- Integrated into error reporting system
- Crooked walls properly flagged in validation outputs
- Improves comprehensiveness of scan validation

### [v0.18.0] Add wall intersections to error report

- Added wall intersection detection to error reporting system
- Identifies cases where walls intersect inappropriately
- May indicate data quality issues or construction anomalies
- Integrated into error report
- Wall intersections properly flagged and reported
- Improves comprehensiveness of scan validation

### [v0.17.0] Add object intersection with walls to error detection

- Added functionality to detect when objects intersect with walls in scan data
- Identifies cases where objects are positioned such that they intersect with wall boundaries
- May indicate data quality issues, measurement errors, or installation problems
- Integrated into error detection system
- Object-wall intersections properly flagged
- Improves comprehensiveness of scan validation

### [v0.16.0] Add object collisions to error chart

- Added object collision detection to error chart
- Identifies cases where objects in scan overlap or collide with each other
- May indicate data quality issues, measurement errors, or spatial conflicts
- Integrated into error reporting visualization
- Makes object collision issues easy to see in error chart
- Improves comprehensiveness of scan validation

### [v0.15.0] Add nib wall detection

- Added functionality to detect nib walls in scan data
- Nib walls are short wall segments, often used in construction
- Detection feature identifies these wall features in scan data
- Expands types of wall configurations that can be recognized and analyzed
- Improves comprehensiveness of room analysis

### [v0.14.0] Add colinear wall detection

- Added functionality to detect colinear walls in scan data
- Identifies walls that lie on the same line
- May indicate data quality issues, measurement precision problems, or construction patterns
- Helps identify cases where multiple wall segments are part of the same wall line
- Important for accurate room analysis
- Improves accuracy of wall analysis

### [v0.13.0] Add wall gap detection

- Added functionality to detect gaps in walls in scan data
- Identifies spaces or gaps between wall segments
- May indicate measurement errors, data quality issues, or construction problems
- Integrated into reporting system
- Wall gaps properly identified and reported
- Improves comprehensiveness of scan validation

### [v0.12.0] Add tub gaps to the report

- Added functionality to detect gaps around tubs in scan data
- Identifies spaces or gaps around bathtubs
- May indicate installation issues, code compliance problems, or measurement errors
- Integrated into reporting system
- Tub gaps properly identified and reported
- Improves comprehensiveness of scan validation

### [v0.11.0] Add scan error count to report

- Added scan error counting functionality to reporting system
- Tracks and reports number of errors detected in scan data
- Provides quantitative measure of data quality
- Error count integrated into reports
- Makes it easy to see overall error rate and track data quality over time
- Improves usefulness of validation reports with summary statistics

### [v0.10.3] Add coloring to the color temperature graph

- Added color coding to color temperature graph
- Visually represents different temperature ranges using color
- Makes graph more informative
- Makes it easier to quickly identify temperature patterns and ranges
- Provides additional visual dimension to data presentation
- Improves graph's usability and interpretability

### [v0.10.2] Improve chart formatting

- Improved formatting and presentation of charts in reports
- Adjusted chart layouts
- Improved label positioning
- Enhanced visual styling
- Made other improvements to how charts are displayed
- Improves readability and professional appearance of reports

### [v0.10.1] Move soffit detection to the wall class

- Moved soffit detection functionality into wall class
- Places soffit detection within wall data structure where it logically belongs
- Improves code organization
- Makes code more intuitive
- Follows object-oriented design principles by keeping related functionality together
- Makes relationship between walls and soffits clearer

### [v0.10.0] Add soffit detection

- Added functionality to detect soffits in scan data
- Soffits are the underside of architectural features
- Often found above cabinets or in ceiling areas
- Detection feature identifies these architectural elements in room scans
- Expands types of features that can be recognized and analyzed
- Improves comprehensiveness of room analysis

### [v0.9.1] Fix external opening counting logic

- Fixed bug in external opening counting logic
- Ensures external openings (windows or doors to outside) are counted accurately
- Prevents incorrect counts that could lead to inaccurate room analysis
- Improves reliability of external opening detection and counting functionality

### [v0.9.0] Add external opening count

- Added functionality to count external openings in room scans
- External openings are windows, doors, or other openings connecting to outside of building
- Tracks and reports number of external openings
- Important for room analysis, code compliance checking, and understanding room connectivity
- Improves comprehensiveness of room analysis

## 2025-12-08

### [v0.8.0] Centralize chart functionality

- Centralized chart functionality into unified chart utilities module
- Consolidates chart-related code into single module
- Improves code organization
- Makes chart functionality easier to maintain and reuse
- Provides common interface for creating and configuring charts
- Reduces code duplication and ensures consistency across chart types
- Follows DRY principle

### [v0.7.3] Extract the gemini logic

- Extracted Gemini AI service logic into separate module
- Separates AI service integration from other code
- Improves code organization
- Makes Gemini service functionality easier to maintain, test, and reuse
- Follows single responsibility principle

### [v0.7.2] Refactor GeminiService

- Refactored GeminiService to improve structure and organization
- Reorganized service's methods
- Improved code readability
- Applied refactoring techniques to make service more maintainable
- Makes Gemini AI integration easier to understand and modify

### [v0.7.1] Move the spatial service to an actual service folder

- Reorganized codebase by moving spatial service to dedicated services folder
- Groups service-related code together
- Makes codebase structure more intuitive
- Follows common project organization patterns
- Makes it easier to find and maintain service-related functionality

### [v0.7.0] Add feature detection to room data analysis

- Added feature detection capabilities to room data analysis
- Expands room analysis to identify and categorize various features within rooms
- Identifies fixtures, architectural elements, and other notable features
- Improves comprehensiveness of room analysis
- Provides more detailed insights into room characteristics

### [v0.6.0] Initial room data analysis in inspect

- Implemented initial room data analysis functionality in inspect script
- Introduces capability to analyze room geometry, spatial relationships, and room characteristics
- Provides basic room analysis features that can be extended over time
- Significantly expands inspection capabilities of the system

### [v0.5.8] Fix inspect report formatting

- Fixed formatting issues in inspect report
- Ensures inspect report is properly formatted and displays correctly
- Fixed issues with layout, styling, and data presentation
- Improves report's readability and professional appearance

### [v0.5.7] Save gemini results

- Added functionality to save results from Gemini AI service
- Persists AI analysis results for reuse or reference
- Avoids redundant AI service calls
- Provides cache of analysis results for debugging or historical reference
- Improves efficiency

### [v0.5.6] Initial pass at adding more data to the inspect report

- Made initial effort to add more data to inspect report
- Expands inspect report to include additional information, metrics, or analysis results
- Makes report more comprehensive and useful
- Provides better insights into scanned artifacts
- Improves value of inspection reports

## 2025-12-07

### [v0.5.5] Sort the keys in arData

- Added functionality to sort keys in AR (Augmented Reality) data
- Ensures AR data structures have consistently ordered keys
- Improves data predictability
- Makes debugging easier
- Ensures consistent output when serializing or processing AR data
- Important for data that may be compared or diffed

### [v0.5.4] Add a script to check for scans that aren't of bathrooms

- Added script to identify and filter out scans that are not of bathrooms
- Helps ensure data quality by identifying scans that don't match expected room type
- Allows non-bathroom scans to be excluded from analysis or flagged for review
- Uses heuristics and analysis to determine whether scan represents a bathroom
- Improves accuracy of bathroom-specific analysis by filtering out irrelevant scans

### [v0.5.3] Reorganize files

- Reorganized project's file structure to improve code organization
- Moved files to more logical locations
- Grouped related files together
- Restructured directories to follow better organizational patterns
- Improves code maintainability
- Makes it easier for developers to find and work with related code

### [v0.5.2] Reinstate validate

- Reinstated validate functionality that was previously removed or disabled
- Brings back artifact validation capabilities
- Allows system to validate scan data and generate validation reports
- Restored validation logic and updated it to work with current codebase
- Fixed issues that had caused it to be removed

### [v0.5.1] Restore validate functionality

- Restored validate functionality to codebase
- Brings back ability to validate artifacts and generate validation reports
- Core feature of the system
- Recovered validation code and updated it to work with current system architecture
- Fixed issues that had caused validation to stop working

### [v0.5.0] Add clean and inspect commands

- Added two new commands to the system: clean and inspect
- Clean command provides functionality to clean or prepare data
- Inspect command enables inspection and analysis of artifacts
- Expands system's capabilities
- Provides new ways to interact with and process scan data
- Commands integrated into project's CLI interface and workflow

## 2025-12-06

### [v0.4.2] Improve error handling of the sync script

- Improved error handling in sync script
- Added better error messages
- Improved error recovery
- More graceful handling of failure cases
- Improves user experience with clearer feedback
- Makes script more reliable in production use

### [v0.4.1] Add markdown linting

- Added markdown linting to project
- Enforces consistent markdown formatting
- Catches common markdown errors
- Includes markdownlint configuration
- Integrates into development workflow
- Ensures all markdown files follow consistent formatting standards
- Improves documentation quality and maintainability

### [v0.4.0] Add a script for syncing down data

- Added script to synchronize artifact data from remote sources
- Enables system to download or sync artifact data from external systems or APIs
- Makes it possible to keep local data in sync with remote sources
- Script handles authentication, API communication, data downloading, and error handling
- Fundamental to system's ability to work with artifact data from external systems

### [v0.3.1] Update validation report format

- Updated validation report format
- Modified how validation results are organized and displayed
- Makes report more readable, informative, and better suited for intended use case
- Improves usefulness and professional appearance of validation reports

### [v0.3.0] Add a script to analyze artifact data that's available

- Created initial script to analyze available artifact data
- Introduces core functionality for processing and analyzing artifact data
- Establishes basis for system's analytical capabilities
- Script provides functionality to read, process, and generate reports from artifact data
- Major milestone in project's development

### [v0.2.0] Initial commit

- Initial commit establishing repository structure and basic project setup
- Includes initial .gitignore file to exclude build artifacts and dependencies from version control
- Includes basic README to document the project
- Sets up project infrastructure
- Establishes starting point for the codebase
