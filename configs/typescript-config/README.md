# `@op/typescript-config` Workspace

This workspace provides shareable TypeScript configurations (`tsconfig.json` base files) for use across the monorepo.

## Purpose

To ensure consistent TypeScript compiler options and settings across different types of projects within the monorepo, reducing boilerplate configuration in individual workspaces.

## Structure

This package contains several `tsconfig.*.json` files, each tailored for a specific environment or project type:

- **`base.json`**: A fundamental configuration with common settings inherited by others.
- **`bundler.json`**: Configuration for code compiled by a bundler (Vite) — the TanStack Start apps `apps/app` and `apps/api`, and the service/package workspaces they import.
- **`react-app.json`**: Configuration tailored for general React applications.
- **`react-library.json`**: Configuration for React component libraries (used by `packages/sense`, `packages/styles`, and `packages/hooks`).
- **`trpc.json`**: Configuration potentially designed for the tRPC service (`services/trpc`), but it is not currently used (it extends `bundler.json` instead).

These files contain TypeScript compiler options (`compilerOptions`).

## Relationship to Other Workspaces

**Depends On:**

- _(None in this monorepo)_

**Depended On By (Dev):**

- **`@op/core`**
- **`@op/db`**
- **`@op/emails`**
- **`@op/hooks`**
- **`@op/supabase`**
- **`@op/trpc`**
- **`apps/api`**
- **`apps/app`**

## Usage

In another workspace's `tsconfig.json` file:

```json
{
  "extends": "@op/typescript-config/bundler.json", // Or react-library.json, base.json, etc.
  "compilerOptions": {
    // Project-specific overrides or additions
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```
