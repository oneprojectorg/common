import { nextJsConfig } from '@op/eslint-config/next';

/** @type {import("eslint").Linter.Config} */
export default nextJsConfig;

// /** @type {import("eslint").Linter.Config} */
// module.exports = {
//   root: true,
//   extends: ['@op/eslint-config/react-internal.js'],
//   parser: '@typescript-eslint/parser',
//   parserOptions: {
//     project: `${__dirname}/tsconfig.json`,
//   },
//   settings: {
//     // 'import/parsers': {
//     //   '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts'],
//     // },
//     'import/resolver': {
//       typescript: {
//         alwaysTryTypes: true,
//         project: `${__dirname}/tsconfig.json`,
//       },
//     },
//   },
//   rules: {
//     'import/prefer-default-export': 'warn',
//     'jsx-a11y/heading-has-content': 'warn',
//     '@typescript-eslint/no-shadow': 'warn',
//     'import/extensions': 'warn',
//   },
// };
