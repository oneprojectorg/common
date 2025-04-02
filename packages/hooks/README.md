# `@op/hooks` Workspace

This workspace provides a collection of reusable React hooks for use across the application.

## Purpose

The primary goal is to encapsulate common logic, state management, data fetching patterns, and interactions with browser APIs into reusable hooks. This promotes code reuse, separation of concerns, and easier testing.

## Structure

- **`src/`**: Contains the implementation of individual hooks (e.g., `useMediaQuery.tsx`).
- **`src/utils/`**: Holds utility functions specifically used by the hooks within this package.
- **`index.ts`**: Serves as the main entry point, likely re-exporting all the hooks provided by the package.

Specific hooks and utilities are made available through the `exports` map in `package.json`.

## Key Technologies

- **React**: The core library for building the hooks.
- **TypeScript**: For static typing.
- **@tanstack/react-query**: Used for managing server state, including data fetching, caching, and synchronization.
- **@op/supabase**: Contains hooks (e.g., `useAuthUser`, `useAuthLogout`) that use the client from `@op/supabase/client` to interact with Supabase, primarily for authentication.
- **js-cookie**: Utility used internally (e.g., in `src/utils/nukeCookies.ts`) for managing browser cookies, supporting Supabase auth persistence.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared configurations or utilities (e.g., `cookieDomains`, `OPURLConfig` used in `src/utils/nukeCookies.ts`).
- **`@op/eslint-config` (Dev)**: Used for linting configuration during development.
- **`@op/supabase`**: To interact with the Supabase backend client (specifically the browser client) and import Supabase types.
- **`@op/typescript-config` (Dev)**: Used for TypeScript configuration during development.

**Depended On By:**

- **`apps/app`**: Likely the main consumer of these hooks.

## Development

- Run `pnpm lint` to lint and type-check the code.
- Testing might involve using React Testing Library or similar tools, although no specific test script is present in the `package.json`.
- No specific test setup is currently configured in this package.
