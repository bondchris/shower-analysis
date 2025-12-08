# Shower Analysis

Tools for analyzing roomplan data to improve shower detection.

## Overview

This project provides a suite of scripts to validate, sync, inspect, and clean scan artifacts from various environments:

- Lowe's Staging
- Lowe's Production
- Bond Production
- Bond Demo

It identifies data integrity issues, generates visual reports, and maintains a clean local dataset.

## Prerequisites

- Node.js (v18+ recommended)
- VPN connection (if required for accessing staging API endpoints)
- `ffmpeg` installed on your system (required for video analysis)

## Installation

```bash
npm install
```

## Usage

### 1. Validate Artifacts

Check for the existence of critical properties (`rawScan`, `arData`, `video`) across all environments and generate an error trend report.

```bash
npm run validate
```

**Output**:

- `reports/validation-report.pdf`: A PDF report summarizing artifact counts, missing properties, and an error trend graph over time.

### 2. Sync Artifacts

Download raw artifact data (`video.mp4`, `rawScan.json`, `arData.json`) to your local machine for deep analysis.

```bash
npm run sync
```

**Features**:

- Creates `data/artifacts/{environment}/{id}/` directories.
- Skips files that already exist.
- Skips "bad scans" listed in `config/badScans.json`.
- Caches API responses to `data/api_cache/` to minimize network requests.

### 3. Inspect Data

Analyze the downloaded local artifacts to extract metadata and generate distribution charts.

```bash
npm run inspect
```

**Output**:

- `reports/data-analysis.pdf`: A PDF report containing:
  - Video Duration Distribution (0-180s buckets).
  - Framerate Distribution.
  - Resolution Distribution.
  - Lists of low FPS videos.

### 4. Clean Data

Automated cleanup of invalid or corrupt artifacts.

```bash
npm run clean
```

**Features**:

- Scans local `data/artifacts` for validity (e.g., checks if `video.mp4` is valid).
- Deletes artifacts deemed "bad" or "empty".
- Updates `config/badScans.json` with IDs of removed scans to prevent future syncing.

### 5. Filter Non-Bathroom Videos (Gemini AI)

Uses Google's Gemini 3 Pro Preview model to identify and remove videos that do not show a bathroom (e.g., office tests).

**Prerequisites**:

- Valid `GEMINI_API_KEY`.
- Create a `.env` file in the root directory (see `.env.example`).

```bash
# .env
GEMINI_API_KEY="your_actual_key"
```

Then run:

```bash
npm run filter-videos
```

**Features**:

- Uploads local videos to Gemini for classification.
- Automatically deletes artifacts identified as "Not a bathroom".
- Updates `config/badScans.json` to prevent re-syncing.
- Respects rate limits.

## Configuration

- **`config/badScans.json`**: A JSON list of artifact IDs that are known to be bad and should be skipped by the sync process.
  - This is automatically updated by `npm run clean`.

## Development

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Linting & Formatting

Ensure code quality before committing:

```bash
# Run linting (ESLint + MarkdownLint)
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check formatting (Prettier)
npm run check-format

# Fix formatting
npm run format
```

## Directory Structure

- `src/`: Source TypeScript files.
  - `scripts/`: Execution scripts (`validate`, `sync`, `inspect`, `clean`).
  - `models/`: Data interfaces and classes.
- `reports/`: Generated PDF reports.
- `data/`: Local data storage (artifacts and API cache).
- `config/`: Configuration files (e.g., `badScans.json`).
