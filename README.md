# Shower Analysis

Tools for analyzing roomplan data to improve shower detection.

## Overview

This project provides a suite of scripts to validate, sync, inspect, clean, and filter scan artifacts from various environments:

- Lowe's Staging
- Lowe's Production
- Bond Production
- Bond Demo

It identifies data integrity issues, generates visual reports, classifies video content using AI, and maintains a clean local dataset.

## Prerequisites

- Node.js (v18+ recommended)
- VPN connection (if required for accessing staging API endpoints)
- `ffmpeg` installed on your system (required for video analysis)

## Installation

```bash
npm install
```

## Workflow & Usage

Follow these steps to manage your dataset and generate insights.

### 1. Sync Artifacts

Download raw artifact data (`video.mp4`, `rawScan.json`, `arData.json`) to your local machine.

```bash
npm run sync
```

**Features**:

- Creates `data/artifacts/{environment}/{id}/` directories.
- Caches API responses to `data/api_cache/` to minimize network requests.
- Skips existing files and "bad scans" listed in `config/badScans.json`.
- Hashes videos with BLAKE3, caches results in `videoHash.json`, and updates
  `config/videoHashes.json` to detect duplicate videos across environments.
- Moves duplicate videos to `data/discarded-artifacts` and records them as bad scans to
  prevent re-syncing the duplicate IDs.

**Output**:

- `reports/sync-report.pdf`: Includes Date Mismatch Analysis, Video Size Trends, Inaccessible Artifacts Over Time, download stats, and duplicate video summary/trend views with per-hash details.

### 2. Validate Artifacts

Check for the existence of critical properties (`rawScan`, `arData`, `video`) and generate an error trend report.

```bash
npm run validate
```

**Output**:

- `reports/validation-report.pdf`: Summarizes artifact counts, missing properties, and error trends.

### 3. Discard Invalid or Non-Bathroom Videos

Combines video integrity checks with Gemini vision filtering to remove unusable artifacts.

**Prerequisites**:

- Valid `GEMINI_API_KEY` in `.env`.

```bash
npm run discard
```

**Features**:

- Detects missing, invalid, or too-short videos and moves them to `data/discarded-artifacts`, updating `config/badScans.json`.
- Removes non-bathroom videos via Gemini; successful checks are cached in `config/checkedScans.json` to avoid re-processing.
- Respects `DRY_RUN=1` and `BATHROOM_FILTER_CONCURRENCY` to control write behavior and parallelism.

**Output**:

- `reports/discard-report.pdf`: Clean/filter counts, bad scan deltas, Short Videos Over Time and Non-Bathroom Videos Over Time trend charts, and new bad scans grouped by environment and reason.

### 4. Format Data

Standardizes JSON files for better diffing and readability.

```bash
npm run format-data
```

**Features**:

- Sorts `arData.json` keys chronologically.
- Saves standardized output to `arDataFormatted.json`.

### 5. Clear Metadata Cache

Invalidates cached metadata files to force regeneration with updated detection logic.

```bash
npm run clear-cache
```

**When to use**:

- After updating detection logic or thresholds
- When metadata appears incorrect or stale
- After code changes that affect feature extraction

**Note**: After clearing the cache, run `npm run inspect` to regenerate metadata files.

### 6. Inspect Data

Deep analysis of metadata, lighting, room features, and camera settings.

```bash
npm run inspect
```

**Output**:

- `reports/data-analysis.pdf`: A comprehensive 3-page report including:
  - **Summary**: Duration, Lens Models, Framerate, Resolution.
  - **Lighting & Exposure**: Ambient Intensity, Color Temp, ISO, Brightness histograms.
  - **Dimensions & Aspect Ratios**: Height/width distributions and aspect ratio scatter plots for walls, windows, doors, openings, and floors.
  - **Fixtures & Vanity Analysis**: Floor area, tub and vanity length distributions, vanity type and sink count breakdowns, and feature prevalence (e.g., non-rectangular walls, multiple fixtures).

## Configuration

- **`.env`**: API keys (e.g., `GEMINI_API_KEY`).
- **`config/config.ts`**: Central configuration including:
  - `ENVIRONMENTS`: List of environments to sync from.
  - `CHART_DATE_RANGE.startDate`: Start date for all "over time" charts (currently `2024-07-23`). All charts use this date through the current date for a consistent timeline.
- **`config/badScans.json`**: Artifact IDs known to be bad/invalid. Automatically updated by
  `discard` and duplicate detection during `sync`.
- **`config/checkedScans.json`**: Cache of discard/Gemini results to prevent re-processing.
- **`config/videoHashes.json`**: Auto-generated mapping of BLAKE3 video hashes to artifact IDs for duplicate detection during sync.

## Development

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Linting & Formatting

Ensure code quality:

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run check-format
npm run format
```

### Testing

Run unit tests with Vitest:

```bash
npm test
```

Generate test coverage report:

```bash
npm run test:coverage
```

This generates coverage reports in multiple formats:

- **Text**: Console output
- **HTML**: `coverage/index.html` (open in browser for detailed view)
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info` (for CI/CD integration)

Coverage thresholds are set at 80% for lines, functions, branches, and statements.

### Full Pipeline

Run the complete data processing pipeline:

```bash
npm run full-pipeline
```

This executes: validate → sync → discard → format-data → inspect

## Directory Structure

- `src/`: Source TypeScript files.
  - `scripts/`: Execution scripts (`validate`, `sync`, `inspect`, `clean`, `filter`, `format`).
  - `models/`: Data interfaces and core domain logic (`rawScan`, `arData`, `point`, etc.).
  - `services/`: External integrations (`SpatialService`, `GeminiService`).
  - `templates/`: React-based PDF report templates and chart components.
  - `utils/`: Shared utilities organized by domain:
    - `chart/`: Chart generation utilities (config builders, KDE, histograms, scatter).
    - `data/`: Data management utilities (`badScans`, `checkedScans`, `syncFailures`).
    - `math/`: Mathematical utilities (`vector`, `polygon`, `segment`, `transform`, `constants`).
    - `room/`: Room validation and analysis functions (wall gaps, intersections, etc.).
    - `sync/`: Synchronization helpers.
    - `logger.ts`: Centralized logging.
    - `reportGenerator.ts`: PDF generation using Playwright.
- `tests/`: Test files.
  - `unit/`: Unit tests organized by module.
  - `integration/`: Integration tests.
- `reports/`: Generated PDF reports.
- `data/`: Local data storage (artifacts and API cache).
- `config/`: Configuration files.

## Sync Failures Tracking

- The sync pipeline persists failures to `config/syncFailures.json` via `src/utils/data/syncFailures.ts`.
- Each record is keyed by artifact ID and shaped as `{ date, environment, reasons: string[] }`, where `reasons` captures all observed failure reasons for that sync run (deduplicated).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a complete history of all changes with semantic versioning.
