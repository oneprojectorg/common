import { coverageConfig } from '@op/vitest-config/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: coverageConfig({
      // Flat package: sources sit at the workspace root, not under `src/`.
      include: ['*.ts'],
    }),
    environment: 'node',
    globals: true,
  },
});
