import path from 'path';

import pluginNext from '@next/eslint-plugin-next';
import tailwind from 'eslint-plugin-tailwindcss';

import { config as baseConfig } from './base.js';

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config}
 */
export const nextJsConfig = baseConfig({
  tsconfigPath: '../../tsconfig.json',
}).append(
  //   {
  //     //   ...pluginReact.configs.flat.recommended,
  //     languageOptions: {
  //       // ...pluginReact.configs.flat.recommended.languageOptions,
  //       globals: {
  //         ...globals.serviceworker,
  //       },
  //     },
  //   },

  {
    plugins: {
      '@next/next': pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
    },
  },
  //   {
  //     plugins: {
  //       'react-hooks': pluginReactHooks,
  //     },
  //     settings: { react: { version: 'detect' } },
  //     rules: {
  //       ...pluginReactHooks.configs.recommended.rules,
  //       // React scope no longer necessary with new JSX transform.
  //       'react/react-in-jsx-scope': 'off',
  //     },
  //   },
  ...tailwind.configs['flat/recommended'],
  {
    settings: {
      tailwindcss: {
        // These are the default values but feel free to customize
        callees: ['classnames', 'clsx', 'ctl', 'cn', 'tv'],
        config: (() => {
          const resolvedPath = path.resolve('./tailwind.config.ts');

          return resolvedPath;
        })(), // returned from `loadConfig()` utility if not provided
        cssFiles: [
          '**/*.css',
          '!**/node_modules',
          '!**/.*',
          '!**/dist',
          '!**/build',
        ],
        cssFilesRefreshRate: 5_000000,
        removeDuplicates: true,
        skipClassAttribute: false,
        whitelist: ['backglow', 'inset-shadow.*', 'better-scrollbar', 'border-glow.*'],
        tags: [], // can be set to e.g. ['tw'] for use in tw`bg-blue`
        classRegex: '^class(Name)?$', // can be modified to support custom attributes. E.g. "^tw$" for `twin.macro`
      },
    },
  },
);
