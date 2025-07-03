import analyzer from '@next/bundle-analyzer';
import { withTranspiledWorkspacesForNext } from '@op/ui/tailwind-utils';
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
  experimental: {
    // reactCompiler: true,
    serverComponentsExternalPackages: [
      'sharp',
      'onnxruntime-node',
      'thread-stream',
      'pino',
      'pino-worker',
      '@axiomhq/pino',
    ],
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
    return [
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

export default withBundleAnalyzer(
  withNextIntl(withTranspiledWorkspacesForNext(config)),
);
// export default withPostHogConfig(
// withBundleAnalyzer(withNextIntl(withTranspiledWorkspacesForNext(config))),
// {
// posthog: {
// personalApiKey: process.env.POSTHOG_API_KEY,
// envId: process.env.POSTHOG_ENV_ID,
// project: 'common',
// host: 'https://eu.i.posthog.com',
// },
// },
// );
