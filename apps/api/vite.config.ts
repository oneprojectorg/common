import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import { nitro } from 'nitro/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  if (process.env.NODE_ENV === 'development') {
    process.stdout.write(`\x1B]2;${'API'}\x1B\x5C`);
    process.stdout.write(`\x1B];${'API'}\x07`);
  }
} catch {
  // Ignore error
}

dotenv.config({
  override: true,
});

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  path: path.resolve(__dirname, '../../.env.local'),
});

// For local development with git worktrees, we need to load the .env.local file from the root *bare* repository
dotenv.config({
  path: path.resolve(__dirname, '../../../.env.local'),
});

// In e2e mode, swap external services for in-process mocks so the API server
// never makes network calls to TipTap Cloud or PostHog.
const e2eAliases =
  process.env.E2E === 'true'
    ? [
        {
          // Exact match keeps this alias off `@op/collab/server`, which has
          // its own mock below.
          find: /^@op\/collab$/,
          replacement: path.resolve(
            __dirname,
            '../../services/collab/__mocks__/index.ts',
          ),
        },
        {
          // The JWT signer needs a real key pair; e2e hands out a fixed token.
          find: /^@op\/collab\/server$/,
          replacement: path.resolve(
            __dirname,
            '../../services/collab/__mocks__/server.ts',
          ),
        },
        {
          find: /^@op\/analytics\/client$/,
          replacement: path.resolve(
            __dirname,
            '../../packages/analytics/src/client.testing.ts',
          ),
        },
      ]
    : [];

export default defineConfig({
  server: {
    port: 3300,
  },
  resolve: {
    alias: e2eAliases,
  },
  plugins: [
    tanstackStart(),
    // The email templates (`@op/emails`) are JSX.
    react(),
    nitro({
      // sharp and onnxruntime-node ship native binaries that cannot be bundled.
      traceDeps: ['sharp', 'onnxruntime-node'],
      plugins: ['./src/server/plugins/observability.ts'],
      vercel: {
        functionRules: {
          '/api/v1/trpc/**': { maxDuration: 120 },
        },
      },
    }),
  ],
});
