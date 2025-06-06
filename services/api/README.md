# `@op/trpc` Workspace

This workspace implements the application's API layer using [tRPC](https://trpc.io/), providing end-to-end type safety between the backend and frontend.

## Purpose

To define and expose backend procedures (queries and mutations) that can be called from the frontend in a fully type-safe manner. It acts as the primary interface for data fetching and manipulation.

## Structure

- **`src/`**: Contains the core tRPC implementation.
  - **`routers/`**: Holds different tRPC routers, organized by domain (e.g., `account.ts`, `llm.ts`). These are combined into the main `appRouter` exported from `src/routers/index.ts`.
  - **`middlewares/`**: Contains reusable tRPC middleware (e.g., `withLogger.ts`, `withAuthenticated.ts`).
  - **`trpcFactory.ts`**: Defines the `createContext` function (providing request ID, timestamp, IP, URL, cookie helpers) and initializes tRPC (`initTRPC`) with SuperJSON, exporting base router/middleware helpers and a `loggedProcedure`.
  - **`supabase/server.ts`**: Exports `createSBAdminClient` for creating Supabase admin clients using the service role key, leveraging context for cookie handling.
  - **`lib/`**: Contains helper utilities, such as `cookies.ts` for context-based cookie management and `error.ts` for error formatting.
  - **`TRPCProvider.tsx`**: A React component responsible for setting up the tRPC client (`@trpc/react-query`), React Query client (`@tanstack/react-query`), and query cache persistence to localStorage (`@tanstack/react-query-persist-client`) for the frontend (`apps/app`).
  - **`vanilla.ts`**: Exports a vanilla (non-React specific) tRPC client (`trpcVanilla`) using `createTRPCClient`, suitable for use in server-side scripts or non-React environments.
  - **`links.ts`**: Defines the shared tRPC links (including SuperJSON transformer and HTTP batch link configured with `OPURLConfig` from `@op/core`) used by both React and vanilla clients.
- **`index.ts`**: Re-exports the main tRPC application router (`appRouter` from `./routers`) and procedure helpers.

Key exports (`.`, `client` -> `TRPCProvider.tsx`, `vanilla`) are defined in `package.json`.

## Key Technologies

- **tRPC**: Framework for building type-safe APIs.
- **TypeScript**: Essential for tRPC's type safety benefits.
- **Zod**: Used for runtime validation of input data in tRPC procedures.
- **Drizzle ORM / `@op/db`**: Used within procedures to interact with the database.
- **`drizzle-zod`**: Generates Zod schemas from Drizzle schemas for validation.
- **`@op/supabase`**: Used for authentication (via server/admin clients created using context cookies) and accessing Supabase types (`@op/supabase/types`) and client creation helpers (`@op/supabase/lib`).
- **`@tanstack/react-query`**: Used on the client-side (`TRPCProvider.tsx`) for caching, state management, and interacting with tRPC procedures via `@trpc/react-query`.
- **`@tanstack/react-query-persist-client`**: Used to persist React Query cache (e.g., to local storage).
- **SuperJSON**: Handles serialization/deserialization of complex data types (like Dates) over the network.
- **AI SDK (`ai`, `@ai-sdk/anthropic`)**: Integrates with Anthropic models, exposed via the `llm` tRPC router (`src/routers/llm/chat.ts`).
- **`server-only`**: Ensures certain code (like `supabase/server.ts`) only runs on the server.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: Relies on the core package for shared configuration and constants (e.g., `OPURLConfig`, `cookieOptionsDomain`, `adminEmails`, `APP_NAME`).
- **`@op/db`**: Relies heavily on the database package for schema definitions and the database client (used within procedures/middleware, often via context augmentation not shown in `createContext` directly).
- **`@op/eslint-config` (Dev)**: Used for linting configuration during development.
- **`@op/supabase`**: Uses the Supabase package for client creation helpers (`@op/supabase/lib`), types (`@op/supabase/types`), and relies on its cookie handling logic for authentication state management.
- **`@op/typescript-config` (Dev)**: Used for TypeScript configuration during development.

**Depended On By:**

- **`apps/api`**: Hosts the tRPC router endpoint (`app/api/v1/trpc/[trpc]/route.ts`) and consumes the `appRouter` and `createContext` from this package.
- **`apps/app`**: Consumes the tRPC client via `TRPCProvider.tsx`.

## Development

- Run `pnpm lint` to lint and type-check the code.
- Development typically involves defining routers and procedures here and consuming them in `apps/app`. The tRPC server endpoint itself is hosted within `apps/api`.
