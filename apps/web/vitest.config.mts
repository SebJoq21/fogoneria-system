import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
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
