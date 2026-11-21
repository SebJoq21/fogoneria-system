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
      // Higiene de medición (Fase 0): no se mide lo que no es producción.
      // `coverage.include` global (todo `src/**`) bajaría el reporte a ~49 %
      // en web y rompería los thresholds; se mide el código ejercitado y se
      // excluye el mismo conjunto que Sonar.
      exclude: [
        ...configDefaults.exclude,
        'src/generated/**',
        'src/**/*.spec.ts',
        'prisma/seed.ts',
        'prisma/rls-roles.ts',
        'scripts/**',
      ],
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
