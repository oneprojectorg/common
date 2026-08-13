import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  if (process.env.NODE_ENV === 'development') {
    process.stdout.write(`\x1B]2;${'API'}\x1B\x5C`);
    process.stdout.write(`\x1B];${'API'}\x07`);
  }
} catch (error) {
  console.error(error);
  // Ignore error
}

dotenv.config({
  override: true,
});

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  path: '../../.env.local',
});

// For local development with git worktrees, we need to load the .env.local file from the root *bare* repository
dotenv.config({
  path: '../../../.env.local',
});

/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  turbopack: {
    // Pin the workspace root. Turbopack otherwise infers it by walking up for
    // lockfiles, so a stray package-lock.json above the monorepo (e.g. an `npm
    // install` run in $HOME) silently moves the root and emits externals
    // symlinks under .next/dev/node_modules with the wrong relative depth —
    // producing "Cannot find module '@swc/helpers-<hash>/...'" at runtime.
    root: path.resolve(__dirname, '../..'),
    resolveAlias: {
      // In e2e mode, swap external services for in-process mocks so the API
      // server never makes network calls to TipTap Cloud or PostHog.
      ...(process.env.E2E === 'true'
        ? {
            '@op/collab': '../../services/collab/__mocks__/index.ts',
            '@op/analytics/client':
              '../../packages/analytics/src/client.testing.ts',
          }
        : {}),
    },
  },
};

export default config;
