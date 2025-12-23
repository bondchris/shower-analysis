# Architecture

This document describes the architecture of the Shower Analysis project, including its components, data flow, and design decisions.

## Overview

Shower Analysis is a TypeScript-based data processing and analysis tool that validates, synchronizes, inspects, and reports on room scan artifacts.

The system processes data from multiple environments (Lowe's Staging, Lowe's Production, Bond Production, Bond Demo) and generates comprehensive PDF reports with visualizations.

## System Architecture

The system follows a modular, service-oriented architecture with clear separation of concerns:

```text
┌─────────────────────────────────────────────────────────────┐
│                      CLI Scripts Layer                      │
│  (sync, validate, inspect, clean, filter, format)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Services Layer                           │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Spatial    │  │    Gemini    │                         │
│  │   Service    │  │   Service    │                         │
│  └──────────────┘  └──────────────┘                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Utilities Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Chart     │  │     Math     │  │     Room     │       │
│  │   Utils      │  │    Utils     │  │   Analysis   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Data      │  │   Report     │  │    Sync      │       │
│  │   Utils      │  │  Generator   │  │   Helpers    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐                                           │
│  │    Logger    │                                           │
│  └──────────────┘                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Models Layer                             │
│  (rawScan, arData, chart, point, report, artifactAnalysis)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Templates Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   React      │  │    Chart     │  │   Report     │       │
│  │ Components   │  │  Components  │  │  Templates   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Scripts (`src/scripts/`)

The entry points for different operations:

- **`syncArtifacts.ts`**: Downloads artifact data from Spatial API with filesystem caching
- **`validateArtifacts.ts`**: Validates artifact integrity and generates error trend reports
- **`inspectArtifacts.ts`**: Performs deep analysis of metadata, lighting, and room features
- **`cleanData.ts`**: Removes invalid or corrupt artifacts
- **`filterNonBathrooms.ts`**: Uses Gemini AI to filter out non-bathroom videos
- **`formatData.ts`**: Creates sorted, normalized copies (`arDataFormatted.json`, `rawScanFormatted.json`) without mutating the originals; sorts keys and AR frame timestamps for consistent diffs

### Services (`src/services/`)

External integrations and core services:

- **`SpatialService`**: Fetches pages of scan artifacts from the Spatial API with a count-based cache
  - Filesystem cache in `data/api_cache/{environment}/`
  - Cache invalidation based on total count comparison
  - Fetches one page at a time; pagination and concurrency are coordinated by caller scripts (for example, `syncArtifacts.ts`)
  - No built-in retry; callers handle error tracking and recovery

- **`GeminiService`**: Wrapper for Google's Gemini AI
  - Uses `gemini-3-pro-preview` model by default
  - Handles video classification for bathroom detection
  - Results cached in `config/checkedScans.json`

### Utilities (`src/utils/`)

Organized by domain:

- **`chart/`**: Chart configuration and data transformation utilities
  - `configBuilders.ts`: Chart configuration builders for BarChart, LineChart, PieChart, Histogram, and MixedChart
  - `kde.ts`: Kernel density estimation for smooth area charts
  - `histogram.ts`: Histogram calculations and binning
  - `colors.ts`: Color utilities for chart theming
  - Dynamic x-axis label positioning based on tick label length and rotation
  - Gradient support for line chart fills and strokes
- **`data/`**: Data management utilities
  - `badScans.ts`: Tracks known bad artifacts
  - `checkedScans.ts`: Caches Gemini AI classification results
  - `syncFailures.ts`: Tracks synchronization failures
  - `artifactIterator.ts`: Centralized artifact discovery via `meta.json`
  - `rawScanExtractor.ts`: Extracts data from rawScan.json files (areas, object attributes, confidence counts)
- **`math/`**: Mathematical operations (`vector`, `polygon`, `segment`, `transform`, `constants`)
- **`room/`**: Room validation and analysis functions
  - `metadata.ts`: Extracts room metadata (area, counts, features)
  - Wall gap detection
  - Intersection checks
  - Colinear/crooked wall detection
  - Door blocking detection
  - Tub/toilet gap detection
  - Nib wall detection
  - External opening detection
- **`arData/`**: Augmented reality data utilities
  - `metadata.ts`: Extracts AR data metadata (frames, camera resolution, EXIF, light estimates)
- **`video/`**: Video analysis utilities
  - `metadata.ts`: Extracts video metadata (duration, fps, resolution) with caching
- **`sync/`**: Synchronization helpers
- **`logger.ts`**: Centralized logging using Winston
- **`reportGenerator.ts`**: PDF generation using Playwright

### Models (`src/models/`)

Type definitions and domain logic:

- **`rawScan/`**: Raw scan data structures (walls, doors, windows, objects, etc.)
- **`arData/`**: Augmented reality data (frames, camera resolution, EXIF, light estimates)
- **`chart/`**: Chart configuration type definitions (BarChartConfig, LineChartConfig, PieChartConfig, etc.)
- **`point.ts`**: Point class for 2D coordinates
- **`artifactAnalysis.ts`**: Artifact metadata and analysis results
- **`report.ts`**: Report data structures
- **`envStats.ts`**, **`syncStats.ts`**: Statistics models

### Templates (`src/templates/`)

React-based PDF report generation:

- **`components/`**: Reusable React components
  - **`ReportShell.tsx`**: Main report container
  - **`Section.tsx`**: Report section wrapper
  - **`Table.tsx`**: Data table component
  - **`charts/`**: Chart components using visx:
    - `BarChart.tsx`: Horizontal and vertical bar charts with optional stacking and percentage labels
    - `Histogram.tsx`: Histogram charts with customizable bins
    - `LineChart.tsx`: Line and area charts with gradient support and dynamic x-axis labels
    - `MixedChart.tsx`: Combined bar and line charts with dual y-axes
    - `PieChart.tsx`: Pie charts with percentage labels, custom legend icons, and dynamic padding
    - **`legend-icons/`**: SVG-based legend icon system:
      - `SVGIcon.tsx`: Generic icon component with automatic scaling
      - `iconConfig.tsx`: Centralized icon configuration mapping
      - `svgLoader.ts`: SVG file loader with CSS class support and color replacement
- **`dataAnalysisReport.ts`**: Comprehensive data analysis report builder
  - Generates reports with multiple chart types: KDE (kernel density estimation) charts for continuous data, bar charts for categorical data, pie charts for object attributes
  - Modular architecture with helper functions: `buildKdeCharts`, `buildDeviceAndCameraCharts`, `buildErrorFeatureObjectCharts`, `buildAreaCharts`, `buildAttributePieCharts`
  - Includes charts for: duration, lighting (ambient, color temp, ISO, brightness), device models,
    camera settings, room areas, object distributions, feature prevalence, error detection, and
    object attribute types (doors, chairs, sofas, tables, storage)
- **`validationReport.ts`**: Validation report builder
- **`syncReport.ts`**: Sync report builder
- **`styles/`**: CSS styles (Tailwind-based)

## Data Flow

### Synchronization Flow

```text
Spatial API
    ↓
