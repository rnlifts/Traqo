import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      name: 'backend',
      command: 'python run.py',
      // FastAPI has no route at bare "/" — it 404s, and Playwright's default
      // readiness check treats any non-2xx/3xx response as "still starting",
      // so it would poll forever and time out even though the server is
      // actually up. Point it at the real health endpoint instead.
      url: 'http://localhost:5000/api/health',
      // Must NOT reuse an existing server on :5000 — if a normal local dev
      // backend happens to already be running there (a completely ordinary
      // thing to have open in another terminal), reusing it would silently
      // run these tests against whatever database *that* instance was
      // started with — not the isolated TEST_DATABASE_URL below. Always
      // start a fresh instance with the right env instead.
      reuseExistingServer: false,
      cwd: '../backend',
      env: {
        'DATABASE_URL': process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost/traqo_test',
        'ENVIRONMENT': 'test',
      },
    },
    {
      name: 'frontend',
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
});
