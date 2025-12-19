# Shower Analysis

Tools for analyzing roomplan data to improve shower detection.

**Current Version:** v0.39.0

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

### 2. Validate Artifacts

Check for the existence of critical properties (`rawScan`, `arData`, `video`) and generate an error trend report.

```bash
npm run validate
```

**Output**:

- `reports/validation-report.pdf`: Summarizes artifact counts, missing properties, and error trends.

### 3. Clean Data

Automated cleanup of invalid, empty, or corrupt media files.

```bash
npm run clean
```

**Features**:

- Deletes artifacts with invalid or zero-byte files.
- Updates `config/badScans.json` to prevent re-syncing.

### 4. Filter Non-Bathroom Videos (Gemini AI)

Uses Google's Gemini 3 Pro Preview model to identify and remove videos that do not show a bathroom (e.g., office tests).

**Prerequisites**:

- Valid `GEMINI_API_KEY` in `.env`.

```bash
npm run filter-videos
```

**Features**:

- Uploads videos to Gemini for classification.
- Deletes "Not a bathroom" artifacts.
- Caches results in `config/checkedScans.json` to save costs and time.

### 5. Format Data

Standardizes JSON files for better diffing and readability.

```bash
npm run format-ar-data
```

**Features**:

- Sorts `arData.json` keys chronologically.
- Saves standardized output to `arDataFormatted.json`.

### 6. Inspect Data

Deep analysis of metadata, lighting, room features, and camera settings.

```bash
npm run inspect
```

**Output**:

- `reports/data-analysis.pdf`: A comprehensive 3-page report including:
  - **Summary**: Duration, Lens Models, Framerate, Resolution.
  - **Lighting & Exposure**: Ambient Intensity, Color Temp, ISO, Brightness histograms.
  - **Room Analysis**: Room Area distribution and Feature Prevalence (e.g., non-rectangular walls, multiple fixtures).

## Configuration

- **`.env`**: API keys (e.g., `GEMINI_API_KEY`).
- **`config/badScans.json`**: Artifact IDs known to be bad/invalid. Automatically updated by `clean` and `filter-videos`.
- **`config/checkedScans.json`**: Cache of Gemini classification results to prevent re-processing.

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

This executes: validate → sync → clean-data → filter-videos → format-ar-data → inspect

## Directory Structure

- `src/`: Source TypeScript files.
  - `scripts/`: Execution scripts (`validate`, `sync`, `inspect`, `clean`, `filter`, `format`).
  - `models/`: Data interfaces and core domain logic (`rawScan`, `arData`, `point`, etc.).
  - `services/`: External integrations (`SpatialService`, `GeminiService`).
  - `templates/`: React-based PDF report templates and chart components.
  - `utils/`: Shared utilities organized by domain:
    - `chartUtils.ts`: Chart generation utilities.
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

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a complete history of all changes with semantic versioning.
