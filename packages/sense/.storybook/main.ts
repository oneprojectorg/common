import type { StorybookConfig } from '@storybook/react-vite';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const config: StorybookConfig = {
  // Stories sit next to the component they document, so a component and its
  // docs move, rename, and get deleted together.
  stories: ['../src/components/**/*.stories.@(ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-themes'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-a11y'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  viteFinal: async (config) => {
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
      // Companion noise (vitejs/vite#15012): reporting the directive warning
      // trips a sourcemap lookup at the directive's position (1:0), which
      // emits a SOURCEMAP_ERROR per module. Only that position is filtered —
      // genuine sourcemap errors elsewhere still surface.
      if (
        warning.code === 'SOURCEMAP_ERROR' &&
        warning.loc?.line === 1 &&
        warning.loc?.column === 0
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
