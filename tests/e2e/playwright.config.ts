import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Override Supabase ports for E2E isolation (56xxx instead of 54xxx)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:56321';
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:56322/postgres';
process.env.S3_ASSET_ROOT =
  'http://127.0.0.1:56321/storage/v1/object/public/assets';

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
    baseURL: 'http://localhost:4100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run dev servers with e2e environment before starting the tests */
  webServer: {
    command: 'pnpm dev:e2e',
    url: 'http://localhost:4100',
    reuseExistingServer: !process.env.CI,
    cwd: path.resolve(__dirname, '../..'),
    timeout: 120 * 1000,
  },
});
