import { defineConfig, devices } from "@playwright/test";

/**
 * E2E real: API + web + PostgreSQL sembrado.
 *
 * `webServer` arranca los dos procesos; en CI se ejecuta después de build,
 * migraciones, roles RLS y seed. Los valores `e2e-only-*` son de prueba y solo
 * se aplican si el entorno no define los reales (nunca en producción).
 */
process.env.SESSION_SECRET ??= "e2e-only-session-secret-change-me-32chars";
process.env.JWT_SECRET ??= "e2e-only-jwt-secret-change-me-32chars";
process.env.SESSION_COOKIE_SECURE ??= "false";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:3001/api/v1";
process.env.NEXT_PUBLIC_REALTIME_URL ??= "http://localhost:3001";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node dist/main.js",
      cwd: "../api",
      url: "http://localhost:3001/api/v1/health",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "pnpm start",
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
