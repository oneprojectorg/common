import analyzer from '@next/bundle-analyzer';
import { withPostHogConfig } from '@posthog/nextjs-config';
import dotenv from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';
import Icons from 'unplugin-icons/webpack';

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

/** @type {import('next').NextConfig} */
const config = {
  // Expose Vercel env vars to client-side for preview URL detection
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_BRANCH_URL:
      process.env.VERCEL_ENV === 'preview'
        ? process.env.VERCEL_BRANCH_URL
        : undefined,
  },
  experimental: {
    // reactCompiler: true,
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
    instrumentationHook: true,
  },

  webpack: (cfg, { isServer }) => {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = cfg.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    );

    cfg.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ['@svgr/webpack'],
      },
    );

    cfg.plugins.push(
      Icons({
        compiler: 'jsx',
        jsx: 'react',
      }),
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    if (!isServer) {
      cfg.resolve.fallback = {
        // Disable the 'tls' module on the client side
        tls: false,
      };
    }

    return cfg;
  },
  async rewrites() {
    // Compute preview API URL for proxy rewrite
    // On preview .vercel.app deployments, proxy tRPC to avoid cross-origin cookie issues
    const isPreview = process.env.VERCEL_ENV === 'preview';
    const branchUrl = process.env.VERCEL_BRANCH_URL;
    const isOnVercelApp = branchUrl?.endsWith('.vercel.app');

    let previewApiRewrites = [];
    if (isPreview && isOnVercelApp && branchUrl) {
      // Extract suffix: "app-git-branch-oneproject.vercel.app" -> "-git-branch-oneproject.vercel.app"
      // Validate it starts with "app" and ends with our team slug for security
      const match = branchUrl.match(/^app(-.*-oneproject\.vercel\.app)$/);
      if (match) {
        const apiUrl = `https://api${match[1]}`;
        previewApiRewrites = [
          {
            source: '/api/v1/trpc/:path*',
            destination: `${apiUrl}/api/v1/trpc/:path*`,
          },
        ];
      }
    }

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
