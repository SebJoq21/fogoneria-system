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
      // Higiene de medición (Fase 0): demo, e2e y scripts no son producción.
      // No se activa `coverage.include` global: mediría páginas nunca
      // importadas y bajaría el reporte a ~49 % líneas / 46 % ramas, por
      // debajo de los thresholds vigentes (58/53).
      exclude: [
        ...configDefaults.exclude,
        "e2e/**",
        "app/demo/**",
        "scripts/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
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