SpatialService (with cache check)
    ↓
Filesystem Cache (if valid)
    ↓
Local Artifact Storage (data/artifacts/{env}/{id}/)
    ↓
Artifact Files (video.mp4, rawScan.json, arData.json)
```

### Validation Flow

```text
Local Artifacts
    ↓
validateArtifacts.ts
    ↓
Property Validation
    ↓
Error/Warning Aggregation
    ↓
Chart Generation (utils/chart/configBuilders)
    ↓
Report Template (validationReport.ts)
    ↓
PDF Generation (reportGenerator.ts)
    ↓
reports/validation-report.pdf
```

### Inspection Flow

```text
Local Artifacts
    ↓
inspectArtifacts.ts
    ↓
Metadata Extraction
    ├─ video/metadata.ts (duration, fps, resolution)
    ├─ arData/metadata.ts (frames, camera, EXIF, lighting)
    └─ room/metadata.ts (area, counts, features, errors)
    ↓
Room Analysis (room/ utilities)
    ↓
Chart Generation (utils/chart/configBuilders)
    ↓
Report Template (dataAnalysisReport.ts)
    - Modular helper functions: buildKdeCharts, buildDeviceAndCameraCharts,
      buildErrorFeatureObjectCharts, buildAreaCharts, buildAttributePieCharts
    ↓
PDF Generation (reportGenerator.ts)
    ↓
