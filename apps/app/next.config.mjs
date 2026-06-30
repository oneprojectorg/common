import analyzer from '@next/bundle-analyzer';
import { SUPPORTED_LOCALES } from '@op/common/locales.mjs';
import { getPreviewApiUrl } from '@op/core/previews';
import { withPostHogConfig } from '@posthog/nextjs-config';
import dotenv from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const withBundleAnalyzer = analyzer({
  enabled: process.env.ANALYZE === 'true',
});

try {
  if (process.env.NODE_ENV === 'development') {
    process.stdout.write(`\x1B]2;${'APP'}\x1B\x5C`);
    process.stdout.write(`\x1B];${'APP'}\x07`);
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

// Deployment environment variables (sourced from Vercel's injected env vars)
const DEPLOY_ENV = process.env.VERCEL_ENV;
const PREVIEW_BRANCH_URL = process.env.VERCEL_BRANCH_URL;

// Decision-process slugs exposed at the vanity URL `/[locale]/<slug>`.
// Keep this list narrow — each entry must match the `slug` column on a
// public DECISION profile. Add a new entry only when a process is going live
// on its vanity path.
const VANITY_DECISION_SLUGS = ['columbus'];

/** @type {import('next').NextConfig} */
const config = {
  // Expose deployment info to client-side for preview URL detection
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: DEPLOY_ENV,
    NEXT_PUBLIC_PREVIEW_BRANCH_URL:
      DEPLOY_ENV === 'preview' ? PREVIEW_BRANCH_URL : undefined,
    NEXT_PUBLIC_E2E: process.env.E2E,
  },
  images: {
    minimumCacheTTL: 31536000, // 1 year — assets are content-addressed
  },
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    resolveAlias: {
      // Disable the 'tls' module on the client side
      tls: { browser: '' },
      // In e2e mode, swap external services for in-process mocks so the app
      // never makes network calls to TipTap Cloud or PostHog.
      ...(process.env.E2E === 'true'
        ? {
            '@op/collab': '../../services/collab/__mocks__/index.ts',
            '@op/analytics/client':
              '../../packages/analytics/src/client.testing.ts',
          }
        : {}),
    },
  },
  // Webpack equivalent of the turbopack resolveAlias above. Both the production
  // build and e2e build use webpack (`next build --webpack`) because Turbopack's
  // per-route partial client-reference manifests cause intermittent "Could not
  // find module ... in the React Client Manifest" 500s on cross-route RSC
  // navigation (Asana 1213980160576009; bug entered with the Turbopack migration
  // #685). Webpack resolves client references across routes correctly. Dev still
  // uses Turbopack via the config above.
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    if (!isServer) {
      // Disable the 'tls' node core module on the client side.
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        tls: false,
      };
    }
    // In e2e mode, swap external services for in-process mocks on both the
    // server and client bundles (mirrors turbopack.resolveAlias, which is not
    // server/client-scoped) so SSR of these modules is mocked too.
    if (process.env.E2E === 'true') {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@op/collab': path.resolve(
          __dirname,
          '../../services/collab/__mocks__/index.ts',
        ),
        '@op/analytics/client': path.resolve(
          __dirname,
          '../../packages/analytics/src/client.testing.ts',
        ),
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async rewrites() {
    // On preview deployments, proxy tRPC to avoid cross-origin cookie issues
    // See packages/core/previews.mjs for the shared preview URL logic
    const previewApiUrl = getPreviewApiUrl(PREVIEW_BRANCH_URL);
    const previewApiRewrites = previewApiUrl
      ? [
          {
            source: '/api/v1/trpc/:path*',
            destination: `${previewApiUrl}/api/v1/trpc/:path*`,
          },
        ]
      : [];

    return [
      ...previewApiRewrites,
      // Vanity URL for decision processes: `/en/columbus` resolves to the same
      // page as `/en/decisions/columbus`. Allow-listed one slug at a time —
      // extend `VANITY_DECISION_SLUGS` when adding a new vanity process.
      {
        source: `/:locale(${SUPPORTED_LOCALES.join('|')})/:slug(${VANITY_DECISION_SLUGS.join('|')})/:path*`,
        destination: '/:locale/decisions/:slug/:path*',
      },
      {
        source: '/assets/:path*',
        destination: `${process.env.S3_ASSET_ROOT}/:path*`,
      },
      {
        source: '/stats/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/stats/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
      {
        source: '/stats/decide',
        destination: 'https://eu.i.posthog.com/decide',
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

const tryGit = (cmd) => {
  try {
    const { execSync } = require('child_process');
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const getGitInfo = () => ({
  branch:
    process.env.VERCEL_GIT_COMMIT_REF ??
    tryGit('git rev-parse --abbrev-ref HEAD'),
  sha: process.env.VERCEL_GIT_COMMIT_SHA ?? tryGit('git rev-parse HEAD'),
});

const { branch: currentBranch, sha: commitSha } = getGitInfo();
const allowedBranches = ['dev', 'main'];
const shouldUploadSourcemaps = allowedBranches.includes(currentBranch);

export default withPostHogConfig(withBundleAnalyzer(withNextIntl(config)), {
  personalApiKey: process.env.POSTHOG_API_KEY,
  envId: process.env.POSTHOG_ENV_ID,
  host: 'https://eu.i.posthog.com',
  sourcemaps: {
    enabled: shouldUploadSourcemaps,
    project: 'common',
    version: commitSha,
  },
});
