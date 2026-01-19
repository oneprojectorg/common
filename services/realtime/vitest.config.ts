import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load .env.test file for test environment variables
const envConfig = config({ path: '.env.test' });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    globalSetup: './vitest.setup.mjs',
    env: envConfig.parsed ?? {},
  },
});
