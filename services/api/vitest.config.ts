import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxConcurrency: 8,
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000, // Increased timeout for database operations
    hookTimeout: 30000, // Increased timeout for setup/teardown
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.config.ts', '**/*.d.ts'],
    },
    // Run integration tests sequentially to avoid database conflicts
    poolOptions: {
      threads: {
        singleThread: true,
      },
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
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://127.0.0.1:55321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':
      '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"',
    'process.env.SUPABASE_URL': '"http://127.0.0.1:55321"',
    'process.env.SUPABASE_ANON_KEY':
      '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"',
    'process.env.DATABASE_URL':
      '"postgresql://postgres:postgres@127.0.0.1:55322/postgres"',
  },
});
