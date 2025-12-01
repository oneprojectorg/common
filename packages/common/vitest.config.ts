import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: true,
    maxConcurrency: 10,
    environment: 'node',
    globals: true,
    globalSetup: ['../../services/api/src/test/globalSetup.ts'],
    setupFiles: ['../../services/api/src/test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.config.ts', '**/*.d.ts'],
    },
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://127.0.0.1:55321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':
      '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"',
    'process.env.SUPABASE_URL': '"http://127.0.0.1:55321"',
    'process.env.SUPABASE_ANON_KEY':
      '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"',
    'process.env.SUPABASE_SERVICE_ROLE':
      '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"',
    'process.env.DATABASE_URL':
      '"postgresql://postgres:postgres@127.0.0.1:55322/postgres"',
  },
});
