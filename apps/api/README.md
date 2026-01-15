# `api` Workspace (apps/api)

This workspace is a Next.js application that serves as the host for the tRPC API endpoint.

## Purpose

- **Host tRPC API**: Exposes the tRPC router defined in `@op/api` as an HTTP endpoint (`app/api/v1/trpc/[trpc]/route.ts`) that the frontend application (`apps/app`) can consume.

## Structure

As a Next.js application using the App Router, the structure includes:

- **`app/api/v1/trpc/[trpc]/route.ts`**: The main Next.js API route handler that uses `@trpc/server/adapters/fetch` to serve the tRPC router from `@op/api`.
- **`app/route.tsx`**: The root route redirects to the main application.
- **`next.config.mjs`**: Next.js configuration file.
- **`postcss.config.ts`**: Configuration for PostCSS and Tailwind CSS.

## Key Technologies

- **Next.js**: React framework used to build the API server.
- **tRPC**: Consumes the router from `@op/api` and uses the Next.js adapter to handle requests.
- **`@op/api`**: Provides the actual API logic and router definition, consumed by the tRPC route handlers.
- **`@op/supabase`**: Used for server-side Supabase client creation, utilized within the tRPC context.
- **dotenv**: Loads environment variables.

## Relationship to Other Workspaces

**Depends On:**

- **`@op/core`**: For shared configurations or utilities.
- **`@op/supabase`**: For server-side Supabase client utilities used in tRPC context/routes.
- **`@op/api`**: Consumes the tRPC router definition (`appRouter`) and context creation (`createContext`).
- **`@op/typescript-config` (Dev)**: For TypeScript configuration.

**Depended On By:**

- (Provides the API endpoint consumed by `apps/app` at runtime, but not a build dependency).

## Development

- Run `pnpm dev` to start the Next.js development server (usually on port 3300).
- Run `pnpm lint` to lint and type-check the code.
- Run `pnpm build` to create a production build.
- Run `pnpm start` to run the production build.
