import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load shared env (non-secret config like feature flags, API URLs, etc.)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// E2E environment — all values are deterministic local-only keys from `supabase start`.
// SUPABASE_SERVICE_ROLE comes from the `dev:e2e` script (cross-env) to avoid
// GitHub push protection flagging the Supabase CLI key in tracked files.
Object.assign(process.env, {
  NODE_ENV: 'test',
  E2E: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:56321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres',
  S3_ASSET_ROOT: 'http://127.0.0.1:56321/storage/v1/object/public/assets',
  // Dummy values — the e2e mock (@op/collab/e2e) ignores these, but
  // getProposalDocumentsContent guards on their presence before calling the client.
  TIPTAP_SECRET: 'e2e',
  NEXT_PUBLIC_TIPTAP_APP_ID: 'e2e',
});

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
    wait: { stdout: /app:dev:e2e:.*Local:\s+http:\/\/localhost:4100/ },
    reuseExistingServer: !process.env.CI,
    cwd: path.resolve(__dirname, '../..'),
    timeout: 120 * 1000,
  },
});
