import { getPreviewApiUrl } from '@op/core/previews';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import { nitro } from 'nitro/vite';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

import { posthogSourcemaps } from './vite/posthogSourcemaps';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  if (process.env.NODE_ENV === 'development') {
    process.stdout.write(`\x1B]2;${'APP'}\x1B\x5C`);
    process.stdout.write(`\x1B];${'APP'}\x07`);
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

// Deployment environment variables (sourced from Vercel's injected env vars)
const DEPLOY_ENV = process.env.VERCEL_ENV;
const PREVIEW_BRANCH_URL = process.env.VERCEL_BRANCH_URL;

/**
 * Inlined into every bundle, server included: these are computed here rather
 * than injected by the host, so the server has no runtime value to read.
 */
const BUILD_ENV = {
  NEXT_PUBLIC_DEPLOY_ENV: DEPLOY_ENV,
  NEXT_PUBLIC_PREVIEW_BRANCH_URL:
    DEPLOY_ENV === 'preview' ? PREVIEW_BRANCH_URL : undefined,
  NEXT_PUBLIC_E2E: process.env.E2E,
};

/**
 * The browser bundle has no `process`. Every public variable the client reads
 * is inlined by name, and any other `process.env.X` reads as undefined — the
 * same contract the public prefix had before.
 */
const PUBLIC_ENV_NAMES = [
  'NEXT_PUBLIC_API_PORT',
  'NEXT_PUBLIC_APP_PORT',
  'NEXT_PUBLIC_MAPTILER_API_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_TIPTAP_APP_ID',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF',
  'NEXT_PUBLIC_VERCEL_URL',
];

const defineEnv = (env: Record<string, string | undefined>) =>
  Object.fromEntries(
    Object.entries(env).map(([name, value]) => [
      `process.env.${name}`,
      JSON.stringify(value),
    ]),
  );

const clientDefine = {
  ...defineEnv(BUILD_ENV),
  ...defineEnv(
    Object.fromEntries(
      PUBLIC_ENV_NAMES.map((name) => [name, process.env[name]]),
    ),
  ),
  'process.env': '{}',
};

// Decision-process slugs are served at their vanity URL by the router's
// rewrite in `src/router.tsx`; this only lists the preview API proxy.
const previewApiUrl = getPreviewApiUrl(PREVIEW_BRANCH_URL);

const tryGit = (cmd: string) => {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const currentBranch =
  process.env.VERCEL_GIT_COMMIT_REF ??
  tryGit('git rev-parse --abbrev-ref HEAD');
const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ?? tryGit('git rev-parse HEAD');
const shouldUploadSourcemaps = ['dev', 'main'].includes(currentBranch ?? '');

// In e2e mode, swap external services for in-process mocks so the app never
// makes network calls to TipTap Cloud or PostHog. Applies to the server and
// client bundles alike, so SSR of these modules is mocked too.
const e2eAliases =
  process.env.E2E === 'true'
    ? [
        {
          // Exact match keeps the alias off `@op/collab/server`, which the
          // mock lacks.
          find: /^@op\/collab$/,
          replacement: path.resolve(
            __dirname,
            '../../services/collab/__mocks__/index.ts',
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
    port: 3100,
  },
  build: {
    // `/assets/*` is the S3 proxy below, so built files — and the URLs the
    // server renders for them — live under `/_build` instead.
    assetsDir: '_build',
  },
  resolve: {
    alias: [
      ...e2eAliases,
      { find: /^@\//, replacement: `${path.resolve(__dirname, 'src')}/` },
    ],
  },
  environments: {
    client: {
      define: clientDefine,
      build: {
        sourcemap: shouldUploadSourcemaps ? 'hidden' : false,
      },
    },
    ssr: {
      define: defineEnv(BUILD_ENV),
      resolve: {
        external: [
          // @vercel/og reads its WASM and default font from beside its own
          // module, so it has to stay a real package rather than be bundled.
          '@vercel/og',
          // base-ui's CommonJS shim `require()`s react. Bundled at this stage,
          // that require stays a runtime call that loads a second React — one
          // whose hooks have no renderer. Left external (it is a direct
          // dependency for this reason), Nitro bundles it with the one React.
          'use-sync-external-store',
        ],
      },
    },
  },
  plugins: [
    tanstackStart({
      router: {
        routeFileIgnorePattern: '\\.(test|unit\\.test)\\.tsx?$|\\.wrk\\.md$',
      },
    }),
    react(),
    nitro({
      // sharp and onnxruntime-node ship native binaries that cannot be bundled.
      // @vercel/og ships WASM it loads from disk.
      traceDeps: ['sharp', 'onnxruntime-node', '@vercel/og'],
      plugins: ['./src/server/plugins/observability.ts'],
      routeRules: {
        '/_build/**': {
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
          },
        },
        '/assets/**': {
          proxy: `${process.env.S3_ASSET_ROOT}/**`,
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
          },
        },
        '/stats/static/**': {
          proxy: 'https://eu-assets.i.posthog.com/static/**',
        },
        '/stats/**': { proxy: 'https://eu.i.posthog.com/**' },
        // On preview deployments, proxy tRPC to avoid cross-origin cookie
        // issues. See packages/core/previews.mjs for the shared preview URL
        // logic.
        ...(previewApiUrl
          ? {
              '/api/v1/trpc/**': {
                proxy: `${previewApiUrl}/api/v1/trpc/**`,
              },
            }
          : {}),
      },
    }),
    posthogSourcemaps({
      enabled: shouldUploadSourcemaps,
      personalApiKey: process.env.POSTHOG_API_KEY,
      envId: process.env.POSTHOG_ENV_ID,
      host: 'https://eu.i.posthog.com',
      project: 'common',
      version: commitSha ?? undefined,
    }),
    ...(process.env.ANALYZE === 'true'
      ? [visualizer({ filename: 'bundle-analysis.html', gzipSize: true })]
      : []),
  ],
});
