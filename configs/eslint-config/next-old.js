const { resolve } = require('path');

const rules = require('./rules');

const project = resolve(process.cwd(), 'tsconfig.json');

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'airbnb',
    'airbnb-typescript',
    'airbnb/hooks',
    require.resolve('@vercel/style-guide/eslint/next'),
    'plugin:workspaces/recommended',
    'eslint-config-turbo',
    'plugin:testing-library/react',
    'plugin:prettier/recommended',
    'prettier',
  ],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
    browser: true,
  },
  plugins: ['@typescript-eslint', 'import', 'react', 'prettier'],
  settings: {
    'import/resolver': {
      typescript: {
        project,
      },
    },
  },
  ignorePatterns: [
    // Ignore dotfiles
    '.*.js',
    'node_modules/',
  ],
  overrides: [{ files: ['*.js?(x)', '*.ts?(x)'] }],
  rules: {
    ...rules,
    '@next/next/no-html-link-for-pages': ['warn'],
    'import/extensions': ['warn', { jsx: 'ignorePackages' }],
    'react/no-unknown-property': [
      2,
      {
        ignore: ['jsx', 'global'],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ImportDeclaration[source.value=/^~icons.*[^.jsx]$/]',
        message: 'Imports from ~icons must end with .jsx',
      },
    ],
  },
};
