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

**Output**:

- `reports/sync-report.pdf`: Includes Video Size Trends, Inaccessible Artifacts Over Time, and download stats.

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
- Hashes videos with BLAKE3 and detects duplicate videos across environments using `config/videoHashes.json`. Moves duplicates to `data/discarded-artifacts` and records them as bad scans.
- Detects date mismatches between API scan dates and video creation metadata (> 24 hours difference).
- Respects `DRY_RUN=1` and `BATHROOM_FILTER_CONCURRENCY` to control write behavior and parallelism.

**Output**:

- `reports/discard-report.pdf`: Clean/filter/duplicate counts, bad scan deltas, trend charts (short videos, non-bathrooms, duplicates), date mismatch analysis, and new bad scans by environment.

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

**Output** (three separate reports):

- `reports/video-analysis.pdf`: Video metadata analysis:
  - Duration distribution with average reference line
  - Framerate distribution
  - Resolution distribution

- `reports/ardata-analysis.pdf`: AR data and camera analysis:
  - Device model distribution
  - Focal length and aperture settings
  - Timezone (UTC offset) distribution from EXIF metadata
  - Time of day distribution showing when scans were taken (hour buckets, 00-23)
  - AR data capture rate (FPS) and dropped frames percentage
  - Dropped frames trend over time
  - Lighting conditions: Average/Minimum/Maximum for Ambient Intensity, Color Temperature, ISO Speed, and Brightness Value

- `reports/scan-analysis.pdf`: Room scan data analysis:
  - Section types and feature prevalence
  - Capture errors and object distribution with confidence levels
  - Object attribute breakdowns (doors, chairs, sofas, tables, storage, vanity)
  - Dimension distributions for floors, walls, windows, doors, and openings
  - Aspect ratio scatter plots for structural elements

## Configuration

- **`.env`**: API keys (e.g., `GEMINI_API_KEY`).
- **`config/config.ts`**: Central configuration including:
  - `ENVIRONMENTS`: List of environments to sync from.
  - `CHART_DATE_RANGE.startDate`: Start date for all "over time" charts (currently `2024-07-23`). All charts use this date through the current date for a consistent timeline.
- **`config/badScans.json`**: Artifact IDs known to be bad/invalid. Automatically updated by `discard`.
- **`config/checkedScans.json`**: Cache of discard/Gemini results to prevent re-processing.
- **`config/videoHashes.json`**: Auto-generated mapping of BLAKE3 video hashes to artifact IDs for duplicate detection.

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
  - `scripts/`: Execution scripts (`validate`, `sync`, `discard`, `inspect`, `format`).
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
