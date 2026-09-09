import { coverageConfig } from '@op/vitest-config/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    coverage: coverageConfig(),
    environment: 'node',
    globals: true,
  },
});
