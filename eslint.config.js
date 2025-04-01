import { config } from '@op/eslint-config/base';

// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
export default config({
  tsconfigPath: './tsconfig.json',
}).append({
  ignores: [
    'apps/**',
    'packages/**',
    'services/**',
    'assets/**',
    'services/**',
  ],
});
