import dotenv from 'dotenv';

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
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
    resolveAlias: {
      // In e2e mode, swap the real TipTap client for an in-process mock
      // so the API server never makes HTTP calls to TipTap Cloud.
      ...(process.env.E2E === 'true'
        ? { '@op/collab': '@op/collab/testing' }
        : {}),
    },
  },
};

export default config;
