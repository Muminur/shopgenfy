import { defineConfig, devices } from '@playwright/test';

/**
 * Hermetic Playwright config.
 *
 * `globalSetup` boots a local upstream stub (Gemini / Pollinations / GitHub)
 * and, locally, an in-memory mongod; `webServer.env` points the app's server-
 * side calls at them so no test ever reaches the live internet. See
 * `__tests__/e2e/global-setup.ts` and `__tests__/e2e/stub-server.mjs`.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const isCI = !!process.env.CI;

// Upstream stub + fixed-port in-memory mongod (see global-setup.ts). The mongo
// URI falls back to the fixed local port; in CI a real mongo service sets
// MONGODB_URI so the in-memory server is skipped.
const STUB_BASE = 'http://127.0.0.1:4545';
const E2E_MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:47017';
const E2E_MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'shopgenfy_e2e';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  // Per-test / per-assertion budgets (kept tight so a hang fails fast rather
  // than stalling CI the way the old live-API suite did).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // `list` for readable output; html report written but never auto-served
  // (auto-serve keeps the process alive in non-interactive runs).
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './__tests__/e2e/global-setup.ts',
  globalTeardown: './__tests__/e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // CI installs only chromium; the suite is validated chromium-only. Keeping a
  // single project means `npm run test:e2e` (no --project) can't fail on an
  // uninstalled browser.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* App under test. CI serves the built app with `next start`; locally we use
     `next dev` (and reuse an already-running dev server if present). Either way
     the upstream/DB env below points at the hermetic stubs. */
  webServer: {
    command: isCI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      GEMINI_API_KEY: 'test-key',
      GEMINI_API_BASE: STUB_BASE,
      POLLINATIONS_API_BASE: `${STUB_BASE}/prompt`,
      GITHUB_API_BASE: STUB_BASE,
      MONGODB_URI: E2E_MONGODB_URI,
      MONGODB_DB_NAME: E2E_MONGODB_DB_NAME,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
