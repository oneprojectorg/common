import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The workspace tsconfig sets jsx: "preserve" for Next, which leaves esbuild
  // on the classic runtime and no React import in scope.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: true,
  },
});
