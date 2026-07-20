import { defineConfig } from "vitest/config";

// Explicit test roots. Without this, vitest's default glob sweeps anything
// nested in the checkout — plugin repos cloned inside the monorepo (the
// supported "nested" layout), their build trees, and JUCE's own example
// tests under _deps/juce-src — producing phantom failures and duplicate
// runs (seen on the Linux miniPC, 2026-07-19: 5 "failed" files, none ours).
export default defineConfig({
  test: {
    include: ["apps/**/*.test.{js,jsx,ts,tsx}", "packages/**/*.test.{js,jsx,ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build*/**",
      "**/_deps/**",
    ],
  },
});
