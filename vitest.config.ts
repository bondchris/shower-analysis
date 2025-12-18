import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.{js,ts,mjs,cjs}",
        "**/tests/**",
        "**/*.test.{ts,js}",
        "**/*.spec.{ts,js}",
        "**/scripts/**",
        "**/templates/**"
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 75,
        statements: 75
      }
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]
  }
});
