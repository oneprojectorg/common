import { coverageConfig } from '@op/vitest-config/coverage';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

import { defineIntegrationProject } from './testing/vitest';

const integration = defineIntegrationProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
});

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    coverage: coverageConfig(),
    projects: [
      {
        // Inline projects inherit the root options (`esbuild`) only with `extends`.
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.{ts,tsx}'],
          environment: 'node',
          globals: true,
          setupFiles: ['./testing/unitSetup.ts'],
        },
      },
      {
        ...integration,
        extends: true,
        test: {
          ...integration.test,
          name: 'integration',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, '**/*.unit.test.{ts,tsx}'],
        },
      },
    ],
  },
});
