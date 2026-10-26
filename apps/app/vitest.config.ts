import { defineIntegrationProject } from '@op/common/testing/vitest';
import { coverageConfig } from '@op/vitest-config/coverage';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const integration = defineIntegrationProject({
  root: fileURLToPath(new URL('.', import.meta.url)),
});

// `*.integration.test.{ts,tsx}` runs against the test Supabase like
// `packages/common` and `services/api`; every other `*.test.{ts,tsx}` is a unit
// test. The unit project keeps the existing suffix so its files do not move.
const INTEGRATION_TESTS = 'src/**/*.integration.test.{ts,tsx}';

const srcAlias = {
  find: '@',
  replacement: fileURLToPath(new URL('./src', import.meta.url)),
};

// A server component under test runs outside a Next.js request scope, where
// `cookies()` / `headers()` throw. The alias reaches every copy of `next` in
// the monorepo (`services/api` resolves its own), which `vi.mock` would not.
const nextHeadersAlias = {
  find: /^next\/headers$/,
  replacement: fileURLToPath(
    new URL('./src/testing/nextHeaders.ts', import.meta.url),
  ),
};

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: [srcAlias],
  },
  test: {
    coverage: coverageConfig(),
    projects: [
      {
        // Inline projects inherit the root options (`esbuild`, `resolve`) only
        // with `extends`.
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, INTEGRATION_TESTS],
          environment: 'node',
          globals: true,
          setupFiles: ['./src/testing/jsdom.setup.ts'],
          server: {
            deps: {
              inline: ['next-intl'],
            },
          },
        },
      },
      {
        ...integration,
        extends: true,
        resolve: {
          alias: [srcAlias, nextHeadersAlias],
        },
        test: {
          ...integration.test,
          name: 'integration',
          include: [INTEGRATION_TESTS],
          server: {
            deps: {
              inline: ['next-intl'],
            },
          },
          env: {
            ...integration.test.env,
            // `forbidden()` / `unauthorized()` refuse to run without the flag
            // `experimental.authInterrupts` sets in next.config.mjs.
            __NEXT_EXPERIMENTAL_AUTH_INTERRUPTS: 'true',
          },
          // A later group keeps unit tests from competing with the database
          // workers (vitest rejects differing `maxWorkers` in one group).
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
