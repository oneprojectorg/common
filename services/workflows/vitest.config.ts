import { defineIntegrationProject } from '@op/common/testing/vitest';
import { coverageConfig } from '@op/vitest-config/coverage';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const integration = defineIntegrationProject({ root });

export default defineConfig({
  test: {
    coverage: coverageConfig(),
    projects: [
      {
        test: {
          name: 'unit',
          root,
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
          // The shared setup mocks `@op/events` down to `{ send }`, which
          // strips `inngest.createFunction`, so a workflow module would not
          // load. This project runs the real Inngest client and mocks only
          // the Next.js shims that `@op/db/client` imports.
          setupFiles: [
            fileURLToPath(new URL('./testing/setup.ts', import.meta.url)),
          ],
          env: {
            ...integration.test.env,
            SMS_PROVIDER: 'memory',
            FEATURE_FLAG_OVERRIDES: 'sms-signup:true',
            NEXT_PUBLIC_POSTHOG_KEY: 'phc_test_never_sent',
          },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
