# Shower Analysis

Tools for analyzing roomplan data to improve shower detection.

## Overview

This project provides scripts to validate and analyze scan artifacts from various environments (Lowe's Staging/Production,
Bond Production/Demo). It checks for the existence of critical data properties like `rawScan`, `arData`, and `video`.

## Prerequisites

- Node.js (v18+ recommended)
- VPN connection (if required for accessing staging environments)

## Installation

```bash
npm install
```

## Usage

### Run Data Validation

To validate artifacts across all environments and generate a report:

```bash
npx ts-node src/validate-artifacts.ts
```

This will:

1. Iterate through all environments.
2. Fetch all artifacts (concurrently).
3. Log progress to the console.
4. Generate a summary report at `reports/validation-report.pdf`.

### Run Data Sync

To download artifact data (video, rawScan, arData) to your local machine:

```bash
npm run sync
```

This will:

1. Create a `data/` directory (ignored by git).
2. Create subdirectories for each environment and artifact ID.
3. Download `video.mp4`, `rawScan.json`, and `arData.json`.
4. Save a `meta.json` with the full artifact metadata.
5. Skip files that have already been downloaded.

### Build Project

To compile TypeScript to JavaScript:

```bash
npm run build
```

## Development

### Linting & Formatting

Ensure code quality before committing:

```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check formatting
npm run check-format

# Fix formatting
npm run format
```

## Output

- **`reports/validation-report.pdf`**: A PDF report summarizing total artifacts, processed count, and missing property statistics per environment.
- **`data/`**: Directory containing downloaded artifacts, organized by `{environment_name}/{artifact_id}/`.
