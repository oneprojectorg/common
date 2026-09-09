import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

import { defineIntegrationProject } from './testing/vitest';

const integration = defineIntegrationProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
});

export default defineConfig({
  test: {
    projects: [
      {
        esbuild: {
          jsx: 'automatic',
        },
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.ts'],
          environment: 'node',
          globals: true,
          setupFiles: ['./testing/unitSetup.ts'],
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
