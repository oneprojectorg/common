# `@op/eslint-config` Workspace

This workspace provides shareable ESLint configurations for enforcing code style and quality across different workspaces in the monorepo.

## Purpose

To ensure consistent coding standards, catch potential errors, and improve code maintainability by providing centralized ESLint configurations tailored for various project types (e.g., base Node.js/TypeScript, React libraries, Next.js applications).

## Structure

This package exports multiple configuration files, intended to be extended in the individual `eslint.config.js` files of other workspaces:

- **`base.js`**: A foundational configuration, used as the base in the monorepo's root `eslint.config.js`.
- **`library.js`**: Configuration designed for library packages (like those in `packages/` or `services/`), although it doesn't appear to be actively used by any workspace currently.
- **`next.js`**: Configuration designed for Next.js applications but is currently used by most workspaces (`apps/*`, `packages/*`, `services/*`) as the primary shared config.
- **`react-internal.js`**: A configuration intended for internal React setups or component packages (`packages/hooks`, `packages/ui`), but it doesn't appear to be actively used.
- **`rules.js`**: Contains shared rule definitions used by other configs.
- **`base-old.js`, `next-old.js`**: Likely older versions of configurations, not actively used.

These configurations are built upon various ESLint plugins and base configurations listed in `devDependencies`.

## Key Technologies & Plugins

- **ESLint**: The core linting tool.
- **`@antfu/eslint-config`**: A popular, opinionated ESLint configuration preset.
- **`@vercel/style-guide`**: Vercel's ESLint and Prettier configurations.
- **`@eslint-react/eslint-plugin`**: ESLint rules for React.
- **`eslint-plugin-react-hooks`**: Enforces rules of Hooks.
- **`eslint-plugin-react-refresh`**: Rules for React Fast Refresh.
- **`@next/eslint-plugin-next`**: ESLint rules specific to Next.js.
- **`eslint-plugin-tailwindcss`**: Linting rules for Tailwind CSS class usage.
- **`eslint-plugin-jsx-a11y`**: Checks for accessibility issues in JSX.
- **`eslint-plugin-turbo`**: Rules related to Turborepo usage.
- **`eslint-plugin-astro` / `astro-eslint-parser`**: Support for linting Astro files.
- **`prettier-plugin-*`**: Prettier plugins used alongside ESLint for code formatting (though Prettier itself might be configured separately).

## Relationship to Other Workspaces

**Depends On:**

- _(None in this monorepo, only external devDependencies)_

**Depended On By (Dev):**

- **`@op/core`**
- **`@op/db`**
- **`@op/emails`**
- **`@op/hooks`**
- **`@op/supabase`**
- **`@op/trpc`**
- **`@op/ui`**
- **`apps/api`**
- **`apps/app`**

## Usage

In another workspace's ESLint configuration file (e.g., `eslint.config.js`):

```javascript
import { nextJsConfig } from '@op/eslint-config/next';

// or import { config as baseConfig } from '@op/eslint-config/base'; // Less common

export default [
  ...nextJsConfig,
  // ... any project-specific rules or overrides
];
```
