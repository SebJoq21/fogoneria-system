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
      // El cliente de Prisma es código generado: no entra en el lcov que lee
      // Sonar (ni en el denominador de Vitest).
      exclude: [...configDefaults.exclude, 'src/generated/**'],
      // Ratchet aprobado en G3 (medido: 76.02/59.54/69.58/77.55).
      thresholds: {
        statements: 71,
        branches: 54,
        functions: 64,
        lines: 72,
      },
    },
  },
});
