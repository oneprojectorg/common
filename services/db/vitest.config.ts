import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Only the pure modules are unit-tested here. Anything importing `index.ts`
    // opens a real connection and belongs in the `@op/api` integration suite.
    include: ['*.test.ts'],
  },
});
