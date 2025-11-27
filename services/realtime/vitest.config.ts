import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load .env.test file for test environment variables
config({ path: '.env.test' });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
