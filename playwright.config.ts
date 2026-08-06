import { defineConfig } from '@playwright/test'

/**
 * Drives the packaged Electron app end-to-end (see e2e/fixtures/support.ts),
 * not a browser — there is no `use.browserName`/`projects` matrix here.
 * workers: 1 + fullyParallel: false is load-bearing: specs share one SQLite
 * profile (e2e/.profiles/shared) in a deliberate story order, so two specs
 * must never touch the app at the same time.
 */
export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report/html', open: 'never' }]],
  outputDir: 'e2e/report/test-results',
  use: {
    trace: 'retain-on-failure'
  }
})
