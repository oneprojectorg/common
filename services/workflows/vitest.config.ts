import { defineIntegrationProject } from '@op/common/testing/vitest';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const integration = defineIntegrationProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
});

export default defineConfig({
  test: {
    // The package has no tests yet, so both projects run empty.
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        ...integration,
        test: {
          ...integration.test,
          name: 'integration',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.unit.test.ts'],
        },
      },
    ],
  },
});