reports/data-analysis.pdf
```

### Report Generation Pipeline

1. **Data Collection**: Scripts gather and process artifact data
2. **Chart Configuration**: `utils/chart/configBuilders` creates chart configs using visx components
3. **Template Building**: Report templates (React components) assemble the report structure
4. **HTML Rendering**: `ReactDOMServer.renderToStaticMarkup` converts React to HTML
5. **PDF Generation**: Playwright's Chromium browser:
   - Loads HTML with embedded CSS
   - Waits for charts to render (visx renders synchronously)
   - Generates PDF with A4 format and 40px margins
6. **Output**: PDF saved to `reports/` directory

## Technology Stack

### Core

- **TypeScript**: Type-safe development
- **Node.js**: Runtime environment
- **ts-node**: Direct TypeScript execution

### Data Processing

- **axios**: HTTP client for API requests
- **fluent-ffmpeg**: Video metadata extraction
- **convert-units**: Unit conversion utilities
- **lodash**: Utility functions

### Report Generation

- **React**: Component-based UI for reports
- **ReactDOMServer**: Server-side rendering
- **Playwright**: Headless browser for PDF generation
- **@visx**: Data visualization library (replacing Chart.js)
- **Tailwind CSS**: Utility-first CSS framework

### AI Integration

- **@google/generative-ai**: Google Gemini AI SDK

### Logging

- **winston**: Structured logging with colorized output

### Testing

- **vitest**: Fast unit testing framework
- **TypeScript**: Type checking

### Development Tools

- **ESLint**: Code linting with custom rules
- **Prettier**: Code formatting
- **markdownlint**: Markdown linting
- **shellcheck**: Shell script linting

## Design Patterns

### Service Pattern

Services encapsulate external integrations:

- `SpatialService`: API communication with caching
- `GeminiService`: AI model interaction

### Utility Organization

Utilities organized by domain (chart, math, room, data, sync, arData, video) for better discoverability and maintainability.

### Template Pattern

Report templates separate data structure from presentation:

- Data models define structure
- React templates define presentation
- Report generator handles rendering

### Caching Strategy

- **API Cache**: Filesystem-based cache for Spatial API responses
- **Gemini Cache**: JSON file cache for AI classification results
- **Bad Scans Cache**: Prevents re-processing known bad artifacts

## Key Integrations

### Spatial API

- **Purpose**: Fetch scan artifacts from remote environments
- **Authentication**: Domain-based (no explicit auth tokens)
- **Caching**: Filesystem cache with count-based invalidation
- **Error Handling**: Retry logic and failure tracking

### Gemini AI

- **Purpose**: Classify videos as bathroom vs non-bathroom
- **Model**: `gemini-3-pro-preview`
- **Caching**: Results stored in `config/checkedScans.json`
- **Cost Optimization**: Skips re-processing cached results

## File Organization

```text
src/
├── models/          # Domain models and type definitions
├── scripts/         # CLI entry points
├── services/        # External service integrations
├── templates/       # React-based report templates
│   ├── components/  # Reusable React components
│   └── styles/      # CSS stylesheets
└── utils/          # Utility functions organized by domain
    ├── arData/      # AR data metadata extraction
    ├── chart/       # Chart configuration and data transformation
    ├── data/        # Data management utilities
    ├── math/        # Mathematical operations
    ├── room/        # Room analysis functions and metadata
    ├── sync/        # Synchronization helpers
    └── video/       # Video metadata extraction

tests/
├── unit/           # Unit tests organized by module
└── integration/    # Integration tests

data/
├── artifacts/      # Local artifact storage
└── api_cache/     # API response cache

config/            # Configuration files
reports/           # Generated PDF reports
```

## Testing Strategy

### Unit Tests

- Located in `tests/unit/`
- Organized to mirror `src/` structure
- Test individual functions and classes in isolation
- Use Vitest for fast execution

### Integration Tests

- Located in `tests/integration/`
- Test service integrations (Spatial API, file system)
- May require network access or mocked services

### Functional Tests

- Located in `tests/functional/` (pipeline end-to-end coverage)
- `pipeline.test.ts` exercises the full CLI flow (validate → sync → clean → filter → format → inspect) with mocks for network, AI, and downloads

### Test Coverage

- Mathematical utilities: Comprehensive coverage
- Room analysis functions: Edge case testing
- Chart utilities: Configuration validation and icon system testing
- SVG loader: CSS class handling and color replacement
- Scripts: End-to-end workflow testing

## Performance Considerations

### Caching

- API responses cached to minimize network requests
- Gemini results cached to reduce API costs
- Bad scans tracked to skip processing

### Concurrency

- Validation script processes artifacts with concurrency limits
- Sync script handles pagination efficiently

### Memory Management

- Streaming file operations where possible
- Progress bars for long-running operations
- Efficient data structures for large datasets

## Future Considerations

### Scalability

- Current design supports processing thousands of artifacts
- Caching strategy reduces redundant operations
- Consider database for large-scale deployments

### Extensibility

- Modular architecture allows easy addition of new analysis functions
- Template system supports new report types
- Service pattern enables new integrations

### Maintainability

- Clear separation of concerns
- Type safety with TypeScript
- Comprehensive test coverage
- Well-documented code structure
