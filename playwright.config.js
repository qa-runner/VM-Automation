const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  workers: 3,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  // Stays false on purpose. The patient tests register a patient, search the list for
  // it and delete it again, and all of them share one patient list. Running the tests
  // inside a file at the same time makes each test's own patient move under the test
  // that is looking for it. Files still run side by side across the workers above.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['allure-playwright', {
      detail: true,
      suiteTitle: false,
    }],
  ],
  globalSetup: './tests/global-setup.js',
  use: {
    baseURL: 'https://appdev.ayushmanager.com',
    // Caps every click, fill and press so a missing element fails in seconds
    // instead of hanging until the test timeout. This lived at the top level
    // before, where Playwright silently ignores it.
    actionTimeout: 15_000,
    // No storageState on purpose. Caching one signed in session and reusing it was
    // tried and it silently changes the app: with a restored session the patient row
    // menu was missing its Delete Patient item, while a real sign in showed it, with
    // an identical user and identical localStorage. The app keeps that part of the
    // UI in state that only the sign in flow builds, so it cannot be saved and
    // replayed. Each test signs in itself.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
