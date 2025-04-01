import antfu from '@antfu/eslint-config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import packageJson from 'eslint-plugin-package-json/configs/recommended';
import turboPlugin from 'eslint-plugin-turbo';

import { baseRules } from './rules.js';

// mimic CommonJS variables -- not needed if using CommonJS
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

export const config = ({ tsconfigPath = '../../tsconfig.json' }) => {
  return antfu(
    {
      ignores: ['dist/**', 'public/**'],

      stylistic: {
        quotes: 'single',
        indent: 2,
        semi: true,
      },
      react: {
        overrides: {
          'antfu/top-level-function': 'off',
        },
      },
      jsonc: {
        ignores: ['**/node_modules/**', '**/dist/**', '**/public/**'],
      },
      // Disable linting for `code snippets` in Markdown files
      markdown: false,
      typescript: {
        tsconfigPath,
        parserOptions: {
          project: './tsconfig.json',
        },
      },
      formatters: {
        css: true,
        html: true,
        markdown: true,
        svg: true,
        xml: true,
        prettierOptions: {
          singleQuote: true,
          tabWidth: 2,
          semi: true,
          arrowParens: 'always',
          endOfLine: 'auto',
          printWidth: 80,
          trailingComma: 'all',
        },
      },
    },
    {
      // Remember to specify the file glob here, otherwise it might cause the vue plugin to handle non-vue files
      files: ['**/package.json'],
      rules: {
        'jsonc/sort-keys': 'off',
      },
    },
    {
      files: ['**/*.html'],
      rules: {
        'no-irregular-whitespace': 'off',
      },
    },
    {
      files: ['**/*.md/**'],
      languageOptions: {
        parserOptions: {
          project: null,
        },
      },
      rules: {
        'ts/no-unused-vars': 'off',
      },
    },
    {
      rules: {
        'node/prefer-global/process': ['off'],
        'unicorn/prefer-node-protocol': 'off',
        'ts/strict-boolean-expressions': 'off',
      },
    },
    {
      rules: {
        'no-console': 'off',
        'ts/no-unused-vars': 'error',
        'ts/no-unsafe-assignment': 'off',
        'ts/promise-function-async': 'off',
        'no-param-reassign': 'error',
        'style/no-tabs': 'off',
        'style/padded-blocks': ['error', { blocks: 'never' }],
        'style/no-multiple-empty-lines': ['error', { max: 1 }],
        'style/padding-line-between-statements': [
          'error',
          { blankLine: 'always', prev: '*', next: 'return' },
          { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
          { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
          { blankLine: 'always', prev: 'directive', next: '*' },
          { blankLine: 'any', prev: 'directive', next: 'directive' },
          { blankLine: 'always', prev: ['case', 'default'], next: '*' },
          { blankLine: 'always', prev: '*', next: ['block', 'block-like'] },
          { blankLine: 'always', prev: ['block', 'block-like'], next: '*' },
          { blankLine: 'always', prev: '*', next: ['enum', 'interface', 'type'] },
        ],
        'unicorn/empty-brace-spaces': 'error',
        'style/jsx-self-closing-comp': ['error', {
          component: true,
          html: true,
        }],
      },
    },
    {
      rules: {
        'ts/no-unused-vars': [
          'error',
          {
            args: 'all',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
      },
    },
    {
      plugins: {
        turbo: turboPlugin,
      },
    },
  ).append(packageJson, jsxA11y.flatConfigs.recommended, {
    rules: {
      ...baseRules,
      //   'react/function-component-definition': [
      //     2,
      //     {
      //       namedComponents: 'arrow-function',
      //       unnamedComponents: 'arrow-function',
      //     },
      //   ],
      //   'import/named': 'off',
      //   'no-underscore-dangle': 'off',
      //   'no-console': 'off',
      //   radix: 'off',
      //   'no-restricted-syntax': [
      //     'error',
      //     'ForInStatement',
      //     'LabeledStatement',
      //     'WithStatement',
      //   ],
      //   '@typescript-eslint/ban-ts-comment': 'warn',
      //   '@typescript-eslint/no-for-in-array': 'error',
      //   'import/no-unresolved': ['error', { ignore: ['~icons'] }],
    },
    // settings: {
    //   'import/parsers': {
    //     '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts'],
    //   },
    //   'import/resolver': {
    //     typescript: {
    //       alwaysTryTypes: true,
    //     },
    //   },
    // },
  });
};

// export const config = tseslint.config(
//   js.configs.recommended,
//   eslintConfigPrettier,
//   tseslint.configs.recommendedTypeChecked,
//   tseslint.configs.stylisticTypeChecked,
//   {
//     languageOptions: {
//       parserOptions: {
//         project: `./tsconfig.json`,
//         // tsconfigRootDir: __dirname,
//       },
//     },
//   },
//   importPlugin.flatConfigs.recommended,
//   importPlugin.flatConfigs.typescript,
//   importPlugin.flatConfigs.errors,
//   importPlugin.flatConfigs.warnings,
//   //   workspacesPlugin.configs.recommended,

//   //   ...compat.extends('plugin:workspaces/recommended'),
//   //   ...compat.extends('airbnb'),
//   //   ...compat.extends('airbnb-typescript'),

//   {
//     plugins: {
//       turbo: turboPlugin,
//     },
//     rules: {
//       'turbo/no-undeclared-env-vars': 'warn',
//     },
//   },
//   //   {
//   //     languageOptions: {
//   //       parserOptions: {
//   //         project: `./tsconfig.json`,
//   //         tsconfigRootDir: import.meta.dirname,
//   //       },
//   //     },
//   //   },
//   {
//     files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.mjsx', '**/*.cjs'],
//     extends: [tseslint.configs.disableTypeChecked],
//   },
//   {
//     ignores: ['dist/**', 'public/**'],
//   },
//   {
//     rules: {
//       'import/no-extraneous-dependencies': ['warn'],
//       'import/named': 'off',
//       'no-underscore-dangle': 'off',
//       'no-console': 'off',
//       radix: 'off',
//       'no-restricted-syntax': [
//         'error',
//         'ForInStatement',
//         'LabeledStatement',
//         'WithStatement',
//       ],
//       '@typescript-eslint/ban-ts-comment': 'warn',
//       '@typescript-eslint/no-for-in-array': 'error',
//       'no-restricted-syntax': [
//         'error',
//         {
//           selector: 'ImportDeclaration[source.value=/~icons.*[^.jsx]$/]',
//           message: 'Imports from ~icons must end with .jsx',
//         },
//       ],
//       'import/no-unresolved': ['error', { ignore: ['~icons'] }],
//     },
//     settings: {
//       'import/parsers': {
//         '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts'],
//       },
//       'import/resolver': {
//         typescript: {
//           alwaysTryTypes: true,
//         },
//       },
//     },
//   },
// );
