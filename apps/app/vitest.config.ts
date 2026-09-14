import { coverageConfig } from '@op/vitest-config/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: coverageConfig(),
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
