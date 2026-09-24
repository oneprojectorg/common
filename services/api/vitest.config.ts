import { defineIntegrationProject } from '@op/common/testing/vitest';
import { coverageConfig } from '@op/vitest-config/coverage';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const integration = defineIntegrationProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
});

export default defineConfig({
  ...integration,
  test: {
    ...integration.test,
    coverage: coverageConfig(),
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
