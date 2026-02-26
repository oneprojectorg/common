import analyzer from '@next/bundle-analyzer';
import { getPreviewApiUrl } from '@op/core/previews';
import { withPostHogConfig } from '@posthog/nextjs-config';
import dotenv from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

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

/** @type {import('next').NextConfig} */
const config = {
  // Expose deployment info to client-side for preview URL detection
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: DEPLOY_ENV,
    NEXT_PUBLIC_PREVIEW_BRANCH_URL:
      DEPLOY_ENV === 'preview' ? PREVIEW_BRANCH_URL : undefined,
  },
  images: {
    minimumCacheTTL: 31536000, // 1 year — assets are content-addressed
  },
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
    resolveAlias: {
      // Disable the 'tls' module on the client side
      tls: { browser: '' },
      // In e2e mode, swap the real TipTap client for an in-process mock
      // so the server never makes HTTP calls to TipTap Cloud.
      ...(process.env.E2E === 'true'
        ? { '@op/collab': '@op/collab/testing' }
        : {}),
    },
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

// Get current git branch (works in both local dev and Vercel)
const getCurrentBranch = () => {
  // In Vercel, use VERCEL_GIT_COMMIT_REF
  if (process.env.VERCEL_GIT_COMMIT_REF) {
    return process.env.VERCEL_GIT_COMMIT_REF;
  }

  // Locally, try to get branch from git
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
};

const currentBranch = getCurrentBranch();
const allowedBranches = ['dev', 'main'];
const shouldUploadSourcemaps = allowedBranches.includes(currentBranch);

export default withPostHogConfig(withBundleAnalyzer(withNextIntl(config)), {
  personalApiKey: process.env.POSTHOG_API_KEY,
  envId: process.env.POSTHOG_ENV_ID,
  project: 'common',
  host: 'https://eu.i.posthog.com',
  sourcemaps: {
    enabled: shouldUploadSourcemaps,
  },
});
