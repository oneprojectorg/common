import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  // Email components (@op/emails) use the automatic JSX runtime (no React import).
  esbuild: {
    jsx: 'automatic',
  },
});
