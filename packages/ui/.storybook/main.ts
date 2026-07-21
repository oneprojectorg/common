import type { StorybookConfig } from '@storybook/react-vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // First-class @op/sense stories, kept apart from the @op/ui stories so
    // they survive @op/ui's eventual deletion.
    '../stories-sense/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    getAbsolutePath('@storybook/addon-onboarding'),
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-themes'),
    getAbsolutePath('@storybook/addon-docs'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': resolve(__dirname, '../src'),
    };

    // Rollup drops module-level directives when bundling and warns once per
    // module — base-ui ships 'use client' in nearly every file. The directive
    // is meaningless in a Storybook (client-only) bundle; silence just that
    // warning and forward everything else.
    config.build = config.build || {};
    config.build.rollupOptions = config.build.rollupOptions || {};
    const previousOnwarn = config.build.rollupOptions.onwarn;
    config.build.rollupOptions.onwarn = (warning, warn) => {
      if (
        warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
        warning.message.includes('use client')
      ) {
        return;
      }
      if (previousOnwarn) {
        previousOnwarn(warning, warn);
      } else {
        warn(warning);
      }
    };

    return config;
  },
};

export default config;

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
