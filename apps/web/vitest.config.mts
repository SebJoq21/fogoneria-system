import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Playwright tiene su propio runner (`pnpm e2e`); Vitest no debe cargarlo.
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      // Ratchet aprobado en G3 (medido: 62.61/58.88/57.91/63.73).
      thresholds: {
        statements: 57,
        branches: 53,
        functions: 52,
        lines: 58,
      },
    },
  },
});
