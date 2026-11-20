import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // El cliente Prisma generado se importa en los tests y aparecía en el
      // lcov; Sonar lo excluye del análisis (`**/generated/**`) y avisaba
      // "Could not resolve 4 file paths". Fuera del reporte y del umbral.
      exclude: [...configDefaults.coverage.exclude, 'src/generated/**'],
      // Ratchet aprobado en G3: 71/54/64/72. La medición excluye
      // `src/generated`, que Sonar ignora en el análisis.
      thresholds: {
        statements: 71,
        branches: 54,
        functions: 64,
        lines: 72,
      },
    },
  },
});
