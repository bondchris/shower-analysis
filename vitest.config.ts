import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/*.test.{ts,js}",
        "**/*.spec.{ts,js}",
        "**/*.config.{js,ts,mjs,cjs}",
        "**/types.ts",
        // Interface-only model definitions with no runtime code
        "src/models/arData/arDataMetadata.ts",
        "src/models/arData/arFrame.ts",
        "src/models/arData/cameraResolution.ts",
        "src/models/arData/coverageSphere.ts",
        "src/models/arData/exifData.ts",
        "src/models/arData/lightEstimate.ts",
        "src/models/arDataCharts.ts",
        "src/models/badScanRecord.ts",
        "src/models/chart/**/*.ts",
        "src/models/checkedScanRecord.ts",
        "src/models/discardStats.ts",
        "src/models/envStats.ts",
        "src/models/rawScan/confidence.ts",
        "src/models/rawScan/door.ts",
        "src/models/rawScan/objectItem.ts",
        "src/models/rawScan/opening.ts",
        "src/models/rawScan/rawScanMetadata.ts",
        "src/models/rawScan/section.ts",
        "src/models/rawScan/window.ts",
        "src/models/report.ts",
        "src/models/shapeOutline.ts",
        "src/models/syncStats.ts",
        "src/models/videoCharts.ts",
        // Re-export module with no runtime logic
        "src/utils/room/layout/index.ts"
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        branches: 90,
        functions: 99,
        lines: 99,
        statements: 99
      }
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    setupFiles: ["./tests/setup.ts"]
  }
});
