# `@op/core` Workspace

This workspace provides core utilities, configuration, and potentially shared types or constants for the monorepo.

## Purpose

This package serves as a foundational layer, offering shared functionality or configuration needed by various other workspaces within the project. It helps avoid code duplication and ensures consistency.

## Structure

- **`src/config.ts`**: Contains shared configuration values (ports, names, API paths), environment detection logic, URL generation functions (`OPURLConfig`), allowed domains/emails, and constants used across the monorepo.
- **`src/fulog.ts`**: Exports a custom logging utility class (`fulog`) providing methods for structured console logging with different levels (info, success, error, etc.), badges, and icons.

The main exports are defined in the `exports` field of `package.json`.

## Key Technologies

- **TypeScript**: For static typing.
- **p-queue**: A library for managing promise concurrency, suggesting this package might handle asynchronous operations or task queuing.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/eslint-config` (Dev)**: Used for linting configuration during development.
- **`@op/typescript-config` (Dev)**: Used for TypeScript configuration during development.

**Depended On By:**

- **`@op/db`**
- **`@op/emails`**
- **`@op/hooks`**
- **`@op/supabase`**
- **`@op/trpc`**
- **`@op/ui`**
- **`apps/api`**
- **`apps/app`**

## Development

- Run `pnpm lint` to lint and type-check the code.
- There might not be a specific `dev` script if this package primarily exports utilities/config.
