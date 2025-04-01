import { nextJsConfig } from '@op/eslint-config/next';

/** @type {import("eslint").Linter.Config} */
export default nextJsConfig;

// module.exports = {
//   root: true,
//   extends: ['@op/eslint-config/base.js'],
//   parserOptions: {
//     project: `${__dirname}/tsconfig.json`,
//     ecmaVersion: 'latest',
//     sourceType: 'module',
//     ecmaFeatures: {
//       jsx: true,
//       experimentalObjectRestSpread: true,
//     },
//     allowImportExportEverywhere: true,
//   },
//   ignorePatterns: ['.eslintrc.js'],
//   rules: {
//     'import/no-extraneous-dependencies': [
//       'warn',
//       {
//         packageDir: `${__dirname}`,
//       },
//     ],
//     'import/prefer-default-export': 'off',
//     'import/no-cycle': 'off',
//     'import/order': [
//       'error',
//       {
//         pathGroups: [
//           {
//             pattern: '@/**',
//             group: 'external',
//             position: 'after',
//           },
//         ],
//       },
//     ],
//   },
//   settings: {
//     'import/parsers': {
//       '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts'],
//     },
//     'import/resolver': {
//       typescript: {
//         alwaysTryTypes: true,
//       },
//       //   alias: {
//       //     extensions: ['.js', '.jsx', '.ts', '.tsx'],
//       //     map: [['~', `${__dirname}/src`]],
//       //   },
//     },
//   },
// };
