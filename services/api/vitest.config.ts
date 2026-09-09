import { defineIntegrationProject } from '@op/common/testing/vitest';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...defineIntegrationProject({
    root: fileURLToPath(new URL('.', import.meta.url)),
  }),
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
