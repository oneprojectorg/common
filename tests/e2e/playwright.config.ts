import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from the root .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

/**
 * Playwright configuration for e2e tests.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000, // 60 seconds per test

  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run local dev servers before starting the tests */
  webServer: [
    {
      // Start the API server
      command: 'pnpm -C ./apps/api dev',
      url: 'http://localhost:3300',
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(__dirname, '../..'),
      timeout: 120 * 1000,
    },
    {
      // Start the app with E2E test mode enabled
      command: 'NEXT_PUBLIC_E2E_TEST=true pnpm w:app dev',
      url: 'http://localhost:3100',
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(__dirname, '../..'),
      timeout: 120 * 1000,
    },
  ],
});
