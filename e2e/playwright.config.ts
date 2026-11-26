import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end acceptance tests against the running Docker stack
 * (`docker compose up --build`); they don't start it themselves.
 * Override the addresses with BASE_URL / MAILPIT_URL if needed.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // the enquiry test shares one Mailpit inbox
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
