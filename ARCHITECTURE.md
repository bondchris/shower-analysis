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
│  (sync, validate, inspect, clean, filter, format)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Services Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Spatial    │  │    Gemini    │  │   Logger     │     │
│  │   Service    │  │   Service    │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Utilities Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Chart     │  │     Math     │  │     Room     │     │
│  │   Utils      │  │    Utils     │  │   Analysis   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Data      │  │   Report     │  │    Sync      │     │
│  │   Utils      │  │  Generator   │  │   Helpers    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Models Layer                              │
│  (rawScan, arData, point, report, artifactAnalysis, etc.)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Templates Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   React      │  │    Chart      │  │   Report     │     │
│  │ Components   │  │  Components   │  │  Templates   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
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
- **`formatArData.ts`**: Standardizes JSON file formatting

### Services (`src/services/`)

External integrations and core services:

- **`SpatialService`**: Fetches scan artifacts from Spatial API with intelligent caching
  - Filesystem cache in `data/api_cache/{environment}/`
  - Cache invalidation based on total count comparison
  - Handles pagination and error recovery

- **`GeminiService`**: Wrapper for Google's Gemini AI
  - Uses `gemini-3-pro-preview` model by default
  - Handles video classification for bathroom detection
  - Results cached in `config/checkedScans.json`

### Utilities (`src/utils/`)

Organized by domain:

- **`chartUtils.ts`**: Chart configuration and data transformation
- **`data/`**: Data management utilities (`badScans`, `checkedScans`, `syncFailures`)
- **`math/`**: Mathematical operations (`vector`, `polygon`, `segment`, `transform`, `constants`)
- **`room/`**: Room validation and analysis functions:
  - Wall gap detection
  - Intersection checks
  - Colinear/crooked wall detection
  - Door blocking detection
  - Tub/toilet gap detection
  - Nib wall detection
  - External opening detection
- **`sync/`**: Synchronization helpers
- **`logger.ts`**: Centralized logging using Winston
- **`reportGenerator.ts`**: PDF generation using Playwright

### Models (`src/models/`)

Type definitions and domain logic:

- **`rawScan/`**: Raw scan data structures (walls, doors, windows, objects, etc.)
- **`arData/`**: Augmented reality data (frames, camera resolution, EXIF, light estimates)
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
    - `BarChart.tsx`
    - `Histogram.tsx`
    - `LineChart.tsx`
    - `MixedChart.tsx`
- **`dataAnalysisReport.ts`**: Data analysis report builder
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
Chart Generation (chartUtils)
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
Metadata Extraction (video, rawScan, arData)
    ↓
Room Analysis (room/ utilities)
    ↓
Chart Generation (chartUtils)
    ↓
Report Template (dataAnalysisReport.ts)
    ↓
PDF Generation (reportGenerator.ts)
    ↓
reports/data-analysis.pdf
```

### Report Generation Pipeline

1. **Data Collection**: Scripts gather and process artifact data
2. **Chart Configuration**: `chartUtils` creates chart configs using visx components
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

Utilities organized by domain (math, room, data, sync) for better discoverability and maintainability.

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
    ├── data/        # Data management utilities
    ├── math/        # Mathematical operations
    ├── room/        # Room analysis functions
    └── sync/        # Synchronization helpers

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

### Test Coverage

- Mathematical utilities: Comprehensive coverage
- Room analysis functions: Edge case testing
- Chart utilities: Configuration validation
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
