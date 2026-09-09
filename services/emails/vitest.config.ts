import { coverageConfig } from '@op/vitest-config/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The workspace tsconfig sets jsx: "preserve" for Next, which leaves esbuild
  // on the classic runtime and no React import in scope.
  esbuild: { jsx: 'automatic' },
  test: {
    // `.react-email/` is scaffolding the preview server generates locally (it is
    // gitignored and absent on CI). Its specs are react-email's own and cannot
    // resolve their dev dependencies from here, so they fail on any machine that
    // has run `react-email dev`.
    exclude: ['**/node_modules/**', '.react-email/**'],
    coverage: coverageConfig({
      // Flat package: the entry point and the templates it renders sit at the
      // workspace root. `.react-email/` is generated preview scaffolding.
      include: ['index.tsx', 'components/**/*.tsx', 'emails/**/*.tsx'],
    }),
    environment: 'node',
    globals: true,
  },
});
