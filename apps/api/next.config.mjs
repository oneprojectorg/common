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
  webpack: (cfg) => {
    // In e2e mode, swap the real TipTap client for an in-process mock
    // so the API server never makes HTTP calls to TipTap Cloud.
    if (process.env.E2E === 'true') {
      cfg.resolve.alias = {
        ...cfg.resolve.alias,
        '@op/collab': '@op/collab/testing',
      };
    }

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

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return cfg;
  },
};

export default config;
