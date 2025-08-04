import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.config.ts', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  define: {
    // Define environment variables for testing
    'process.env.NODE_ENV': '"test"',
  },
});
