import { defineConfig } from 'vitest/config';

/**
 * Pruebas contra PostgreSQL real (AYCDS-62).
 *
 * Se ejecutan aparte porque necesitan `DATABASE_URL_TEST` y truncan datos:
 *   pnpm --filter api test:db
 *
 * El `pnpm test` normal no las incluye (sus archivos terminan en
 * `.db-spec.ts`, no en `.spec.ts`).
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/db/**/*.db-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
